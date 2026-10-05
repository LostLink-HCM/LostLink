import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../../components/moderator/Badge'
import Button from '../../components/moderator/Button'
import DataTable, { cell } from '../../components/moderator/DataTable'
import DateRange from '../../components/moderator/DateRange'
import DetailList from '../../components/moderator/DetailList'
import Dialog from '../../components/moderator/Dialog'
import EmptyState from '../../components/moderator/EmptyState'
import Field, { Input, Select, Textarea } from '../../components/moderator/Field'
import Icon from '../../components/common/Icon'
import IconButton from '../../components/moderator/IconButton'
import Notice from '../../components/moderator/Notice'
import Pagination from '../../components/moderator/Pagination'
import TypeBadge from '../../components/moderator/TypeBadge'
import { filterModeratorPosts } from '../../lib/moderatorPosts'
import { REJECT_REASONS, reviewPost } from '../../lib/moderation'
import { downloadCsv } from '../../lib/csv'

const EMPTY_FILTERS = { category: '', type: '', district: '', from: '', to: '', query: '' }
const PAGE_SIZE = 8

const CATEGORY_TONES = {
  'Đồ điện tử': 'primary',
  'Ví / Giấy tờ': 'info',
  'Thú cưng': 'success',
  'Chìa khóa': 'warning',
}

function Reputation({ score }) {
  const tone = score < 0 ? 'text-danger-ink' : score >= 100 ? 'text-success' : 'text-ink-muted'
  return (
    <span className={`mt-1.5 flex items-center gap-1 text-caption font-medium ${tone}`}>
      <Icon name={score < 0 ? 'warning' : score >= 100 ? 'star' : 'user'} size={14} />
      {score == null ? 'Chưa có điểm uy tín' : `Điểm: ${score}`}
    </span>
  )
}

