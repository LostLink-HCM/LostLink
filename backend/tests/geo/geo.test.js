const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const env = require('../../src/config/env')
const { clearCache, ensureInHcm } = require('../../src/services/vietmapService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const HCM = 12
// Mã thật của VietMap (địa giới cũ), đã đối chiếu bằng reverse/v4 tại Dĩ An
const BINH_DUONG = 23

// Cấp hành chính kiểu VietMap: type 0 = tỉnh/thành, 1 = quận/huyện, 2 = phường/xã
const boundaries = (cityId, district) => [
  { type: 2, id: 2601, name: 'Bến Nghé', prefix: 'Phường', full_name: 'Phường Bến Nghé' },
  { type: 1, id: 760, name: '1', prefix: 'Quận', full_name: district },
  { type: 0, id: cityId, name: 'Hồ Chí Minh', prefix: 'Thành Phố', full_name: 'TP Hồ Chí Minh' },
]

const suggestion = (refId, cityId = HCM, district = 'Quận 1') => ({
  ref_id: refId,
  name: `Địa điểm ${refId}`,
  address: `Địa chỉ ${refId}`,
  display: `Địa điểm ${refId}, Địa chỉ ${refId}`,
  boundaries: boundaries(cityId, district),
})

let fetchMock

// Giả lập VietMap: trả body (JSON) với mã HTTP cho mọi lần gọi
const vietmapReturns = (body, status = 200) => {
  fetchMock = mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify(body), { status })
  )
  return fetchMock
}

const calledUrl = (n = 0) => fetchMock.mock.calls[n].arguments[0]

let get

beforeEach(async () => {
  await createUser()
  const { client, accessToken } = await loginAs()
  get = (path) => client.get(path).set('Authorization', `Bearer ${accessToken}`)
})

afterEach(() => {
  fetchMock?.mock.restore()
  fetchMock = undefined
  clearCache()
})

const assertOutsideHcm = (res) => {
  assert.equal(res.status, 422)
  assert.equal(res.body.code, 'OUTSIDE_HCM')
  assert.equal(
    res.body.message,
    'Vị trí nằm ngoài TP.HCM. LostLink hiện chỉ hỗ trợ khu vực TP.HCM.'
  )
}

describe('API bản đồ: chỉ cho người đã đăng nhập', () => {
  test('Guest gọi gợi ý địa chỉ bị từ chối, không tốn lượt VietMap', async () => {
    const fetch = vietmapReturns([])
    const res = await newClient().get('/api/geo/search?text=ben thanh')

    assert.equal(res.status, 401)
    assert.equal(fetch.mock.callCount(), 0)
  })
})

describe('Tìm địa chỉ trong TP.HCM', () => {
  test('gửi key, lọc TP.HCM cũ phía VietMap và chỉ trả kết quả thuộc TP.HCM', async () => {
    vietmapReturns([
      suggestion('hcm-1'),
      suggestion('binh-duong', BINH_DUONG, 'Thành phố Dĩ An'),
      suggestion('hcm-2', HCM, 'Huyện Củ Chi'),
      // Quận 2 đã nhập vào TP Thủ Đức, không còn trong danh sách khu vực nên area để trống
      suggestion('hcm-3', HCM, 'Quận 2'),
    ])

    const res = await get('/api/geo/search?text=  Ben Thanh ')

    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.data.map((item) => [item.refId, item.district, item.area]),
      [
        ['hcm-1', 'Quận 1', 'Quận 1'],
        ['hcm-2', 'Huyện Củ Chi', 'Huyện Củ Chi'],
        ['hcm-3', 'Quận 2', ''],
      ]
    )

    const url = calledUrl()
    assert.equal(url.origin + url.pathname, 'https://maps.vietmap.vn/api/autocomplete/v4')
    assert.equal(url.searchParams.get('apikey'), 'test-vietmap-key')
    assert.equal(url.searchParams.get('text'), 'Ben Thanh')
    assert.equal(url.searchParams.get('cityId'), String(HCM))
    assert.equal(url.searchParams.get('display_type'), '6')
    assert.match(url.searchParams.get('focus'), /^10\.\d+,106\.\d+$/)
    // key của server không bao giờ xuất hiện trong phản hồi
    assert.doesNotMatch(JSON.stringify(res.body), /test-vietmap-key/)
  })

  test('tối đa 5 gợi ý', async () => {
    vietmapReturns(Array.from({ length: 8 }, (_, i) => suggestion(`p${i}`)))

    const res = await get('/api/geo/search?text=nguyen hue')

    assert.equal(res.body.data.length, 5)
  })

  test('cùng từ khoá (khác hoa thường) chỉ gọi VietMap một lần', async () => {
    const fetch = vietmapReturns([suggestion('hcm-1')])

    await get('/api/geo/search?text=ben thanh')
    const res = await get('/api/geo/search?text=BEN THANH')

    assert.equal(res.status, 200)
    assert.equal(res.body.data[0].refId, 'hcm-1')
    assert.equal(fetch.mock.callCount(), 1)
  })

  test('từ khoá quá ngắn hoặc gửi lặp tham số bị từ chối, không gọi VietMap', async () => {
    const fetch = vietmapReturns([])

    for (const query of ['text=a', 'text=', 'text=ben&text=thanh', '']) {
      const res = await get(`/api/geo/search?${query}`)
      assert.equal(res.status, 422, query)
      assert.equal(res.body.details[0].field, 'text')
    }
    assert.equal(fetch.mock.callCount(), 0)
  })
})

