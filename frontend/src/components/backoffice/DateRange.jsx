import { useId } from 'react'
import { cx, focusRing } from './classes'

export default function DateRange({ from, to, onChange, children }) {
  const errorId = useId()
  const invalid = Boolean(from && to && from > to)
  const inputClassName = cx(
    'h-9 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-small text-ink',
    'placeholder:text-ink-subtle aria-invalid:border-danger',
    focusRing
  )

  return (
    <div className="mt-3 border-t border-line-subtle pt-3">
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex w-44 flex-col gap-1.5 text-small font-semibold text-ink-secondary max-sm:flex-1">
          Từ ngày
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => onChange('from', event.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            className={inputClassName}
          />
        </label>
        <span aria-hidden="true" className="leading-9 text-ink-subtle max-sm:hidden">
          —
        </span>
        <label className="flex w-44 flex-col gap-1.5 text-small font-semibold text-ink-secondary max-sm:flex-1">
          Đến ngày
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => onChange('to', event.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            className={inputClassName}
          />
        </label>
        {children}
      </div>
      {invalid && (
        <p id={errorId} role="alert" className="mt-3 text-small text-danger-ink">
          Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.
        </p>
      )}
    </div>
  )
}
