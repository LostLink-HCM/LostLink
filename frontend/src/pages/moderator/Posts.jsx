import { useRef, useState } from 'react'
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
import {
  EMPTY_FILTERS,
  STATUS_LABELS,
  filterModeratorPosts,
  hasInvalidRange,
  postsToRows,
  setPostHidden,
  validateHideReason,
} from '../../lib/moderatorPosts'
import { downloadCsv } from '../../lib/csv'

const PAGE_SIZE = 8

const STATUS_TONES = {
  pending: 'warning',
  searching: 'primary',
  contacted: 'info',
  completed: 'success',
  rejected: 'danger',
}

function Status({ value, hidden }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={STATUS_TONES[value]}>{STATUS_LABELS[value]}</Badge>
      {hidden && <Badge>Đã ẩn</Badge>}
    </span>
  )
}

function Location({ children }) {
  return (
    <div className="mt-1.5 flex items-start gap-1 text-caption text-ink-muted">
      <Icon name="pin" size={13} />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

function MatchingPosts({ matches, onView }) {
  return (
    <section aria-label="Bài đăng đang matching" className="mt-5 border-t border-line pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-small font-semibold">Bài đăng đang matching</h4>
        <span className="text-caption text-ink-muted">{matches.length} bài đăng</span>
      </div>
      {matches.length ? (
        <ul className="grid gap-3">
          {matches.map(({ id, post, score }) => (
            <li
              key={id}
              className="min-w-0 rounded-lg border border-line-strong bg-surface-muted p-3.5"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TypeBadge type={post.type} />
                  <span className="text-caption text-ink-muted">{post.postCode}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <strong className="text-title leading-tight text-primary">
                    {(score * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
                  </strong>
                  <span className="text-caption text-ink-muted">Tỷ lệ matching</span>
                </div>
              </div>
              <button
                type="button"
                className="block cursor-pointer text-left text-small font-semibold leading-relaxed text-ink hover:text-primary"
                onClick={() => onView(post.id)}
              >
                {post.title}
              </button>
              <p className="my-1 text-caption text-ink-muted">
                {post.author} · {post.dateTime}
              </p>
              <Location>{post.location}</Location>
              <p className="mt-2.5 mb-3 text-small leading-relaxed text-ink-secondary">
                {post.desc}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <Status value={post.status} hidden={post.hidden} />
                <Button size="sm" onClick={() => onView(post.id)}>
                  Xem bài đăng
                  <Icon name="next" size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-surface-muted p-4 text-center text-small text-ink-muted">
          Chưa có bài đăng đang matching.
        </p>
      )}
    </section>
  )
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
  const title = post.hidden ? 'Hiện lại bài đăng' : 'Ẩn bài đăng'

  return (
    <Dialog
      size="sm"
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button data-autofocus={post.hidden || undefined} onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            form="post-visibility-form"
            variant={post.hidden ? 'primary' : 'danger'}
          >
            <Icon name={post.hidden ? 'eye' : 'eyeOff'} size={16} />
            {title}
          </Button>
        </>
      }
    >
      <form id="post-visibility-form" className="flex flex-col gap-3" onSubmit={submit} noValidate>
        <p className="text-lead font-semibold leading-relaxed [overflow-wrap:anywhere]">
          {post.title}
        </p>
        <p className="text-small leading-relaxed text-ink-muted">
          {post.hidden
            ? 'Bạn muốn hiện lại bài đăng này?'
            : 'Bài vẫn được giữ trong danh sách quản lý để có thể kiểm tra và hiện lại.'}
        </p>
        {!post.hidden && (
          <Field
            label="Lý do ẩn bài đăng"
            required
            error={error}
            hint={`${reason.length}/500 ký tự`}
          >
            {(a) => (
              <Textarea
                {...a}
                ref={reasonRef}
                data-autofocus
                rows={4}
                maxLength={500}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setError('')
                }}
                placeholder="Nhập lý do ẩn bài đăng…"
              />
            )}
          </Field>
        )}
      </form>
    </Dialog>
  )
}

export default function Posts() {
  const { posts, setPosts, matchPairs } = useOutletContext()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [nextStatus, setNextStatus] = useState('')
  const [notice, setNotice] = useState('')
  const invalidRange = hasInvalidRange(filters)
  const filtered = filterModeratorPosts(posts, filters)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * PAGE_SIZE
  const visible = filtered.slice(start, start + PAGE_SIZE)
  const selected = modal && posts.find((post) => post.id === modal.id)
  const matchingPosts = selected
    ? matchPairs
        .filter((match) => match.postLost === selected.id || match.postFound === selected.id)
        .map((match) => ({
          ...match,
          post: posts.find(
            (post) =>
              post.id === (match.postLost === selected.id ? match.postFound : match.postLost)
          ),
        }))
        .filter((match) => match.post)
        .sort((a, b) => b.score - a.score)
    : []

  const changeFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
    setNotice('')
  }
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
    setNotice('')
  }
  const exportCsv = () => {
    downloadCsv('LostLink_Danh_sach_bai_dang.csv', postsToRows(filtered))
    setNotice(`Đã xuất ${filtered.length} bài đăng ra CSV.`)
  }
  const saveStatus = () => {
    setPosts((previous) =>
      previous.map((post) => (post.id === selected.id ? { ...post, status: nextStatus } : post))
    )
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
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <section
        aria-label="Bộ lọc bài đăng"
        className="rounded-xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid grid-cols-[minmax(205px,1.4fr)_repeat(4,minmax(0,1fr))] gap-3 max-sm:grid-cols-2">
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
          <Field label="Trạng thái">
            {(a) => (
              <Select
                {...a}
                value={filters.status}
                onChange={(e) => changeFilter('status', e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
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
                {[...new Set(posts.map((p) => p.category))].map((category) => (
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
                {[...new Set(posts.map((p) => p.district))].map((district) => (
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
              onClick={resetFilters}
            />
            <Button
              variant="primary"
              onClick={exportCsv}
              disabled={invalidRange || !filtered.length}
            >
              <Icon name="download" />
              Xuất CSV
            </Button>
          </div>
        </DateRange>
      </section>

      <p className="mt-4 mb-2.5 text-small text-ink-muted" aria-live="polite">
        Số lượng: <strong className="px-1 text-lead text-primary">{filtered.length}</strong> bài
        đăng
      </p>
      {notice && <Notice>{notice}</Notice>}

      <DataTable
        caption="Danh sách bài đăng của cộng đồng"
        minWidth="min-w-[900px]"
        columns={[
          ['ID', 'w-[9%]'],
          ['Thông tin bài đăng', 'w-[25%]'],
          ['Phân loại', 'w-[11%]'],
          ['Thời gian & Vị trí', 'w-[18%]'],
          ['Thống kê', 'w-[13%]'],
          ['Trạng thái', 'w-[12%]'],
          ['Thao tác', 'w-[12%]'],
        ]}
        empty={
          !visible.length && (
            <div className="pb-8 text-center">
              <EmptyState
                icon="list"
                title={
                  invalidRange ? 'Khoảng thời gian chưa hợp lệ' : 'Không tìm thấy bài đăng phù hợp'
                }
                description={
                  invalidRange
                    ? 'Vui lòng kiểm tra lại ngày bắt đầu và ngày kết thúc.'
                    : 'Thử thay đổi bộ lọc hoặc chọn khoảng thời gian khác.'
                }
              />
              <Button onClick={resetFilters}>Xóa bộ lọc</Button>
            </div>
          )
        }
      >
        {visible.map((post) => (
          <tr key={post.id} className="hover:bg-surface-muted">
            <td className={cell}>
              <span className="whitespace-nowrap text-caption font-semibold text-primary">
                {post.postCode}
              </span>
            </td>
            <td className={cell}>
              <button
                type="button"
                className="mb-1.5 block cursor-pointer text-left text-small font-semibold leading-relaxed text-ink hover:text-primary"
                onClick={() => setModal({ kind: 'detail', id: post.id })}
              >
                {post.title}
              </button>
              <Badge>{post.category}</Badge>
            </td>
            <td className={cell}>
              <TypeBadge type={post.type} />
            </td>
            <td className={cell}>
              <div className="text-caption font-semibold">{post.dateTime}</div>
              <Location>{post.location}</Location>
            </td>
            <td className={cell}>
              <div className="flex gap-2 whitespace-nowrap text-caption text-ink-muted">
                {[
                  ['eye', post.views, 'Lượt xem'],
                  ['chat', post.comments, 'Bình luận'],
                  ['link', post.matches, 'Ghép nối'],
                ].map(([icon, count, label]) => (
                  <span
                    key={icon}
                    title={label}
                    aria-label={`${label}: ${count}`}
                    className="flex items-center gap-0.5 last:text-primary"
                  >
                    <Icon name={icon} size={13} />
                    {count}
                  </span>
                ))}
              </div>
            </td>
            <td className={cell}>
              <Status value={post.status} hidden={post.hidden} />
            </td>
            <td className={cell}>
              <div className="flex flex-wrap gap-1.5">
                <IconButton
                  icon="eye"
                  tone="view"
                  label={`Xem chi tiết bài #${post.id}`}
                  onClick={() => setModal({ kind: 'detail', id: post.id })}
                />
                <IconButton
                  icon="edit"
                  tone="edit"
                  label={`Cập nhật trạng thái bài #${post.id}`}
                  onClick={() => {
                    setNextStatus(post.status)
                    setModal({ kind: 'edit', id: post.id })
                  }}
                />
                <IconButton
                  icon={post.hidden ? 'eye' : 'eyeOff'}
                  tone={post.hidden ? 'success' : 'danger'}
                  label={`${post.hidden ? 'Hiện lại' : 'Ẩn'} bài đăng #${post.id}`}
                  onClick={() => setModal({ kind: 'visibility', id: post.id })}
                />
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination
        page={currentPage}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
        noun="bài"
      />

      {selected && modal.kind === 'detail' && (
        <Dialog
          key={selected.id}
          title="Chi tiết bài đăng"
          onClose={() => setModal(null)}
          footer={
            modal.returnId ? (
              <>
                <Button onClick={() => setModal({ kind: 'detail', id: modal.returnId })}>
                  <Icon name="back" size={15} />
                  Quay lại bài trước
                </Button>
                <Button onClick={() => setModal(null)}>Đóng</Button>
              </>
            ) : (
              <Button onClick={() => setModal(null)}>Đóng</Button>
            )
          }
        >
          <h3 className="mb-1 text-lead font-bold leading-snug text-primary [overflow-wrap:anywhere]">
            {selected.title}
          </h3>
          <DetailList
            rows={[
              ['Mã bài đăng', selected.postCode],
              ['Người đăng', `@${selected.author}`],
              ['Loại bài', selected.type === 'lost' ? 'Mất đồ' : 'Nhặt được'],
              ['Danh mục', selected.category],
              ['Ngày đăng', selected.dateTime],
              ['Vị trí', selected.location],
              [
                'Trạng thái',
                <Status key="status" value={selected.status} hidden={selected.hidden} />,
              ],
            ]}
          />
          {selected.hidden && selected.hiddenReason && (
            <section
              aria-label="Lý do ẩn bài đăng"
              className="mt-3.5 rounded-lg border border-danger-soft bg-danger-soft/50 px-3.5 py-3 text-small leading-relaxed text-danger-ink"
            >
              <strong>Lý do ẩn bài đăng</strong>
              <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                {selected.hiddenReason}
              </p>
            </section>
          )}
          <h4 className="mt-3.5 mb-2 text-small font-semibold">Nội dung mô tả</h4>
          <p className="rounded-lg border border-primary-soft bg-primary-subtle px-3.5 py-3 text-small leading-relaxed [overflow-wrap:anywhere]">
            {selected.desc}
          </p>
          {selected.images.length > 0 && (
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
          <MatchingPosts
            matches={matchingPosts}
            onView={(id) => setModal({ kind: 'detail', id, returnId: selected.id })}
          />
        </Dialog>
      )}

      {selected && modal.kind === 'edit' && (
        <Dialog
          size="sm"
          title="Cập nhật trạng thái"
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Hủy</Button>
              <Button variant="primary" onClick={saveStatus}>
                Cập nhật
              </Button>
            </>
          }
        >
          <p className="mb-3 text-lead font-semibold leading-relaxed [overflow-wrap:anywhere]">
            {selected.title}
          </p>
          <fieldset>
            <legend className="mb-2 text-small text-ink-muted">
              Chọn trạng thái mới cho bài đăng
            </legend>
            <div className="flex flex-col gap-2">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-2.5 has-checked:border-primary has-checked:bg-primary-subtle has-focus-visible:outline-2 has-focus-visible:outline-focus"
                >
                  <input
                    type="radio"
                    name="postStatus"
                    value={value}
                    checked={nextStatus === value}
                    onChange={() => setNextStatus(value)}
                    className="accent-primary"
                  />
                  <Badge tone={STATUS_TONES[value]}>{label}</Badge>
                </label>
              ))}
            </div>
          </fieldset>
        </Dialog>
      )}

      {selected && modal.kind === 'visibility' && (
        <VisibilityDialog
          key={selected.id}
          post={selected}
          onSubmit={saveVisibility}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
