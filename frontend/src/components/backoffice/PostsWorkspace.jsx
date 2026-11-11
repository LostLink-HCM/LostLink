import { useEffect, useMemo, useRef, useState } from 'react'
import Badge from './Badge'
import Button from './Button'
import DataTable, { cell } from './DataTable'
import DateRange from './DateRange'
import DetailList from './DetailList'
import Dialog from './Dialog'
import EmptyState from './EmptyState'
import Field, { Input, Select, Textarea } from './Field'
import Icon from '../common/Icon'
import IconButton from './IconButton'
import Notice from './Notice'
import Pagination from './Pagination'
import TypeBadge from './TypeBadge'
import {
  EMPTY_FILTERS,
  STATUS_LABELS,
  hasInvalidRange,
  postsToRows,
  validateHideReason,
} from '../../lib/backoffice/posts'
import {
  getBackofficePost,
  listBackofficePosts,
  updateBackofficePostStatus,
  updateBackofficePostVisibility,
} from '../../lib/backoffice/postsApi'
import { downloadCsv } from '../../lib/csv'
import usePaginatedFilter from '../../hooks/usePaginatedFilter'

const PAGE_SIZE = 8

const STATUS_TONES = {
  pending: 'warning',
  searching: 'primary',
  contacted: 'info',
  rejected: 'danger',
  returned: 'success',
  closed: 'info',
}
const TONE_TEXT_CLASSES = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-ink',
  info: 'text-info',
  neutral: 'text-neutral',
}

const identityFilter = (items) => items

