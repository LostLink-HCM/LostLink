import { useId } from 'react'
import { PLACES } from '../../../data/composePost'
import {
  RADIUS_MAX,
  RADIUS_MIN,
  RADIUS_STEP,
  formatRadius,
  radiusToPercent,
} from '../../../lib/user/settings'
import LocationMap from '../compose/LocationMap'
import { chipClass, labelClass } from '../compose/styles'
import TextField from './TextField'

const QUICK_PICKS = PLACES.slice(0, 6)

// Chọn tâm trên bản đồ và chỉnh bán kính cho một khu vực để ý
export default function AreaEditor({ value, onChange, error }) {
  const radiusId = useId()

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary-subtle/60 p-4">
      <div>
        <p className={labelClass}>Chọn nhanh</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PICKS.map((place) => {
            const active = value.name === place.label
            return (
              <button
                key={place.label}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ name: place.label, point: { x: place.x, y: place.y } })}
                className={chipClass(active)}
              >
                {place.label}
              </button>
            )
          })}
        </div>
      </div>

      <LocationMap
        point={value.point}
        label={value.point ? value.name || 'Vị trí đã ghim' : ''}
        emptyText="Bấm vào bản đồ để chọn tâm khu vực"
        draggable
        onMove={(point) => onChange({ point })}
        ringPercent={radiusToPercent(value.radius)}
      />

      <TextField
        label="Tên gợi nhớ"
        hint="Không bắt buộc, ví dụ: Gần nhà, Chỗ làm."
        value={value.name}
        maxLength={60}
        onChange={(event) => onChange({ name: event.target.value })}
        placeholder="Khu vực mới"
      />

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor={radiusId} className="text-small font-semibold text-ink">
            Bán kính nhắc tin
          </label>
          <span className="text-small font-bold text-primary">{formatRadius(value.radius)}</span>
        </div>
        <input
          id={radiusId}
          type="range"
          min={RADIUS_MIN}
          max={RADIUS_MAX}
          step={RADIUS_STEP}
          value={value.radius}
          onChange={(event) => onChange({ radius: Number(event.target.value) })}
          className="w-full cursor-pointer accent-primary"
        />
        <div className="mt-1 flex justify-between text-tiny text-ink-subtle">
          <span>{formatRadius(RADIUS_MIN)}</span>
          <span>{formatRadius(RADIUS_MAX)}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="m-0 text-caption text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
