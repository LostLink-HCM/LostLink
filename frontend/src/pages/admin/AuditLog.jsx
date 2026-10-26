import { useEffect, useMemo, useState } from 'react'
import Badge from '../../components/backoffice/Badge'
import Button from '../../components/backoffice/Button'
import DataTable, { cell } from '../../components/backoffice/DataTable'
import DateRange from '../../components/backoffice/DateRange'
import EmptyState from '../../components/backoffice/EmptyState'
import Field, { Input, Select } from '../../components/backoffice/Field'
import Icon from '../../components/common/Icon'
import IconButton from '../../components/backoffice/IconButton'
import Notice from '../../components/backoffice/Notice'
import Pagination from '../../components/backoffice/Pagination'
import { createAdminAudit } from '../../data/adminAudit'
import { downloadCsv } from '../../lib/csv'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_FILTERS,
  auditDetail,
  auditEntityLabel,
  auditObjectCode,
  auditReason,
  auditLogsToRows,
  filterAuditLogs,
  formatAuditDate,
} from '../../lib/admin/audit'

const PAGE_SIZE = 8

const actionIcons = {
  lock: 'lock',
  hide: 'lock',
  revoke: 'lock',
  incorrect: 'lock',
  grant: 'check',
  verify: 'check',
  returned: 'check',
  settings: 'settings',
  remind: 'mail',
}

const roleTones = { Admin: 'primary', Moderator: 'info' }

export default function AuditLog() {
  const [filters, setFilters] = useState(AUDIT_FILTERS)
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState('')
  const [logs] = useState(createAdminAudit)
  const filtered = useMemo(() => filterAuditLogs(logs, filters), [filters, logs])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const changeFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
    setNotice('')
  }

  const resetFilters = () => {
    setFilters(AUDIT_FILTERS)
    setPage(1)
    setNotice('')
  }

  const exportCsv = () => {
    if (!filtered.length) return
    downloadCsv('LostLink_Nhat_ky_thao_tac.csv', auditLogsToRows(filtered))
    setNotice(`Đã xuất ${filtered.length} bản ghi nhật ký ra CSV.`)
  }

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <section
        aria-label="Bộ lọc nhật ký thao tác"
        className="rounded-xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid grid-cols-[minmax(220px,1.35fr)_repeat(3,minmax(0,1fr))] gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Field label="Tìm kiếm">
            {(props) => (
              <Input
                {...props}
                type="search"
                value={filters.query}
                onChange={(event) => changeFilter('query', event.target.value)}
                placeholder="Tên hoặc nội dung thao tác…"
              />
            )}
          </Field>
          <Field label="Vai trò">
            {(props) => (
              <Select
                {...props}
                value={filters.actor}
                onChange={(event) => changeFilter('actor', event.target.value)}
              >
                <option value="">Tất cả vai trò</option>
                <option value="Admin">Admin</option>
                <option value="Moderator">Moderator</option>
              </Select>
            )}
          </Field>
          <Field label="Hành động">
            {(props) => (
              <Select
                {...props}
                value={filters.action}
                onChange={(event) => changeFilter('action', event.target.value)}
              >
                <option value="">Tất cả hành động</option>
                {Object.entries(AUDIT_ACTIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Đối tượng">
            {(props) => (
              <Select
                {...props}
                value={filters.entityType}
                onChange={(event) => changeFilter('entityType', event.target.value)}
              >
                <option value="">Tất cả đối tượng</option>
                {Object.entries(AUDIT_ENTITY_TYPES).map(([value, label]) => (
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
              label="Đặt lại bộ lọc nhật ký"
              bordered
              size={36}
              onClick={resetFilters}
            />
            <Button variant="primary" onClick={exportCsv} disabled={!filtered.length}>
              <Icon name="download" size={16} />
              Xuất CSV
            </Button>
          </div>
        </DateRange>
      </section>

      {notice && <Notice>{notice}</Notice>}
      <p className="mt-4 mb-2.5 text-small text-ink-muted" aria-live="polite">
        Hiển thị <strong className="px-1 text-lead text-primary">{filtered.length}</strong> bản ghi
        phù hợp
      </p>

      <DataTable
        caption="Nhật ký thao tác của Admin và Moderator"
        ariaLabel="Bảng nhật ký thao tác, cuộn ngang để xem thêm"
        minWidth="min-w-[900px]"
        variant="admin"
        columns={[
          ['Thời gian', 'w-[17%]'],
          ['Người thực hiện', 'w-[17%]'],
          ['Hành động', 'w-[19%]'],
          ['Đối tượng', 'w-[23%]'],
          ['Chi tiết', 'w-[24%]'],
        ]}
        empty={
          !visible.length && (
            <div className="pb-8 text-center">
              <EmptyState
                icon="history"
                title="Không có bản ghi phù hợp"
                description="Thay đổi bộ lọc để xem các thao tác khác."
              />
              <Button onClick={resetFilters}>Xóa bộ lọc</Button>
            </div>
          )
        }
      >
        {visible.map((log) => (
          <tr key={log.id} className="hover:bg-surface-muted">
            <td className={cell}>
              <time dateTime={log.createdAt} className="text-caption text-ink-secondary">
                {formatAuditDate(log.createdAt)}
              </time>
            </td>
            <td className={cell}>
              <Badge tone={roleTones[log.actorRole] || 'neutral'}>{log.actorRole}</Badge>
            </td>
            <td className={cell}>
              <span className="inline-flex items-center gap-1.5 text-small text-ink-secondary">
                <Icon name={actionIcons[log.action] || 'history'} size={15} />
                {AUDIT_ACTIONS[log.action] || log.detail}
              </span>
            </td>
            <td className={cell}>
              <div className="flex flex-col gap-1 text-small text-ink-secondary">
                <span className="font-semibold text-ink">{auditEntityLabel(log)}</span>
                <span className="text-caption text-ink-muted">{auditObjectCode(log)}</span>
              </div>
            </td>
            <td className={cell}>
              <span className="text-small font-semibold leading-relaxed text-ink">
                {auditDetail(log)}
              </span>
              {auditReason(log) && (
                <span className="mt-1 block text-caption leading-relaxed text-ink-muted">
                  {auditReason(log)}
                </span>
              )}
            </td>
          </tr>
        ))}
      </DataTable>

      <Pagination
        page={currentPage}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
        noun="bản ghi"
      />
    </div>
  )
}
