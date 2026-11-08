import { Fragment, lazy, Suspense, useId, useRef, useState } from 'react'
import { getPlace, reversePoint, searchPlaces } from '../../../api/geo'
import { AREAS } from '../../../data/homeFeed'
import { distanceMeters, formatDistance } from '../../../lib/user/composePost'
import Icon from '../../common/Icon'
import Button from '../Button'
import Note from '../Note'
import { cx, focusRing } from '../classes'
import { chipClass, inputClass, labelClass } from './styles'
import { FieldError, RequiredMark, StepHeading } from './ui'

// Thư viện bản đồ khá nặng nên chỉ tải khi tới bước Vị trí
const VietMapView = lazy(() => import('./VietMapView'))

const SEARCH_MIN = 2
// GPS lệch hơn mức này thì nhắc kéo ghim lại
const GPS_ACCURACY_WARN_M = 100
const OUTSIDE_MESSAGE = 'Điểm này nằm ngoài TP.HCM. LostLink hiện chỉ hỗ trợ khu vực TP.HCM.'

const gpsMessage = (error) =>
  error.code === error.PERMISSION_DENIED
    ? 'Bạn đã từ chối quyền truy cập vị trí. Hãy tìm địa chỉ hoặc bấm lên bản đồ để đặt ghim.'
    : 'Không lấy được vị trí của bạn. Hãy thử lại, tìm địa chỉ hoặc bấm lên bản đồ.'

const geoMessage = (error) => (error.code === 'OUTSIDE_HCM' ? OUTSIDE_MESSAGE : error.message)

// Đặt địa điểm cho một đầu đoạn đường (0: điểm đầu, 1: điểm cuối)
const withPlace = (places, index, place) => {
  const next = [places[0] ?? '', places[1] ?? '']
  next[index] = place
  return next
}

// Khu vực lưu riêng cho ghim và đoạn đường, bật/tắt đoạn đường không phải hỏi lại VietMap
const areaFields = (current, slot, area, auto) => {
  const forRoad = slot !== 'point'
  const saved = forRoad
    ? { roadArea: area, roadAreaAuto: auto }
    : { pointArea: area, pointAreaAuto: auto }
  const active = (current.mode === 'road') === forRoad
  return active ? { ...saved, area, areaAuto: auto } : saved
}

function MapFallback() {
  return (
    <div className="grid h-72 place-items-center rounded-2xl border border-line bg-surface-muted text-caption text-ink-muted sm:h-96">
      Đang tải bản đồ…
    </div>
  )
}

// Gợi ý phía trên bản đồ theo thao tác đang làm
function hintOf(location) {
  if (location.mode === 'road') {
    if (location.road.length === 0) return 'Bấm lên bản đồ để chọn điểm đầu của đoạn đường.'
    if (location.road.length === 1) return 'Bấm tiếp để chọn điểm cuối của đoạn đường.'
    return 'Kéo hai đầu để chỉnh cho đúng đoạn đường, hoặc bấm Vẽ lại.'
  }
  if (!location.point) {
    return 'Tìm địa chỉ, dùng vị trí của bạn, hoặc bấm lên bản đồ để đặt ghim.'
  }
  return 'Kéo ghim để chỉnh lại cho đúng chỗ.'
}

