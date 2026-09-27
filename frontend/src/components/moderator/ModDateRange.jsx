import { useId } from 'react'
import { hasInvalidRange } from '../../lib/moderatorPosts'

export default function ModDateRange({ filters, onChange, children, classes = {} }) {
  const errorId = useId()
  const invalid = hasInvalidRange(filters)
  return <div className={classes.container ?? 'mod-date-filter'}>
    <div className={classes.row ?? 'mod-date-row'}>
      <label className={classes.label}>Từ ngày<input className={classes.input} type="date" value={filters.from} max={filters.to || undefined} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} onChange={(e) => onChange('from', e.target.value)} /></label>
      <span className={classes.separator ?? 'mod-date-separator'} aria-hidden="true">—</span>
      <label className={classes.label}>Đến ngày<input className={classes.input} type="date" value={filters.to} min={filters.from || undefined} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} onChange={(e) => onChange('to', e.target.value)} /></label>
      {children}
    </div>
    {invalid && <p id={errorId} className={classes.error ?? 'mod-error'} role="alert">Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.</p>}
  </div>
}