function Meta({ icon, children }) {
  return (
    <div className="mt-1.5 flex items-start gap-1 text-caption text-ink-muted">
      <Icon name={icon} size={13} />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export default function Review() {
  const { posts, setPosts } = useOutletContext()
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
  const changeFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
  }
  const openReject = (id) => {
    setReason(REJECT_REASONS[0])
    setCustomReason('')
    setError('')
    setModal({ id, kind: 'reject' })
  }
  const openApprove = (id, fromDetail = false) => setModal({ id, kind: 'approve', fromDetail })
  const cancelApprove = () => setModal(modal.fromDetail ? { id: modal.id, kind: 'detail' } : null)
  const approve = (id) => {
    setPosts((previous) => reviewPost(previous, id, 'approve'))
    setModal(null)
    setNotice(
      `Đã duyệt bài ${posts.find((post) => post.id === id)?.postCode || id}. Bài chuyển sang trạng thái Đang tìm và rời hàng đợi.`
    )
  }
  const reject = (event) => {
    event.preventDefault()
    const detail = reason === 'other' ? customReason.trim() : reason
    if (!detail) {
      setError('Vui lòng nhập lý do từ chối cụ thể.')
      return
    }
    setPosts((previous) => reviewPost(previous, selected.id, 'reject', detail))
    setNotice(`Đã từ chối bài ${selected.postCode || selected.id}. Lý do: ${detail}`)
    setModal(null)
  }
  const exportCsv = () => {
    downloadCsv('LostLink_Bai_dang_cho_duyet.csv', [
      ['ID', 'Tiêu đề', 'Người đăng', 'Điểm uy tín', 'Danh mục', 'Loại tin', 'Thời gian', 'Vị trí'],
      ...filtered.map((post) => [
        post.postCode || post.id,
        post.title,
        post.author,
        post.reputation,
        post.category,
        post.type === 'lost' ? 'Mất đồ' : 'Nhặt được',
        post.dateTime,
        post.location,
      ]),
    ])
    setNotice(`Đã xuất ${filtered.length} bài đăng chờ duyệt ra CSV.`)
  }

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <section
        aria-label="Bộ lọc hàng đợi"
        className="rounded-xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid grid-cols-[minmax(205px,1.4fr)_repeat(3,minmax(0,1fr))] gap-3 max-sm:grid-cols-2">
          <Field label="Tìm kiếm">
            {(a) => (
              <Input
                {...a}
                type="search"
                value={filters.query}
                onChange={(e) => changeFilter('query', e.target.value)}
                placeholder="Tiêu đề, người đăng, khu vực…"
              />
            )}
          </Field>
          <Field label="Danh mục">
            {(a) => (
              <Select
                {...a}
                value={filters.category}
                onChange={(e) => changeFilter('category', e.target.value)}
              >
                <option value="">Tất cả danh mục</option>
                {[...new Set(posts.map((post) => post.category))].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Loại bài đăng">
            {(a) => (
              <Select
                {...a}
                value={filters.type}
                onChange={(e) => changeFilter('type', e.target.value)}
              >
                <option value="">Tất cả loại tin</option>
                <option value="lost">Mất đồ</option>
                <option value="found">Nhặt được</option>
              </Select>
            )}
          </Field>
          <Field label="Khu vực">
            {(a) => (
              <Select
                {...a}
                value={filters.district}
                onChange={(e) => changeFilter('district', e.target.value)}
              >
                <option value="">Tất cả khu vực</option>
                {[...new Set(posts.map((post) => post.district))].map((district) => (
                  <option key={district}>{district}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <DateRange from={filters.from} to={filters.to} onChange={changeFilter}>
          <div className="ml-auto flex gap-2 max-sm:basis-full max-sm:justify-end">
            <IconButton
              icon="reset"
              label="Đặt lại bộ lọc"
              bordered
              size={36}
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                setPage(1)
              }}
            />
            <Button variant="primary" onClick={exportCsv} disabled={!filtered.length}>
              <Icon name="download" />
              Xuất CSV
            </Button>
          </div>
        </DateRange>
      </section>

      <p className="mt-4 mb-2.5 text-small text-ink-muted">
        Số lượng: <strong className="px-1 text-lead text-primary">{filtered.length}</strong> bài
        đăng
      </p>
      {notice && <Notice>{notice}</Notice>}

      <DataTable
        caption="Bài đăng chờ kiểm duyệt"
        minWidth="min-w-[800px]"
        columns={[
          ['ID', 'w-[12%]'],
          ['Bài đăng chờ duyệt', 'w-[28%]'],
          ['Người đăng', 'w-[20%]'],
          ['Danh mục & Vị trí', 'w-[23%]'],
          ['Thao tác', 'w-[17%]'],
        ]}
        empty={
          !visible.length && (
            <EmptyState
              title="Không có bài đăng nào cần duyệt trong danh sách này."
              description="Thử thay đổi bộ lọc để xem các kết quả khác."
            />
          )
        }
      >
        {visible.map((post) => {
          const code = post.postCode || post.id
          return (
            <tr key={post.id} className="hover:bg-surface-muted">
              <td className={cell}>
                <span className="whitespace-nowrap text-caption font-semibold text-primary">
                  {code}
                </span>
              </td>
              <td className={cell}>
                <button
                  type="button"
                  className="mb-1.5 block cursor-pointer text-left text-small font-semibold leading-relaxed text-ink hover:text-primary"
                  onClick={() => setModal({ id: post.id, kind: 'detail' })}
                >
                  {post.title}
                </button>
                <TypeBadge type={post.type} />
              </td>
              <td className={cell}>
                <strong className="block text-small font-semibold">@{post.author}</strong>
                <Reputation score={post.reputation} />
              </td>
              <td className={cell}>
                <Badge tone={CATEGORY_TONES[post.category] ?? 'neutral'}>{post.category}</Badge>
                <Meta icon="calendar">{post.dateTime}</Meta>
                <Meta icon="pin">{post.location}</Meta>
              </td>
              <td className={cell}>
                <div className="flex flex-wrap gap-1.5">
                  <IconButton
                    icon="eye"
                    tone="view"
                    label={`Đọc bài ${code}`}
                    onClick={() => setModal({ id: post.id, kind: 'detail' })}
                  />
                  <IconButton
                    icon="check"
                    tone="success"
                    label={`Duyệt bài ${code}`}
                    onClick={() => openApprove(post.id)}
                  />
                  <IconButton
                    icon="close"
                    tone="danger"
                    label={`Từ chối bài ${code}`}
                    onClick={() => openReject(post.id)}
                  />
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>
      <Pagination
        page={currentPage}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
        noun="bài đăng"
      />

      {selected && modal.kind === 'detail' && (
        <Dialog
          key="detail"
          size="md"
          title="Đọc và duyệt bài đăng"
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Đóng xem trước</Button>
              <Button variant="danger" onClick={() => openReject(selected.id)}>
                <Icon name="close" />
                Từ chối bài
              </Button>
              <Button variant="success" onClick={() => openApprove(selected.id, true)}>
                <Icon name="check" />
                Duyệt xuất bản
              </Button>
            </>
          }
        >
          <h3 className="mb-1 text-lead font-bold leading-snug text-primary [overflow-wrap:anywhere]">
            {selected.title}
          </h3>
          <DetailList
            rows={[
              [
                'Người đăng',
                <>
                  @{selected.author}
                  <Reputation score={selected.reputation} />
                </>,
              ],
              ['Loại tin', selected.type === 'lost' ? 'Mất đồ' : 'Nhặt được'],
              ['Danh mục', selected.category],
              ['Ngày đăng', selected.dateTime],
              ['Vị trí', selected.location],
            ]}
          />
          <h4 className="mt-3.5 mb-2 text-small font-semibold">Nội dung do người dùng đăng</h4>
          <p className="rounded-lg border border-primary-soft bg-primary-subtle px-3.5 py-3 text-small leading-relaxed [overflow-wrap:anywhere]">
            {selected.desc}
          </p>
          {!!selected.images?.length && (
            <>
              <h4 className="mt-3.5 mb-2 text-small font-semibold">Hình ảnh đính kèm</h4>
              <div className="flex flex-wrap gap-3">
                {selected.images.map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Ảnh minh họa ${index + 1} của bài ${selected.title}`}
                    loading="lazy"
                    className="size-28 rounded-lg object-cover"
                  />
                ))}
              </div>
            </>
          )}
        </Dialog>
      )}

      {selected && modal.kind === 'approve' && (
        <Dialog
          key="approve"
          size="sm"
          title="Xác nhận duyệt bài đăng"
          onClose={cancelApprove}
          footer={
            <>
              <Button data-autofocus onClick={cancelApprove}>
                Hủy
              </Button>
              <Button variant="success" onClick={() => approve(selected.id)}>
                <Icon name="check" />
                Xác nhận duyệt
              </Button>
            </>
          }
        >
          <p className="mb-4 text-lead font-semibold leading-relaxed [overflow-wrap:anywhere]">
            {selected.postCode || selected.id} · {selected.title}
          </p>
          <p className="rounded-lg border border-primary-soft bg-primary-subtle p-4 text-body leading-relaxed">
            Bạn có chắc muốn duyệt xuất bản bài đăng này? Sau khi duyệt, bài đăng sẽ chuyển sang
            trạng thái Đang tìm và rời hàng đợi kiểm duyệt.
          </p>
        </Dialog>
      )}

      {selected && modal.kind === 'reject' && (
        <Dialog
          key="reject"
          size="sm"
          title="Từ chối bài đăng"
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Hủy</Button>
              <Button variant="danger" type="submit" form="mod-reject-form">
                Xác nhận từ chối
              </Button>
            </>
          }
        >
          <p className="mb-4 text-lead font-semibold leading-relaxed [overflow-wrap:anywhere]">
            {selected.title}
          </p>
          <form id="mod-reject-form" className="flex flex-col gap-4" onSubmit={reject} noValidate>
            <Field label="Lý do từ chối">
              {(a) => (
                <Select
                  {...a}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setError('')
                  }}
                >
                  {REJECT_REASONS.map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                  <option value="other">Lý do khác</option>
                </Select>
              )}
            </Field>
            {reason === 'other' && (
              <Field label="Lý do cụ thể" error={error}>
                {(a) => (
                  <Textarea
                    {...a}
                    value={customReason}
                    onChange={(e) => {
                      setCustomReason(e.target.value)
                      setError('')
                    }}
                    maxLength={1000}
                    placeholder="Nhập lý do không duyệt bài đăng…"
                  />
                )}
              </Field>
            )}
            <p className="text-caption leading-relaxed text-ink-muted">
              Bài đăng sẽ rời hàng đợi sau khi xác nhận từ chối.
            </p>
          </form>
        </Dialog>
      )}
    </div>
  )
}
