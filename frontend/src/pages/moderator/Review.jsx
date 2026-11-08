import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../../components/backoffice/Badge'
import Button from '../../components/backoffice/Button'
import DataTable, { cell } from '../../components/backoffice/DataTable'
import DateRange from '../../components/backoffice/DateRange'
import DetailList from '../../components/backoffice/DetailList'
import Dialog from '../../components/backoffice/Dialog'
import EmptyState from '../../components/backoffice/EmptyState'
import Field, { Input, Select, Textarea } from '../../components/backoffice/Field'
import Icon from '../../components/common/Icon'
import IconButton from '../../components/backoffice/IconButton'
import Notice from '../../components/backoffice/Notice'
import Pagination from '../../components/backoffice/Pagination'
import TypeBadge from '../../components/backoffice/TypeBadge'
import { REJECT_REASONS } from '../../lib/moderator/moderation'
import {
  approveModeratorPendingPost,
  getModeratorPendingPost,
  listModeratorPendingPosts,
  rejectModeratorPendingPost,
} from '../../lib/moderator/reviewPosts'
import { downloadCsv } from '../../lib/csv'
import usePaginatedFilter from '../../hooks/usePaginatedFilter'

const EMPTY_FILTERS = { category: '', type: '', district: '', from: '', to: '', query: '' }
const PAGE_SIZE = 8

const CATEGORY_TONES = {
  'Đồ điện tử': 'primary',
  'Ví / Giấy tờ': 'info',
  'Thú cưng': 'success',
  'Chìa khóa': 'warning',
}

const keepServerFilteredPosts = (posts) => posts

