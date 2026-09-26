import { useRef, useState } from 'react'
import ModIcon from '../../components/moderator/ModIcon'
import ModDialog from '../../components/moderator/ModDialog'
import ModDateRange from '../../components/moderator/ModDateRange'
import { EMPTY_FILTERS, STATUS_LABELS, filterModeratorPosts, hasInvalidRange, postsToCsv, setPostHidden, validateHideReason } from '../../lib/moderatorPosts'

import '../../theme/workspacePosts.css'

const PAGE_SIZE = 8

function Status({ value, hidden }) {
  return <span className="workspace-post-status"><span className={`mod-status ${value}`}>{STATUS_LABELS[value]}</span>{hidden && <span className="mod-status post-hidden">Đã ẩn</span>}</span>
}

function MatchingPosts({ matches, onView }) {
  return <section className="workspace-post-matches" aria-label="Bài đăng đang matching">
    <div className="workspace-post-matches-heading"><h4>Bài đăng đang matching</h4><span>{matches.length} bài đăng</span></div>
    {matches.length ? <ul>{matches.map(({ id, post, score }) => <li key={id}>
      <div className="workspace-post-match-heading">
        <div><span className={`mod-type ${post.type}`}>{post.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}</span><span className="workspace-post-match-id">{post.postCode}</span></div>
        <div className="workspace-post-match-score"><strong>{(score * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</strong><span>Tỷ lệ matching</span></div>
      </div>
      <button className="mod-post-title" onClick={() => onView(post.id)}>{post.title}</button>
      <p className="workspace-post-match-author">{post.author} · {post.dateTime}</p>
      <div className="mod-post-location"><ModIcon name="pin" size={15} />{post.location}</div>
      <p className="workspace-post-match-description">{post.desc}</p>
      <div className="workspace-post-match-actions"><Status value={post.status} hidden={post.hidden} /><button className="mod-button" onClick={() => onView(post.id)}>Xem bài đăng<ModIcon name="next" size={15} /></button></div>
    </li>)}</ul> : <p className="workspace-post-matches-empty">Chưa có bài đăng đang matching.</p>}
  </section>
}

function VisibilityDialog({ post, onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const reasonRef = useRef(null)
  const submit = (event) => {
    event.preventDefault()
    const validationError = post.hidden ? '' : validateHideReason(reason)
    if (validationError) {
      setError(validationError)
      reasonRef.current?.focus()
      return
    }
    onSubmit(reason.trim())
  }
  return <ModDialog title={post.hidden ? 'Hiện lại bài đăng' : 'Ẩn bài đăng'} onClose={onClose} footer={<><button className="mod-button" autoFocus={post.hidden} onClick={onClose}>Hủy</button><button type="submit" form="post-visibility-form" className={`mod-button ${post.hidden ? 'primary' : 'danger'}`}><ModIcon name={post.hidden ? 'eye' : 'eyeOff'} size={16} />{post.hidden ? 'Hiện lại bài đăng' : 'Ẩn bài đăng'}</button></>}>
    <form id="post-visibility-form" className="mod-action-form workspace-post-visibility-form" onSubmit={submit} noValidate>
      <p className="mod-edit-title">{post.title}</p>
      <p className="workspace-post-visibility-note">{post.hidden ? 'Bạn muốn hiện lại bài đăng này?' : 'Bài vẫn được giữ trong danh sách quản lý để có thể kiểm tra và hiện lại.'}</p>
      {!post.hidden && <>
        <label htmlFor="post-hide-reason">Lý do ẩn bài đăng <span className="workspace-post-required">(bắt buộc)</span></label>
        <textarea ref={reasonRef} autoFocus id="post-hide-reason" rows={4} maxLength={500} required value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder="Nhập lý do ẩn bài đăng…" aria-invalid={Boolean(error)} aria-describedby={`post-hide-reason-count${error ? ' post-hide-reason-error' : ''}`} />
        <small id="post-hide-reason-count" className="workspace-post-reason-count">{reason.length}/500 ký tự</small>
        {error && <p id="post-hide-reason-error" className="mod-error" role="alert">{error}</p>}
      </>}
    </form>
  </ModDialog>
}

export default function Posts({ posts, setPosts, pendingOnly = false, matchPairs = [] }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [nextStatus, setNextStatus] = useState('')
  const [notice, setNotice] = useState('')
  const effectiveFilters = pendingOnly ? { ...filters, status: 'pending' } : filters
  const invalidRange = hasInvalidRange(filters)
  const filtered = filterModeratorPosts(posts, effectiveFilters)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * PAGE_SIZE
  const visible = filtered.slice(start, start + PAGE_SIZE)
  const selected = modal && posts.find((post) => post.id === modal.id)
  const matchingPosts = selected ? matchPairs
    .filter((match) => match.postLost === selected.id || match.postFound === selected.id)
    .map((match) => ({ ...match, post: posts.find((post) => post.id === (match.postLost === selected.id ? match.postFound : match.postLost)) }))
    .filter((match) => match.post)
    .sort((a, b) => b.score - a.score) : []

  const changeFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
    setNotice('')
  }
  const resetFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); setNotice('') }
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([postsToCsv(filtered)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'LostLink_Danh_sach_bai_dang.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice(`Đã xuất ${filtered.length} bài đăng ra CSV.`)
  }
  const saveStatus = () => {
    setPosts((previous) => previous.map((post) => post.id === selected.id ? { ...post, status: nextStatus } : post))
    setNotice(`Đã cập nhật trạng thái bài #${selected.id}.`)
    setModal(null)
  }
  const saveVisibility = (reason) => {
    const hidden = !selected.hidden
    setPosts((previous) => setPostHidden(previous, selected.id, hidden, reason))
    setNotice(`Đã ${hidden ? 'ẩn' : 'hiện lại'} bài đăng #${selected.id}.`)
    setModal(null)
  }

  return (
    <div className="mod-content workspace-posts">
      {pendingOnly && <div className="mod-page-heading"><div><h2>Bài đăng chờ xét duyệt</h2><p>Theo dõi và quản lý các bài đăng trong cộng đồng LostLink.</p></div></div>}
      <section className="mod-filters" aria-label="Bộ lọc bài đăng">
        <div className="mod-filter-grid">
          <label className="mod-search-filter">Tìm kiếm<input type="search" value={filters.query} onChange={(e) => changeFilter('query', e.target.value)} placeholder="Tiêu đề, người đăng, khu vực…" /></label>
          <label>Trạng thái<select value={effectiveFilters.status} disabled={pendingOnly} onChange={(e) => changeFilter('status', e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Danh mục<select value={filters.category} onChange={(e) => changeFilter('category', e.target.value)}><option value="">Tất cả danh mục</option>{[...new Set(posts.map((p) => p.category))].map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Loại bài đăng<select value={filters.type} onChange={(e) => changeFilter('type', e.target.value)}><option value="">Tất cả loại tin</option><option value="lost">Mất đồ</option><option value="found">Nhặt được</option></select></label>
          <label>Khu vực<select value={filters.district} onChange={(e) => changeFilter('district', e.target.value)}><option value="">Tất cả khu vực</option>{[...new Set(posts.map((p) => p.district))].map((district) => <option key={district}>{district}</option>)}</select></label>
        </div>
        <ModDateRange filters={filters} onChange={changeFilter}>
          <div className="mod-filter-actions"><button className="mod-button mod-reset-button" onClick={resetFilters} aria-label="Đặt lại bộ lọc" title="Đặt lại bộ lọc"><ModIcon name="reset" /></button><button className="mod-button primary" onClick={exportCsv} disabled={invalidRange || !filtered.length}><ModIcon name="download" />Xuất CSV</button></div>
        </ModDateRange>
      </section>
      <div className="mod-result-summary" aria-live="polite"><span>Số lượng: <strong>{filtered.length}</strong> bài đăng</span><span>{notice}</span></div>
      <div className="mod-table-container">
        <table className="mod-table mod-all-table">
          <caption className="sr-only">Danh sách bài đăng của cộng đồng</caption>
          <colgroup><col style={{ width: '8%' }} /><col style={{ width: '25%' }} /><col style={{ width: '12%' }} /><col style={{ width: '18%' }} /><col style={{ width: '13%' }} /><col style={{ width: '11%' }} /><col style={{ width: '13%' }} /></colgroup>
          <thead><tr>{['ID', 'Thông tin bài đăng', 'Phân loại', 'Thời gian & Vị trí', 'Thống kê', 'Trạng thái', 'Thao tác'].map((title) => <th key={title} scope="col">{title}</th>)}</tr></thead>
          <tbody>{visible.map((post) => <tr key={post.id}>
            <td className="workspace-post-code">{post.postCode}</td>
            <td><button className="mod-post-title" onClick={() => setModal({ kind: 'detail', id: post.id })}>{post.title}</button><span className="mod-category">{post.category}</span></td>
            <td><span className={`mod-type ${post.type}`}>{post.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}</span></td>
            <td><div className="mod-post-date">{post.dateTime}</div><div className="mod-post-location"><ModIcon name="pin" size={13} />{post.location}</div></td>
            <td><div className="mod-stats">{[['eye', post.views, 'Lượt xem'], ['chat', post.comments, 'Bình luận'], ['link', post.matches, 'Ghép nối']].map(([icon, count, label]) => <span key={icon} title={label} aria-label={`${label}: ${count}`}><ModIcon name={icon} size={14} />{count}</span>)}</div></td>
            <td><Status value={post.status} hidden={post.hidden} /></td>
            <td><div className="mod-row-actions"><button className="mod-icon-button view" aria-label={`Xem chi tiết bài #${post.id}`} title="Xem chi tiết" onClick={() => setModal({ kind: 'detail', id: post.id })}><ModIcon name="eye" /></button><button className="mod-icon-button edit" aria-label={`Cập nhật trạng thái bài #${post.id}`} title="Cập nhật trạng thái" onClick={() => { setNextStatus(post.status); setModal({ kind: 'edit', id: post.id }) }}><ModIcon name="edit" /></button><button className={`mod-icon-button ${post.hidden ? 'success' : 'danger'}`} aria-label={`${post.hidden ? 'Hiện lại' : 'Ẩn'} bài đăng #${post.id}`} title={post.hidden ? 'Hiện lại bài đăng' : 'Ẩn bài đăng'} onClick={() => setModal({ kind: 'visibility', id: post.id })}><ModIcon name={post.hidden ? 'eye' : 'eyeOff'} /></button></div></td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <div className="mod-empty"><ModIcon name="list" size={36} /><h3>{invalidRange ? 'Khoảng thời gian chưa hợp lệ' : 'Không tìm thấy bài đăng phù hợp'}</h3><p>{invalidRange ? 'Vui lòng kiểm tra lại ngày bắt đầu và ngày kết thúc.' : 'Thử thay đổi bộ lọc hoặc chọn khoảng thời gian khác.'}</p><button className="mod-button" onClick={resetFilters}>Xóa bộ lọc</button></div>}
      </div>
      <nav className="mod-pagination" aria-label="Phân trang bài đăng"><span>Hiển thị {filtered.length ? start + 1 : 0}–{Math.min(start + PAGE_SIZE, filtered.length)} trong số {filtered.length} bài</span><div><button className="mod-icon-button" aria-label="Trang trước" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ModIcon name="back" size={16} /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={`mod-icon-button ${currentPage === number ? 'selected' : ''}`} aria-label={`Trang ${number}`} aria-current={currentPage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}<button className="mod-icon-button" aria-label="Trang sau" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ModIcon name="next" size={16} /></button></div></nav>
      {selected && modal.kind === 'detail' && <ModDialog key={selected.id} title="Chi tiết bài đăng" footer={modal.returnId ? <><button className="mod-button" onClick={() => setModal({ kind: 'detail', id: modal.returnId })}><ModIcon name="back" size={15} />Quay lại bài trước</button><button className="mod-button" onClick={() => setModal(null)}>Đóng</button></> : undefined} onClose={() => setModal(null)}><h3 className="mod-detail-title">{selected.title}</h3><dl className="mod-detail-list">{[['Mã bài đăng', selected.postCode], ['Người đăng', `@${selected.author}`], ['Loại bài', selected.type === 'lost' ? 'Mất đồ' : 'Nhặt được'], ['Danh mục', selected.category], ['Ngày đăng', selected.dateTime], ['Vị trí', selected.location], ['Trạng thái', <Status key="status" value={selected.status} hidden={selected.hidden} />]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{selected.hidden && selected.hiddenReason && <section className="workspace-post-hidden-reason" aria-label="Lý do ẩn bài đăng"><strong>Lý do ẩn bài đăng</strong><p>{selected.hiddenReason}</p></section>}<h4>Nội dung mô tả</h4><p className="mod-description">{selected.desc}</p>{selected.images.length > 0 && <><h4>Hình ảnh đính kèm</h4><div className="mod-detail-images">{selected.images.map((src, index) => <img key={src} src={src} alt={`Ảnh minh họa ${index + 1} của bài ${selected.title}`} loading="lazy" />)}</div></>}<MatchingPosts matches={matchingPosts} onView={(id) => setModal({ kind: 'detail', id, returnId: selected.id })} /></ModDialog>}
      {selected && modal.kind === 'edit' && <ModDialog title="Cập nhật trạng thái" onClose={() => setModal(null)} footer={<><button className="mod-button" onClick={() => setModal(null)}>Hủy</button><button className="mod-button primary" onClick={saveStatus}>Cập nhật</button></>}><p className="mod-edit-title">{selected.title}</p><fieldset className="mod-status-options"><legend>Chọn trạng thái mới cho bài đăng</legend>{Object.entries(STATUS_LABELS).map(([value, label]) => <label key={value}><input type="radio" name="postStatus" value={value} checked={nextStatus === value} onChange={() => setNextStatus(value)} /><span className={`mod-status ${value}`}>{label}</span></label>)}</fieldset></ModDialog>}
      {selected && modal.kind === 'visibility' && <VisibilityDialog key={selected.id} post={selected} onSubmit={saveVisibility} onClose={() => setModal(null)} />}
    </div>
  )
}
