import { useEffect, useMemo, useRef, useState } from 'react'
import { listAuditLogs } from '../../api/auditLogs'
import Badge from '../../components/backoffice/Badge'
import Button from '../../components/backoffice/Button'
import DataTable, { cell } from '../../components/backoffice/DataTable'
import DateRange from '../../components/backoffice/DateRange'
import EmptyState from '../../components/backoffice/EmptyState'
import Field, { Input, Select } from '../../components/backoffice/Field'
import Icon from '../../components/common/Icon'
import IconButton from '../../components/backoffice/IconButton'
import Pagination from '../../components/backoffice/Pagination'
import useBackofficePageSize from '../../hooks/useBackofficePageSize'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_FILTERS,
  AUDIT_ROLES,
  auditActorName,
  auditChanges,
  auditDetail,
  auditEntityLabel,
  auditObjectCode,
  auditReason,
  formatAuditDate,
} from '../../lib/admin/audit'

const actionIcons = {
  lock: 'lock',
  unlock: 'unlock',
  hide: 'eyeOff',
  unhide: 'eyeCheck',
  revoke: 'lock',
  grant: 'check',
  approve: 'check',
  reject: 'close',
  restrict: 'warning',
  warn: 'warning',
  initialize: 'settings',
  create: 'compose',
  delete: 'trash',
}

const roleTones = { admin: 'primary', moderator: 'info', system: 'neutral' }

