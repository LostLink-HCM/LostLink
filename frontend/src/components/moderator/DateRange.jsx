import { useId } from 'react'
import { Input } from './Field'

// Giá trị dạng yyyy-mm-dd của <input type="date"> nên so sánh chuỗi là đủ
export default function DateRange({ from, to, onChange, children }) {
  const errorId = useId()
  const invalid = Boolean(from && to && from > to)
  const inputProps = {
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? errorId : undefined,
  }

  return (
    <div className="mt-3 border-t border-line-subtle pt-3">
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex w-44 flex-col gap-1.5 text-small font-semibold text-ink-secondary max-sm:flex-1">
          Từ ngày
          <Input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onChange('from', e.target.value)}
            {...inputProps}
          />
        </label>
        <span aria-hidden="true" className="leading-9 text-ink-subtle max-sm:hidden">
          —
        </span>
        <label className="flex w-44 flex-col gap-1.5 text-small font-semibold text-ink-secondary max-sm:flex-1">
          Đến ngày
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onChange('to', e.target.value)}
            {...inputProps}
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