describe('VietMap gặp sự cố', () => {
  test('VietMap trả lỗi HTTP thì báo MAP_UNAVAILABLE', async () => {
    vietmapReturns({ message: 'Invalid apikey' }, 401)

    const res = await get('/api/geo/search?text=ben thanh')

    assert.equal(res.status, 503)
    assert.equal(res.body.code, 'MAP_UNAVAILABLE')
    assert.equal(res.body.message, 'Dịch vụ bản đồ đang gián đoạn, vui lòng thử lại sau.')
  })

  test('mất kết nối hoặc quá thời gian chờ thì báo MAP_UNAVAILABLE, lần sau gọi lại', async () => {
    fetchMock = mock.method(globalThis, 'fetch', async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })

    const res = await get('/api/geo/search?text=ben thanh')
    assert.equal(res.status, 503)
    assert.equal(res.body.code, 'MAP_UNAVAILABLE')

    // lỗi không bị cache
    fetchMock.mock.restore()
    vietmapReturns([suggestion('hcm-1')])
    const retry = await get('/api/geo/search?text=ben thanh')
    assert.equal(retry.status, 200)
  })

  test('server chưa cấu hình key thì báo MAP_UNAVAILABLE, không gọi VietMap', async (t) => {
    const fetch = vietmapReturns([])
    const original = env.vietmap.apiKey
    env.vietmap.apiKey = ''
    t.after(() => {
      env.vietmap.apiKey = original
    })

    const res = await get('/api/geo/search?text=ben thanh')

    assert.equal(res.status, 503)
    assert.equal(res.body.code, 'MAP_UNAVAILABLE')
    assert.equal(fetch.mock.callCount(), 0)
  })
})

describe('Toạ độ của gợi ý đã chọn', () => {
  test('trả toạ độ của địa điểm trong TP.HCM', async () => {
    vietmapReturns({
      name: 'Chợ Bến Thành',
      display: 'Chợ Bến Thành, Quận 1',
      lat: 10.7725,
      lng: 106.698,
    })

    const res = await get('/api/geo/place?refId=geocode:abc')

    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, {
      lat: 10.7725,
      lng: 106.698,
      name: 'Chợ Bến Thành',
      display: 'Chợ Bến Thành, Quận 1',
    })
    assert.equal(calledUrl().pathname, '/api/place/v4')
    assert.equal(calledUrl().searchParams.get('refid'), 'geocode:abc')
  })

  test('địa điểm ngoài TP.HCM (Hà Nội) bị từ chối', async () => {
    vietmapReturns({ name: 'Hồ Gươm', lat: 21.0287, lng: 105.8523 })

    assertOutsideHcm(await get('/api/geo/place?refId=geocode:hanoi'))
  })

  test('VietMap không có toạ độ thì báo không tìm thấy', async () => {
    vietmapReturns({})

    const res = await get('/api/geo/place?refId=geocode:missing')

    assert.equal(res.status, 404)
    assert.equal(res.body.code, 'PLACE_NOT_FOUND')
  })
})

