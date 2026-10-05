import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../../components/moderator/Badge'
import Button from '../../components/moderator/Button'
import DataTable, { cell } from '../../components/moderator/DataTable'
import DetailList from '../../components/moderator/DetailList'
import Dialog from '../../components/moderator/Dialog'
import EmptyState from '../../components/moderator/EmptyState'
import Field, { Input, Select } from '../../components/moderator/Field'
import Icon from '../../components/common/Icon'
import IconButton from '../../components/moderator/IconButton'
import Notice from '../../components/moderator/Notice'
import Pagination from '../../components/moderator/Pagination'
import { cx, focusRing } from '../../components/moderator/classes'
import EscalationActionDialog from '../../components/moderator/EscalationActionDialog'
import {
  ESCALATION_ACTIONS,
  elapsedDays,
  escalationGroup,
  actionUnavailable,
  filterEscalations,
  applyEscalationAction,
} from '../../lib/escalations'

const EMPTY_FILTERS = { group: '', state: 'open', chat: '', query: '' }
const PAGE_SIZE = 6
const GROUP_LABELS = { stale: 'Match STALE >3 ngày', overdue: 'Giao dịch >30 ngày' }
const GROUP_TONES = { stale: 'warning', overdue: 'primary' }
// Thao tác "view" không phải hành động nguy hiểm nên dùng nút thường
const BUTTON_VARIANTS = { view: 'secondary', success: 'success', danger: 'danger' }

const STATS = [
  {
    group: 'stale',
    label: 'Match STALE',
    description: '>3 ngày chưa có tiến triển',
    icon: 'warning',
    tone: 'bg-warning-soft text-warning',
  },
  {
    group: 'overdue',
    label: 'Chờ xác nhận trao trả',
    description: '>30 ngày chưa đủ xác nhận',
    icon: 'calendar',
    tone: 'bg-primary-soft text-primary',
  },
  {
    group: 'resolved',
    label: 'Đã xử lý',
    description: 'Đã trao trả hoặc không chính xác',
    icon: 'check',
    tone: 'bg-success-soft text-success',
  },
]

const linkButton =
  'block cursor-pointer text-left text-small font-semibold leading-relaxed text-ink hover:text-primary'
const hint = 'mt-3 text-caption leading-relaxed text-ink-muted'
const heading = 'mt-3.5 mb-2 text-small font-semibold'

const formatDate = (date) => (date ? new Date(date).toLocaleString('vi-VN') : 'Chưa có')

function ticketStatus(ticket) {
  if (ticket.resolution === 'returned') return { tone: 'success', label: 'Đã trao trả' }
  if (ticket.resolution === 'incorrect') return { tone: 'danger', label: 'Không chính xác' }
  if (ticket.state === 'reminded') return { tone: 'primary', label: 'Đã nhắc' }
  return { tone: 'warning', label: 'Chờ xử lý' }
}

function TicketStatus({ ticket }) {
  const { tone, label } = ticketStatus(ticket)
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Badge tone={tone}>{label}</Badge>
      {ticket.verified && (
        <span className="inline-flex items-center gap-1 text-caption text-success">
          <Icon name="shield" size={13} />
          Đã xác minh
        </span>
      )}
      {(ticket.lost.hidden || ticket.found.hidden) && (
        <span className="text-caption text-danger-ink">Có bài đã ẩn</span>
      )}
    </div>
  )
}

function postStatusLabel(status) {
  if (status === 'returned') return 'Đã trao trả'
  if (status === 'contacted') return 'Đã liên hệ'
  return 'Đang tìm'
}

function Party({ ticket, side, detailed = false }) {
  const party = ticket[side]
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5 py-2 [overflow-wrap:anywhere] first:pt-0 last:pb-0">
      <span
        className={cx(
          'text-caption font-bold tracking-wide',
          side === 'lost' ? 'text-danger-ink' : 'text-primary'
        )}
      >
        {side === 'lost' ? 'BÊN MẤT' : 'BÊN NHẶT'}
      </span>
      <strong className="text-small font-semibold text-ink">{party.name}</strong>
      <span className="text-caption text-ink-muted">{party.email}</span>
      {detailed && (
        <>
          <p className="my-2 text-small leading-relaxed text-ink-secondary">
            <strong>{party.postId}</strong> · {party.title}
          </p>
          <span className="text-caption text-ink-muted">
            Trạng thái bài: {postStatusLabel(party.postStatus)}
            {party.hidden ? ' · Đã ẩn' : ''}
          </span>
        </>
      )}
      <small className={cx('text-caption', party.confirmed ? 'text-success' : 'text-ink-subtle')}>
        {party.confirmed ? 'Đã xác nhận trao trả' : 'Chưa xác nhận trao trả'}
      </small>
    </div>
  )
}

