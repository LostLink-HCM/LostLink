import { useId, useState } from 'react'
import { DAY_PARTS, TIME_PRESETS } from '../../../data/composePost'
import {
  applyTimePreset,
  describeTime,
  isFutureDayPart,
  isFuturePreset,
  resolveTimePreset,
  toDateInput,
} from '../../../lib/user/composePost'
import Icon from '../../common/Icon'
import { cx } from '../classes'
import { chipClass, inputClass, labelClass, tileClass } from './styles'
import { FieldError, RequiredMark, StepHeading } from './ui'

// Mốc, buổi chưa tới thì mờ đi và không bấm được
const disabledClass = 'disabled:cursor-not-allowed disabled:opacity-40'

// Ngày (bắt buộc), mốc gần đúng và buổi; không cho chọn thời điểm chưa tới
export default function TimeStep({ form, errors, onChange }) {
  const id = useId()
  // Lấy giờ một lần lúc mở bước để render thuần; bấm Tiếp tục và server vẫn kiểm tra lại
  const [now] = useState(() => new Date())
  const today = toDateInput(now)
  const lost = form.type === 'lost'
  const summary = describeTime(form)

  // Đổi ngày giữ buổi, trừ khi sang hôm nay mà buổi đó chưa tới
  const changeDate = (date) => {
    const dayPart = isFutureDayPart(date, form.dayPart, now) ? '' : form.dayPart
    onChange({ date, dayPart, timePreset: resolveTimePreset(date, dayPart, form.timePreset) })
  }

  return (
    <>
      <StepHeading title={lost ? 'Bạn mất đồ khi nào?' : 'Bạn nhặt được khi nào?'} />

      <label htmlFor={`${id}-date`} className={labelClass}>
        Ngày {lost ? 'mất đồ' : 'nhặt được'}
        <RequiredMark />
      </label>
      <input
        id={`${id}-date`}
        type="date"
        value={form.date}
        max={today}
        onChange={(e) => changeDate(e.target.value)}
        aria-required="true"
        aria-invalid={errors.date ? true : undefined}
        aria-describedby={errors.date ? `${id}-date-error` : undefined}
        className={cx(inputClass, 'h-10 sm:max-w-60')}
      />
      <FieldError id={`${id}-date-error`}>{errors.date}</FieldError>

      <p className="m-0 mt-4 mb-2 text-small text-ink-muted">
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
              disabled={!active && isFuturePreset(preset, now)}
              onClick={() => onChange(applyTimePreset(preset, form.dayPart))}
              className={cx(chipClass(active), disabledClass)}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <fieldset className="m-0 mt-5 border-0 p-0">
        <legend className={labelClass}>Khoảng thời gian trong ngày</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {DAY_PARTS.map((part) => {
            const active = form.dayPart === part.value
            return (
              <button
                key={part.value}
                type="button"
                aria-pressed={active}
                // Buổi đang chọn vẫn bấm được để bỏ chọn
                disabled={!active && isFutureDayPart(form.date, part.value, now)}
                onClick={() => {
                  const dayPart = active ? '' : part.value
                  onChange({
                    dayPart,
                    timePreset: resolveTimePreset(form.date, dayPart, form.timePreset),
                  })
                }}
                className={cx(
                  tileClass(active),
                  'flex-col items-start gap-0.5 px-3 py-2',
                  disabledClass
                )}
              >
                <span className="text-small font-semibold">{part.label}</span>
                <span className="text-caption text-ink-muted">{part.hint}</span>
              </button>
            )
          })}
        </div>
        <p className="m-0 mt-2 text-caption text-ink-muted">
          Từ 0:00 đến 6:00 sáng tính là Ban đêm của ngày hôm trước.
          {form.date === today && ' Hôm nay chỉ chọn được các buổi đã bắt đầu.'}
        </p>
        <FieldError>{errors.dayPart}</FieldError>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-primary/20 bg-primary-subtle px-4 py-3">
        <Icon name="calendar" size={16} className="text-primary" />
        <span className="text-small text-ink-secondary">Sẽ hiển thị trên bài:</span>
        <strong className={cx('text-small', summary ? 'text-primary' : 'text-ink-subtle')}>
          {summary || 'Chưa chọn ngày'}
        </strong>
      </div>
    </>
  )
}
