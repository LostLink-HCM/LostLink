import { useId, useState } from 'react'
import Icon from '../common/Icon'
import { cx, focusRing } from './classes'

const toDisplayDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

const toIsoDate = (value) => {
  const input = value.trim()
  const displayMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  const match = displayMatch ? [null, displayMatch[3], displayMatch[2], displayMatch[1]] : isoMatch

  if (!match) return ''

  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    Number(year) < 1000 ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return ''
  }

  return `${year}-${month}-${day}`
}

function DateFields({ from, to, onChange, children }) {
  const errorId = useId()
  const [drafts, setDrafts] = useState({ from: toDisplayDate(from), to: toDisplayDate(to) })
  const [formatErrors, setFormatErrors] = useState({ from: false, to: false })
  const invalidRange = Boolean(from && to && from > to)
  const inputClassName = cx(
    'h-9 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 pr-10 text-small font-normal text-ink',
    'placeholder:text-ink-subtle aria-invalid:border-danger',
    focusRing
  )

  const updateDraft = (key, value) => {
    setDrafts((previous) => ({ ...previous, [key]: value }))
    const parsed = value ? toIsoDate(value) : ''
    if (value && parsed) {
      setDrafts((previous) => ({ ...previous, [key]: toDisplayDate(parsed) }))
      setFormatErrors((previous) => ({ ...previous, [key]: false }))
      onChange(key, parsed)
    } else if (!value) {
      setFormatErrors((previous) => ({ ...previous, [key]: false }))
      onChange(key, '')
    }
  }

  const updateFromCalendar = (key, value) => {
    setDrafts((previous) => ({ ...previous, [key]: toDisplayDate(value) }))
    setFormatErrors((previous) => ({ ...previous, [key]: false }))
    onChange(key, value)
  }

  const hasFormatError = formatErrors.from || formatErrors.to
  const invalid = invalidRange || hasFormatError

  return (
    <>
      <div className="mt-3 border-t border-line-subtle pt-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex w-44 flex-col gap-1.5 text-small font-semibold text-ink-secondary max-sm:flex-1">
            Từ ngày
            <span className="relative block">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                placeholder="dd/mm/yyyy"
                value={drafts.from}
                onChange={(event) => updateDraft('from', event.target.value)}
                onBlur={() =>
                  setFormatErrors((previous) => ({
                    ...previous,
                    from: Boolean(drafts.from && !toIsoDate(drafts.from)),
                  }))
                }
                aria-invalid={formatErrors.from || invalidRange || undefined}
                aria-describedby={invalid ? errorId : undefined}
                className={inputClassName}
              />
              <Icon
                name="calendar"
                size={16}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink"
              />
              <input
                type="date"
                lang="vi"
                aria-label="Chọn từ ngày trên lịch"
                value={from}
                max={to || undefined}
                onChange={(event) => updateFromCalendar('from', event.target.value)}
                className="absolute top-0 right-0 h-9 w-9 cursor-pointer opacity-0"
              />
            </span>
          </label>
          <span aria-hidden="true" className="leading-9 text-ink-subtle max-sm:hidden">
            —
          </span>
          <label className="flex w-44 flex-col gap-1.5 text-small font-semibold text-ink-secondary max-sm:flex-1">
            Đến ngày
            <span className="relative block">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                placeholder="dd/mm/yyyy"
                value={drafts.to}
                onChange={(event) => updateDraft('to', event.target.value)}
                onBlur={() =>
                  setFormatErrors((previous) => ({
                    ...previous,
                    to: Boolean(drafts.to && !toIsoDate(drafts.to)),
                  }))
                }
                aria-invalid={formatErrors.to || invalidRange || undefined}
                aria-describedby={invalid ? errorId : undefined}
                className={inputClassName}
              />
              <Icon
                name="calendar"
                size={16}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink"
              />
              <input
                type="date"
                lang="vi"
                aria-label="Chọn đến ngày trên lịch"
                value={to}
                min={from || undefined}
                onChange={(event) => updateFromCalendar('to', event.target.value)}
                className="absolute top-0 right-0 h-9 w-9 cursor-pointer opacity-0"
              />
            </span>
          </label>
          {children}
        </div>
        {invalid && (
          <p id={errorId} role="alert" className="mt-3 text-small text-danger-ink">
            {hasFormatError
              ? 'Ngày không hợp lệ, định dạng đúng là DD/MM/YYYY.'
              : 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'}
          </p>
        )}
      </div>
    </>
  )
}

export default function DateRange({ from, to, onChange, children }) {
  return (
    <DateFields key={`${from}|${to}`} from={from} to={to} onChange={onChange}>
      {children}
    </DateFields>
  )
}
