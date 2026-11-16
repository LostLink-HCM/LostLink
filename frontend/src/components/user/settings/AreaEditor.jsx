import { lazy, Suspense, useId } from 'react'
import {
  AREA_PRESETS,
  RADIUS_MAX,
  RADIUS_MIN,
  RADIUS_STEP,
  formatRadius,
} from '../../../lib/user/settings'
import { chipClass, labelClass } from '../compose/styles'
import TextField from './TextField'

const VietMapView = lazy(() => import('../compose/VietMapView'))

function MapFallback() {
  return (
    <div className="grid h-72 place-items-center rounded-2xl border border-line bg-surface-muted text-caption text-ink-muted sm:h-96">
      Đang tải bản đồ…
    </div>
  )
}

const samePoint = (a, b) => a && b && a.lat === b.lat && a.lng === b.lng
const PRESET_LABELS = new Set(AREA_PRESETS.map((preset) => preset.label))
// Tên trống hoặc đang là tên chip khác thì đổi theo chip mới, tên tự đặt thì giữ nguyên
const presetName = (name, label) => (!name || PRESET_LABELS.has(name) ? label : name)

// Chọn tâm trên bản đồ và chỉnh bán kính cho một khu vực để ý
export default function AreaEditor({ value, onChange, error }) {
  const radiusId = useId()
  const pick = (point) => onChange({ point })

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary-subtle/60 p-4">
      <div>
        <p className={labelClass}>Chọn nhanh</p>
        <div className="flex flex-wrap gap-2">
          {AREA_PRESETS.map(({ label, lat, lng }) => {
            const active = samePoint(value.point, { lat, lng })
            return (
              <button
                key={label}
                type="button"
                aria-pressed={Boolean(active)}
                onClick={() =>
                  onChange({ name: presetName(value.name, label), point: { lat, lng } })
                }
                className={chipClass(active)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <Suspense fallback={<MapFallback />}>
        <VietMapView
          mode="point"
          point={value.point}
          radius={value.radius}
          onMapClick={pick}
          onPointDrag={pick}
        />
      </Suspense>

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
