import { useEffect, useId, useRef, useState } from 'react'
import { LOCATION_MODES, PLACES, ROAD_SEGMENTS } from '../../../data/composePost'
import { AREAS } from '../../../data/homeFeed'
import { describeLocation } from '../../../lib/user/composePost'
import { normalize } from '../../../lib/user/homeFeed'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'
import LocationMap from './LocationMap'
import { inputClass, labelClass, tileClass } from './styles'
import { FieldError, StepHeading } from './ui'

const MODE_ICONS = { gps: 'locate', pin: 'pin', address: 'search', road: 'route' }
const CENTER = { x: 50, y: 50 }
const MAX_SUGGESTIONS = 5

const EMPTY_TEXT = {
  '': 'Chọn một cách xác định vị trí ở trên',
  gps: 'Đang chờ lấy vị trí hiện tại',
  address: 'Chọn một địa chỉ gợi ý để xem trên bản đồ',
  road: 'Chọn đoạn đường để xem trên bản đồ',
}

const gpsMessage = (error) =>
  error.code === error.PERMISSION_DENIED
    ? 'Bạn đã từ chối quyền truy cập vị trí. Hãy chọn cách khác: kéo ghim, gõ địa chỉ hoặc chọn đoạn đường.'
    : 'Không lấy được vị trí hiện tại. Hãy thử lại hoặc chọn cách khác.'

