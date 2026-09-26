import { useId } from 'react'
import { hasInvalidRange } from '../../lib/moderatorPosts'

export default function ModDateRange({ filters, onChange, children }) {
  const errorId = useId()
  const invalid = hasInvalidRange(filters)
  return <div className="mod-date-filter">
    <div className="mod-date-row">
      <label>Từ ngày<input type="date" value={filters.from} max={filters.to || undefined} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} onChange={(e) => onChange('from', e.target.value)} /></label>
      <span className="mod-date-separator" aria-hidden="true">—</span>
      <label>Đến ngày<input type="date" value={filters.to} min={filters.from || undefined} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} onChange={(e) => onChange('to', e.target.value)} /></label>
      {children}
    </div>
    {invalid && <p id={errorId} className="mod-error" role="alert">Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.</p>}
  </div>
}
