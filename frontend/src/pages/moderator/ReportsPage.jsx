import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
import { REPORT_ACTIONS, SEVERITY_LABELS } from '../../lib/moderator/moderation'
import {
  getModeratorReport,
  listModeratorReports,
  REPORT_REASON_LABELS,
  resolveModeratorReport,
} from '../../lib/moderator/reportQueue'
import { downloadCsv } from '../../lib/csv'
import { postPath } from '../../lib/user/homeFeed'
import { profilePath } from '../../lib/user/profiles'
import useLinkedHighlight from '../../hooks/useLinkedHighlight'
import { cx, linkedHighlight } from '../../components/backoffice/classes'

const EMPTY_FILTERS = {
  targetType: 'user',
  severity: '',
  queueStatus: 'open',
  from: '',
  to: '',
  query: '',
}
const QUEUE_STATUS_LABELS = { open: 'Chưa xử lý', processed: 'Đã xử lý' }
const SEVERITY_TEXT_CLASSES = {
  high: 'text-danger-ink',
  medium: 'text-warning',
  low: 'text-success',
}

function Severity({ value }) {
  return (
    <span className={`font-semibold ${SEVERITY_TEXT_CLASSES[value] || 'text-ink-muted'}`}>
      {SEVERITY_LABELS[value] || value}
    </span>
  )
}

const actionAllowed = (report, action) => {
  if (action === 'hide') return report.targetType === 'post' && !report.target?.isHidden
  if (action === 'warn' || action === 'lock') {
    const target = report.targetType === 'post' ? report.target?.owner : report.target
    return target?.role === 'user'
  }
  return true
}

const actionLabel = (report, settings) => `${settings.label} · ${report.displayCode}`

const targetPath = (report) => {
  if (!report.target) return ''
  return report.targetType === 'post'
    ? postPath(report.target)
    : report.target.username
      ? profilePath(report.target.username)
      : ''
}

function ReportActions({ report, onAction, disabled = false }) {
  const available = report.availableActions
  return Object.entries(REPORT_ACTIONS).map(([action, settings]) => {
    const allowed = available ? available.includes(action) : actionAllowed(report, action)
    return (
      <Button
        key={action}
        variant={settings.tone}
        aria-label={actionLabel(report, settings)}
        title={allowed ? settings.label : 'Thao tác không áp dụng cho đối tượng này'}
        disabled={disabled || !allowed}
        onClick={() => onAction(action)}
      >
        {settings.label}
      </Button>
    )
  })
}