function Reputation({ score }) {
  const tone = score < 0 ? 'text-danger-ink' : score >= 100 ? 'text-success' : 'text-ink-muted'
  return (
    <span className={`mt-1.5 flex items-center gap-1 text-caption font-medium ${tone}`}>
      <Icon name="star" size={14} />
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
  const {
    reviewPosts: posts,
    setReviewPosts,
    reviewLoading,
    reviewError,
    reloadReviewPosts,
  } = useOutletContext()
  const [modal, setModal] = useState(null)
  const [reason, setReason] = useState(REJECT_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [detailPost, setDetailPost] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [previewImageIndex, setPreviewImageIndex] = useState(null)
  const [apiPosts, setApiPosts] = useState(null)
  const [filterLoading, setFilterLoading] = useState(false)
  const [filterError, setFilterError] = useState('')
  const [filterAttempt, setFilterAttempt] = useState(0)
  const filterRequestId = useRef(0)
  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])
  const {
    filters,
    setFilter,
    resetFilters,
    setPage,
    currentPage,
    filteredItems: filtered,
    visibleItems: visible,
  } = usePaginatedFilter({
    items: apiPosts ?? posts,
    initialFilters: EMPTY_FILTERS,
    filterFn: keepServerFilteredPosts,
    pageSize: PAGE_SIZE,
  })
  const hasActiveFilters = Boolean(
    filters.query.trim() ||
    filters.category ||
    filters.type ||
    filters.district ||
    filters.from ||
    filters.to
  )
  const invalidDateRange = Boolean(filters.from && filters.to && filters.from > filters.to)
  const listLoading = hasActiveFilters ? filterLoading : reviewLoading
  const listError = hasActiveFilters ? filterError : reviewError

  useEffect(() => {
    const requestId = ++filterRequestId.current
    if (!hasActiveFilters || invalidDateRange) return undefined

    const timeout = window.setTimeout(
      async () => {
        try {
          const result = await listModeratorPendingPosts(filters)
          if (requestId === filterRequestId.current) setApiPosts(result)
        } catch (requestError) {
          if (requestId === filterRequestId.current) {
            setApiPosts([])
            setFilterError(requestError.message)
          }
        } finally {
          if (requestId === filterRequestId.current) setFilterLoading(false)
        }
      },
      filters.query.trim() ? 300 : 0
    )

    return () => {
      window.clearTimeout(timeout)
      if (requestId === filterRequestId.current) filterRequestId.current += 1
    }
  }, [filters, filterAttempt, hasActiveFilters, invalidDateRange])
  const listSelected =
    modal && posts.find((post) => post.id === modal.id && post.status === 'pending')
  const selected =
    modal?.kind === 'detail' && detailPost?.id === modal.id ? detailPost : listSelected
  const changeFilter = (key, value) => {
    const nextFilters = { ...filters, [key]: value }
    const nextHasActiveFilters = Boolean(
      nextFilters.query.trim() ||
      nextFilters.category ||
      nextFilters.type ||
      nextFilters.district ||
      nextFilters.from ||
      nextFilters.to
    )
    const nextInvalidDateRange = Boolean(
      nextFilters.from && nextFilters.to && nextFilters.from > nextFilters.to
    )
    setApiPosts(nextHasActiveFilters ? [] : null)
    setFilterLoading(nextHasActiveFilters && !nextInvalidDateRange)
    setFilterError('')
    setFilter(key, value)
  }
  const loadDetail = async (id) => {
    setDetailLoading(true)
    setDetailError('')
    try {
      setDetailPost(await getModeratorPendingPost(id))
    } catch (detailRequestError) {
      setDetailError(detailRequestError.message)
    } finally {
      setDetailLoading(false)
    }
  }
  const openDetail = (id) => {
    setDetailPost(null)
    setModal({ id, kind: 'detail' })
    void loadDetail(id)
  }
  const openReject = (id) => {
    setReason(REJECT_REASONS[0])
    setCustomReason('')
    setError('')
    setActionError('')
    setModal({ id, kind: 'reject' })
  }
  const openApprove = (id, fromDetail = false) => {
    setActionError('')
    setModal({ id, kind: 'approve', fromDetail })
  }
  const cancelApprove = () => {
    if (decisionLoading) return
    setActionError('')
    setModal(modal.fromDetail ? { id: modal.id, kind: 'detail' } : null)
  }
  const removeFromReviewQueue = (id) => {
    setReviewPosts((previous) => previous.filter((post) => post.id !== id))
    setApiPosts((previous) => (previous ? previous.filter((post) => post.id !== id) : null))
    if (hasActiveFilters) {
      filterRequestId.current += 1
      setFilterAttempt((previous) => previous + 1)
    }
  }
  const approve = async (id) => {
    const postCode = posts.find((post) => post.id === id)?.postCode || id
    setDecisionLoading(true)
    setActionError('')
    try {
      await approveModeratorPendingPost(id)
      removeFromReviewQueue(id)
      setModal(null)
      setNotice(`Đã duyệt bài đăng ${postCode}.`)
    } catch (decisionError) {
      setActionError(decisionError.message)
    } finally {
      setDecisionLoading(false)
    }
  }
  const reject = async (event) => {
    event.preventDefault()
    const detail = reason === 'other' ? customReason.trim() : reason
    if (!detail) {
      setError('Vui lòng nhập lý do từ chối cụ thể.')
      return
    }

    setDecisionLoading(true)
    setError('')
    setActionError('')
    try {
      await rejectModeratorPendingPost(selected.id, detail)
      removeFromReviewQueue(selected.id)
      setNotice(`Đã từ chối bài đăng ${selected.postCode || selected.id}.`)
      setModal(null)
    } catch (decisionError) {
      setActionError(decisionError.message)
    } finally {
      setDecisionLoading(false)
    }
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
                maxLength={100}
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
                {[
                  ...new Map(
                    posts
                      .filter((post) => post.categorySlug && post.category)
                      .map((post) => [post.categorySlug, post.category])
                  ),
                ].map(([slug, category]) => (
                  <option key={slug} value={slug}>
                    {category}
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
                {[...new Set(posts.map((post) => post.district).filter(Boolean))].map(
                  (district) => (
                    <option key={district}>{district}</option>
                  )
                )}
              </Select>
            )}
          </Field>
        </div>
        <DateRange from={filters.from} to={filters.to} onChange={changeFilter}>
          <div className="ml-auto flex gap-2 max-sm:basis-full max-sm:justify-end">
            <IconButton
              icon="reset"
              label="Đặt lại bộ lọc và tải lại danh sách"
              bordered
              size={36}
              onClick={() => {
                resetFilters()
                setApiPosts(null)
                setFilterLoading(false)
                setFilterError('')
                void reloadReviewPosts()
              }}
            />
            <Button variant="primary" onClick={exportCsv} disabled={!filtered.length}>
              <Icon name="download" />
              Xuất CSV
            </Button>
          </div>
        </DateRange>
      </section>

      <p className="mt-4 mb-2.5 text-small text-ink-subtle">
        Hiển thị {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
        {Math.min(currentPage * PAGE_SIZE, filtered.length)} trong số {filtered.length} bài đăng
      </p>
      {listLoading && (
        <Notice>
          {hasActiveFilters ? 'Đang tìm kiếm và lọc bài đăng…' : 'Đang tải hàng đợi kiểm duyệt…'}
        </Notice>
      )}
      {!listLoading && listError && (
        <div>
          <Notice>{listError}</Notice>
          <Button
            onClick={() => {
              if (!hasActiveFilters) {
                void reloadReviewPosts()
                return
              }
              setApiPosts([])
              setFilterLoading(!invalidDateRange)
              setFilterError('')
              setFilterAttempt((previous) => previous + 1)
            }}
          >
            Thử tải lại
          </Button>
        </div>
      )}
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
          !listLoading &&
          !listError &&
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
                  onClick={() => openDetail(post.id)}
                >
                  {post.title}
                </button>
                <TypeBadge type={post.type} />
              </td>
              <td className={cell}>
                <strong className="block text-small font-semibold">{post.author}</strong>
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
                    onClick={() => openDetail(post.id)}
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
        showSummary={false}
      />

      {selected && modal.kind === 'detail' && (
        <Dialog
          key="detail"
          size="md"
          title="Chi tiết bài đăng"
          scrollableContent
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Đóng</Button>
              <Button variant="danger" onClick={() => openReject(selected.id)}>
                Từ chối
              </Button>
              <Button variant="success" onClick={() => openApprove(selected.id, true)}>
                Duyệt
              </Button>
            </>
          }
        >
          <h3 className="mb-1 text-lead font-bold leading-snug text-primary [overflow-wrap:anywhere]">
            {selected.title}
          </h3>
          <DetailList
            rows={[
              ['ID bài đăng', selected.postCode || selected.id],
              [
                'Người đăng',
                <>
                  {selected.author}
                  <Reputation score={selected.reputation} />
                </>,
              ],
              ['Loại tin', selected.type === 'lost' ? 'Mất đồ' : 'Nhặt được'],
              ['Danh mục', selected.category],
              ['Ngày đăng', selected.dateTime],
              ['Vị trí', selected.location],
            ]}
          />
          {detailLoading && <Notice>Đang tải chi tiết bài đăng…</Notice>}
          {!detailLoading && detailError && (
            <div>
              <Notice>{detailError}</Notice>
              <Button onClick={() => void loadDetail(selected.id)}>Thử tải lại chi tiết</Button>
            </div>
          )}
          {!detailLoading && !detailError && detailPost?.id === selected.id && (
            <>
              <h4 className="mt-3.5 mb-2 text-small font-semibold">Nội dung</h4>
              <p className="rounded-lg border border-primary-soft bg-primary-subtle px-3.5 py-3 text-small leading-relaxed [overflow-wrap:anywhere]">
                {detailPost.desc || 'Bài đăng chưa có mô tả.'}
              </p>
              {!!detailPost.images?.length && (
                <>
                  <h4 className="mt-3.5 mb-2 text-small font-semibold">Hình ảnh</h4>
                  <div className="flex flex-wrap gap-3">
                    {detailPost.images.map((src, index) => (
                      <button
                        key={src}
                        type="button"
                        aria-label={`Phóng to ảnh ${index + 1} của bài ${detailPost.title}`}
                        onClick={() => setPreviewImageIndex(index)}
                        className="cursor-zoom-in rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <img
                          src={src}
                          alt={`Ảnh ${index + 1} của bài ${detailPost.title}`}
                          loading="lazy"
                          className="size-28 rounded-lg object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </Dialog>
      )}

      {selected &&
        detailPost?.id === selected.id &&
        previewImageIndex !== null &&
        detailPost.images?.[previewImageIndex] && (
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
                  src={detailPost.images[previewImageIndex]}
                  alt={`Ảnh ${previewImageIndex + 1} của bài ${selected.title}`}
                  className="max-h-[calc(100dvh-180px)] max-w-full rounded-lg object-contain"
                />
              </div>
              <IconButton
                icon="next"
                label="Xem ảnh tiếp theo"
                bordered
                size={36}
                disabled={previewImageIndex === detailPost.images.length - 1}
                onClick={() => setPreviewImageIndex((index) => index + 1)}
              />
            </div>
            <p className="mt-3 text-center text-caption text-ink-muted">
              {previewImageIndex + 1}/{detailPost.images.length}
            </p>
          </Dialog>
        )}

      {selected && modal.kind === 'approve' && (
        <Dialog
          key="approve"
          size="sm"
          title="Xác nhận"
          onClose={cancelApprove}
          footer={
            <>
              <Button data-autofocus disabled={decisionLoading} onClick={cancelApprove}>
                Hủy
              </Button>
              <Button
                variant="success"
                disabled={decisionLoading}
                onClick={() => void approve(selected.id)}
              >
                {decisionLoading ? 'Đang duyệt…' : 'Duyệt'}
              </Button>
            </>
          }
        >
          <p className="text-body leading-relaxed">
            Bạn có chắc muốn duyệt bài đăng{' '}
            <strong className="font-semibold">{selected.postCode || selected.id}</strong> không?
          </p>
          {actionError && (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-small text-danger-ink"
            >
              {actionError}
            </p>
          )}
        </Dialog>
      )}

      {selected && modal.kind === 'reject' && (
        <Dialog
          key="reject"
          size="sm"
          title="Xác nhận"
          onClose={() => {
            if (!decisionLoading) setModal(null)
          }}
          footer={
            <>
              <Button disabled={decisionLoading} onClick={() => setModal(null)}>
                Hủy
              </Button>
              <Button
                variant="danger"
                type="submit"
                form="mod-reject-form"
                disabled={decisionLoading}
              >
                {decisionLoading ? 'Đang từ chối…' : 'Từ chối'}
              </Button>
            </>
          }
        >
          <p className="mb-4 text-lead font-semibold leading-relaxed [overflow-wrap:anywhere]">
            Bạn có chắc muốn từ chối bài đăng <strong>{selected.postCode || selected.id}</strong>{' '}
            không?
          </p>
          <form id="mod-reject-form" className="flex flex-col gap-4" onSubmit={reject} noValidate>
            <Field label="Lý do từ chối">
              {(a) => (
                <Select
                  {...a}
                  value={reason}
                  disabled={decisionLoading}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setError('')
                    setActionError('')
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
              <Field error={error}>
                {(a) => (
                  <Textarea
                    {...a}
                    aria-label="Lý do từ chối"
                    value={customReason}
                    disabled={decisionLoading}
                    onChange={(e) => {
                      setCustomReason(e.target.value)
                      setError('')
                      setActionError('')
                    }}
                    maxLength={1000}
                    placeholder="Nhập lý do không duyệt bài đăng…"
                  />
                )}
              </Field>
            )}
            {actionError && (
              <p
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-small text-danger-ink"
              >
                {actionError}
              </p>
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
