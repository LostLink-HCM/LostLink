import { useRef, useState } from 'react'
import ModIcon from '../../components/ui/Icon'
import ModDialog from '../../components/moderator/ModDialog'
import ModDateRange from '../../components/moderator/ModDateRange'
import { EMPTY_FILTERS, STATUS_LABELS, filterModeratorPosts, hasInvalidRange, postsToCsv, setPostHidden, validateHideReason } from '../../lib/moderatorPosts'

import { postUi, postStatusColors, postTypeColors, postDialogClasses, postDateClasses } from '../../components/moderator/postStyles'

const PAGE_SIZE = 8

function Status({ value, hidden }) {
  return <span className="inline-flex flex-wrap items-center gap-[6px]"><span className={`${postUi.badge} ${postStatusColors[value]}`}>{STATUS_LABELS[value]}</span>{hidden && <span className="inline-flex max-w-full items-center rounded-[5px] bg-[#e9edf3] px-[7px] py-[5px] text-[11px] font-semibold text-[#626c7d]">Đã ẩn</span>}</span>
}

function MatchingPosts({ matches, onView }) {
  return <section className="mt-[24px] border-0 border-t border-solid border-[#d4e0ec] pt-[20px] [&_ul]:m-0 [&_ul]:grid [&_ul]:list-none [&_ul]:gap-[14px] [&_ul]:p-0 [&_li]:min-w-0 [&_li]:rounded-[9px] [&_li]:border [&_li]:border-solid [&_li]:border-[#b8cde2] [&_li]:bg-[#f8fbfe] [&_li]:p-[18px] max-[600px]:[&_li]:p-[14px]" aria-label="Bài đăng đang matching">
    <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[8px] [&_h4]:m-0 [&_h4]:text-[17px] [&_h4]:font-semibold [&_span]:text-[14px] [&_span]:text-[#71859c]"><h4 className={postUi.subheading}>Bài đăng đang matching</h4><span>{matches.length} bài đăng</span></div>
    {matches.length ? <ul>{matches.map(({ id, post, score }) => <li key={id}>
      <div className="mb-[12px] flex items-start justify-between gap-[12px]">
        <div><span className={`${postUi.badge} ${postTypeColors[post.type]}`}>{post.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}</span><span className="ml-[10px] text-[13px] text-[#71859c]">{post.postCode}</span></div>
        <div className="flex shrink-0 flex-col items-end gap-[3px] [&_strong]:text-[25px] [&_strong]:leading-[1.1] [&_strong]:text-[#1a639e] [&_span]:text-[12px] [&_span]:text-[#71859c]"><strong>{(score * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</strong><span>Tỷ lệ matching</span></div>
      </div>
      <button className={postUi.title} onClick={() => onView(post.id)}>{post.title}</button>
      <p className="my-[6px] text-[13px] text-[#71859c] [overflow-wrap:anywhere]">{post.author} · {post.dateTime}</p>
      <div className={postUi.location}><ModIcon name="pin" size={15} />{post.location}</div>
      <p className="mt-[12px] mb-[16px] text-[14px] leading-[1.75] text-[#4e647c] [overflow-wrap:anywhere]">{post.desc}</p>
      <div className="flex flex-wrap items-center justify-between gap-[10px]"><Status value={post.status} hidden={post.hidden} /><button className={postUi.button} onClick={() => onView(post.id)}>Xem bài đăng<ModIcon name="next" size={15} /></button></div>
    </li>)}</ul> : <p className="m-0 rounded-[8px] bg-[#f5f8fc] p-[20px] text-center text-[14px] text-[#71859c]">Chưa có bài đăng đang matching.</p>}
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
  return <ModDialog classes={postDialogClasses} title={post.hidden ? 'Hiện lại bài đăng' : 'Ẩn bài đăng'} onClose={onClose} footer={<><button className={postUi.button} autoFocus={post.hidden} onClick={onClose}>Hủy</button><button type="submit" form="post-visibility-form" className={post.hidden ? postUi.primaryButton : postUi.dangerButton}><ModIcon name={post.hidden ? 'eye' : 'eyeOff'} size={16} />{post.hidden ? 'Hiện lại bài đăng' : 'Ẩn bài đăng'}</button></>}>
    <form id="post-visibility-form" className="[&_label]:mt-[18px] [&_label]:mb-[9px] [&_label]:block [&_label]:text-[15px] [&_label]:font-medium" onSubmit={submit} noValidate>
      <p className={postUi.editTitle}>{post.title}</p>
      <p className="text-[15px] leading-[1.8] text-[#61738b]">{post.hidden ? 'Bạn muốn hiện lại bài đăng này?' : 'Bài vẫn được giữ trong danh sách quản lý để có thể kiểm tra và hiện lại.'}</p>
      {!post.hidden && <>
        <label htmlFor="post-hide-reason">Lý do ẩn bài đăng <span className="text-[13px] font-normal text-[#75859a]">(bắt buộc)</span></label>
        <textarea className="min-h-[110px] w-full resize-y rounded-[7px] border border-solid border-[#cbd5e1] bg-white px-[12px] py-[10px] text-[15px] leading-[1.7] text-[#334155] [font-family:inherit] aria-invalid:border-[#c73352] focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-3 focus-visible:outline-[#60a5fa]" ref={reasonRef} autoFocus id="post-hide-reason" rows={4} maxLength={500} required value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder="Nhập lý do ẩn bài đăng…" aria-invalid={Boolean(error)} aria-describedby={`post-hide-reason-count${error ? ' post-hide-reason-error' : ''}`} />
        <small id="post-hide-reason-count" className="mt-[6px] block text-right text-[12px] text-[#75859a]">{reason.length}/500 ký tự</small>
        {error && <p id="post-hide-reason-error" className={postUi.error} role="alert">{error}</p>}
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
    <div className="box-border px-[32px] py-[28px] text-[13px] text-[#16233a] [&_*]:box-border [&_button]:[font-family:inherit] max-[1200px]:px-[22px] max-[600px]:px-[16px] max-[600px]:py-[22px]">
      {pendingOnly && <div className="mb-[24px] flex items-center justify-between gap-[16px] [&_h2]:m-0 [&_h2]:mb-[7px] [&_h2]:text-[21px] [&_h2]:font-bold [&_h2]:text-[#16233a] [&_p]:text-[12px] [&_p]:leading-[1.7] [&_p]:text-[#64748b]"><div><h2>Bài đăng chờ xét duyệt</h2><p>Theo dõi và quản lý các bài đăng trong cộng đồng LostLink.</p></div></div>}
      <section className="rounded-[12px] border border-solid border-[#dce4ed] bg-white p-[22px] shadow-[0_2px_6px_#16233a03] max-[600px]:p-[16px]" aria-label="Bộ lọc bài đăng">
        <div className="grid grid-cols-[minmax(205px,1.4fr)_repeat(4,minmax(0,1fr))] gap-x-[12px] gap-y-[10px] max-[600px]:grid-cols-2 max-[600px]:gap-[12px]">
          <label className="flex min-w-0 flex-col gap-[5px] text-[13px] font-semibold text-[#43536b]">Tìm kiếm<input className={postUi.input} type="search" value={filters.query} onChange={(e) => changeFilter('query', e.target.value)} placeholder="Tiêu đề, người đăng, khu vực…" /></label>
          <label className={postUi.label}>Trạng thái<select className={postUi.input} value={effectiveFilters.status} disabled={pendingOnly} onChange={(e) => changeFilter('status', e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={postUi.label}>Danh mục<select className={postUi.input} value={filters.category} onChange={(e) => changeFilter('category', e.target.value)}><option value="">Tất cả danh mục</option>{[...new Set(posts.map((p) => p.category))].map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className={postUi.label}>Loại bài đăng<select className={postUi.input} value={filters.type} onChange={(e) => changeFilter('type', e.target.value)}><option value="">Tất cả loại tin</option><option value="lost">Mất đồ</option><option value="found">Nhặt được</option></select></label>
          <label className={postUi.label}>Khu vực<select className={postUi.input} value={filters.district} onChange={(e) => changeFilter('district', e.target.value)}><option value="">Tất cả khu vực</option>{[...new Set(posts.map((p) => p.district))].map((district) => <option key={district}>{district}</option>)}</select></label>
        </div>
        <ModDateRange classes={postDateClasses} filters={filters} onChange={changeFilter}>
          <div className="ml-auto flex gap-[8px] max-[600px]:basis-full max-[600px]:justify-end"><button className={postUi.resetButton} onClick={resetFilters} aria-label="Đặt lại bộ lọc" title="Đặt lại bộ lọc"><ModIcon name="reset" /></button><button className={postUi.primaryButton} onClick={exportCsv} disabled={invalidRange || !filtered.length}><ModIcon name="download" />Xuất CSV</button></div>
        </ModDateRange>
      </section>
      <div className="mt-[22px] mb-[12px] flex flex-wrap items-center justify-between gap-[8px] text-[14px] text-[#64748b] [&_strong]:px-[3px] [&_strong]:text-[17px] [&_strong]:text-[#1a528e] [&>span+span]:text-[13px] [&>span+span]:text-[#1a528e]" aria-live="polite"><span>Số lượng: <strong>{filtered.length}</strong> bài đăng</span><span>{notice}</span></div>
      <div className="overflow-x-hidden overflow-y-visible rounded-[11px] border border-solid border-[#b4c6db] bg-white">
        <table className="w-full min-w-0 table-fixed border-collapse text-left text-[12px]">
          <caption className="sr-only">Danh sách bài đăng của cộng đồng</caption>
          <colgroup><col className="w-[8%]" /><col className="w-[25%]" /><col className="w-[12%]" /><col className="w-[18%]" /><col className="w-[13%]" /><col className="w-[11%]" /><col className="w-[13%]" /></colgroup>
          <thead><tr>{['ID', 'Thông tin bài đăng', 'Phân loại', 'Thời gian & Vị trí', 'Thống kê', 'Trạng thái', 'Thao tác'].map((title) => <th className={postUi.tableHead} key={title} scope="col">{title}</th>)}</tr></thead>
          <tbody className="[&_tr:last-child_td]:border-b-0">{visible.map((post) => <tr key={post.id} className="hover:bg-[#f9fbfe]">
            <td className={`${postUi.tableCell} text-left text-[11px] font-semibold whitespace-nowrap text-[#1a528e]`}>{post.postCode}</td>
            <td className={postUi.tableCell}><button className={postUi.title} onClick={() => setModal({ kind: 'detail', id: post.id })}>{post.title}</button><span className="mt-[7px] inline-block rounded-[4px] bg-[#f0f3f7] px-[7px] py-[3px] text-[11px] text-[#697b91]">{post.category}</span></td>
            <td className={postUi.tableCell}><span className={`${postUi.badge} ${postTypeColors[post.type]}`}>{post.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}</span></td>
            <td className={postUi.tableCell}><div className="text-[12px] font-semibold">{post.dateTime}</div><div className={postUi.location}><ModIcon name="pin" size={13} />{post.location}</div></td>
            <td className={postUi.tableCell}><div className="flex flex-nowrap gap-[6px] text-[12px] whitespace-nowrap text-[#7e8ea4] [&_span]:flex [&_span]:shrink-0 [&_span]:items-center [&_span]:gap-[3px] [&_span:last-child]:text-[#1a528e] [&_svg]:h-[13px] [&_svg]:w-[13px]">{[['eye', post.views, 'Lượt xem'], ['chat', post.comments, 'Bình luận'], ['link', post.matches, 'Ghép nối']].map(([icon, count, label]) => <span key={icon} title={label} aria-label={`${label}: ${count}`}><ModIcon name={icon} size={14} />{count}</span>)}</div></td>
            <td className={postUi.tableCell}><Status value={post.status} hidden={post.hidden} /></td>
            <td className={postUi.tableCell}><div className="flex flex-wrap gap-[6px]"><button className={postUi.viewAction} aria-label={`Xem chi tiết bài #${post.id}`} title="Xem chi tiết" onClick={() => setModal({ kind: 'detail', id: post.id })}><ModIcon name="eye" /></button><button className={postUi.editAction} aria-label={`Cập nhật trạng thái bài #${post.id}`} title="Cập nhật trạng thái" onClick={() => { setNextStatus(post.status); setModal({ kind: 'edit', id: post.id }) }}><ModIcon name="edit" /></button><button className={post.hidden ? postUi.restoreAction : postUi.hideAction} aria-label={`${post.hidden ? 'Hiện lại' : 'Ẩn'} bài đăng #${post.id}`} title={post.hidden ? 'Hiện lại bài đăng' : 'Ẩn bài đăng'} onClick={() => setModal({ kind: 'visibility', id: post.id })}><ModIcon name={post.hidden ? 'eye' : 'eyeOff'} /></button></div></td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <div className="flex flex-col items-center px-[20px] py-[54px] text-center text-[#8494a8] [&_h3]:mt-[18px] [&_h3]:mb-[8px] [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-[#334155] [&_p]:mb-[20px] [&_p]:text-[12px]"><ModIcon name="list" size={36} /><h3>{invalidRange ? 'Khoảng thời gian chưa hợp lệ' : 'Không tìm thấy bài đăng phù hợp'}</h3><p>{invalidRange ? 'Vui lòng kiểm tra lại ngày bắt đầu và ngày kết thúc.' : 'Thử thay đổi bộ lọc hoặc chọn khoảng thời gian khác.'}</p><button className={postUi.button} onClick={resetFilters}>Xóa bộ lọc</button></div>}
      </div>
      <nav className="mt-[18px] flex items-center justify-between gap-[16px] text-[13px] text-[#8494a8] [&>div]:flex [&>div]:gap-[6px] max-[600px]:flex-wrap" aria-label="Phân trang bài đăng"><span>Hiển thị {filtered.length ? start + 1 : 0}–{Math.min(start + PAGE_SIZE, filtered.length)} trong số {filtered.length} bài</span><div><button className={postUi.iconButton} aria-label="Trang trước" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ModIcon name="back" size={16} /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={currentPage === number ? postUi.selectedButton : postUi.iconButton} aria-label={`Trang ${number}`} aria-current={currentPage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}<button className={postUi.iconButton} aria-label="Trang sau" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ModIcon name="next" size={16} /></button></div></nav>
      {selected && modal.kind === 'detail' && <ModDialog classes={postDialogClasses} key={selected.id} title="Chi tiết bài đăng" footer={modal.returnId ? <><button className={postUi.button} onClick={() => setModal({ kind: 'detail', id: modal.returnId })}><ModIcon name="back" size={15} />Quay lại bài trước</button><button className={postUi.button} onClick={() => setModal(null)}>Đóng</button></> : undefined} onClose={() => setModal(null)}><h3 className="mt-[21px] mb-[12px] text-[21px] leading-[1.6] font-bold text-[#1a528e]">{selected.title}</h3><dl className="my-[1em] [&>div]:grid [&>div]:grid-cols-[110px_1fr] [&>div]:gap-[14px] [&>div]:border-0 [&>div]:border-b [&>div]:border-solid [&>div]:border-[#edf1f5] [&>div]:py-[12px] [&>div]:text-[15px] [&_dt]:text-[#8494a8] [&_dd]:m-0 [&_dd]:font-medium [&_dd]:[overflow-wrap:anywhere] max-[600px]:[&>div]:grid-cols-[90px_minmax(0,1fr)] max-[600px]:[&>div]:gap-[10px]">{[['Mã bài đăng', selected.postCode], ['Người đăng', `@${selected.author}`], ['Loại bài', selected.type === 'lost' ? 'Mất đồ' : 'Nhặt được'], ['Danh mục', selected.category], ['Ngày đăng', selected.dateTime], ['Vị trí', selected.location], ['Trạng thái', <Status key="status" value={selected.status} hidden={selected.hidden} />]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{selected.hidden && selected.hiddenReason && <section className="mt-[18px] rounded-[8px] border border-solid border-[#e7c5ce] bg-[#fff6f8] px-[16px] py-[14px] text-[15px] leading-[1.7] text-[#954158] [&_p]:mt-[5px] [&_p]:whitespace-pre-wrap [&_p]:[overflow-wrap:anywhere]" aria-label="Lý do ẩn bài đăng"><strong>Lý do ẩn bài đăng</strong><p>{selected.hiddenReason}</p></section>}<h4 className={postUi.subheading}>Nội dung mô tả</h4><p className={postUi.description}>{selected.desc}</p>{selected.images.length > 0 && <><h4 className={postUi.subheading}>Hình ảnh đính kèm</h4><div className="flex flex-wrap gap-[12px] [&_img]:h-[150px] [&_img]:w-[150px] [&_img]:rounded-[8px] [&_img]:object-cover">{selected.images.map((src, index) => <img key={src} src={src} alt={`Ảnh minh họa ${index + 1} của bài ${selected.title}`} loading="lazy" />)}</div></>}<MatchingPosts matches={matchingPosts} onView={(id) => setModal({ kind: 'detail', id, returnId: selected.id })} /></ModDialog>}
      {selected && modal.kind === 'edit' && <ModDialog classes={postDialogClasses} title="Cập nhật trạng thái" onClose={() => setModal(null)} footer={<><button className={postUi.button} onClick={() => setModal(null)}>Hủy</button><button className={postUi.primaryButton} onClick={saveStatus}>Cập nhật</button></>}><p className={postUi.editTitle}>{selected.title}</p><fieldset className="m-0 border-0 p-0 [&_legend]:mb-[10px] [&_legend]:text-[15px] [&_legend]:text-[#64748b] [&_label]:mb-[9px] [&_label]:flex [&_label]:cursor-pointer [&_label]:items-center [&_label]:gap-[12px] [&_label]:rounded-[7px] [&_label]:border [&_label]:border-solid [&_label]:border-[#dce4ed] [&_label]:p-[12px] [&_label:has(input:checked)]:border-[#1a528e] [&_label:has(input:checked)]:bg-[#f5f9fd] [&_input]:accent-[#1a528e]"><legend>Chọn trạng thái mới cho bài đăng</legend>{Object.entries(STATUS_LABELS).map(([value, label]) => <label key={value}><input type="radio" name="postStatus" value={value} checked={nextStatus === value} onChange={() => setNextStatus(value)} /><span className={`${postUi.badge} ${postStatusColors[value]}`}>{label}</span></label>)}</fieldset></ModDialog>}
      {selected && modal.kind === 'visibility' && <VisibilityDialog key={selected.id} post={selected} onSubmit={saveVisibility} onClose={() => setModal(null)} />}
    </div>
  )
}