function AuditDetails({ log }) {
  const changes = auditChanges(log)
  return (
    <>
      <span className="text-small font-semibold leading-relaxed text-ink">{auditDetail(log)}</span>
      {auditReason(log) && (
        <span className="mt-1 block text-caption leading-relaxed text-ink-muted">
          Lý do: {auditReason(log)}
        </span>
      )}
      {changes.length > 0 && (
        <details className="mt-2 text-caption text-ink-secondary">
          <summary className="cursor-pointer rounded py-1 text-primary focus-visible:outline-2 focus-visible:outline-focus">
            Xem thay đổi
          </summary>
          <dl className="mt-1 max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface-muted px-3">
            {changes.map((change) => (
              <div key={change.key} className="py-2">
                <dt className="font-semibold">{change.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-relaxed">
                  <span className="text-ink-muted">Trước: </span>
                  {change.before}
                </dd>
                <dd className="mt-1 whitespace-pre-wrap leading-relaxed">
                  <span className="text-ink-muted">Sau: </span>
                  {change.after}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </>
  )
}

export default function AuditLog() {
  const fallbackPageSize = useBackofficePageSize()
  const [filters, setFilters] = useState(AUDIT_FILTERS)
  const [page, setPage] = useState(1)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: '', fieldErrors: {} })
  const pending = useRef(null)
  const requestFilters = useMemo(
    () => ({
      query: debouncedQuery,
      actorRole: filters.actorRole,
      action: filters.action,
      entityType: filters.entityType,
      from: filters.from,
      to: filters.to,
      page,
    }),
    [
      debouncedQuery,
      filters.actorRole,
      filters.action,
      filters.entityType,
      filters.from,
      filters.to,
      page,
    ]
  )
  const requestKey = JSON.stringify([requestFilters, retryCount])
  const queryDebouncing = filters.query.trim() !== debouncedQuery
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to)
  const current = result.key === requestKey && !queryDebouncing && !invalidRange
  const loading = !invalidRange && (queryDebouncing || !current)
  const error = current ? result.error : ''
  const fieldErrors = current ? result.fieldErrors : {}
  const data = current && !error ? result.data : null
  const logs = data?.items || []
  const pageSize = data?.pageSize ?? fallbackPageSize
  const currentPage = data?.page ?? page

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(filters.query.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [filters.query])

  useEffect(() => {
    if (queryDebouncing || invalidRange) return undefined
    let active = true
    if (pending.current?.key !== requestKey)
      pending.current = { key: requestKey, promise: listAuditLogs(requestFilters) }
    pending.current.promise.then(
      (data) => {
        if (active) setResult({ key: requestKey, data, error: '', fieldErrors: {} })
      },
      (error) => {
        if (active)
          setResult({
            key: requestKey,
            data: null,
            error: error.message,
            fieldErrors: error.fieldErrors || {},
          })
      }
    )
    return () => {
      active = false
    }
  }, [requestFilters, requestKey, queryDebouncing, invalidRange])

  const changeFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
    if (key === 'query' && !value.trim()) setDebouncedQuery('')
  }

  const resetFilters = () => {
    setFilters(AUDIT_FILTERS)
    setDebouncedQuery('')
    setPage(1)
    setRetryCount((count) => count + 1)
  }

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <section
        aria-label="Bộ lọc nhật ký thao tác"
        className="rounded-xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid grid-cols-[minmax(220px,1.35fr)_repeat(3,minmax(0,1fr))] gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Field label="Tìm kiếm" error={fieldErrors.q}>
            {(props) => (
              <Input
                {...props}
                type="search"
                maxLength={100}
                value={filters.query}
                onChange={(event) => changeFilter('query', event.target.value)}
                placeholder="Tên hoặc nội dung thao tác…"
              />
            )}
          </Field>
          <Field label="Vai trò" error={fieldErrors.actorRole}>
            {(props) => (
              <Select
                {...props}
                value={filters.actorRole}
                onChange={(event) => changeFilter('actorRole', event.target.value)}
              >
                <option value="">Tất cả vai trò</option>
                {Object.entries(AUDIT_ROLES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Hành động" error={fieldErrors.action}>
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
          <Field label="Đối tượng" error={fieldErrors.entityType}>
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
            <span title="Xuất CSV sẽ được bổ sung sau.">
              <Button variant="primary" disabled>
                <Icon name="download" size={16} />
                Xuất CSV
              </Button>
            </span>
          </div>
        </DateRange>
      </section>

      {error && (
        <div
          role="alert"
          className="my-4 flex flex-wrap items-center gap-3 rounded-lg border border-danger-soft bg-danger-soft p-3 text-small text-danger-ink"
        >
          <p className="min-w-0 flex-1">
            Không tải được nhật ký thao tác. {error}{' '}
            {[fieldErrors.from, fieldErrors.to, fieldErrors.page].filter(Boolean).join(' ')}
          </p>
          <Button onClick={() => setRetryCount((count) => count + 1)}>Thử lại</Button>
        </div>
      )}
      {data && (
        <p className="mt-4 mb-2.5 text-small text-ink-muted" aria-live="polite">
          Hiển thị <strong className="px-1 text-lead text-primary">{data.total}</strong> bản ghi phù
          hợp
        </p>
      )}

      <div className="mt-3" aria-busy={loading}>
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
            loading ? (
              <p role="status" className="px-4 py-8 text-center text-small text-ink-muted">
                Đang tải nhật ký thao tác…
              </p>
            ) : (
              !error &&
              !invalidRange &&
              !logs.length && (
                <div className="pb-8 text-center">
                  <EmptyState
                    icon="history"
                    title="Không có bản ghi phù hợp"
                    description="Thay đổi bộ lọc để xem các thao tác khác."
                  />
                  <Button onClick={resetFilters}>Xóa bộ lọc</Button>
                </div>
              )
            )
          }
        >
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-surface-muted">
              <td className={cell}>
                <time dateTime={log.createdAt} className="text-caption text-ink-secondary">
                  {formatAuditDate(log.createdAt)}
                </time>
              </td>
              <td className={cell}>
                <span className="mb-1 block text-small font-semibold text-ink">
                  {auditActorName(log)}
                </span>
                {log.actorRole !== 'system' && (
                  <Badge tone={roleTones[log.actorRole] || 'neutral'}>
                    {AUDIT_ROLES[log.actorRole] || 'Không xác định'}
                  </Badge>
                )}
              </td>
              <td className={cell}>
                <span className="inline-flex items-center gap-1.5 text-small text-ink-secondary">
                  <Icon name={actionIcons[log.action] || 'history'} size={15} />
                  {AUDIT_ACTIONS[log.action] || log.action}
                </span>
              </td>
              <td className={cell}>
                <div className="flex flex-col gap-1 text-small text-ink-secondary">
                  <span className="font-semibold text-ink">{auditEntityLabel(log)}</span>
                  <span className="text-caption text-ink-muted">{auditObjectCode(log)}</span>
                  {log.detail?.entityName &&
                    log.detail.entityName !== auditObjectCode(log) &&
                    log.detail.entityName !== auditEntityLabel(log) && (
                      <span className="text-caption text-ink-secondary">
                        {log.detail.entityName}
                      </span>
                    )}
                </div>
              </td>
              <td className={cell}>
                <AuditDetails log={log} />
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {data && (
        <Pagination
          page={currentPage}
          total={data.total}
          pageSize={pageSize}
          onChange={setPage}
          noun="bản ghi"
        />
      )}
    </div>
  )
}