// Một trong bốn cách xác định vị trí, kèm khu vực để lọc bài
export default function LocationStep({ type, location, errors, onChange }) {
  const id = useId()
  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)

  // Kết quả GPS về sau khi người dùng đã đổi cách khác thì bỏ qua
  const modeRef = useRef(location.mode)
  useEffect(() => {
    modeRef.current = location.mode
  }, [location.mode])

  const lost = type === 'lost'
  const road = location.mode === 'road' && ROAD_SEGMENTS.find((r) => r.id === location.roadId)
  const query = normalize(location.place)
  const suggestions =
    location.mode === 'address' && suggestOpen && query
      ? PLACES.filter((place) => normalize(`${place.label} ${place.area}`).includes(query)).slice(
          0,
          MAX_SUGGESTIONS
        )
      : []
  const ready = location.coords || location.point || road || location.place.trim()

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Trình duyệt không hỗ trợ lấy vị trí. Hãy chọn cách khác.')
      return
    }
    setLocating(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        if (modeRef.current !== 'gps') return
        onChange({ coords: { lat: coords.latitude, lng: coords.longitude }, point: CENTER })
      },
      (error) => {
        setLocating(false)
        setGpsError(gpsMessage(error))
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const chooseMode = (mode) => {
    if (mode === location.mode) return
    setGpsError('')
    setSuggestOpen(false)
    modeRef.current = mode
    onChange({ mode, place: '', roadId: '', coords: null, point: mode === 'pin' ? CENTER : null })
    if (mode === 'gps') locate()
  }

  // Chọn khu vực trước thì danh sách đoạn đường chỉ còn đường trong khu vực đó
  const roads = location.area
    ? ROAD_SEGMENTS.filter((segment) => segment.area === location.area)
    : ROAD_SEGMENTS

  const changeArea = (area) => {
    const keepRoad =
      !location.roadId || ROAD_SEGMENTS.some((r) => r.id === location.roadId && r.area === area)
    onChange(keepRoad ? { area } : { area, roadId: '' })
  }

  const pickPlace = (place) => {
    onChange({ place: place.label, area: place.area, point: { x: place.x, y: place.y } })
    setSuggestOpen(false)
  }

  const placeNameInput = (
    <div>
      <label htmlFor={`${id}-place`} className={labelClass}>
        Tên địa điểm <span className="font-normal text-ink-muted">· không bắt buộc</span>
      </label>
      <input
        id={`${id}-place`}
        value={location.place}
        onChange={(e) => onChange({ place: e.target.value })}
        placeholder="Ví dụ: Cổng sau ký túc xá khu A"
        className={cx(inputClass, 'h-11')}
      />
    </div>
  )

  return (
    <>
      <StepHeading
        title={lost ? 'Bạn mất đồ ở đâu?' : 'Bạn nhặt được ở đâu?'}
        description="Vị trí chính xác được giữ kín. Người khác chỉ nhìn thấy một vùng rộng quanh đó."
      />

      <div
        role="group"
        aria-label="Cách xác định vị trí"
        className="grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        {LOCATION_MODES.map((mode) => {
          const active = location.mode === mode.value
          return (
            <button
              key={mode.value}
              type="button"
              aria-pressed={active}
              onClick={() => chooseMode(mode.value)}
              className={cx(
                tileClass(active),
                'min-h-11 items-center gap-2 px-3 py-2 text-small font-medium'
              )}
            >
              <Icon name={MODE_ICONS[mode.value]} size={18} className="shrink-0" />
              {mode.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 max-w-xs">
        <label htmlFor={`${id}-area`} className={labelClass}>
          Khu vực
        </label>
        <select
          id={`${id}-area`}
          value={location.area}
          onChange={(e) => changeArea(e.target.value)}
          aria-invalid={errors.area ? true : undefined}
          aria-describedby={errors.area ? `${id}-area-error` : undefined}
          className={cx(inputClass, 'h-11 cursor-pointer')}
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

      <div className="mt-4 flex flex-col gap-4">
        {location.mode === 'gps' && (
          <>
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-muted px-4 py-3 text-small"
            >
              <Icon
                name="locate"
                size={16}
                className={location.coords ? 'text-success' : 'text-ink-subtle'}
              />
              <span
                className={cx(
                  'min-w-0 flex-1',
                  gpsError ? 'text-danger-ink' : 'text-ink-secondary'
                )}
              >
                {locating
                  ? 'Đang lấy vị trí hiện tại…'
                  : location.coords
                    ? `Đã lấy vị trí hiện tại (${location.coords.lat.toFixed(5)}, ${location.coords.lng.toFixed(5)})`
                    : gpsError || 'Chưa lấy được vị trí.'}
              </span>
              <button
                type="button"
                onClick={locate}
                disabled={locating}
                className={cx(
                  'h-8 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-caption font-semibold text-primary hover:bg-primary-subtle disabled:cursor-wait disabled:opacity-60',
                  focusRing
                )}
              >
                {location.coords ? 'Lấy lại' : 'Thử lại'}
              </button>
            </div>
            {placeNameInput}
          </>
        )}

        {location.mode === 'pin' && placeNameInput}

        {location.mode === 'address' && (
          <div className="relative">
            <label htmlFor={`${id}-address`} className={labelClass}>
              Địa chỉ
            </label>
            <input
              id={`${id}-address`}
              value={location.place}
              autoComplete="off"
              onChange={(e) => {
                onChange({ place: e.target.value, point: null })
                setSuggestOpen(true)
              }}
              onKeyDown={(e) => {
                // Enter chọn gợi ý đầu tiên thay vì gửi form
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (suggestions[0]) pickPlace(suggestions[0])
              }}
              placeholder="Gõ tên đường, địa danh… ví dụ: Bến Thành"
              aria-invalid={errors.location ? true : undefined}
              aria-describedby={errors.location ? `${id}-location-error` : undefined}
              className={cx(inputClass, 'h-11')}
            />
            {suggestions.length > 0 && (
              <ul
                aria-label="Địa chỉ gợi ý"
                className="absolute inset-x-0 top-full z-10 m-0 mt-1.5 list-none overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-dialog"
              >
                {suggestions.map((place) => (
                  <li key={place.label}>
                    <button
                      type="button"
                      onClick={() => pickPlace(place)}
                      className={cx(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-small text-ink hover:bg-primary-subtle',
                        focusRing
                      )}
                    >
                      <Icon name="pin" size={16} className="shrink-0 text-ink-subtle" />
                      <span className="min-w-0 truncate">{place.label}</span>
                      <span className="ml-auto shrink-0 text-caption text-ink-muted">
                        {place.area}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {location.mode === 'road' && (
          <div>
            <label htmlFor={`${id}-road`} className={labelClass}>
              Đoạn đường
            </label>
            <select
              id={`${id}-road`}
              value={location.roadId}
              onChange={(e) => {
                const segment = ROAD_SEGMENTS.find((r) => r.id === e.target.value)
                onChange({ roadId: e.target.value, area: segment?.area ?? location.area })
              }}
              aria-invalid={errors.location ? true : undefined}
              aria-describedby={errors.location ? `${id}-location-error` : undefined}
              className={cx(inputClass, 'h-11 cursor-pointer')}
            >
              <option value="">Chọn đoạn đường…</option>
              {roads.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.road} (đoạn {segment.from} – {segment.to}) · {segment.area}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <FieldError id={`${id}-location-error`}>{errors.location}</FieldError>

      <div className="mt-4">
        <LocationMap
          point={location.point}
          road={road || null}
          label={ready ? describeLocation(location) : ''}
          emptyText={EMPTY_TEXT[location.mode] ?? EMPTY_TEXT['']}
          draggable={location.mode === 'pin'}
          onMove={(point) => onChange({ point })}
        />
      </div>
    </>
  )
}
