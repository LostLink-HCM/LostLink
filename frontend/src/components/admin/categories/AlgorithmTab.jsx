import { useState } from 'react'
import useSystemSettings from '../../../hooks/useSystemSettings'
import Icon from '../../common/Icon'
import { isSame, validateAlgorithm } from '../../../lib/admin/categories'
import {
  TIME_SHAPES,
  filterRadius,
  formatDays,
  formatDistance,
  formatPercent,
  timeShapeKey,
  timeWindow,
} from '../../../lib/admin/matching'
import { NumberField, SaveBar, Segmented } from './ui'

const FIELDS = ['matchRadius', 'timeShape', 'timeMedianDays', 'diffusion']

const pick = (category) => Object.fromEntries(FIELDS.map((key) => [key, category[key]]))
const toNumbers = (form) => Object.fromEntries(FIELDS.map((key) => [key, Number(form[key])]))

function Card({ title, icon, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line-soft bg-primary-faint p-4">
      <h3 className="m-0 flex items-center gap-2.5 text-body font-semibold text-primary">
        <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon name={icon} size={15} />
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3.5 py-3 shadow-raised">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="m-0 mt-1 text-title font-bold text-primary tabular-nums">{value}</dd>
    </div>
  )
}

function Preview({ form, valid, frequency, sMin }) {
  const { matchRadius, timeShape, timeMedianDays, diffusion } = toNumbers(form)
  const show = (compute) => (valid ? compute() : '—')

  return (
    <section
      aria-label="Xem trước"
      className="rounded-2xl bg-linear-to-br from-primary-soft to-primary-faint p-4"
      aria-live="polite"
    >
      <h3 className="m-0 flex items-center gap-2 text-body font-semibold text-primary">
        <Icon name="eye" size={16} />
        Xem trước (chỉ đọc)
      </h3>
      <dl className="mt-3.5 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <Stat
          label="Cửa sổ thời gian Tₘₐₓ"
          value={show(() => `≈ ${formatDays(timeWindow(timeMedianDays, timeShape, sMin))}`)}
        />
        <Stat
          label="Tần suất danh mục u"
          value={frequency == null ? 'Tự tính từ bài đăng' : formatPercent(frequency, 2)}
        />
        <Stat
          label="Bán kính lọc lúc mất"
          value={show(() => formatDistance(filterRadius(matchRadius, diffusion, 0)))}
        />
        <Stat
          label="Sau 7 ngày"
          value={show(() => formatDistance(filterRadius(matchRadius, diffusion, 7)))}
        />
        <Stat
          label="Sau 30 ngày"
          value={show(() => formatDistance(filterRadius(matchRadius, diffusion, 30)))}
        />
      </dl>
    </section>
  )
}

export default function AlgorithmTab({ category, onSave, active }) {
  const saved = pick(category)
  const { systemSettings, settingsLoading, settingsError, reloadSystemSettings } =
    useSystemSettings({ scope: 'matching', enabled: active })
  const sMin = systemSettings?.values.sMin
  const [form, setForm] = useState(saved)
  const [shape, setShape] = useState(() => timeShapeKey(saved.timeShape))
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const dirty = !isSame(toNumbers(form), saved)
  const valid = !Object.keys(validateAlgorithm(form)).length
  const change = (key, value) => {
    setErrors({})
    setForm((current) => ({ ...current, [key]: value }))
  }
  const chooseShape = (key) => {
    setShape(key)
    const preset = TIME_SHAPES.find((item) => item.key === key)
    if (preset.k) change('timeShape', preset.k)
  }
  const reset = () => {
    setErrors({})
    setForm(saved)
    setShape(timeShapeKey(saved.timeShape))
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validateAlgorithm(form)
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)
    const next = toNumbers(form)
    setSaving(true)
    setSaveError('')
    try {
      const updated = await onSave(next)
      setForm(pick(updated))
      setShape(timeShapeKey(updated.timeShape))
    } catch (error) {
      setSaveError(error.message || 'Không lưu được cấu hình thuật toán. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="category-algorithm-form" className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Thời gian" icon="history">
          <Segmented
            label="Kiểu suy giảm (k)"
            options={TIME_SHAPES.map(({ key, label }) => ({ value: key, label }))}
            value={shape}
            onChange={chooseShape}
          />
          <NumberField
            label="Trung vị thời gian chờ"
            unit="ngày"
            min="0.1"
            max="365"
            step="0.1"
            value={form.timeMedianDays}
            error={errors.timeMedianDays}
            onChange={(event) => change('timeMedianDays', event.target.value)}
          />
          <NumberField
            label="Hệ số hình dạng k"
            unit={shape === 'custom' ? undefined : 'tự điền theo kiểu'}
            min="0.3"
            max="5"
            step="0.1"
            value={form.timeShape}
            error={errors.timeShape}
            disabled={shape !== 'custom'}
            onChange={(event) => change('timeShape', event.target.value)}
          />
        </Card>

        <Card title="Vị trí" icon="locate">
          <NumberField
            label="Bán kính ban đầu"
            unit="m"
            min="100"
            max="50000"
            step="100"
            value={form.matchRadius}
            error={errors.matchRadius}
            hint="Sai số ghim cộng quãng chạy lúc mới lạc"
            onChange={(event) => change('matchRadius', event.target.value)}
          />
          <NumberField
            label="Hệ số khuếch tán D"
            unit="m²/ngày"
            min="0"
            max="5000000"
            step="1000"
            value={form.diffusion}
            error={errors.diffusion}
            hint="Đồ vật để 0: vùng tìm không đổi. Thú cưng: vùng tìm rộng dần"
            onChange={(event) => change('diffusion', event.target.value)}
          />
        </Card>
      </div>

      {settingsLoading && (
        <p role="status" className="text-small text-ink-muted">
          Đang tải cấu hình ghép cặp…
        </p>
      )}
      {settingsError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-danger-soft bg-danger-soft p-3 text-small text-danger-ink"
        >
          <p className="min-w-0 flex-1">Không tải được cấu hình ghép cặp. {settingsError}</p>
          <button
            type="button"
            className="rounded-lg border border-current px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
            onClick={reloadSystemSettings}
          >
            Thử lại
          </button>
        </div>
      )}
      <Preview
        form={form}
        valid={valid && Number.isFinite(sMin)}
        frequency={category.frequency}
        sMin={sMin}
      />

      <SaveBar
        formId="category-algorithm-form"
        dirty={dirty}
        error={saveError}
        saving={saving}
        onReset={() => {
          setSaveError('')
          reset()
        }}
      />
    </form>
  )
}
