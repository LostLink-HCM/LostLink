import { useState } from 'react'
import ModIcon from '../../components/ui/Icon'
import ModDialog from '../../components/moderator/ModDialog'
import { QueueToolbar, QueueSummary, QueuePagination, QueueEmpty } from '../../components/moderator/QueueControls'
import { REPORT_ACTIONS, SEVERITY_LABELS, violationHistory, resolveReport, downloadCsv, filterModeratorReports } from '../../lib/moderation'
import { reportDialogClasses, reportQueueClasses, reportSeverityClasses, reportUi } from '../../components/moderator/reportStyles'

const PAGE_SIZE = 6
const EMPTY_FILTERS = { targetType: 'account', severity: '', from: '', to: '', query: '' }

function Severity({ value }) {
  return <span className={`${reportUi.severity} ${reportSeverityClasses[value]}`}>{SEVERITY_LABELS[value]}</span>
}

function getDisplayCode(report, posts) {
  if (report.targetType === 'post') {
    const post = posts.find((entry) => entry.id === report.targetPostId || entry.title === report.targetTitle)
    return post?.postCode || post?.id || report.id
  }
  return `#${report.id}`
}

function ReportActions({ report, onAction, compact = false, code, wrapperClass = reportUi.reportActions }) {
  const actionClass = { warning: reportUi.warningAction, danger: reportUi.dangerAction, success: reportUi.successAction }
  return <div className={wrapperClass}>{Object.entries(REPORT_ACTIONS).map(([action, settings]) => <button key={action}
    className={compact ? actionClass[settings.tone] : settings.tone === 'danger' ? reportUi.dangerButton : settings.tone === 'success' ? reportUi.successButton : reportUi.warningButton}
    title={action === 'hide' && report.targetType !== 'post' ? 'Chỉ áp dụng cho report bài đăng' : settings.label}
    aria-label={`${settings.label} · ${report.targetType === 'post' ? 'bài' : 'report'} ${code || `#${report.id}`}`}
    disabled={action === 'hide' && report.targetType !== 'post'}
    onClick={() => onAction(action)}><ModIcon name={settings.icon} />{!compact && settings.label}</button>)}</div>
}

function History({ report }) {
  const history = violationHistory(report)
  return <span className={`${reportUi.reputation} ${history.length ? reportUi.reputationDanger : reportUi.reputationSuccess}`}><ModIcon name={history.length ? 'warning' : 'check'} size={14} />{history.length ? `${history.length} cảnh báo cũ` : 'Chưa có vi phạm'}</span>
}

function RelatedReportHistory({ reports }) {
  return <div className={reportUi.historyList}>{reports.length ? reports.map((entry) => <article className={reportUi.historyArticle} key={entry.id}><div className={reportUi.historyMeta}><strong className={reportUi.historyId}>#{entry.displayId || entry.id}</strong><span className={reportUi.historyTime}>{entry.time}</span><Severity value={entry.severity} /></div><p className={reportUi.historyReason}>{entry.reason}</p><small className={reportUi.historyReporter}>Người gửi: @{entry.reporter}{entry.resolution ? ` · Đã xử lý: ${REPORT_ACTIONS[entry.resolution]?.label || entry.resolution}` : ' · Đang mở'}</small></article>) : <p>Chưa có report nào trước đó.</p>}</div>
}

export default function Reports({ reports, setReports, posts = [] }) {
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
  const oldWarningsWithoutReport = oldWarnings.filter((entry) => !reports.some((report) => String(report.id) === String(entry.id)))
  const historyReports = selected ? reports.filter((report) => report.id !== selected.id && (oldWarningIds.has(String(report.id)) || (report.reportedUser === selected.reportedUser && (selected.targetType === 'account' || report.targetTitle === selected.targetTitle)))) : []
  const changeFilter = (key, value) => { setFilters((previous) => ({ ...previous, [key]: value })); setPage(1) }
  const confirmAction = (id, nextAction) => setModal({ id, kind: 'confirm', action: nextAction })
  const executeAction = () => {
    if (!selected || !action || (modal.action === 'hide' && selected.targetType !== 'post')) return
    setReports((previous) => resolveReport(previous, selected.id, modal.action))
    setNotice(`Đã ghi nhận “${action.label}” cho ${selected.targetType === 'post' ? `bài ${selectedCode}` : `report ${selectedCode}`} và đưa report khỏi hàng đợi.`)
    setModal(null)
  }
  const exportCsv = () => {
    downloadCsv('LostLink_Hang_doi_report.csv', [
      ['ID', 'Thời gian', 'Loại đối tượng', 'Đối tượng', 'Người bị report', 'Mức độ', 'Lý do', 'Người gửi'],
      ...filtered.map((report) => [getDisplayCode(report, posts), report.time, report.targetType === 'post' ? 'Bài đăng' : 'Tài khoản', report.targetTitle, report.reportedUser, SEVERITY_LABELS[report.severity], report.reason, report.reporter]),
    ])
    setNotice(`Đã xuất ${filtered.length} report ra CSV.`)
  }
  return <div className={reportUi.root}>
    <QueueToolbar classes={reportQueueClasses} onReset={() => { setFilters(EMPTY_FILTERS); setPage(1) }} onExport={exportCsv} empty={!filtered.length} dateFilters={filters} onDateChange={changeFilter}>
      <label className={reportUi.label}>Tìm kiếm<input className={reportUi.input} type="search" value={filters.query} onChange={(e) => changeFilter('query', e.target.value)} placeholder="Report, bài đăng, tài khoản…" /></label>
      <label className={reportUi.label}>Loại Report<select className={reportUi.input} value={filters.targetType} onChange={(e) => changeFilter('targetType', e.target.value)}><option value="">Tất cả đối tượng</option><option value="post">Bài viết</option><option value="account">Tài khoản</option></select></label>
      <label className={reportUi.label}>Mức độ nghiêm trọng<select className={reportUi.input} value={filters.severity} onChange={(e) => changeFilter('severity', e.target.value)}><option value="">Tất cả mức độ</option>{Object.entries(SEVERITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </QueueToolbar>
    <QueueSummary classes={reportUi} count={filtered.length} noun="report" notice={notice} />
    <div className={reportUi.tableContainer}>
      <table className={reportUi.table}>
        <caption className="sr-only">Hàng đợi report cần xử lý</caption>
        <colgroup><col className="w-[16%]" /><col className="w-[23%]" /><col className="w-[20%]" /><col className="w-[24%]" /><col className="w-[17%]" /></colgroup>
        <thead><tr>{['Thời gian', 'Đối tượng', 'Tài khoản', 'Lý do & Mức độ', 'Thao tác'].map((label) => <th className={reportUi.tableHead} key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody className="[&_tr:last-child_td]:border-b-0">{visible.map((report) => (
          <tr className="hover:bg-[#f9fbfe]" key={report.id}>
            <td className={reportUi.tableCell}><strong className={reportUi.code}>{getDisplayCode(report, posts)}</strong><div className={reportUi.location}><ModIcon name="calendar" size={13} />{report.time}</div></td>
            <td className={reportUi.tableCell}><button className={reportUi.title} onClick={() => setModal({ id: report.id, kind: 'detail' })}>{report.targetTitle}</button><span className={report.targetType === 'post' ? reportUi.typePost : reportUi.typeAccount}>{report.targetType === 'post' ? 'Bài đăng' : 'Tài khoản'}</span></td>
            <td className={reportUi.tableCell}><strong className={reportUi.author}>@{report.reportedUser}</strong><History report={report} /></td>
            <td className={reportUi.tableCell}><p className={reportUi.reason}>{report.reason}</p><Severity value={report.severity} /></td>
            <td className={reportUi.tableCell}><div className={reportUi.tableActions}><button className={reportUi.viewAction} aria-label={`Xem ${report.targetType === 'post' ? 'bài' : 'report'} ${getDisplayCode(report, posts)}`} title="Xem chi tiết" onClick={() => setModal({ id: report.id, kind: 'detail' })}><ModIcon name="eye" /></button><ReportActions compact wrapperClass="contents" report={report} code={getDisplayCode(report, posts)} onAction={(nextAction) => confirmAction(report.id, nextAction)} /></div></td>
          </tr>
        ))}</tbody>
      </table>
      {!visible.length && <QueueEmpty classes={reportUi}>Không có report nào cần xử lý trong danh sách này.</QueueEmpty>}
    </div>
    <QueuePagination classes={reportUi} page={currentPage} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} noun="report" />
    {selected && modal.kind === 'detail' && <ModDialog classes={reportDialogClasses} key="detail" title="Chi tiết Report" onClose={() => setModal(null)} footer={<><button className={reportUi.button} onClick={() => setModal(null)}>Đóng</button><ReportActions report={selected} code={selectedCode} onAction={(nextAction) => confirmAction(selected.id, nextAction)} /></>}>
      <dl className={reportUi.detailList}><div><dt>{selected.targetType === 'post' ? 'Mã bài đăng' : 'Mã Report'}</dt><dd>{selectedCode}</dd></div><div><dt>Thời gian</dt><dd>{selected.time}</dd></div><div><dt>Đối tượng</dt><dd>{selected.targetTitle}</dd></div><div><dt>Người bị Report</dt><dd>@{selected.reportedUser}</dd></div><div><dt>Lý do Report</dt><dd>{selected.reason}</dd></div><div><dt>Mức độ</dt><dd><Severity value={selected.severity} /></dd></div><div><dt>Người gửi</dt><dd>@{selected.reporter}</dd></div></dl>
      <h4 className={reportUi.heading}>Nội dung giải trình / bằng chứng từ người Report</h4><p className={reportUi.evidence}>{selected.content}</p>
      {(oldWarningsWithoutReport.length > 0 || historyReports.length > 0) && <><h4 className={reportUi.heading}>Lịch sử</h4>{oldWarningsWithoutReport.length > 0 && <RelatedReportHistory reports={oldWarningsWithoutReport} />}{historyReports.length > 0 && <RelatedReportHistory reports={historyReports} />}</>}
    </ModDialog>}
    {selected && modal.kind === 'confirm' && <ModDialog classes={reportDialogClasses} key="confirm" title="Xác nhận thao tác" onClose={() => setModal(null)} footer={<><button className={reportUi.button} onClick={() => setModal(null)}>Hủy</button><button className={action.tone === 'danger' ? reportUi.dangerButton : action.tone === 'success' ? reportUi.successButton : reportUi.warningButton} onClick={executeAction}>Xác nhận {action.label.toLowerCase()}</button></>}>
      <p className={reportUi.editTitle}>{action.description}</p><dl className={reportUi.detailList}><div><dt>{selected.targetType === 'post' ? 'Bài đăng' : 'Report'}</dt><dd>{selectedCode} · {selected.targetTitle}</dd></div><div><dt>Tài khoản</dt><dd>@{selected.reportedUser}</dd></div></dl>
      <p className={reportUi.hint}>Thao tác sẽ được ghi nhận và report sẽ rời hàng đợi sau khi xác nhận.</p>
    </ModDialog>}
  </div>
}
