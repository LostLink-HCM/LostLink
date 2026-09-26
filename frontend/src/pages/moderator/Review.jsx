import { useState } from 'react'
import ModIcon from '../../components/moderator/ModIcon'
import ModDialog from '../../components/moderator/ModDialog'
import { QueueToolbar, QueueSummary, QueuePagination, QueueEmpty } from '../../components/moderator/QueueControls'
import { filterModeratorPosts } from '../../lib/moderatorPosts'
import { REJECT_REASONS, reviewPost, downloadCsv } from '../../lib/moderation'

const EMPTY_FILTERS = { category: '', type: '', district: '', from: '', to: '', query: '' }
const PAGE_SIZE = 8

function Reputation({ score }) {
  const tone = score < 0 ? 'danger' : score >= 100 ? 'success' : 'neutral'
  return <span className={`mod-reputation ${tone}`}><ModIcon name={score < 0 ? 'warning' : score >= 100 ? 'star' : 'user'} size={14} />{score == null ? 'Chưa có điểm uy tín' : `Điểm: ${score}`}</span>
}

export default function Review({ posts, setPosts }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [reason, setReason] = useState(REJECT_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const filtered = filterModeratorPosts(posts, { ...filters, status: 'pending' })
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selected = modal && posts.find((post) => post.id === modal.id && post.status === 'pending')
  const changeFilter = (key, value) => { setFilters((previous) => ({ ...previous, [key]: value })); setPage(1) }
  const openReject = (id) => { setReason(REJECT_REASONS[0]); setCustomReason(''); setError(''); setModal({ id, kind: 'reject' }) }
  const openApprove = (id, fromDetail = false) => setModal({ id, kind: 'approve', fromDetail })
  const cancelApprove = () => setModal(modal.fromDetail ? { id: modal.id, kind: 'detail' } : null)
  const approve = (id) => {
    setPosts((previous) => reviewPost(previous, id, 'approve'))
    setModal(null)
    setNotice(`Đã duyệt bài ${posts.find((post) => post.id === id)?.postCode || id}. Bài chuyển sang trạng thái Đang tìm và rời hàng đợi.`)
  }
  const reject = (event) => {
    event.preventDefault()
    const detail = reason === 'other' ? customReason.trim() : reason
    if (!detail) { setError('Vui lòng nhập lý do từ chối cụ thể.'); return }
    setPosts((previous) => reviewPost(previous, selected.id, 'reject', detail))
    setNotice(`Đã từ chối bài ${selected.postCode || selected.id}. Lý do: ${detail}`)
    setModal(null)
  }
  const exportCsv = () => {
    downloadCsv('LostLink_Bai_dang_cho_duyet.csv', [
      ['ID', 'Tiêu đề', 'Người đăng', 'Điểm uy tín', 'Danh mục', 'Loại tin', 'Thời gian', 'Vị trí'],
      ...filtered.map((post) => [post.postCode || post.id, post.title, post.author, post.reputation, post.category, post.type === 'lost' ? 'Mất đồ' : 'Nhặt được', post.dateTime, post.location]),
    ])
    setNotice(`Đã xuất ${filtered.length} bài đăng chờ duyệt ra CSV.`)
  }

  return <div className="mod-content">
    <QueueToolbar onReset={() => { setFilters(EMPTY_FILTERS); setPage(1) }} onExport={exportCsv} empty={!filtered.length} dateFilters={filters} onDateChange={changeFilter}>
      <label className="mod-search-filter">Tìm kiếm<input type="search" value={filters.query} onChange={(e) => changeFilter('query', e.target.value)} placeholder="Tiêu đề, người đăng, khu vực…" /></label>
      <label>Danh mục<select value={filters.category} onChange={(e) => changeFilter('category', e.target.value)}><option value="">Tất cả danh mục</option>{[...new Set(posts.map((post) => post.category))].map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Loại bài đăng<select value={filters.type} onChange={(e) => changeFilter('type', e.target.value)}><option value="">Tất cả loại tin</option><option value="lost">Mất đồ</option><option value="found">Nhặt được</option></select></label>
      <label>Khu vực<select value={filters.district} onChange={(e) => changeFilter('district', e.target.value)}><option value="">Tất cả khu vực</option>{[...new Set(posts.map((post) => post.district))].map((district) => <option key={district}>{district}</option>)}</select></label>
    </QueueToolbar>
    <QueueSummary count={filtered.length} notice={notice} />
    <div className="mod-table-container">
      <table className="mod-table mod-review-table">
        <caption className="sr-only">Bài đăng chờ kiểm duyệt</caption>
        <colgroup><col style={{ width: '12%' }} /><col style={{ width: '28%' }} /><col style={{ width: '20%' }} /><col style={{ width: '23%' }} /><col style={{ width: '17%' }} /></colgroup>
        <thead><tr>{['ID', 'Bài đăng chờ duyệt', 'Người đăng', 'Danh mục & Vị trí', 'Thao tác'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{visible.map((post) => <tr key={post.id}>
          <td className="mod-review-code">{post.postCode || post.id}</td>
          <td><button className="mod-post-title" onClick={() => setModal({ id: post.id, kind: 'detail' })}>{post.title}</button><span className={`mod-type mod-cell-badge ${post.type}`}>{post.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}</span></td>
          <td><strong className="mod-author">@{post.author}</strong><Reputation score={post.reputation} /></td>
          <td><span className="mod-category" data-category={post.category}>{post.category}</span><div className="mod-post-location"><ModIcon name="calendar" size={13} />{post.dateTime}</div><div className="mod-post-location"><ModIcon name="pin" size={13} />{post.location}</div></td>
          <td><div className="mod-row-actions"><button className="mod-icon-button view" title="Đọc bài đăng" aria-label={`Đọc bài ${post.postCode || post.id}`} onClick={() => setModal({ id: post.id, kind: 'detail' })}><ModIcon name="eye" /></button><button className="mod-icon-button success" title="Duyệt xuất bản" aria-label={`Duyệt bài ${post.postCode || post.id}`} onClick={() => openApprove(post.id)}><ModIcon name="check" /></button><button className="mod-icon-button danger" title="Từ chối bài" aria-label={`Từ chối bài ${post.postCode || post.id}`} onClick={() => openReject(post.id)}><ModIcon name="close" /></button></div></td>
        </tr>)}</tbody>
      </table>
      {!visible.length && <QueueEmpty>Không có bài đăng nào cần duyệt trong danh sách này.</QueueEmpty>}
    </div>
    <QueuePagination page={currentPage} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
    {selected && modal.kind === 'detail' && <ModDialog key="detail" title="Đọc và duyệt bài đăng" onClose={() => setModal(null)} footer={<><button className="mod-button" onClick={() => setModal(null)}>Đóng xem trước</button><button className="mod-button danger" onClick={() => openReject(selected.id)}><ModIcon name="close" />Từ chối bài</button><button className="mod-button success" onClick={() => openApprove(selected.id, true)}><ModIcon name="check" />Duyệt xuất bản</button></>}>
      <h3 className="mod-detail-title">{selected.title}</h3>
      <dl className="mod-detail-list"><div><dt>Người đăng</dt><dd>@{selected.author}<Reputation score={selected.reputation} /></dd></div><div><dt>Loại tin</dt><dd>{selected.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}</dd></div><div><dt>Danh mục</dt><dd>{selected.category}</dd></div><div><dt>Ngày đăng</dt><dd>{selected.dateTime}</dd></div><div><dt>Vị trí</dt><dd>{selected.location}</dd></div></dl>
      <h4>Nội dung do người dùng đăng</h4><p className="mod-description">{selected.desc}</p>
      {!!selected.images?.length && <><h4>Hình ảnh đính kèm</h4><div className="mod-detail-images">{selected.images.map((src, index) => <img key={src} src={src} alt={`Ảnh minh họa ${index + 1} của bài ${selected.title}`} loading="lazy" />)}</div></>}
    </ModDialog>}
    {selected && modal.kind === 'approve' && <ModDialog key="approve" title="Xác nhận duyệt bài đăng" onClose={cancelApprove} footer={<><button className="mod-button" autoFocus onClick={cancelApprove}>Hủy</button><button className="mod-button success" onClick={() => approve(selected.id)}><ModIcon name="check" />Xác nhận duyệt</button></>}>
      <p className="mod-edit-title">{selected.postCode || selected.id} · {selected.title}</p>
      <p className="mod-description">Bạn có chắc muốn duyệt xuất bản bài đăng này? Sau khi duyệt, bài đăng sẽ chuyển sang trạng thái Đang tìm và rời hàng đợi kiểm duyệt.</p>
    </ModDialog>}
    {selected && modal.kind === 'reject' && <ModDialog key="reject" title="Từ chối bài đăng" onClose={() => setModal(null)} footer={<><button className="mod-button" onClick={() => setModal(null)}>Hủy</button><button className="mod-button danger" type="submit" form="mod-reject-form">Xác nhận từ chối</button></>}>
      <p className="mod-edit-title">{selected.title}</p>
      <form id="mod-reject-form" className="mod-action-form" onSubmit={reject}>
        <label>Lý do từ chối<select value={reason} onChange={(e) => { setReason(e.target.value); setError('') }}>{REJECT_REASONS.map((label) => <option key={label}>{label}</option>)}<option value="other">Lý do khác</option></select></label>
        {reason === 'other' && <label>Lý do cụ thể<textarea value={customReason} onChange={(e) => { setCustomReason(e.target.value); setError('') }} maxLength={1000} aria-invalid={Boolean(error)} aria-describedby={error ? 'mod-reject-error' : undefined} placeholder="Nhập lý do không duyệt bài đăng…" /></label>}
        {error && <p className="mod-error" id="mod-reject-error" role="alert">{error}</p>}
        <p className="mod-filter-hint">Bài đăng sẽ rời hàng đợi sau khi xác nhận từ chối.</p>
      </form>
    </ModDialog>}
  </div>
}