function TicketActions({ ticket, onAction, now }) {
  return Object.entries(ESCALATION_ACTIONS).map(([action, settings]) => {
    const disabledReason = actionUnavailable(ticket, action, now)
    return (
      <Button
        key={action}
        variant={BUTTON_VARIANTS[settings.tone]}
        disabled={Boolean(disabledReason)}
        title={disabledReason || settings.label}
        aria-label={`${settings.label} · hồ sơ #${ticket.id}`}
        onClick={() => onAction(action)}
      >
        <Icon name={settings.icon} />
        {settings.label}
      </Button>
    )
  })
}

function Summary({ count, noun }) {
  return (
    <p className="mt-4 mb-2.5 text-small text-ink-muted">
      Số lượng: <strong className="px-1 text-lead text-primary">{count}</strong> {noun}
    </p>
  )
}

function AuditRows({ logs, onView }) {
  return (
    <DataTable
      caption="Nhật ký thao tác Escalation"
      minWidth="min-w-[760px]"
      columns={[
        ['Thời gian', 'w-[18%]'],
        ['Người thực hiện', 'w-[16%]'],
        ['Cặp ghép', 'w-[18%]'],
        ['Thao tác', 'w-[18%]'],
        ['Lý do / căn cứ', 'w-[30%]'],
      ]}
      empty={
        !logs.length && (
          <EmptyState
            icon="history"
            title="Chưa có thao tác được ghi nhận"
            description="Nhật ký sẽ xuất hiện sau khi moderator xác nhận một thao tác."
          />
        )
      }
    >
      {logs.map((log) => (
        <tr key={log.id} className="hover:bg-surface-muted">
          <td className={cell}>{formatDate(log.createdAt)}</td>
          <td className={cell}>{log.actor}</td>
          <td className={cell}>
            <button
              type="button"
              className={cx(linkButton, focusRing)}
              onClick={() => onView(log.id)}
            >
              #{log.entityId}
            </button>
          </td>
          <td className={cell}>
            {ESCALATION_ACTIONS[log.action].label}
            {log.action === 'remind' && (
              <small className="mt-1 block text-caption text-ink-subtle">Email nhắc</small>
            )}
          </td>
          <td className={cell}>
            <button
              type="button"
              title="Xem chi tiết nhật ký"
              className={cx(
                'block w-full cursor-pointer text-left text-small leading-relaxed text-ink-secondary hover:text-primary',
                focusRing
              )}
              onClick={() => onView(log.id)}
            >
              {log.detail.reason}
              <span className="mt-1 flex items-center gap-1 text-caption text-primary">
                Xem chi tiết <Icon name="next" size={12} />
              </span>
            </button>
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

export default function Escalations() {
  const { escalationState, setEscalationState } = useOutletContext()
  const [tab, setTab] = useState('queue')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [logPage, setLogPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [now] = useState(() => Date.now())
  const { tickets, logs } = escalationState
  const filtered = filterEscalations(tickets, filters, now)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const currentLogPage = Math.min(logPage, Math.max(1, Math.ceil(logs.length / PAGE_SIZE)))
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selected = modal?.ticketId ? tickets.find((ticket) => ticket.id === modal.ticketId) : null
  const selectedLog = modal?.logId ? logs.find((log) => log.id === modal.logId) : null
  const pending = tickets.filter((ticket) => !ticket.resolution)
  const closeModal = () => setModal(null)
  const openDetail = (ticketId) => setModal({ kind: 'detail', ticketId })
  const openAction = (ticketId, action) => setModal({ kind: 'action', ticketId, action })
  const setFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
  }
  const statCount = (group) =>
    group === 'resolved'
      ? tickets.filter((ticket) => ticket.resolution).length
      : pending.filter((ticket) => escalationGroup(ticket, now) === group).length
  const handleAction = (payload) => {
    const next = applyEscalationAction(escalationState, {
      ...payload,
      actor: 'Moderator',
      now: Date.now(),
    })
    setEscalationState(next)
    setModal(null)
    setNotice(
      payload.action === 'remind'
        ? `Đã ghi nhận email nhắc cho hồ sơ #${payload.id}.`
        : `Đã ghi nhận “${ESCALATION_ACTIONS[payload.action].label}” cho hồ sơ #${payload.id} và lưu nhật ký.`
    )
  }
  const tabClass = (value) =>
    cx(
      '-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-small font-semibold transition-colors',
      tab === value
        ? 'border-primary text-primary'
        : 'border-transparent text-ink-muted hover:text-primary',
      focusRing
    )

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <div className="mb-5 grid grid-cols-3 gap-4 max-lg:grid-cols-1 max-sm:gap-2.5">
        {STATS.map((stat) => (
          <button
            key={stat.group}
            type="button"
            className={cx(
              'flex cursor-pointer items-start gap-3.5 rounded-xl border border-line bg-surface p-5 text-left shadow-card transition-colors hover:border-primary/40 max-xl:gap-2.5 max-xl:p-4 max-sm:items-center',
              focusRing
            )}
            onClick={() => {
              setTab('queue')
              setPage(1)
              setFilters({
                ...EMPTY_FILTERS,
                group: stat.group === 'resolved' ? '' : stat.group,
                state: stat.group === 'resolved' ? 'resolved' : 'open',
              })
            }}
          >
            <span className={cx('flex shrink-0 rounded-lg p-2.5 max-xl:p-2', stat.tone)}>
              <Icon name={stat.icon} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-small font-semibold text-ink-secondary">
                {stat.label}
              </span>
              <strong className="my-1.5 block text-display font-bold text-ink">
                {statCount(stat.group)}
              </strong>
              <small className="block text-caption text-ink-muted">{stat.description}</small>
            </span>
          </button>
        ))}
      </div>

      <div
        role="group"
        aria-label="Nội dung Escalation"
        className="mb-5 flex flex-wrap gap-1.5 border-b border-line"
      >
        <button
          type="button"
          aria-pressed={tab === 'queue'}
          className={tabClass('queue')}
          onClick={() => setTab('queue')}
        >
          <Icon name="list" />
          Hàng đợi xử lý <Badge>{pending.length}</Badge>
        </button>
        <button
          type="button"
          aria-pressed={tab === 'logs'}
          className={tabClass('logs')}
          onClick={() => setTab('logs')}
        >
          <Icon name="history" />
          Nhật ký thao tác <Badge>{logs.length}</Badge>
        </button>
      </div>

      {notice && <Notice>{notice}</Notice>}

      {tab === 'queue' ? (
        <>
          <section
            aria-label="Bộ lọc Escalation"
            className="rounded-xl border border-line bg-surface p-4 shadow-card"
          >
            <div className="grid grid-cols-[minmax(205px,1.5fr)_repeat(3,minmax(0,1fr))_auto] items-end gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <Field label="Tìm kiếm">
                {(a) => (
                  <Input
                    {...a}
                    type="search"
                    value={filters.query}
                    placeholder="Mã match, đồ vật, tên hai bên…"
                    onChange={(e) => setFilter('query', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Nhóm hồ sơ">
                {(a) => (
                  <Select
                    {...a}
                    value={filters.group}
                    onChange={(e) => setFilter('group', e.target.value)}
                  >
                    <option value="">Tất cả nhóm</option>
                    <option value="stale">{GROUP_LABELS.stale}</option>
                    <option value="overdue">{GROUP_LABELS.overdue}</option>
                  </Select>
                )}
              </Field>
              <Field label="Trạng thái chat">
                {(a) => (
                  <Select
                    {...a}
                    value={filters.chat}
                    onChange={(e) => setFilter('chat', e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    <option value="opened">Đã mở chat</option>
                    <option value="unopened">Chưa mở chat</option>
                  </Select>
                )}
              </Field>
              <Field label="Xử lý">
                {(a) => (
                  <Select
                    {...a}
                    value={filters.state}
                    onChange={(e) => setFilter('state', e.target.value)}
                  >
                    <option value="open">Chưa xử lý xong</option>
                    <option value="resolved">Đã xử lý</option>
                    <option value="">Tất cả trạng thái</option>
                  </Select>
                )}
              </Field>
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
            </div>
          </section>

          <Summary count={filtered.length} noun="hồ sơ" />

          <DataTable
            caption="Match treo và giao dịch chưa xác nhận"
            minWidth="min-w-[960px]"
            columns={[
              ['Cặp ghép', 'w-[21%]'],
              ['Thông tin hai bên', 'w-[23%]'],
              ['Chat & Hẹn gặp', 'w-[16%]'],
              ['Thời gian chờ', 'w-[11%]'],
              ['Trạng thái', 'w-[13%]'],
              ['Thao tác', 'w-[16%]'],
            ]}
            empty={
              !visible.length && (
                <EmptyState
                  title="Không có hồ sơ phù hợp"
                  description="Thay đổi bộ lọc hoặc xem mục Đã xử lý."
                />
              )
            }
          >
            {visible.map((ticket) => {
              const group = ticket.queueGroup || escalationGroup(ticket, now)
              return (
                <tr key={ticket.id} className="hover:bg-surface-muted">
                  <td className={cell}>
                    <button
                      type="button"
                      className={cx(
                        'mb-1.5 block cursor-pointer text-caption font-semibold text-primary',
                        focusRing
                      )}
                      onClick={() => openDetail(ticket.id)}
                    >
                      #{ticket.id}
                    </button>
                    <button
                      type="button"
                      className={cx(linkButton, focusRing)}
                      onClick={() => openDetail(ticket.id)}
                    >
                      {ticket.item}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={GROUP_TONES[group]}>{GROUP_LABELS[group]}</Badge>
                      <Badge>{ticket.category}</Badge>
                    </div>
                  </td>
                  <td className={cell}>
                    <div className="divide-y divide-line-subtle">
                      <Party ticket={ticket} side="lost" />
                      <Party ticket={ticket} side="found" />
                    </div>
                  </td>
                  <td className={cell}>
                    <span
                      className={cx(
                        'inline-flex items-center gap-1.5 text-caption',
                        ticket.chatOpenedAt ? 'text-primary' : 'text-ink-subtle'
                      )}
                    >
                      <Icon name="chat" size={14} />
                      {ticket.chatOpenedAt ? 'Đã mở chat' : 'Chưa mở chat'}
                    </span>
                    <p className="mt-2 text-caption leading-relaxed text-ink-muted">
                      {ticket.meetingPoint
                        ? `Đã hẹn: ${ticket.meetingPoint}`
                        : 'Chưa ghi nhận hẹn gặp'}
                    </p>
                  </td>
                  <td className={cell}>
                    <strong className="block whitespace-nowrap text-small text-ink">
                      {elapsedDays(
                        group === 'overdue' ? ticket.transactionStartedAt : ticket.lastActivityAt,
                        now
                      )}{' '}
                      ngày
                    </strong>
                    <small className="mt-1 block text-caption text-ink-subtle">
                      {group === 'overdue' ? 'Từ khi giao dịch mở' : 'Từ hoạt động cuối'}
                    </small>
                    {ticket.reminderCount > 0 && (
                      <small className="mt-1 block text-caption text-ink-subtle">
                        Đã nhắc {ticket.reminderCount} lần
                      </small>
                    )}
                  </td>
                  <td className={cell}>
                    <TicketStatus ticket={ticket} />
                  </td>
                  <td className={cell}>
                    <div className="mx-auto grid max-w-[120px] grid-cols-3 place-items-center gap-1.5">
                      <IconButton
                        icon="eye"
                        tone="view"
                        label={`Xem hồ sơ #${ticket.id}`}
                        onClick={() => openDetail(ticket.id)}
                      />
                      {Object.entries(ESCALATION_ACTIONS).map(([action, settings]) => {
                        const disabledReason = actionUnavailable(ticket, action, now)
                        return (
                          <IconButton
                            key={action}
                            icon={settings.icon}
                            tone={settings.tone}
                            label={`${settings.label} · hồ sơ #${ticket.id}`}
                            title={disabledReason || settings.label}
                            disabled={Boolean(disabledReason)}
                            onClick={() => openAction(ticket.id, action)}
                          />
                        )
                      })}
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
            noun="hồ sơ"
          />
        </>
      ) : (
        <>
          <Summary count={logs.length} noun="thao tác" />
          <AuditRows
            logs={logs.slice((currentLogPage - 1) * PAGE_SIZE, currentLogPage * PAGE_SIZE)}
            onView={(logId) => setModal({ kind: 'log', logId })}
          />
          <Pagination
            page={currentLogPage}
            total={logs.length}
            pageSize={PAGE_SIZE}
            onChange={setLogPage}
            noun="thao tác"
          />
        </>
      )}

      {selected && modal.kind === 'detail' && (
        <Dialog
          key="detail"
          size="lg"
          title={`Hồ sơ #${selected.id}`}
          onClose={closeModal}
          footer={
            <>
              <Button onClick={closeModal}>Đóng</Button>
              <TicketActions
                ticket={selected}
                now={now}
                onAction={(action) => openAction(selected.id, action)}
              />
            </>
          }
        >
          <h3 className="mb-3 text-title font-bold text-primary [overflow-wrap:anywhere]">
            {selected.item}
          </h3>
          <TicketStatus ticket={selected} />
          <div className="my-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {['lost', 'found'].map((side) => (
              <div key={side} className="rounded-lg border border-line p-3.5">
                <Party detailed ticket={selected} side={side} />
              </div>
            ))}
          </div>
          <DetailList
            rows={[
              ['Nhóm hồ sơ', GROUP_LABELS[selected.queueGroup || escalationGroup(selected, now)]],
              ['Hoạt động cuối', formatDate(selected.lastActivityAt)],
              ['Bắt đầu giao dịch', formatDate(selected.transactionStartedAt)],
              [
                'Mở chat',
                selected.chatOpenedAt ? formatDate(selected.chatOpenedAt) : 'Chưa mở chat',
              ],
              ['Hẹn gặp', selected.meetingPoint || 'Chưa ghi nhận'],
              [
                'Email nhắc',
                `${selected.reminderCount} lần${selected.lastRemindedAt ? ` · Gần nhất ${formatDate(selected.lastRemindedAt)}` : ''}`,
              ],
            ]}
          />
          {actionUnavailable(selected, 'returned', now) && (
            <p className={hint}>{actionUnavailable(selected, 'returned', now)}</p>
          )}
          <h4 className={heading}>Nhật ký hồ sơ</h4>
          <div className="flex flex-col gap-3">
            {logs
              .filter((log) => log.entityId === selected.id)
              .map((log) => (
                <button
                  key={log.id}
                  type="button"
                  className={cx(
                    'block w-full cursor-pointer rounded-md border border-l-3 border-line border-l-primary/40 bg-surface-muted p-3 text-left hover:bg-primary-subtle',
                    focusRing
                  )}
                  onClick={() => setModal({ kind: 'log', logId: log.id })}
                >
                  <strong className="block text-small font-semibold text-primary">
                    {ESCALATION_ACTIONS[log.action].label}
                  </strong>
                  <span className="my-1 block text-caption text-ink-muted">
                    {log.actor} · {formatDate(log.createdAt)}
                  </span>
                  <p className="text-small leading-relaxed text-ink-secondary [overflow-wrap:anywhere]">
                    {log.detail.reason}
                  </p>
                </button>
              ))}
            {!logs.some((log) => log.entityId === selected.id) && (
              <p className="text-caption text-ink-muted">Chưa có thao tác.</p>
            )}
          </div>
        </Dialog>
      )}

      {selected && modal.kind === 'action' && (
        <EscalationActionDialog
          key={`${selected.id}-${modal.action}`}
          ticket={selected}
          action={modal.action}
          onClose={closeModal}
          onSubmit={handleAction}
        />
      )}

      {selectedLog && (
        <Dialog
          key="log"
          title={`Nhật ký · Hồ sơ #${selectedLog.entityId}`}
          onClose={closeModal}
          footer={<Button onClick={closeModal}>Đóng</Button>}
        >
          <DetailList
            rows={[
              ['Thao tác', ESCALATION_ACTIONS[selectedLog.action].label],
              ['Người thực hiện', selectedLog.actor],
              ['Thời gian', formatDate(selectedLog.createdAt)],
              ['Hồ sơ', `#${selectedLog.entityId}`],
              ['Trước thao tác', <TicketStatus key="before" ticket={selectedLog.before} />],
              ['Sau thao tác', <TicketStatus key="after" ticket={selectedLog.after} />],
            ]}
          />
          <h4 className={heading}>Lý do / căn cứ</h4>
          <p className="rounded-lg border border-primary-soft bg-primary-subtle px-3.5 py-3 text-small leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
            {selectedLog.detail.reason}
          </p>
          {selectedLog.detail.offlineConfirmed && (
            <p className={hint}>Moderator đã kiểm tra việc trao trả offline (Ca A).</p>
          )}
          {selectedLog.action === 'hide' && (
            <p className={hint}>
              Bài đã ẩn:{' '}
              {selectedLog.detail.targets
                .map(
                  (side) =>
                    `${selectedLog.before[side].postId} (${side === 'lost' ? 'bên mất' : 'bên nhặt'})`
                )
                .join(', ')}
            </p>
          )}
          {selectedLog.action === 'remind' && (
            <>
              <h4 className={heading}>Email nhắc</h4>
              <p className="mb-2 text-caption text-ink-muted">
                Người nhận: {selectedLog.detail.recipients.join(', ')}
              </p>
              <p className="rounded-lg border border-primary-soft bg-primary-subtle px-3.5 py-3 text-small leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                {selectedLog.detail.message}
              </p>
            </>
          )}
        </Dialog>
      )}
    </div>
  )
}
