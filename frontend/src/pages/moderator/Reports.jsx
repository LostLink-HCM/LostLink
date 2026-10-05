import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../../components/moderator/Badge'
import Button from '../../components/moderator/Button'
import DataTable, { cell } from '../../components/moderator/DataTable'
import DateRange from '../../components/moderator/DateRange'
import DetailList from '../../components/moderator/DetailList'
import Dialog from '../../components/moderator/Dialog'
import EmptyState from '../../components/moderator/EmptyState'
import Field, { Input, Select } from '../../components/moderator/Field'
import Icon from '../../components/common/Icon'
import IconButton from '../../components/moderator/IconButton'
import Notice from '../../components/moderator/Notice'
import Pagination from '../../components/moderator/Pagination'
import {
  REPORT_ACTIONS,
  SEVERITY_LABELS,
  violationHistory,
  resolveReport,
  filterModeratorReports,
} from '../../lib/moderation'
import { downloadCsv } from '../../lib/csv'

const PAGE_SIZE = 6
const EMPTY_FILTERS = { targetType: 'account', severity: '', from: '', to: '', query: '' }

const SEVERITY_TONES = { high: 'danger', medium: 'warning', low: 'success' }

function Severity({ value }) {
  return <Badge tone={SEVERITY_TONES[value]}>{SEVERITY_LABELS[value]}</Badge>
}

function getDisplayCode(report, posts) {
  if (report.targetType === 'post') {
    const post = posts.find(
      (entry) => entry.id === report.targetPostId || entry.title === report.targetTitle
    )
    return post?.postCode || post?.id || report.id
  }
  return `#${report.id}`
}

// Ẩn bài chỉ áp dụng cho report bài đăng
const canApply = (report, action) => action !== 'hide' || report.targetType === 'post'
const actionLabel = (report, settings, code) =>
  `${settings.label} · ${report.targetType === 'post' ? 'bài' : 'report'} ${code || `#${report.id}`}`

function ReportActions({ report, onAction, code }) {
  return Object.entries(REPORT_ACTIONS).map(([action, settings]) => (
    <Button
      key={action}
      variant={settings.tone}
      aria-label={actionLabel(report, settings, code)}
      title={canApply(report, action) ? settings.label : 'Chỉ áp dụng cho report bài đăng'}
      disabled={!canApply(report, action)}
      onClick={() => onAction(action)}
    >
      <Icon name={settings.icon} />
      {settings.label}
    </Button>
  ))
}

function History({ report }) {
  const count = violationHistory(report).length
  return (
    <span
      className={`mt-1.5 flex items-center gap-1 text-caption font-medium ${count ? 'text-danger-ink' : 'text-success'}`}
    >
      <Icon name={count ? 'warning' : 'check'} size={14} />
      {count ? `${count} cảnh báo cũ` : 'Chưa có vi phạm'}
    </span>
  )
}

function RelatedReportHistory({ reports }) {
  if (!reports.length)
    return <p className="text-small text-ink-muted">Chưa có report nào trước đó.</p>
  return (
    <div className="grid gap-2">
      {reports.map((entry) => (
        <article
          key={entry.id}
          className="rounded-lg border border-line bg-surface-muted px-3 py-2.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-caption font-semibold text-primary">
              #{entry.displayId || entry.id}
            </strong>
            <span className="text-caption text-ink-muted">{entry.time}</span>
            <Severity value={entry.severity} />
          </div>
          <p className="my-1.5 text-small leading-relaxed text-ink-secondary">{entry.reason}</p>
          <small className="text-caption text-ink-subtle">
            Người gửi: @{entry.reporter}
            {entry.resolution
              ? ` · Đã xử lý: ${REPORT_ACTIONS[entry.resolution]?.label || entry.resolution}`
              : ' · Đang mở'}
          </small>
        </article>
      ))}
    </div>
  )
}

