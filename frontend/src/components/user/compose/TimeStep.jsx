import { useId } from 'react'
import { DAY_PARTS, TIME_PRESETS } from '../../../data/composePost'
import { applyTimePreset, describeTime, toDateInput } from '../../../lib/composePost'
import Icon from '../../common/Icon'
import { cx } from '../classes'
import { chipClass, inputClass, labelClass, tileClass } from './styles'
import { FieldError, StepHeading } from './ui'

// Ngày bắt buộc, mốc gần đúng và buổi trong ngày tuỳ chọn
export default function TimeStep({ form, errors, onChange }) {
  const id = useId()
  const lost = form.type === 'lost'
  const summary = describeTime(form)

  return (
    <>
      <StepHeading title={lost ? 'Bạn mất đồ khi nào?' : 'Bạn nhặt được khi nào?'} />

      <label htmlFor={`${id}-date`} className={labelClass}>
        Ngày {lost ? 'mất đồ' : 'nhặt được'}
      </label>
      <input
        id={`${id}-date`}
        type="date"
        value={form.date}
        max={toDateInput(new Date())}
        onChange={(e) => onChange({ date: e.target.value, timePreset: '' })}
        aria-invalid={errors.date ? true : undefined}
        aria-describedby={errors.date ? `${id}-date-error` : undefined}
        className={cx(inputClass, 'h-11 sm:max-w-60')}
      />
      <FieldError id={`${id}-date-error`}>{errors.date}</FieldError>

      <p className="m-0 mt-5 mb-2.5 text-small text-ink-muted">
        Không nhớ chính xác? Chọn một mốc gần đúng:
      </p>
      <div role="group" aria-label="Mốc thời gian gần đúng" className="flex flex-wrap gap-2">
        {TIME_PRESETS.map((preset) => {
          const active = form.timePreset === preset.label
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(applyTimePreset(preset))}
              className={chipClass(active)}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <fieldset className="m-0 mt-6 border-0 p-0">
        <legend className={labelClass}>
          Khoảng thời gian trong ngày{' '}
          <span className="font-normal text-ink-muted">· không bắt buộc</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {DAY_PARTS.map((part) => {
            const active = form.dayPart === part.value
            return (
              <button
                key={part.value}
                type="button"
                aria-pressed={active}
                // Bấm lại lần nữa để bỏ chọn khi không chắc
                onClick={() => onChange({ dayPart: active ? '' : part.value, timePreset: '' })}
                className={cx(tileClass(active), 'flex-col items-start gap-0.5 px-3 py-2.5')}
              >
                <span className="text-small font-semibold">{part.label}</span>
                <span className="text-caption text-ink-muted">{part.hint}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-primary/20 bg-primary-subtle px-4 py-3.5">
        <Icon name="calendar" size={16} className="text-primary" />
        <span className="text-small text-ink-secondary">Sẽ hiển thị trên bài:</span>
        <strong className={cx('text-small', summary ? 'text-primary' : 'text-ink-subtle')}>
          {summary || 'Chưa chọn ngày'}
        </strong>
      </div>
    </>
  )
}