function Status({ value, hidden, uniformTextColor = false }) {
  const textClass = uniformTextColor ? 'text-primary' : undefined
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={STATUS_TONES[value]}>
        <span className={textClass}>{STATUS_LABELS[value]}</span>
      </Badge>
      {hidden && (
        <Badge>
          <span className={textClass}>Đã ẩn</span>
        </Badge>
      )}
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
                <Status value={post.status} hidden={post.hidden} uniformTextColor />
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

function getMatchesForPost(post) {
  return post?.matchingPosts || []
}

function VisibilityDialog({ post, onSubmit, onClose, submitting, serverError }) {
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
      onClose={() => {
        if (!submitting) onClose()
      }}
      footer={
        <>
          <Button data-autofocus={post.hidden || undefined} onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            form="post-visibility-form"
            variant={post.hidden ? 'primary' : 'danger'}
            disabled={submitting}
          >
            {submitting ? (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              post.hidden && <Icon name="eye" size={16} />
            )}
            {submitting ? 'Đang lưu…' : title}
          </Button>
        </>
      }
    >
      <form id="post-visibility-form" className="flex flex-col gap-3" onSubmit={submit} noValidate>
        {serverError && (
          <p role="alert" className="rounded-lg bg-danger-soft/50 p-3 text-small text-danger-ink">
            {serverError}
          </p>
        )}
        <p className="text-lead font-normal leading-relaxed text-primary [overflow-wrap:anywhere]">
          <span className="font-[400]">{post.postCode || post.id}:</span>{' '}
          <span className="font-[400]">{post.title}</span>
        </p>
        {post.hidden && (
          <p className="text-small leading-relaxed text-ink-muted">
            Bạn muốn hiện lại bài đăng này?
          </p>
        )}
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
                disabled={submitting}
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

export default function PostsWorkspace() {
  const [modal, setModal] = useState(null)
  const [nextStatus, setNextStatus] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [statusReasonError, setStatusReasonError] = useState('')
  const statusReasonRef = useRef(null)
  const [actionError, setActionError] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState('info')
  const [retryCount, setRetryCount] = useState(0)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [listState, setListState] = useState({ key: null, items: [], error: '' })
  const [categoryOptions, setCategoryOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [detailState, setDetailState] = useState({ id: null, post: null, error: '' })
  const [previewImageIndex, setPreviewImageIndex] = useState(null)
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false)
  const detailRequest = useRef(0)
  const {
    filters,
    setFilter,
    resetFilters: resetFilterState,
    setPage,
    currentPage,
  } = usePaginatedFilter({
    items: listState.items,
    initialFilters: EMPTY_FILTERS,
    filterFn: identityFilter,
    pageSize: PAGE_SIZE,
  })
  const invalidRange = hasInvalidRange(filters)
  const requestFilters = useMemo(
    () => ({
      status: filters.status,
      category: filters.category,
      type: filters.type,
      district: filters.district,
      from: filters.from,
      to: filters.to,
      query: debouncedQuery,
    }),
    [
      filters.status,
      filters.category,
      filters.type,
      filters.district,
      filters.from,
      filters.to,
      debouncedQuery,
    ]
  )
  const requestKey = JSON.stringify([requestFilters, retryCount])
  const listIsCurrent = listState.key === requestKey
  const queryDebouncing = filters.query.trim() !== debouncedQuery
  const loading = !invalidRange && (queryDebouncing || !listIsCurrent)
  const posts = invalidRange || queryDebouncing || !listIsCurrent ? [] : listState.items
  const filtered = posts
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const listError = !queryDebouncing && listIsCurrent ? listState.error : ''
  const detailId = modal?.kind === 'detail' ? modal.id : null
  const detailIsCurrent = detailState.id === detailId
  const selectedDetail = detailIsCurrent ? detailState.post : null
  const selectedFromList = modal && posts.find((post) => post.id === modal.id)
  const selected = modal?.kind === 'detail' ? selectedDetail || selectedFromList : selectedFromList
  const detailPost = modal?.kind === 'detail' ? selected : null
  const detailLoading = Boolean(detailId && !detailIsCurrent)
  const detailError = detailIsCurrent ? detailState.error : ''
  const matchingPosts = detailPost ? getMatchesForPost(detailPost) : []

  const openDetail = (id, returnId) => {
    setPreviewImageIndex(null)
    setStatusHistoryOpen(false)
    setModal({ kind: 'detail', id, ...(returnId ? { returnId } : {}) })
  }
  const closeDetail = () => {
    setPreviewImageIndex(null)
    setStatusHistoryOpen(false)
    setModal(null)
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(filters.query.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [filters.query])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (invalidRange || queryDebouncing) return undefined
    let active = true
    listBackofficePosts(requestFilters)
      .then((items) => {
        if (!active) return
        setListState({ key: requestKey, items, error: '' })
        setCategoryOptions((previous) => {
          const options = new Map(previous.map((item) => [item.slug, item]))
          items.forEach((post) => {
            if (post.categorySlug) {
              options.set(post.categorySlug, {
                slug: post.categorySlug,
                name: post.category,
              })
            }
          })
          return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        })
        setDistrictOptions((previous) =>
          [...new Set([...previous, ...items.map((post) => post.district).filter(Boolean)])].sort(
            (a, b) => a.localeCompare(b, 'vi')
          )
        )
      })
      .catch((error) => {
        if (active) setListState({ key: requestKey, items: [], error: error.message })
      })
    return () => {
      active = false
    }
  }, [invalidRange, queryDebouncing, requestFilters, requestKey])

  useEffect(() => {
    if (!detailId) return undefined
    const requestId = ++detailRequest.current
    getBackofficePost(detailId)
      .then((post) => {
        if (requestId === detailRequest.current) setDetailState({ id: detailId, post, error: '' })
      })
      .catch((error) => {
        if (requestId === detailRequest.current) {
          setDetailState({ id: detailId, post: null, error: error.message })
        }
      })
    return () => {
      detailRequest.current += 1
    }
  }, [detailId])

  const updateCurrentListPost = (id, update) => {
    setListState((previous) =>
      previous.key === requestKey
        ? {
            ...previous,
            items: previous.items
              .map((post) => (post.id === id ? { ...post, ...update } : post))
              .filter((post) => !filters.status || post.status === filters.status),
          }
        : previous
    )
  }

  const changeFilter = (key, value) => {
    setFilter(key, value)
    setNotice('')
  }
  const resetFilters = () => {
    resetFilterState()
    setNotice('')
    setNoticeTone('info')
  }
  const exportCsv = () => {
    downloadCsv('LostLink_Danh_sach_bai_dang.csv', postsToRows(filtered))
    setNotice(`Đã xuất ${filtered.length} bài đăng ra CSV.`)
    setNoticeTone('success')
  }
  const saveStatus = async () => {
    if (!selected || actionPending) return
    if (nextStatus === selected.status) {
      setActionError('Vui lòng chọn trạng thái khác với trạng thái hiện tại.')
      return
    }
    const normalizedReason = statusReason.trim()
    if (nextStatus === 'rejected' && !normalizedReason) {
      setStatusReasonError('Vui lòng nhập lý do từ chối.')
      statusReasonRef.current?.focus()
      return
    }

    setActionPending(true)
    setActionError('')
    setStatusReasonError('')
    try {
      const result = await updateBackofficePostStatus(
        selected.id,
        nextStatus,
        nextStatus === 'rejected' ? normalizedReason : ''
      )
      updateCurrentListPost(selected.id, { status: result.status })
      setNotice(`Đã cập nhật trạng thái bài ${result.code || selected.postCode}.`)
      setNoticeTone('success')
      setModal(null)
    } catch (error) {
      setActionError(error.message || 'Không thể cập nhật trạng thái bài đăng.')
    } finally {
      setActionPending(false)
    }
  }
  const saveVisibility = async (reason) => {
    if (!selected || actionPending) return
    const hidden = !selected.hidden
    setActionPending(true)
    setActionError('')
    try {
      const result = await updateBackofficePostVisibility(selected.id, hidden, reason.trim())
      updateCurrentListPost(selected.id, {
        hidden: result.isHidden,
        hiddenReason: result.hiddenReason || '',
      })
      setNotice(
        `Đã ${result.isHidden ? 'ẩn' : 'hiện lại'} bài đăng ${result.code || selected.postCode}.`
      )
      setNoticeTone('success')
      setModal(null)
    } catch (error) {
      setActionError(error.message || 'Không thể cập nhật trạng thái hiển thị bài đăng.')
    } finally {
      setActionPending(false)
    }
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
                maxLength={100}
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
                <option value="hidden">Đã ẩn</option>
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
                {categoryOptions.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
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
                {districtOptions.map((district) => (
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
              disabled={invalidRange || loading || Boolean(listError) || !filtered.length}
            >
              <Icon name="download" />
              Xuất CSV
            </Button>
          </div>
        </DateRange>
      </section>

      <p className="mt-4 mb-2.5 text-small text-ink-subtle" aria-live="polite">
        {loading ? (
          'Đang tải danh sách bài đăng…'
        ) : (
          <>
            Hiển thị {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} trong số {filtered.length} bài đăng
          </>
        )}
      </p>
      {notice &&
        (noticeTone === 'error' ? (
          <p
            role="alert"
            className="mb-3.5 rounded-lg border border-danger-soft bg-danger-soft/50 px-4 py-3 text-small leading-relaxed text-danger-ink"
          >
            {notice}
          </p>
        ) : (
          <Notice>{notice}</Notice>
        ))}
      {listError && (
        <div
          role="alert"
          className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-soft bg-danger-soft/50 px-4 py-3 text-small text-danger-ink"
        >
          <span>{listError}</span>
          <Button size="sm" onClick={() => setRetryCount((count) => count + 1)}>
            Thử lại
          </Button>
        </div>
      )}

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
              {loading ? (
                <p className="py-16 text-small text-ink-muted">Đang tải danh sách bài đăng…</p>
              ) : listError ? (
                <>
                  <EmptyState icon="warning" title="Không tải được danh sách bài đăng" />
                  <Button onClick={() => setRetryCount((count) => count + 1)}>Thử lại</Button>
                </>
              ) : (
                <>
                  <EmptyState
                    icon="list"
                    title={
                      invalidRange
                        ? 'Khoảng thời gian chưa hợp lệ'
                        : 'Không tìm thấy bài đăng phù hợp'
                    }
                    description={
                      invalidRange
                        ? 'Vui lòng kiểm tra lại ngày bắt đầu và ngày kết thúc.'
                        : 'Thử thay đổi bộ lọc hoặc chọn khoảng thời gian khác.'
                    }
                  />
                  <Button onClick={resetFilters}>Xóa bộ lọc</Button>
                </>
              )}
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
                onClick={() => openDetail(post.id)}
              >
                {post.title}
              </button>
              <Badge>{post.category}</Badge>
            </td>
            <td className={cell}>
              <span
                className={`text-caption font-semibold ${post.type === 'lost' ? 'text-danger-ink' : 'text-primary'}`}
              >
                {post.type === 'lost' ? 'Mất đồ' : 'Nhặt được'}
              </span>
            </td>
            <td className={cell}>
              <div className="text-caption font-semibold">{post.dateTime}</div>
              <Location>{post.district}</Location>
            </td>
            <td className={cell}>
              <div className="flex gap-2 whitespace-nowrap text-caption text-ink-muted">
                {[
                  ['eye', post.views, 'Lượt xem'],
                  ['comment', post.comments, 'Bình luận'],
                  ['link', post.matches, 'Ghép nối'],
                ].map(([icon, count, label]) => (
                  <span
                    key={icon}
                    title={label}
                    aria-label={`${label}: ${count}`}
                    className="flex items-center gap-0.5"
                  >
                    <Icon name={icon} size={13} />
                    {count}
                  </span>
                ))}
              </div>
            </td>
            <td className={cell}>
              <span
                className={`inline-flex flex-col items-start gap-1 text-caption font-semibold ${TONE_TEXT_CLASSES[STATUS_TONES[post.status]] || 'text-ink-secondary'}`}
              >
                <span>{STATUS_LABELS[post.status] || 'Không xác định'}</span>
                {post.hidden && (
                  <span className="inline-flex items-center gap-1 text-neutral">
                    <Icon name="eyeOff" size={13} />
                    Đã ẩn
                  </span>
                )}
              </span>
            </td>
            <td className={cell}>
              <div className="flex flex-wrap gap-1.5">
                <IconButton
                  icon="eye"
                  tone="view"
                  label="Xem chi tiết bài đăng"
                  onClick={() => openDetail(post.id)}
                />
                <IconButton
                  icon="edit"
                  tone="edit"
                  label="Cập nhật trạng thái bài đăng"
                  onClick={() => {
                    setNextStatus(post.status)
                    setStatusReason('')
                    setStatusReasonError('')
                    setActionError('')
                    setModal({ kind: 'edit', id: post.id })
                  }}
                />
                <IconButton
                  icon={post.hidden ? 'eyeCheck' : 'eyeOff'}
                  tone={post.hidden ? 'success' : 'danger'}
                  label={`${post.hidden ? 'Hiện lại' : 'Ẩn'} bài đăng`}
                  onClick={() => {
                    setActionError('')
                    setModal({ kind: 'visibility', id: post.id })
                  }}
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
        noun="bài đăng"
        showSummary={false}
      />

      {modal?.kind === 'detail' && !selected && (
        <Dialog
          key={modal.id}
          title="Chi tiết bài đăng"
          onClose={closeDetail}
          scrollableContent
          footer={<Button onClick={closeDetail}>Đóng</Button>}
        >
          {detailLoading && (
            <p className="py-8 text-center text-small text-ink-muted">
              Đang tải chi tiết bài đăng…
            </p>
          )}
          {detailError && (
            <p role="alert" className="text-small text-danger-ink">
              {detailError}
            </p>
          )}
        </Dialog>
      )}

      {selected && modal.kind === 'detail' && (
        <Dialog
          key={selected.id}
          title="Chi tiết bài đăng"
          onClose={closeDetail}
          scrollableContent
          footer={
            modal.returnId ? (
              <>
                <Button onClick={() => openDetail(modal.returnId)}>
                  <Icon name="back" size={15} />
                  Quay lại bài trước
                </Button>
                <Button onClick={closeDetail}>Đóng</Button>
              </>
            ) : (
              <Button onClick={closeDetail}>Đóng</Button>
            )
          }
        >
          {detailLoading && (
            <p className="mb-3 text-small text-ink-muted">Đang tải đầy đủ chi tiết bài đăng…</p>
          )}
          {detailError && (
            <p
              role="alert"
              className="mb-3 rounded-lg bg-danger-soft/50 p-3 text-small text-danger-ink"
            >
              {detailError}
            </p>
          )}
          <h3 className="mb-1 text-lead font-bold leading-snug text-primary [overflow-wrap:anywhere]">
            {selected.title}
          </h3>
          <DetailList
            rows={[
              ['Mã bài đăng', selected.postCode],
              ['Người đăng', selected.author],
              ['Loại bài', selected.type === 'lost' ? 'Mất đồ' : 'Nhặt được'],
              ['Danh mục', selected.category],
              ['Ngày đăng', selected.dateTime],
              ['Vị trí', selected.location],
              [
                'Trạng thái',
                <button
                  key="status"
                  type="button"
                  aria-expanded={statusHistoryOpen}
                  aria-controls={`status-history-${selected.id}`}
                  aria-label={
                    statusHistoryOpen ? 'Ẩn lịch sử trạng thái' : 'Xem lịch sử trạng thái'
                  }
                  onClick={() => setStatusHistoryOpen((open) => !open)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <Status value={selected.status} hidden={selected.hidden} />
                  <Icon
                    name="next"
                    size={14}
                    className={`transition-transform ${statusHistoryOpen ? 'rotate-90' : ''}`}
                  />
                </button>,
              ],
            ]}
          />
          {statusHistoryOpen && (
            <section
              id={`status-history-${selected.id}`}
              aria-label="Lịch sử trạng thái"
              className="mb-3 rounded-lg border border-line bg-surface-muted p-3.5"
            >
              <h4 className="mb-3 text-small font-semibold">Lịch sử trạng thái</h4>
              {selected.statusHistory?.length ? (
                <ol className="grid gap-3">
                  {[...selected.statusHistory].reverse().map((entry, index) => (
                    <li
                      key={`${entry.status}-${entry.dateTime}-${index}`}
                      className="border-l-2 border-primary-soft pl-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-small font-semibold text-primary">
                          {STATUS_LABELS[entry.status] || entry.status}
                        </span>
                        {entry.dateTime && (
                          <time className="text-caption text-ink-muted">{entry.dateTime}</time>
                        )}
                      </div>
                      {entry.status === 'rejected' && (
                        <p className="mt-1 whitespace-pre-wrap text-small leading-relaxed text-ink-secondary [overflow-wrap:anywhere]">
                          Lý do: {entry.reason || 'Chưa có lý do được lưu.'}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-small text-ink-muted">
                  {selected.status === 'rejected'
                    ? 'Bài đăng đang bị từ chối nhưng chưa có lý do được lưu.'
                    : 'Chưa có lịch sử trạng thái.'}
                </p>
              )}
            </section>
          )}
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
          {selected.images?.length > 0 && (
            <>
              <h4 className="mt-3.5 mb-2 text-small font-semibold">Hình ảnh đính kèm</h4>
              <div className="flex flex-wrap gap-3">
                {selected.images.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    aria-label={`Phóng to ảnh ${index + 1} của bài ${selected.title}`}
                    onClick={() => setPreviewImageIndex(index)}
                    className="cursor-zoom-in rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <img
                      src={src}
                      alt={`Ảnh ${index + 1} của bài ${selected.title}`}
                      loading="lazy"
                      className="size-28 rounded-lg object-cover"
                    />
                  </button>
                ))}
              </div>
            </>
          )}
          <MatchingPosts matches={matchingPosts} onView={(id) => openDetail(id, selected.id)} />
        </Dialog>
      )}

      {selected &&
        modal?.kind === 'detail' &&
        previewImageIndex !== null &&
        selected.images?.[previewImageIndex] && (
          <Dialog
            key="image-preview"
            size="lg"
            title="Hình ảnh"
            onClose={() => setPreviewImageIndex(null)}
          >
            <div className="flex items-center justify-center gap-3">
              <IconButton
                icon="back"
                label="Xem ảnh trước"
                bordered
                size={36}
                disabled={previewImageIndex === 0}
                onClick={() => setPreviewImageIndex((index) => index - 1)}
              />
              <div className="flex min-w-0 flex-1 justify-center">
                <img
                  src={selected.images[previewImageIndex]}
                  alt={`Ảnh ${previewImageIndex + 1} của bài ${selected.title}`}
                  className="max-h-[calc(100dvh-180px)] max-w-full rounded-lg object-contain"
                />
              </div>
              <IconButton
                icon="next"
                label="Xem ảnh tiếp theo"
                bordered
                size={36}
                disabled={previewImageIndex === selected.images.length - 1}
                onClick={() => setPreviewImageIndex((index) => index + 1)}
              />
            </div>
            <p className="mt-3 text-center text-caption text-ink-muted">
              {previewImageIndex + 1}/{selected.images.length}
            </p>
          </Dialog>
        )}

      {selected && modal.kind === 'edit' && (
        <Dialog
          size="sm"
          title="Cập nhật trạng thái"
          scrollableContent
          onClose={() => {
            if (!actionPending) setModal(null)
          }}
          footer={
            <>
              <Button onClick={() => setModal(null)} disabled={actionPending}>
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={saveStatus}
                disabled={actionPending || nextStatus === selected.status}
              >
                {actionPending ? (
                  <span
                    aria-hidden="true"
                    className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                ) : null}
                {actionPending ? 'Đang lưu…' : 'Cập nhật'}
              </Button>
            </>
          }
        >
          {actionError && (
            <p
              role="alert"
              className="mb-3 rounded-lg bg-danger-soft/50 p-3 text-small text-danger-ink"
            >
              {actionError}
            </p>
          )}
          <p className="mb-3 text-lead font-normal leading-relaxed text-primary [overflow-wrap:anywhere]">
            <span className="font-[400]">{selected.postCode || selected.id}:</span>{' '}
            <span className="font-[400]">{selected.title}</span>
          </p>
          <fieldset disabled={actionPending}>
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
                    onChange={() => {
                      setNextStatus(value)
                      if (value !== 'rejected') setStatusReason('')
                      setStatusReasonError('')
                      setActionError('')
                    }}
                    className="accent-primary"
                  />
                  <Badge tone={STATUS_TONES[value]}>
                    <span className="text-primary">{label}</span>
                  </Badge>
                </label>
              ))}
            </div>
          </fieldset>
          {nextStatus === 'rejected' && (
            <Field
              label="Lý do từ chối"
              required
              error={statusReasonError}
              hint={`${statusReason.length}/1000 ký tự`}
              className="mt-3"
            >
              {(a) => (
                <Textarea
                  {...a}
                  ref={statusReasonRef}
                  rows={4}
                  maxLength={1000}
                  value={statusReason}
                  disabled={actionPending}
                  onChange={(event) => {
                    setStatusReason(event.target.value)
                    setStatusReasonError('')
                    setActionError('')
                  }}
                  placeholder="Nhập lý do từ chối bài đăng…"
                />
              )}
            </Field>
          )}
        </Dialog>
      )}

      {selected && modal.kind === 'visibility' && (
        <VisibilityDialog
          key={selected.id}
          post={selected}
          onSubmit={saveVisibility}
          submitting={actionPending}
          serverError={actionError}
          onClose={() => {
            if (!actionPending) setModal(null)
          }}
        />
      )}
    </div>
  )
}