export default function Reports() {
  const { reports, setReports, posts } = useOutletContext()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const filtered = filterModeratorReports(reports, filters)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selected = modal && reports.find((report) => report.id === modal.id && !report.resolution)
  const selectedCode = selected ? getDisplayCode(selected, posts) : ''
  const action = modal?.action && REPORT_ACTIONS[modal.action]
  const oldWarnings = selected ? violationHistory(selected) : []
  const oldWarningIds = new Set(oldWarnings.map((entry) => String(entry.id)))
  const oldWarningsWithoutReport = oldWarnings.filter(
    (entry) => !reports.some((report) => String(report.id) === String(entry.id))
  )
  const historyReports = selected
    ? reports.filter(
        (report) =>
          report.id !== selected.id &&
          (oldWarningIds.has(String(report.id)) ||
            (report.reportedUser === selected.reportedUser &&
              (selected.targetType === 'account' || report.targetTitle === selected.targetTitle)))
      )
    : []
  const changeFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
  }
  const confirmAction = (id, nextAction) => setModal({ id, kind: 'confirm', action: nextAction })
  const executeAction = () => {
    if (!selected || !action || (modal.action === 'hide' && selected.targetType !== 'post')) return
    setReports((previous) => resolveReport(previous, selected.id, modal.action))
    setNotice(
      `Đã ghi nhận “${action.label}” cho ${selected.targetType === 'post' ? `bài ${selectedCode}` : `report ${selectedCode}`} và đưa report khỏi hàng đợi.`
    )
    setModal(null)
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
      ...filtered.map((report) => [
        getDisplayCode(report, posts),
        report.time,
        report.targetType === 'post' ? 'Bài đăng' : 'Tài khoản',
        report.targetTitle,
        report.reportedUser,
        SEVERITY_LABELS[report.severity],
        report.reason,
        report.reporter,
      ]),
    ])
    setNotice(`Đã xuất ${filtered.length} report ra CSV.`)
  }

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <section
        aria-label="Bộ lọc hàng đợi"
        className="rounded-xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid grid-cols-[minmax(205px,1.4fr)_repeat(2,minmax(0,1fr))] gap-3 max-sm:grid-cols-2">
          <Field label="Tìm kiếm">
            {(a) => (
              <Input
                {...a}
                type="search"
                value={filters.query}
                onChange={(e) => changeFilter('query', e.target.value)}
                placeholder="Report, bài đăng, tài khoản…"
              />
            )}
          </Field>
          <Field label="Loại Report">
            {(a) => (
              <Select
                {...a}
                value={filters.targetType}
                onChange={(e) => changeFilter('targetType', e.target.value)}
              >
                <option value="">Tất cả đối tượng</option>
                <option value="post">Bài viết</option>
                <option value="account">Tài khoản</option>
              </Select>
            )}
          </Field>
          <Field label="Mức độ nghiêm trọng">
            {(a) => (
              <Select
                {...a}
                value={filters.severity}
                onChange={(e) => changeFilter('severity', e.target.value)}
              >
                <option value="">Tất cả mức độ</option>
                {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
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
        Số lượng: <strong className="px-1 text-lead text-primary">{filtered.length}</strong> report
      </p>
      {notice && <Notice>{notice}</Notice>}

      <DataTable
        caption="Hàng đợi report cần xử lý"
        minWidth="min-w-[900px]"
        columns={[
          ['Thời gian', 'w-[16%]'],
          ['Đối tượng', 'w-[23%]'],
          ['Tài khoản', 'w-[20%]'],
          ['Lý do & Mức độ', 'w-[24%]'],
          ['Thao tác', 'w-[17%]'],
        ]}
        empty={
          !visible.length && (
            <EmptyState
              title="Không có report nào cần xử lý trong danh sách này."
              description="Thử thay đổi bộ lọc để xem các kết quả khác."
            />
          )
        }
      >
        {visible.map((report) => {
          const code = getDisplayCode(report, posts)
          return (
            <tr key={report.id} className="hover:bg-surface-muted">
              <td className={cell}>
                <strong className="text-caption font-semibold text-primary">{code}</strong>
                <div className="mt-1.5 flex items-center gap-1 text-caption text-ink-muted">
                  <Icon name="calendar" size={13} />
                  {report.time}
                </div>
              </td>
              <td className={cell}>
                <button
                  type="button"
                  className="mb-1.5 block cursor-pointer text-left text-small font-semibold leading-relaxed text-ink hover:text-primary"
                  onClick={() => setModal({ id: report.id, kind: 'detail' })}
                >
                  {report.targetTitle}
                </button>
                <Badge tone={report.targetType === 'post' ? 'primary' : 'info'}>
                  {report.targetType === 'post' ? 'Bài đăng' : 'Tài khoản'}
                </Badge>
              </td>
              <td className={cell}>
                <strong className="block text-small font-semibold">@{report.reportedUser}</strong>
                <History report={report} />
              </td>
              <td className={cell}>
                <p className="mb-1.5 text-small font-medium leading-relaxed">{report.reason}</p>
                <Severity value={report.severity} />
              </td>
              <td className={cell}>
                <div className="mx-auto grid max-w-[120px] grid-cols-3 place-items-center gap-1.5">
                  <IconButton
                    icon="eye"
                    tone="view"
                    label={`Xem ${report.targetType === 'post' ? 'bài' : 'report'} ${code}`}
                    onClick={() => setModal({ id: report.id, kind: 'detail' })}
                  />
                  {Object.entries(REPORT_ACTIONS).map(([key, settings]) => (
                    <IconButton
                      key={key}
                      icon={settings.icon}
                      tone={settings.tone}
                      label={actionLabel(report, settings, code)}
                      disabled={!canApply(report, key)}
                      onClick={() => confirmAction(report.id, key)}
                    />
                  ))}
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
        noun="report"
      />

      {selected && modal.kind === 'detail' && (
        <Dialog
          key="detail"
          size="lg"
          title="Chi tiết Report"
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Đóng</Button>
              <ReportActions
                report={selected}
                code={selectedCode}
                onAction={(nextAction) => confirmAction(selected.id, nextAction)}
              />
            </>
          }
        >
          <DetailList
            rows={[
              [selected.targetType === 'post' ? 'Mã bài đăng' : 'Mã Report', selectedCode],
              ['Thời gian', selected.time],
              ['Đối tượng', selected.targetTitle],
              ['Người bị Report', `@${selected.reportedUser}`],
              ['Lý do Report', selected.reason],
              ['Mức độ', <Severity key="severity" value={selected.severity} />],
              ['Người gửi', `@${selected.reporter}`],
            ]}
          />
          <h4 className="mt-3.5 mb-2 text-small font-semibold">
            Nội dung giải trình / bằng chứng từ người Report
          </h4>
          <p className="rounded-lg border border-danger-soft bg-danger-soft/50 px-3.5 py-3 text-small leading-relaxed text-danger-ink [overflow-wrap:anywhere]">
            {selected.content}
          </p>
          {(oldWarningsWithoutReport.length > 0 || historyReports.length > 0) && (
            <>
              <h4 className="mt-3.5 mb-2 text-small font-semibold">Lịch sử</h4>
              <div className="grid gap-2">
                {oldWarningsWithoutReport.length > 0 && (
                  <RelatedReportHistory reports={oldWarningsWithoutReport} />
                )}
                {historyReports.length > 0 && <RelatedReportHistory reports={historyReports} />}
              </div>
            </>
          )}
        </Dialog>
      )}

      {selected && modal.kind === 'confirm' && (
        <Dialog
          key="confirm"
          size="sm"
          title="Xác nhận thao tác"
          onClose={() => setModal(null)}
          footer={
            <>
              <Button onClick={() => setModal(null)}>Hủy</Button>
              <Button variant={action.tone} onClick={executeAction}>
                Xác nhận {action.label.toLowerCase()}
              </Button>
            </>
          }
        >
          <p className="mb-2 text-lead font-semibold leading-relaxed">{action.description}</p>
          <DetailList
            rows={[
              [
                selected.targetType === 'post' ? 'Bài đăng' : 'Report',
                `${selectedCode} · ${selected.targetTitle}`,
              ],
              ['Tài khoản', `@${selected.reportedUser}`],
            ]}
          />
          <p className="text-caption leading-relaxed text-ink-muted">
            Thao tác sẽ được ghi nhận và report sẽ rời hàng đợi sau khi xác nhận.
          </p>
        </Dialog>
      )}
    </div>
  )
}
