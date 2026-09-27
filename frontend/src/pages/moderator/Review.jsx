import { useState } from 'react'
import ModIcon from '../../components/moderator/ModIcon'
import ModDialog from '../../components/moderator/ModDialog'
import { QueueToolbar, QueueSummary, QueuePagination, QueueEmpty } from '../../components/moderator/QueueControls'
import { filterModeratorPosts } from '../../lib/moderatorPosts'
import { REJECT_REASONS, reviewPost, downloadCsv } from '../../lib/moderation'
import { reviewUi, reviewCategoryColors, reviewDialogClasses, reviewQueueClasses } from '../../components/moderator/reviewStyles'

const EMPTY_FILTERS = { category: '', type: '', district: '', from: '', to: '', query: '' }
const PAGE_SIZE = 8

function Reputation({ score }) {
  const tone = score < 0 ? 'danger' : score >= 100 ? 'success' : 'neutral'
  const toneClass = tone === 'danger' ? reviewUi.reputationDanger : tone === 'success' ? reviewUi.reputationSuccess : reviewUi.reputationNeutral
  return <span className={`${reviewUi.reputation} ${toneClass}`}><ModIcon name={score < 0 ? 'warning' : score >= 100 ? 'star' : 'user'} size={14} />{score == null ? 'Chưa có điểm uy tín' : `Điểm: ${score}`}</span>
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

  return <div className={reviewUi.root}>
    <QueueToolbar classes={reviewQueueClasses} onReset={() => { setFilters(EMPTY_FILTERS); setPage(1) }} onExport={exportCsv} empty={!filtered.length} dateFilters={filters} onDateChange={changeFilter}>
      <label className={reviewUi.label}>Tìm kiếm<input className={reviewUi.input} type="search" value={filters.query} onChange={(e) => changeFilter('query', e.target.value)} placeholder="Tiêu đề, người đăng, khu vực…" /></label>
      <label className={reviewUi.label}>Danh mục<select className={reviewUi.input} value={filters.category} onChange={(e) => changeFilter('category', e.target.value)}><option value="">Tất cả danh mục</option>{[...new Set(posts.map((post) => post.category))].map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className={reviewUi.label}>Loại bài đăng<select className={reviewUi.input} value={filters.type} onChange={(e) => changeFilter('type', e.target.value)}><option value="">Tất cả loại tin</option><option value="lost">Mất đồ</option><option value="found">Nhặt được</option></select></label>
      <label className={reviewUi.label}>Khu vực<select className={reviewUi.input} value={filters.district} onChange={(e) => changeFilter('district', e.target.value)}><option value="">Tất cả khu vực</option>{[...new Set(posts.map((post) => post.district))].map((district) => <option key={district}>{district}</option>)}</select></label>
    </QueueToolbar>
    <QueueSummary classes={reviewUi} count={filtered.length} notice={notice} />
    <div className={reviewUi.tableContainer}>
      <table className={reviewUi.table}>
        <caption className="sr-only">Bài đăng chờ kiểm duyệt</caption>
        <colgroup><col className="w-[12%]" /><col className="w-[28%]" /><col className="w-[20%]" /><col className="w-[23%]" /><col className="w-[17%]" /></colgroup>
        <thead><tr>{['ID', 'Bài đăng chờ duyệt', 'Người đăng', 'Danh mục & Vị trí', 'Thao tác'].map((label) => <th className={reviewUi.tableHead} key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody className="[&_tr:last-child_td]:border-b-0">{visible.map((post) => <tr key={post.id} className="hover:bg-[#f9fbfe]">
          <td className={reviewUi.tableCell}><span className={reviewUi.code}>{post.postCode || post.id}</span></td>
          <td className={reviewUi.tableCell}><button className={reviewUi.title} onClick={() => setModal({ id: post.id, kind: 'detail' })}>{post.title}</button><span className={post.type === 'lost' ? reviewUi.typeLost : reviewUi.typeFound}>{post.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}</span></td>
          <td className={reviewUi.tableCell}><strong className={reviewUi.author}>@{post.author}</strong><Reputation score={post.reputation} /></td>
          <td className={reviewUi.tableCell}><span className={`${reviewUi.category} ${reviewCategoryColors[post.category] || reviewUi.categoryDefault}`}>{post.category}</span><div className={reviewUi.location}><ModIcon name="calendar" size={13} />{post.dateTime}</div><div className={reviewUi.location}><ModIcon name="pin" size={13} />{post.location}</div></td>
          <td className={reviewUi.tableCell}><div className={reviewUi.actions}><button className={reviewUi.viewAction} title="Đọc bài đăng" aria-label={`Đọc bài ${post.postCode || post.id}`} onClick={() => setModal({ id: post.id, kind: 'detail' })}><ModIcon name="eye" /></button><button className={reviewUi.approveAction} title="Duyệt xuất bản" aria-label={`Duyệt bài ${post.postCode || post.id}`} onClick={() => openApprove(post.id)}><ModIcon name="check" /></button><button className={reviewUi.rejectAction} title="Từ chối bài" aria-label={`Từ chối bài ${post.postCode || post.id}`} onClick={() => openReject(post.id)}><ModIcon name="close" /></button></div></td>
        </tr>)}</tbody>
      </table>
      {!visible.length && <QueueEmpty classes={reviewUi}>Không có bài đăng nào cần duyệt trong danh sách này.</QueueEmpty>}
    </div>
    <QueuePagination classes={reviewUi} page={currentPage} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
    {selected && modal.kind === 'detail' && <ModDialog classes={reviewDialogClasses} key="detail" title="Đọc và duyệt bài đăng" onClose={() => setModal(null)} footer={<><button className={reviewUi.button} onClick={() => setModal(null)}>Đóng xem trước</button><button className={reviewUi.dangerButton} onClick={() => openReject(selected.id)}><ModIcon name="close" />Từ chối bài</button><button className={reviewUi.successButton} onClick={() => openApprove(selected.id, true)}><ModIcon name="check" />Duyệt xuất bản</button></>}>
      <h3 className={reviewUi.detailTitle}>{selected.title}</h3>
      <dl className={reviewUi.detailList}><div><dt>Người đăng</dt><dd>@{selected.author}<Reputation score={selected.reputation} /></dd></div><div><dt>Loại tin</dt><dd>{selected.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}</dd></div><div><dt>Danh mục</dt><dd>{selected.category}</dd></div><div><dt>Ngày đăng</dt><dd>{selected.dateTime}</dd></div><div><dt>Vị trí</dt><dd>{selected.location}</dd></div></dl>
      <h4 className={reviewUi.heading}>Nội dung do người dùng đăng</h4><p className={reviewUi.description}>{selected.desc}</p>
      {!!selected.images?.length && <><h4 className={reviewUi.heading}>Hình ảnh đính kèm</h4><div className={reviewUi.images}>{selected.images.map((src, index) => <img key={src} src={src} alt={`Ảnh minh họa ${index + 1} của bài ${selected.title}`} loading="lazy" />)}</div></>}
    </ModDialog>}
    {selected && modal.kind === 'approve' && <ModDialog classes={reviewDialogClasses} key="approve" title="Xác nhận duyệt bài đăng" onClose={cancelApprove} footer={<><button className={reviewUi.button} autoFocus onClick={cancelApprove}>Hủy</button><button className={reviewUi.successButton} onClick={() => approve(selected.id)}><ModIcon name="check" />Xác nhận duyệt</button></>}>
      <p className={reviewUi.editTitle}>{selected.postCode || selected.id} · {selected.title}</p>
      <p className={reviewUi.description}>Bạn có chắc muốn duyệt xuất bản bài đăng này? Sau khi duyệt, bài đăng sẽ chuyển sang trạng thái Đang tìm và rời hàng đợi kiểm duyệt.</p>
    </ModDialog>}
    {selected && modal.kind === 'reject' && <ModDialog classes={reviewDialogClasses} key="reject" title="Từ chối bài đăng" onClose={() => setModal(null)} footer={<><button className={reviewUi.button} onClick={() => setModal(null)}>Hủy</button><button className={reviewUi.dangerButton} type="submit" form="mod-reject-form">Xác nhận từ chối</button></>}>
      <p className={reviewUi.editTitle}>{selected.title}</p>
      <form id="mod-reject-form" className={reviewUi.form} onSubmit={reject}>
        <label>Lý do từ chối<select value={reason} onChange={(e) => { setReason(e.target.value); setError('') }}>{REJECT_REASONS.map((label) => <option key={label}>{label}</option>)}<option value="other">Lý do khác</option></select></label>
        {reason === 'other' && <label>Lý do cụ thể<textarea value={customReason} onChange={(e) => { setCustomReason(e.target.value); setError('') }} maxLength={1000} aria-invalid={Boolean(error)} aria-describedby={error ? 'mod-reject-error' : undefined} placeholder="Nhập lý do không duyệt bài đăng…" /></label>}
        {error && <p className={reviewUi.error} id="mod-reject-error" role="alert">{error}</p>}
        <p className={reviewUi.hint}>Bài đăng sẽ rời hàng đợi sau khi xác nhận từ chối.</p>
      </form>
    </ModDialog>}
  </div>
}
