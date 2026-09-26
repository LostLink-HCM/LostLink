import ModIcon from './ModIcon'
import ModDateRange from './ModDateRange'

export function QueueToolbar({ children, onReset, onExport, empty, dateFilters, onDateChange }) {
  return <section className="mod-filters mod-queue-toolbar" aria-label="Bộ lọc hàng đợi">
    <div className="mod-queue-filter-fields">{children}</div>
    <ModDateRange filters={dateFilters} onChange={onDateChange}>
      <div className="mod-filter-actions">
        <button className="mod-button mod-reset-button" onClick={onReset} aria-label="Đặt lại bộ lọc" title="Đặt lại bộ lọc"><ModIcon name="reset" /></button>
        <button className="mod-button primary" onClick={onExport} disabled={empty}><ModIcon name="download" />Xuất CSV</button>
      </div>
    </ModDateRange>
  </section>
}

export function QueueSummary({ count, noun = 'bài đăng', notice }) {
  return <><div className="mod-result-summary"><span>Số lượng: <strong>{count}</strong> {noun}</span></div>{notice && <p className="mod-queue-notice" role="status">{notice}</p>}</>
}

export function QueuePagination({ page, total, pageSize, onChange, noun = 'bài đăng' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <nav className="mod-pagination" aria-label="Phân trang hàng đợi">
    <span>Hiển thị {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} trong số {total} {noun}</span>
    <div><button className="mod-icon-button" aria-label="Trang trước" disabled={page === 1} onClick={() => onChange(page - 1)}><ModIcon name="back" /></button>
      {Array.from({ length: pages }, (_, index) => index + 1).map((number) => <button key={number} className={`mod-icon-button ${page === number ? 'selected' : ''}`} aria-label={`Trang ${number}`} aria-current={page === number ? 'page' : undefined} onClick={() => onChange(number)}>{number}</button>)}
      <button className="mod-icon-button" aria-label="Trang sau" disabled={page === pages} onClick={() => onChange(page + 1)}><ModIcon name="next" /></button></div>
  </nav>
}

export function QueueEmpty({ children }) {
  return <div className="mod-empty"><ModIcon name="check" size={36} /><h3>{children}</h3><p>Thử thay đổi bộ lọc để xem các kết quả khác.</p></div>
}
