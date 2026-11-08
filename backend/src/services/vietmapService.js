const { AREAS } = require('../config/areas')
const env = require('../config/env')
const { HCM_CENTER, HCM_CITY_ID, isInHcmBounds } = require('../config/hcm')
const ApiError = require('../utils/ApiError')

// Gọi VietMap Maps API v4 từ server để key không lộ xuống trình duyệt.
// Mỗi lần gọi autocomplete/place/reverse tính 1 transaction nên có cache và loại sớm
// toạ độ ở xa TP.HCM trước khi gọi
const BASE_URL = 'https://maps.vietmap.vn/api'
const TIMEOUT_MS = 5000
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 500
const MAX_SUGGESTIONS = 5
// display_type=6: kết quả chính theo địa giới cũ (phường, quận, thành phố), địa giới mới nằm ở data_new
const DISPLAY_OLD_AND_NEW = 6
// Làm tròn toạ độ còn khoảng 1 m để các lần chọn gần trùng nhau dùng lại cache
const COORD_DECIMALS = 5

const mapUnavailable = (cause) => {
  const error = new ApiError(
    503,
    'Dịch vụ bản đồ đang gián đoạn, vui lòng thử lại sau.',
    undefined,
    'MAP_UNAVAILABLE'
  )
  error.cause = cause
  return error
}

const OUTSIDE_HCM_MESSAGE = 'Vị trí nằm ngoài TP.HCM. LostLink hiện chỉ hỗ trợ khu vực TP.HCM.'

// details trỏ về field location để form đăng bài hiện lỗi ở đúng bước Vị trí
const outsideHcm = () =>
  new ApiError(
    422,
    OUTSIDE_HCM_MESSAGE,
    [{ field: 'location', message: OUTSIDE_HCM_MESSAGE }],
    'OUTSIDE_HCM'
  )

// Cache trong bộ nhớ, hết hạn sau CACHE_TTL_MS, đầy thì bỏ mục cũ nhất.
// Chỉ lưu kết quả thành công, lỗi thì lần sau gọi lại VietMap
const cache = new Map()

const cached = async (key, load) => {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const value = await load()
  cache.delete(key)
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  if (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value)
  return value
}

const clearCache = () => cache.clear()

// Không đưa URL vào thông báo lỗi vì URL chứa apikey
const callVietmap = async (path, params) => {
  if (!env.vietmap.apiKey) throw mapUnavailable(new Error('VIETMAP_API_KEY chưa được cấu hình'))

  const url = new URL(`${BASE_URL}${path}`)
  url.search = new URLSearchParams({ apikey: env.vietmap.apiKey, ...params })

  let res
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    throw mapUnavailable(new Error(`VietMap ${path} không phản hồi: ${error.name}`))
  }
  if (!res.ok) throw mapUnavailable(new Error(`VietMap ${path} trả về HTTP ${res.status}`))

  try {
    return await res.json()
  } catch {
    throw mapUnavailable(new Error(`VietMap ${path} trả về dữ liệu không phải JSON`))
  }
}

const asArray = (value) => (Array.isArray(value) ? value : [])

// boundaries: danh sách cấp hành chính, type 0 = tỉnh/thành, 1 = quận/huyện, 2 = phường/xã
const boundaryOf = (item, type) => asArray(item?.boundaries).find((b) => b?.type === type)

const isHcmResult = (item) => boundaryOf(item, 0)?.id === HCM_CITY_ID

const districtOf = (item) => {
  const district = boundaryOf(item, 1)
  if (!district) return ''
  return district.full_name || [district.prefix, district.name].filter(Boolean).join(' ')
}

// Khu vực dùng cho bộ lọc bài đăng, chỉ điền khi quận nằm trong danh sách AREAS
const areaOf = (district) => (AREAS.includes(district) ? district : '')

// Số nhà ở đầu tên địa chỉ: 7, 21-23, 47/29/39, 12A, 123B/4, M789/778 (có chữ cái đứng trước)
const HOUSE_NUMBER = /^[A-Za-z]{0,2}\d[\dA-Za-z/-]*\s+/
// Mã Plus Code VietMap trả khi điểm không có địa chỉ (vd trong sân bay): 7P28RM95+CG
const PLUS_CODE = /^[2-9CFGHJMPQRVWX]{4,8}\+[2-9CFGHJMPQRVWX]{2,3}$/i

// Plus Code vô nghĩa với người đọc nên bỏ, chỉ còn phường, quận
const placeText = (head, item) =>
  [PLUS_CODE.test(head) ? '' : head, boundaryOf(item, 2)?.full_name ?? '', districtOf(item)]
    .filter(Boolean)
    .join(', ')

// Địa chỉ đầy đủ (có số nhà): "47/29/39 Trần Quốc Toản, Phường Võ Thị Sáu, Quận 3".
// Người đăng thấy bản này khi soạn bài; đoạn đường cũng hiện bản này trên bài công khai
const detailPlaceOf = (item) => placeText((item.name ?? '').trim(), item)