function ReportEntries({ reports, onPreview }) {
  if (!reports.length)
    return <p className="text-small text-ink-muted">Chưa có report trong nhóm này.</p>
  return (
    <div className="grid gap-2">
      {reports.map((entry) => (
        <article
          key={entry.id}
          className="rounded-lg border border-line bg-surface-muted px-3 py-2.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-ink-muted">{entry.time}</span>
          </div>
          <div className="mt-2 grid gap-1 text-small leading-relaxed text-ink-secondary">
            <p>
              <span className="font-medium">Người gửi:</span> {entry.reporter || 'Tài khoản đã xóa'}
            </p>
            <p>
              <span className="font-medium">Lý do:</span>{' '}
              {entry.reasonLabel || REPORT_REASON_LABELS[entry.reason] || entry.reason}
            </p>
            {entry.content && entry.reason !== 'other' && (
              <p>
                <span className="font-medium">Nội dung:</span> {entry.content}
              </p>
            )}
            <small className="text-caption text-ink-subtle">
              {['resolved', 'dismissed'].includes(entry.status)
                ? `Đã xử lý${entry.action ? `: ${REPORT_ACTIONS[entry.action]?.label || entry.action}` : ''}`
                : 'Chưa xử lý'}
            </small>
          </div>
          {entry.screenshots?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {entry.screenshots.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  aria-label={`Phóng to ảnh ${index + 1}`}
                  onClick={() => onPreview(entry.screenshots, index)}
                  className="cursor-zoom-in rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <img
                    src={url}
                    alt="Bằng chứng report"
                    loading="lazy"
                    className="size-20 rounded-lg object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

export default function Reports() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const targetTypeParam = searchParams.get('targetType')
  const linkedTargetType = ['post', 'user'].includes(targetTypeParam) ? targetTypeParam : ''
  const linkedTargetId = linkedTargetType ? searchParams.get('targetId') : ''
  const focusKey = linkedTargetId ? `${location.key}:${linkedTargetType}:${linkedTargetId}` : null
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    ...(linkedTargetType && { targetType: linkedTargetType }),
  }))
  const [page, setPage] = useState(1)
  const [targetLookupPending, setTargetLookupPending] = useState(Boolean(linkedTargetId))
  const [linkedTargetFound, setLinkedTargetFound] = useState(null)
  const [result, setResult] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const requestReports = useCallback(
    () =>
      listModeratorReports({
        ...filters,
        page,
        ...(targetLookupPending && linkedTargetId ? { targetId: linkedTargetId } : {}),
      }),
    [filters, linkedTargetId, page, targetLookupPending]
  )

  useEffect(() => {
    let active = true
    requestReports()
      .then((nextResult) => {
        if (!active) return
        setResult(nextResult)
        if (targetLookupPending) {
          const found = nextResult.items.some(
            (report) =>
              report.targetType === linkedTargetType && report.target?.id === linkedTargetId
          )
          setLinkedTargetFound(found)
          setTargetLookupPending(false)
          if (found && nextResult.page !== page) {
            setLoading(true)
            setPage(nextResult.page)
          }
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [linkedTargetId, linkedTargetType, page, requestReports, targetLookupPending])

  const loadReports = async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await requestReports())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const items = result.items
  const linkedReport = items.find(
    (report) => report.targetType === linkedTargetType && report.target?.id === linkedTargetId
  )
  const highlight = useLinkedHighlight(focusKey, {
    enabled: Boolean(linkedTargetId && linkedReport && !loading),
  })
  const linkedTargetUnavailable = Boolean(
    linkedTargetId && linkedTargetFound === false && !loading && !error
  )
  const selected = useMemo(() => {
    if (!modal) return null
    if (detail?.id === modal.id) return detail
    return items.find((report) => report.id === modal.id) || null
  }, [detail, items, modal])
  const action = modal?.action ? REPORT_ACTIONS[modal.action] : null

  const changeFilter = (key, value) => {
    setLoading(true)
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setLoading(true)
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const changePage = (nextPage) => {
    setLoading(true)
    setPage(nextPage)
  }

  const openDetail = async (id) => {
    setModal({ id, kind: 'detail' })
    setPreviewImage(null)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      setDetail(await getModeratorReport(id))
    } catch (requestError) {
      setDetailError(requestError.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const confirmAction = (id, nextAction) => {
    setReason('')
    setActionError('')
    setModal({ id, kind: 'confirm', action: nextAction })
  }

  const executeAction = async (event) => {
    event?.preventDefault()
    if (!selected || !action || actionLoading) return
    const trimmedReason = reason.trim()
    if (modal.action !== 'dismiss' && !trimmedReason) {
      setActionError('Vui lòng nhập lý do xử lý.')
      return
    }
    setActionLoading(true)
    setActionError('')
    try {
      await resolveModeratorReport(selected.id, modal.action, trimmedReason)
      setPreviewImage(null)
      setModal(null)
      setDetail(null)
      setNotice(`Đã ${action.label.toLowerCase()} ${selected.displayCode}.`)
      await loadReports()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setActionLoading(false)
    }
  }

  const exportCsv = () => {
    downloadCsv('LostLink_Hang_doi_report.csv', [
      [
        'ID',
        'Thời gian',
        'Loại đối tượng',
        'Đối tượng',
        'Người bị report',
        'Mức độ',
        'Lý do',
        'Người gửi',
      ],
      ...items.map((report) => [
        report.displayCode,
        report.time,
        report.targetType === 'post' ? 'Bài đăng' : 'Tài khoản',
        report.targetTitle,
        report.reportedUser,
        SEVERITY_LABELS[report.severity],
        report.reasonLabel,
        report.reporter,
      ]),
    ])
    setNotice(`Đã xuất ${items.length} report đang hiển thị ra CSV.`)
  }

  const showEmpty = !loading && !error && !items.length

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <section
        aria-label="Bộ lọc hàng đợi"
        className="rounded-xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid grid-cols-[minmax(205px,1.4fr)_repeat(3,minmax(0,1fr))] gap-3 max-lg:grid-cols-2">
          <Field label="Tìm kiếm">
            {(props) => (
              <Input
                {...props}
                type="search"
                value={filters.query}
                onChange={(event) => changeFilter('query', event.target.value)}
                placeholder="Mã bài, tiêu đề, username, lý do…"
              />
            )}
          </Field>
          <Field label="Loại Report">
            {(props) => (
              <Select
                {...props}
                value={filters.targetType}
                onChange={(event) => changeFilter('targetType', event.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="post">Bài đăng</option>
                <option value="user">Tài khoản</option>
              </Select>
            )}
          </Field>
          <Field label="Mức độ nghiêm trọng">
            {(props) => (
              <Select
                {...props}
                value={filters.severity}
                onChange={(event) => changeFilter('severity', event.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Trạng thái xử lý">
            {(props) => (
              <Select
                {...props}
                value={filters.queueStatus}
                onChange={(event) => changeFilter('queueStatus', event.target.value)}
              >
                <option value="open">Chưa xử lý</option>
                <option value="processed">Đã xử lý</option>
              </Select>
            )}
          </Field>
        </div>
        <DateRange from={filters.from} to={filters.to} onChange={changeFilter}>
          <div className="ml-auto flex gap-2 max-sm:basis-full max-sm:justify-end">
            <IconButton
              icon="reset"
              label="Đặt lại bộ lọc"
              tone="view"
              colored
              size={36}
              onClick={resetFilters}
            />
            <Button variant="primary" onClick={exportCsv} disabled={!items.length}>
              <Icon name="download" />
              Xuất CSV
            </Button>
          </div>
        </DateRange>
      </section>

      <p className="mt-4 mb-2.5 text-small text-ink-subtle" aria-live="polite">
        {loading ? (
          'Đang tải danh sách report…'
        ) : (
          <>
            Hiển thị {result.total ? (result.page - 1) * result.pageSize + 1 : 0}–
            {Math.min(result.page * result.pageSize, result.total)} trong số {result.total} report
          </>
        )}
      </p>
      {notice && <Notice>{notice}</Notice>}
      {linkedTargetUnavailable && (
        <Notice>Đối tượng này không còn trong hàng đợi report chưa xử lý.</Notice>
      )}
      {error && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-small text-danger-ink">
          <span role="alert">{error}</span>
          <Button variant="danger-subtle" size="sm" onClick={loadReports}>
            Thử lại
          </Button>
        </div>
      )}

      <DataTable
        caption="Hàng đợi report cần xử lý"
        minWidth="min-w-[900px]"
        containerClassName="!border-[#b3c7df] !shadow-[0_10px_26px_rgba(34,65,100,0.14)]"
        headingClassName="!border-b-2 !border-b-[#c5d5e7] !bg-[#edf3fa] !text-[#244d78] !text-small"
        columns={[
          ['Thời gian', 'w-1/6'],
          ['Đối tượng', 'w-1/6'],
          ['Số lượng', 'w-1/6', 'text-center'],
          ['Người báo cáo', 'w-1/6'],
          ['Mức độ', 'w-1/6'],
          ['Thao tác', 'w-1/6'],
        ]}
        empty={
          showEmpty && (
            <EmptyState
              title={
                filters.queueStatus === 'processed'
                  ? 'Chưa có report nào đã xử lý trong danh sách này.'
                  : 'Không có report nào chưa xử lý trong danh sách này.'
              }
              description="Thử thay đổi bộ lọc để xem các kết quả khác."
            />
          )
        }
      >
        {loading ? (
          <tr>
            <td colSpan={6} className="px-5 py-14 text-center text-ink-muted">
              Đang tải hàng đợi report…
            </td>
          </tr>
        ) : (
          items.map((report) => (
            <tr
              key={report.id}
              ref={report.id === linkedReport?.id && highlight.active ? highlight.targetRef : null}
              className={cx(
                'transition-colors duration-150',
                report.id === linkedReport?.id && highlight.active
                  ? linkedHighlight
                  : 'hover:bg-[#edf4fc]'
              )}
            >
              <td className={cell}>
                {report.targetType === 'post' && (
                  <strong className="text-caption font-semibold text-primary">
                    {report.displayCode}
                  </strong>
                )}
                <div className="mt-1.5 flex items-center gap-1 text-caption text-ink-muted">
                  <Icon name="calendar" size={13} />
                  {report.time}
                </div>
              </td>
              <td className={cell}>
                {targetPath(report) ? (
                  <Link
                    to={targetPath(report)}
                    className="mb-1.5 block text-small font-semibold leading-relaxed text-ink hover:text-primary hover:underline"
                  >
                    {report.targetTitle}
                  </Link>
                ) : (
                  <span className="mb-1.5 block text-small font-semibold leading-relaxed text-ink">
                    {report.targetTitle}
                  </span>
                )}
              </td>
              <td className={`${cell} text-center`}>
                <span className="text-small font-semibold text-ink">{report.reportCount || 1}</span>
                <span className="ml-1 text-small font-semibold text-ink">report</span>
              </td>
              <td className={cell}>
                <strong className="block text-small font-semibold">
                  {report.reporter || 'Tài khoản đã xóa'}
                </strong>
              </td>
              <td className={cell}>
                <Severity value={report.severity} />
              </td>
              <td className={cell}>
                <div className="mx-auto grid max-w-[120px] grid-cols-3 place-items-center gap-1.5">
                  <IconButton
                    icon="eye"
                    tone="view"
                    colorOnly
                    label={`Xem report ${report.displayCode}`}
                    onClick={() => openDetail(report.id)}
                  />
                  {Object.entries(REPORT_ACTIONS).map(([key, settings]) => (
                    <IconButton
                      key={key}
                      icon={settings.icon}
                      tone={settings.tone}
                      colorOnly
                      label={actionLabel(report, settings)}
                      disabled={report.queueStatus === 'processed' || !actionAllowed(report, key)}
                      onClick={() => confirmAction(report.id, key)}
                    />
                  ))}
                </div>
              </td>
            </tr>
          ))
        )}
      </DataTable>
      <Pagination
        page={result.page}
        total={result.total}
        pageSize={result.pageSize}
        onChange={changePage}
        noun="report"
        showSummary={false}
      />

      {modal?.kind === 'detail' && (
        <Dialog
          key="detail"
          size="lg"
          title="Chi tiết Report"
          scrollableContent
          onClose={() => setModal(null)}
          footer={
            selected && (
              <>
                <Button onClick={() => setModal(null)}>Đóng</Button>
                {selected.queueStatus !== 'processed' && (
                  <ReportActions
                    report={selected}
                    onAction={(nextAction) => confirmAction(selected.id, nextAction)}
                  />
                )}
              </>
            )
          }
        >
          {detailLoading && (
            <p className="py-8 text-center text-ink-muted">Đang tải chi tiết report…</p>
          )}
          {detailError && (
            <div className="flex items-center justify-between gap-3 py-5 text-danger-ink">
              <span role="alert">{detailError}</span>
              <Button variant="danger-subtle" size="sm" onClick={() => openDetail(modal.id)}>
                Thử lại
              </Button>
            </div>
          )}
          {selected && !detailLoading && !detailError && (
            <>
              <DetailList
                rows={[
                  ['Số report', selected.reportCount || 1],
                  ['Trạng thái', QUEUE_STATUS_LABELS[selected.queueStatus] || 'Chưa xử lý'],
                  ['Đối tượng', selected.targetTitle],
                  ['Người bị report', selected.reportedUser || 'Không xác định'],
                  ['Mức độ cao nhất', <Severity key="severity" value={selected.severity} />],
                ]}
              />
              <h4 className="mt-3.5 mb-2 text-small font-semibold">Danh sách report</h4>
              <ReportEntries
                onPreview={(images, index) => setPreviewImage({ images, index })}
                reports={
                  selected.reports?.length
                    ? selected.reports
                    : [selected, ...(selected.history || [])]
                }
              />
            </>
          )}
        </Dialog>
      )}

      {modal?.kind === 'detail' && previewImage?.images?.[previewImage.index] && (
        <Dialog
          key="report-image-preview"
          size="lg"
          title="Hình ảnh"
          onClose={() => setPreviewImage(null)}
        >
          <div className="flex items-center justify-center gap-3">
            <IconButton
              icon="back"
              label="Xem ảnh trước"
              bordered
              size={36}
              disabled={previewImage.index === 0}
              onClick={() =>
                setPreviewImage((current) => ({ ...current, index: current.index - 1 }))
              }
            />
            <div className="flex min-w-0 flex-1 justify-center">
              <img
                src={previewImage.images[previewImage.index]}
                alt={`Ảnh ${previewImage.index + 1}`}
                className="max-h-[calc(100dvh-180px)] max-w-full rounded-lg object-contain"
              />
            </div>
            <IconButton
              icon="next"
              label="Xem ảnh tiếp theo"
              bordered
              size={36}
              disabled={previewImage.index === previewImage.images.length - 1}
              onClick={() =>
                setPreviewImage((current) => ({ ...current, index: current.index + 1 }))
              }
            />
          </div>
          <p className="mt-3 text-center text-caption text-ink-muted">
            {previewImage.index + 1}/{previewImage.images.length}
          </p>
        </Dialog>
      )}

      {modal?.kind === 'confirm' && selected && action && (
        <Dialog
          key="confirm"
          size="sm"
          title={
            modal.action === 'warn'
              ? 'Gửi cảnh cáo'
              : modal.action === 'hide'
                ? 'Ẩn bài đăng'
                : modal.action === 'lock'
                  ? 'Xác nhận khóa tài khoản'
                  : modal.action === 'dismiss'
                    ? 'Xác nhận bỏ qua report'
                    : 'Xác nhận thao tác'
          }
          onClose={() => !actionLoading && setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)} disabled={actionLoading}>
                Hủy
              </Button>
              <Button variant={action.tone} onClick={executeAction} disabled={actionLoading}>
                {actionLoading
                  ? 'Đang xử lý…'
                  : modal.action === 'warn'
                    ? 'Gửi'
                    : modal.action === 'hide'
                      ? 'Xác nhận'
                      : modal.action === 'lock'
                        ? 'Xác nhận'
                        : modal.action === 'dismiss'
                          ? 'Xác nhận'
                          : `Xác nhận ${action.label.toLowerCase()}`}
              </Button>
            </>
          }
        >
          {!['warn', 'hide', 'lock', 'dismiss'].includes(modal.action) && (
            <p className="mb-2 text-lead font-semibold leading-relaxed">{action.description}</p>
          )}
          <DetailList
            rows={[
              ['Số report chưa xử lý', selected.openReportCount || selected.reportCount || 1],
              ['Đối tượng', selected.targetTitle],
              ['Tài khoản', selected.reportedUser || 'Không xác định'],
            ]}
          />
          {modal.action !== 'dismiss' && (
            <Field
              label={
                modal.action === 'warn'
                  ? 'Nội dung'
                  : modal.action === 'hide'
                    ? 'Lý do'
                    : modal.action === 'lock'
                      ? 'Lý do'
                      : 'Lý do xử lý'
              }
              required={!['warn', 'hide', 'lock'].includes(modal.action)}
              error={actionError}
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={
                    modal.action === 'warn'
                      ? 'Nhập nội dung'
                      : modal.action === 'hide'
                        ? 'Nhập lý do xử lý'
                        : modal.action === 'lock'
                          ? 'Nhập lý do khóa tài khoản'
                          : 'Nhập lý do xử lý report'
                  }
                  maxLength={500}
                />
              )}
            </Field>
          )}
          {modal.action === 'dismiss' && actionError && (
            <p role="alert" className="text-danger-ink">
              {actionError}
            </p>
          )}
          <p className="mt-3 text-caption leading-relaxed text-ink-muted">
            {modal.action === 'warn'
              ? 'Nội dung cảnh cáo sẽ được gửi cho Người dùng'
              : modal.action === 'hide'
                ? 'Bài đăng sẽ được ẩn sau khi thực hiện thao tác này'
                : modal.action === 'lock'
                  ? 'Tài khoản sẽ bị khóa sau khi thực hiện thao tác này'
                  : modal.action === 'dismiss'
                    ? 'Report sẽ được bỏ qua vì không phát hiện vi phạm.'
                    : 'Thao tác sẽ được ghi nhận cho tất cả report đang mở của đối tượng này.'}
          </p>
        </Dialog>
      )}
    </div>
  )
}