describe('Địa chỉ của toạ độ GPS hoặc ghim', () => {
  test('toạ độ trong TP.HCM: trả địa chỉ và điền sẵn khu vực', async () => {
    vietmapReturns([
      {
        name: 'Chợ Bến Thành',
        address: 'Lê Lợi, Phường Bến Nghé, Quận 1',
        display: 'Chợ Bến Thành, Lê Lợi, Phường Bến Nghé, Quận 1',
        boundaries: boundaries(HCM, 'Quận 1'),
      },
    ])

    const res = await get('/api/geo/reverse?lat=10.77250123&lng=106.6980049')

    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, {
      lat: 10.7725,
      lng: 106.698,
      name: 'Chợ Bến Thành',
      address: 'Lê Lợi, Phường Bến Nghé, Quận 1',
      display: 'Chợ Bến Thành, Lê Lợi, Phường Bến Nghé, Quận 1',
      place: 'Chợ Bến Thành, Phường Bến Nghé, Quận 1',
      detail: 'Chợ Bến Thành, Phường Bến Nghé, Quận 1',
      district: 'Quận 1',
      area: 'Quận 1',
    })
    const url = calledUrl()
    assert.equal(url.pathname, '/api/reverse/v4')
    assert.equal(url.searchParams.get('lat'), '10.7725')
    assert.equal(url.searchParams.get('display_type'), '6')
  })

  test('địa điểm công khai: địa chỉ thường bỏ số nhà, địa danh giữ nguyên tên', async () => {
    const ward = 'Phường Bến Nghé, Quận 1'
    // [tên VietMap trả, categories, địa điểm công khai, địa chỉ đầy đủ cho người đang soạn bài]
    const cases = [
      [
        '47/29/39 Trần Quốc Toản',
        [],
        `Trần Quốc Toản, ${ward}`,
        `47/29/39 Trần Quốc Toản, ${ward}`,
      ],
      ['21-23 Phan Chu Trinh', [], `Phan Chu Trinh, ${ward}`, `21-23 Phan Chu Trinh, ${ward}`],
      ['12A Lê Lợi', [], `Lê Lợi, ${ward}`, `12A Lê Lợi, ${ward}`],
      // Số nhà có chữ cái đứng trước
      ['M789/778 Nguyễn Kiệm', [], `Nguyễn Kiệm, ${ward}`, `M789/778 Nguyễn Kiệm, ${ward}`],
      ['1C Phạm Văn Hai', [], `Phạm Văn Hai, ${ward}`, `1C Phạm Văn Hai, ${ward}`],
      // Plus Code (điểm không có địa chỉ) thì chỉ còn phường, quận
      ['7P28RM95+CG', [], ward, ward],
      ['Lotteria Crescent Mall', ['1002'], `Lotteria Crescent Mall, ${ward}`],
      // Địa danh có số trong tên vẫn giữ nguyên
      ['7-Eleven Lê Lợi', ['1000'], `7-Eleven Lê Lợi, ${ward}`],
    ]
    for (const [index, [name, categories, place, detail = place]] of cases.entries()) {
      vietmapReturns([{ name, categories, boundaries: boundaries(HCM, 'Quận 1') }])
      const res = await get(`/api/geo/reverse?lat=10.77${index}&lng=106.698`)
      assert.equal(res.body.data.place, place, name)
      assert.equal(res.body.data.detail, detail, name)
      fetchMock.mock.restore()
    }
  })

  test('toạ độ ở xa TP.HCM bị từ chối ngay, không tốn lượt VietMap', async () => {
    const fetch = vietmapReturns([])

    // Hà Nội, Vũng Tàu, Côn Đảo (Côn Đảo thuộc TP.HCM mới, không thuộc TP.HCM cũ)
    for (const [lat, lng] of [
      [21.0287, 105.8523],
      [10.346, 107.0843],
      [8.6833, 106.6083],
    ]) {
      assertOutsideHcm(await get(`/api/geo/reverse?lat=${lat}&lng=${lng}`))
    }
    assert.equal(fetch.mock.callCount(), 0)
  })

  test('trong khung TP.HCM nhưng VietMap xác định thuộc tỉnh khác (Dĩ An) thì bị từ chối', async () => {
    vietmapReturns([{ name: 'Dĩ An', boundaries: boundaries(BINH_DUONG, 'Thành phố Dĩ An') }])

    assertOutsideHcm(await get('/api/geo/reverse?lat=10.9067&lng=106.7694'))
  })

  test('VietMap không trả địa chỉ nào thì coi như ngoài TP.HCM', async () => {
    vietmapReturns([])

    assertOutsideHcm(await get('/api/geo/reverse?lat=10.5&lng=106.95'))
  })

  test('toạ độ sai định dạng bị từ chối', async () => {
    const fetch = vietmapReturns([])

    for (const query of ['lat=abc&lng=106.7', 'lat=10.7', 'lat=95&lng=106.7', 'lat=10.7&lng=200']) {
      const res = await get(`/api/geo/reverse?${query}`)
      assert.equal(res.status, 422, query)
    }
    assert.equal(fetch.mock.callCount(), 0)
  })
})

describe('Kiểm tra vị trí khi đăng bài', () => {
  test('VietMap gián đoạn: toạ độ trong khung TP.HCM vẫn được chấp nhận', async (t) => {
    t.mock.method(console, 'warn', () => {})
    vietmapReturns({ message: 'Service Unavailable' }, 503)

    assert.equal(await ensureInHcm(10.7725, 106.698), null)
  })

  test('trả khu vực của toạ độ để lưu vào bài', async () => {
    vietmapReturns([{ name: 'Chợ Bến Thành', boundaries: boundaries(HCM, 'Quận 1') }])

    assert.deepEqual(await ensureInHcm(10.7725, 106.698), {
      area: 'Quận 1',
      place: 'Chợ Bến Thành, Phường Bến Nghé, Quận 1',
      detail: 'Chợ Bến Thành, Phường Bến Nghé, Quận 1',
    })
  })

  test('VietMap gián đoạn: toạ độ ngoài khung vẫn bị từ chối', async () => {
    vietmapReturns({ message: 'Service Unavailable' }, 503)

    await assert.rejects(ensureInHcm(21.0287, 105.8523), { errorCode: 'OUTSIDE_HCM' })
  })

  test('VietMap xác định thuộc tỉnh khác thì bị từ chối', async () => {
    vietmapReturns([{ name: 'Dĩ An', boundaries: boundaries(BINH_DUONG, 'Thành phố Dĩ An') }])

    await assert.rejects(ensureInHcm(10.9067, 106.7694), {
      errorCode: 'OUTSIDE_HCM',
      details: [
        {
          field: 'location',
          message: 'Vị trí nằm ngoài TP.HCM. LostLink hiện chỉ hỗ trợ khu vực TP.HCM.',
        },
      ],
    })
  })
})