// Dòng "Địa điểm" của ghim trên bài công khai: tên đường (bỏ số nhà) hoặc tên địa danh, phường,
// quận. Địa danh (có categories, vd Lotteria Crescent Mall) giữ nguyên tên; địa chỉ thường bỏ số
// nhà để không lộ nhà riêng hay nơi làm việc của người đăng
const publicPlaceOf = (item) => {
  const name = (item.name ?? '').trim()
  const isLandmark = asArray(item.categories).length > 0
  return placeText(isLandmark ? name : name.replace(HOUSE_NUMBER, '').trim(), item)
}

const roundCoord = (value) => Number(value.toFixed(COORD_DECIMALS))

// Tìm địa chỉ (người dùng bấm Tìm), chỉ trả kết quả thuộc TP.HCM cũ. Dùng autocomplete/v4
// vì tài khoản Trial không giới hạn lượt/ngày cho API này, khác với search/v4.
// cityId lọc ngay phía VietMap, lọc lại theo boundaries phòng khi VietMap bỏ qua tham số
const searchPlaces = (text) =>
  cached(`search:${text.toLowerCase()}`, async () => {
    const results = await callVietmap('/autocomplete/v4', {
      text,
      focus: `${HCM_CENTER.lat},${HCM_CENTER.lng}`,
      cityId: HCM_CITY_ID,
      display_type: DISPLAY_OLD_AND_NEW,
    })
    return asArray(results)
      .filter((item) => item?.ref_id && isHcmResult(item))
      .slice(0, MAX_SUGGESTIONS)
      .map((item) => {
        const district = districtOf(item)
        return {
          refId: item.ref_id,
          name: item.name ?? '',
          address: item.address ?? '',
          display: item.display ?? item.name ?? '',
          place: publicPlaceOf(item),
          detail: detailPlaceOf(item),
          district,
          area: areaOf(district),
        }
      })
  })

// Toạ độ của một kết quả tìm kiếm đã chọn. ref_id có từ display_type=6 thì Place trả địa giới mới
// (không có quận) nên ở đây chỉ kiểm tra khung TP.HCM; kiểm tra chặt dùng reverseGeocode
const place = (refId) =>
  cached(`place:${refId}`, async () => {
    const item = await callVietmap('/place/v4', { refid: refId })
    const lat = Number(item?.lat)
    const lng = Number(item?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ApiError(404, 'Không tìm thấy địa điểm.', undefined, 'PLACE_NOT_FOUND')
    }
    if (!isInHcmBounds(lat, lng)) throw outsideHcm()
    return {
      lat,
      lng,
      name: item.name ?? '',
      display: item.display ?? '',
    }
  })

// Địa chỉ của một toạ độ (GPS, kéo ghim), đồng thời là bước xác nhận toạ độ thuộc TP.HCM cũ:
// ngoài khung thì từ chối luôn không gọi VietMap, trong khung thì dựa vào city_id
const reverseGeocode = async (lat, lng) => {
  if (!isInHcmBounds(lat, lng)) throw outsideHcm()

  const point = { lat: roundCoord(lat), lng: roundCoord(lng) }
  return cached(`reverse:${point.lat},${point.lng}`, async () => {
    const [item] = asArray(
      await callVietmap('/reverse/v4', { ...point, display_type: DISPLAY_OLD_AND_NEW })
    )
    if (!item || !isHcmResult(item)) throw outsideHcm()

    const district = districtOf(item)
    return {
      ...point,
      name: item.name ?? '',
      address: item.address ?? '',
      display: item.display ?? '',
      place: publicPlaceOf(item),
      detail: detailPlaceOf(item),
      district,
      area: areaOf(district),
    }
  })
}

// Kiểm tra toạ độ trước khi lưu bài đăng, ngoài TP.HCM thì báo OUTSIDE_HCM (422).
// Trả về khu vực (quận, huyện; quận không có trong danh sách thì ''), địa điểm công khai (bỏ số
// nhà) và địa chỉ đầy đủ.
// VietMap gián đoạn thì chấp nhận toạ độ đã nằm trong khung TP.HCM (bước đầu của
// reverseGeocode) và trả null để dùng khu vực người dùng chọn; bài còn qua Moderator duyệt
const ensureInHcm = async (lat, lng) => {
  try {
    const { area, place, detail } = await reverseGeocode(lat, lng)
    return { area, place, detail }
  } catch (error) {
    if (error.errorCode !== 'MAP_UNAVAILABLE') throw error
    console.warn('VietMap gián đoạn, chỉ kiểm tra toạ độ theo khung TP.HCM:', error.cause?.message)
    return null
  }
}

module.exports = { searchPlaces, place, reverseGeocode, ensureInHcm, clearCache }