// Tìm địa chỉ, GPS hay bấm bản đồ đều đặt cùng một ghim kéo được; đoạn đường là hai đầu mút.
// Chỉ tìm khi bấm Tìm, lỗi chỉ hiện khi bấm Tiếp tục
export default function LocationStep({ type, location, errors, onChange }) {
  const id = useId()
  const [locating, setLocating] = useState(false)
  // Thông báo sau thao tác: từ chối GPS, ngoài TP.HCM, lỗi tìm kiếm
  const [notice, setNotice] = useState(null)
  const [search, setSearch] = useState({ status: 'idle', results: [] })
  const [choosing, setChoosing] = useState('')
  const [satellite, setSatellite] = useState(false)
  // Điểm đang chờ VietMap trả địa chỉ: 'point', 0, 1
  const [pending, setPending] = useState({})

  // Mỗi điểm chỉ nhận kết quả của lần hỏi mới nhất
  const requestRef = useRef({})
  // Đầu nào của đoạn đường đang ở ngoài TP.HCM
  const roadOutsideRef = useRef([false, false])

  const lost = type === 'lost'
  const roadMode = location.mode === 'road'
  const hasLocation = roadMode ? location.road.length > 0 : Boolean(location.point)
  const areaPending = Boolean(roadMode ? pending[0] : pending.point)
  // Chỉ cho chọn khu vực tay khi không tự nhận được theo vị trí
  const showAreaSelect = hasLocation && !areaPending && !(location.areaAuto && location.area)

  const describe = async (point, slot, { keepPlace = false } = {}) => {
    const request = (requestRef.current[slot] = (requestRef.current[slot] ?? 0) + 1)
    const latest = () => requestRef.current[slot] === request
    const setsArea = slot === 'point' || slot === 0
    setPending((prev) => ({ ...prev, [slot]: true }))
    try {
      const { data } = await reversePoint(point)
      if (!latest()) return
      // Người đăng thấy địa chỉ đầy đủ, bản công khai do server tạo
      const place = data.detail || ''
      if (slot !== 'point') roadOutsideRef.current[slot] = false
      onChange((current) => ({
        ...(setsArea && areaFields(current, slot, data.area || '', Boolean(data.area))),
        ...(slot === 'point'
          ? { pointOutside: false, ...(!keepPlace && { place }) }
          : {
              roadOutside: roadOutsideRef.current.some(Boolean),
              ...(!keepPlace && { roadPlaces: withPlace(current.roadPlaces, slot, place) }),
            }),
      }))
    } catch (error) {
      if (!latest()) return
      const outside = error.code === 'OUTSIDE_HCM'
      // Không rõ khu vực thì cho chọn tay; ngoài TP.HCM thì giữ điểm và tô đỏ
      if (slot !== 'point' && outside) roadOutsideRef.current[slot] = true
      onChange((current) => ({
        ...(setsArea && areaFields(current, slot, '', false)),
        ...(slot === 'point'
          ? { ...(!keepPlace && { place: '' }), ...(outside && { pointOutside: true }) }
          : {
              ...(!keepPlace && { roadPlaces: withPlace(current.roadPlaces, slot, '') }),
              ...(outside && { roadOutside: true }),
            }),
      }))
      setNotice({ tone: 'danger', text: geoMessage(error) })
    } finally {
      if (latest()) setPending((prev) => ({ ...prev, [slot]: false }))
    }
  }

  // source: gps, pin hoặc address
  const setPoint = (point, source, extra = {}) => {
    setNotice(null)
    onChange({
      mode: source,
      pointSource: source,
      point,
      pointOutside: false,
      place: '',
      placePublic: '',
      accuracy: null,
      ...extra,
    })
  }

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setNotice({ tone: 'warning', text: 'Trình duyệt không hỗ trợ lấy vị trí.' })
      return
    }
    setLocating(true)
    setNotice(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const point = { lat: coords.latitude, lng: coords.longitude }
        setPoint(point, 'gps', { accuracy: Math.round(coords.accuracy) })
        describe(point, 'point')
      },
      (error) => {
        setLocating(false)
        setNotice({ tone: 'warning', text: gpsMessage(error) })
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Bấm lên bản đồ: chế độ đoạn đường thì thêm đầu mút, còn lại là đặt ghim
  const clickMap = (point) => {
    if (roadMode) {
      if (location.road.length >= 2) return
      const index = location.road.length
      setNotice(null)
      onChange((current) => ({
        road: [...current.road, point],
        roadPlaces: withPlace(current.roadPlaces, index, ''),
      }))
      describe(point, index)
      return
    }
    setPoint(point, 'pin')
    describe(point, 'point')
  }

  const dragPoint = (point) => {
    setPoint(point, 'pin')
    describe(point, 'point')
  }

  const dragRoadEnd = (index, point) => {
    setNotice(null)
    onChange((current) => ({
      road: current.road.map((item, i) => (i === index ? point : item)),
      roadPlaces: withPlace(current.roadPlaces, index, ''),
    }))
    describe(point, index)
  }

  const resetRoad = () => {
    roadOutsideRef.current = [false, false]
    requestRef.current[0] = (requestRef.current[0] ?? 0) + 1
    requestRef.current[1] = (requestRef.current[1] ?? 0) + 1
    setPending((prev) => ({ ...prev, 0: false, 1: false }))
    setNotice(null)
    onChange({ road: [], roadPlaces: [], roadOutside: false })
  }

  // Bật/tắt đoạn đường, khu vực đổi theo vị trí đang dùng
  const toggleRoad = () => {
    setNotice(null)
    const toRoad = !roadMode
    const target = toRoad ? location.road[0] : location.point
    const savedArea = toRoad ? location.roadArea : location.pointArea
    const savedAuto = toRoad ? location.roadAreaAuto : location.pointAreaAuto
    const known = target && savedArea !== undefined
    onChange({
      mode: toRoad ? 'road' : location.point ? location.pointSource || 'pin' : '',
      ...(known && { area: savedArea, areaAuto: Boolean(savedAuto) }),
    })
    // Chưa có khu vực đã lưu (vd vừa mở bản nháp) thì hỏi lại VietMap
    if (target && !known) describe(target, toRoad ? 0 : 'point', { keepPlace: true })
  }

  const runSearch = async () => {
    const text = location.query.trim()
    if (text.length < SEARCH_MIN) {
      setSearch({ status: 'idle', results: [] })
      setNotice({ tone: 'warning', text: `Nhập ít nhất ${SEARCH_MIN} ký tự rồi bấm Tìm.` })
      return
    }
    setNotice(null)
    setSearch({ status: 'loading', results: [] })
    try {
      const { data } = await searchPlaces(text)
      setSearch({ status: 'done', results: data })
    } catch (error) {
      setSearch({ status: 'idle', results: [] })
      setNotice({ tone: 'warning', text: geoMessage(error) })
    }
  }

  const choosePlace = async (result) => {
    setChoosing(result.refId)
    try {
      const { data } = await getPlace(result.refId)
      setSearch({ status: 'idle', results: [] })
      setPoint({ lat: data.lat, lng: data.lng }, 'address', {
        // Người đăng thấy địa chỉ đầy đủ, bản công khai (giữ tên địa danh) gửi lên server
        place: result.detail,
        placePublic: result.place,
        // Quận ngoài danh sách khu vực thì chọn tay
        area: result.area || '',
        areaAuto: Boolean(result.area),
        pointArea: result.area || '',
        pointAreaAuto: Boolean(result.area),
      })
    } catch (error) {
      setNotice({ tone: 'warning', text: geoMessage(error) })
    } finally {
      setChoosing('')
    }
  }

  const roadLength =
    location.road.length === 2 ? distanceMeters(location.road[0], location.road[1]) : null
  const gpsInaccurate =
    !roadMode &&
    location.mode === 'gps' &&
    location.accuracy > GPS_ACCURACY_WARN_M &&
    !location.pointOutside

  const muted = (text) => <span className="text-ink-muted">{text}</span>
  const strong = (text) => <strong className="font-semibold text-ink">{text}</strong>

  // Không lấy được địa chỉ thì ghi khu vực
  const pointPlaceText = () => {
    if (!location.point) return muted('chưa chọn vị trí')
    if (pending.point) return muted('đang xác định…')
    if (location.pointOutside) return muted('nằm ngoài TP.HCM')
    const text = location.place || location.area
    return text ? strong(text) : muted('chưa xác định được')
  }

  const roadPlaceText = (index) => {
    if (!location.road[index]) {
      return muted(index === 0 ? 'chưa chọn điểm đầu' : 'chưa chọn điểm cuối')
    }
    if (pending[index]) return muted('đang xác định…')
    const text = location.roadPlaces[index] || location.area
    return text ? strong(text) : muted('chưa xác định được')
  }

  return (
    <>
      <StepHeading title={lost ? 'Bạn mất đồ ở đâu?' : 'Bạn nhặt được ở đâu?'} required />

      <label htmlFor={`${id}-search`} className={labelClass}>
        Tìm địa chỉ
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-search`}
          type="search"
          value={location.query}
          autoComplete="off"
          onChange={(e) => onChange({ query: e.target.value })}
          onKeyDown={(e) => {
            // Enter tìm địa chỉ thay vì sang bước tiếp theo
            if (e.key !== 'Enter') return
            e.preventDefault()
            runSearch()
          }}
          placeholder="Tên đường, địa danh…"
          className={cx(inputClass, 'h-10 flex-1')}
        />
        <Button
          variant="primary"
          size="lg"
          onClick={runSearch}
          disabled={search.status === 'loading'}
          className="shrink-0"
        >
          <Icon name="search" size={16} />
          {search.status === 'loading' ? 'Đang tìm…' : 'Tìm'}
        </Button>
      </div>

      {search.status === 'done' && (
        <div className="mt-2 rounded-xl border border-line bg-surface p-1">
          {search.results.length === 0 ? (
            <p className="m-0 px-3 py-2.5 text-small text-ink-muted">
              Không tìm thấy địa chỉ nào trong TP.HCM. Thử gõ cụ thể hơn, ví dụ thêm tên đường hoặc
              quận.
            </p>
          ) : (
            <ul aria-label="Kết quả tìm địa chỉ" className="m-0 list-none p-0">
              {search.results.map((result) => (
                <li key={result.refId}>
                  <button
                    type="button"
                    onClick={() => choosePlace(result)}
                    disabled={Boolean(choosing)}
                    className={cx(
                      'flex w-full cursor-pointer items-start gap-2.5 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-small text-ink hover:bg-primary-subtle disabled:cursor-wait',
                      focusRing
                    )}
                  >
                    <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-ink-subtle" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{result.name}</span>
                      <span className="block text-caption text-ink-muted">
                        {choosing === result.refId ? 'Đang mở trên bản đồ…' : result.display}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        role="group"
        aria-label="Công cụ bản đồ"
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className={cx(chipClass(false), 'disabled:cursor-wait disabled:opacity-60')}
        >
          <Icon name="locate" size={15} />
          {locating ? 'Đang lấy vị trí…' : 'Vị trí của tôi'}
        </button>
        <button
          type="button"
          aria-pressed={roadMode}
          onClick={toggleRoad}
          className={chipClass(roadMode)}
        >
          <Icon name="route" size={15} />
          Đánh dấu đoạn đường
        </button>
        {roadMode && location.road.length > 0 && (
          <button type="button" onClick={resetRoad} className={chipClass(false)}>
            <Icon name="history" size={15} />
            Vẽ lại
          </button>
        )}
        <button
          type="button"
          aria-pressed={satellite}
          onClick={() => setSatellite((on) => !on)}
          className={cx(chipClass(satellite), 'sm:ml-auto')}
        >
          Ảnh vệ tinh
        </button>
      </div>

      <ul className="m-0 mt-3 mb-2 list-disc pl-5 text-caption text-ink-muted marker:text-primary">
        <li>{hintOf(location)}</li>
      </ul>
      <FieldError>{errors.location}</FieldError>

      {notice && (
        <Note icon="info" tone={notice.tone} className="mb-3">
          {notice.text}
        </Note>
      )}
      {gpsInaccurate && (
        <Note icon="info" tone="warning" className="mb-3">
          Vị trí của bạn có thể lệch khoảng {formatDistance(location.accuracy)}. Hãy kéo ghim tới
          đúng chỗ mất hoặc nhặt được đồ.
        </Note>
      )}

      <Suspense fallback={<MapFallback />}>
        <VietMapView
          mode={roadMode ? 'road' : 'point'}
          point={location.point}
          pointOutside={location.pointOutside}
          road={location.road}
          roadOutside={location.roadOutside}
          satellite={satellite}
          onMapClick={clickMap}
          onPointDrag={dragPoint}
          onRoadDrag={dragRoadEnd}
        />
      </Suspense>

      <div className="mt-3 rounded-xl border border-line bg-surface-muted px-3.5 py-2.5 text-small text-ink-secondary">
        {roadMode ? (
          <>
            <p className="m-0 font-semibold text-ink">
              Địa điểm
              <RequiredMark />
            </p>
            <dl className="m-0 mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
              {['Từ', 'Đến'].map((label, index) => (
                <Fragment key={label}>
                  <dt className="text-ink-muted">{label}:</dt>
                  <dd className="m-0">{roadPlaceText(index)}</dd>
                </Fragment>
              ))}
            </dl>
            {roadLength !== null && (
              <p className="m-0 mt-1 text-caption text-ink-muted">
                Đoạn đường dài khoảng {formatDistance(roadLength)}.
              </p>
            )}
          </>
        ) : (
          <p className="m-0">
            <span className="font-semibold text-ink">
              Địa điểm
              <RequiredMark />:
            </span>{' '}
            {pointPlaceText()}
          </p>
        )}

        {showAreaSelect && (
          <div className="mt-2.5 max-w-xs">
            <label htmlFor={`${id}-area`} className={labelClass}>
              Chưa xác định được khu vực, hãy chọn
              <RequiredMark />
            </label>
            <select
              id={`${id}-area`}
              value={location.area}
              onChange={(e) =>
                onChange({
                  area: e.target.value,
                  areaAuto: false,
                  ...(roadMode
                    ? { roadArea: e.target.value, roadAreaAuto: false }
                    : { pointArea: e.target.value, pointAreaAuto: false }),
                })
              }
              aria-required="true"
              aria-invalid={errors.area ? true : undefined}
              aria-describedby={errors.area ? `${id}-area-error` : undefined}
              className={cx(inputClass, 'h-10 cursor-pointer')}
            >
              <option value="">Chọn quận, huyện…</option>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <FieldError id={`${id}-area-error`}>{errors.area}</FieldError>
          </div>
        )}
      </div>
    </>
  )
}
