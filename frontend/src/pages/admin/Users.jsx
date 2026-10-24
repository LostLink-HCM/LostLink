import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import Button from '../../components/backoffice/Button'
import DataTable from '../../components/backoffice/DataTable'
import Dialog from '../../components/backoffice/Dialog'
import Pagination from '../../components/backoffice/Pagination'
import { cx, focusRing } from '../../components/backoffice/classes'
import { downloadCsv } from '../../lib/csv'
import {
  applyUserAction,
  filterAdminUsers,
  isCurrentUser,
  USER_ACTIONS,
  USER_FILTERS,
  USER_ROLES,
  USER_STATUSES,
  usersToRows,
  userActionUnavailable,
} from '../../lib/adminUsers'
import { createAdminUsers } from '../../data/adminUsers'
import usePaginatedFilter from '../../hooks/usePaginatedFilter'

const PAGE_SIZE = 8
const number = (value) => new Intl.NumberFormat('vi-VN').format(value)
const date = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa có')
const dateTime = (value) =>
  new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

const avatarTones = {
  blue: 'bg-[#e7effa] text-[#3e70aa]',
  purple: 'bg-[#eee8f8] text-[#7c5bae]',
  teal: 'bg-[#e0f2ec] text-[#287f6a]',
  amber: 'bg-[#faf0dc] text-[#9d752b]',
}

const statusTones = {
  active: 'bg-[#eff9f4] text-[#438b76]',
  locked: 'bg-[#fff3f6] text-[#c27687]',
  restricted: 'bg-[#fff8e8] text-[#b28b4c]',
}

const roleTones = {
  user: 'text-[#405b78]',
  moderator: 'text-[#285e9c]',
  admin: 'text-[#7750a6]',
}

const actionTones = {
  primary:
    'border-primary-soft bg-primary-subtle text-primary hover:border-primary hover:bg-primary-soft',
  danger: 'border-[#ebcad1] bg-[#fff8fa] text-[#b4596b] hover:border-[#d69baa] hover:bg-[#fceaf0]',
  success: 'border-[#b7d9cb] bg-[#f4fbf8] text-[#2b866d] hover:bg-[#e4f5ed]',
}

const completedActions = {
  lock: 'Đã khóa tài khoản của',
  unlock: 'Đã mở khóa tài khoản của',
  grant: 'Đã cấp quyền Moderator cho',
  revoke: 'Đã thu hồi quyền Moderator của',
}

function Avatar({ account, large = false }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-bold',
        large
          ? 'size-[66px] text-[22px] max-sm:size-[54px] max-sm:text-lg'
          : 'size-[42px] text-[13px]',
        avatarTones[account.color]
      )}
      aria-hidden="true"
    >
      {account.initials}
    </span>
  )
}

function Role({ role }) {
  return (
    <span className={cx('whitespace-nowrap text-small font-semibold', roleTones[role])}>
      {USER_ROLES[role]}
    </span>
  )
}

function Status({ status }) {
  return (
    <span
      className={cx(
        'inline-flex whitespace-nowrap rounded-md px-2.5 py-1.5 text-small font-semibold leading-tight',
        statusTones[status]
      )}
    >
      {USER_STATUSES[status]}
    </span>
  )
}

function ActionButton({ action, account, actor, expanded = false, onAction }) {
  const settings = USER_ACTIONS[action]
  const disabledReason = userActionUnavailable(account, actor, action)
  const shortLabels = { lock: 'Khóa', unlock: 'Mở khóa', grant: 'Cấp Mod', revoke: 'Thu hồi' }

  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-8 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1.5 text-caption font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        actionTones[settings.tone],
        focusRing
      )}
      disabled={Boolean(disabledReason)}
      title={disabledReason || settings.label}
      aria-label={`${settings.label} · ${account.username}`}
      onClick={() => onAction(action)}
    >
      <Icon name={settings.icon} size={15} />
      {expanded ? settings.label : shortLabels[action]}
    </button>
  )
}

function UserActions({ account, actor, onAction, expanded = false }) {
  const actions = [
    account.status === 'locked' ? 'unlock' : 'lock',
    account.role === 'moderator' ? 'revoke' : 'grant',
  ]

  return (
    <>
      {actions.map((action) => (
        <ActionButton
          key={action}
          action={action}
          account={account}
          actor={actor}
          expanded={expanded}
          onAction={onAction}
        />
      ))}
    </>
  )
}

function UserProfile({ account, actor, logs, onClose, onAction }) {
  const protectedAccount = isCurrentUser(account, actor) || account.role === 'admin'

  return (
    <Dialog
      title="Hồ sơ người dùng"
      onClose={onClose}
      footer={<Button onClick={onClose}>Đóng hồ sơ</Button>}
    >
      <div className="flex items-center gap-4">
        <Avatar account={account} large />
        <div className="min-w-0">
          <h3 className="text-title font-bold text-[#284663]">
            {account.name}
            {isCurrentUser(account, actor) && (
              <span className="ml-2 inline-flex rounded bg-[#e4eefc] px-1.5 py-0.5 align-middle text-[10px] font-medium text-[#396dad]">
                Bạn
              </span>
            )}
          </h3>
          <p className="mt-1 text-small text-ink-muted">@{account.username}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Role role={account.role} />
            <Status status={account.status} />
          </div>
        </div>
      </div>

      <section className="my-5 rounded-xl border border-[#ecd8a8] bg-[#fffbf0] px-5 py-4">
        <div className="flex items-center gap-2.5 text-[#b08b32]">
          <Icon name="star" size={23} />
          <strong className="text-[28px] leading-tight text-[#88661d]">
            {number(account.reputationScore)}
          </strong>
          <span className="text-small">điểm uy tín</span>
        </div>
        <p className="mt-1.5 text-caption leading-relaxed text-[#9a8862]">
          Uy tín cộng đồng từ hoạt động trao trả và đánh giá.
        </p>
      </section>

      <h4 className="mb-2 mt-5 text-small font-bold">Thông tin tài khoản</h4>
      <dl className="mb-3">
        {[
          ['Mã tài khoản', account.id],
          ['Email', account.email],
          ['Ngày tham gia', date(account.createdAt)],
          ['Cập nhật gần nhất', dateTime(account.updatedAt)],
          [
            'Xác thực email',
            account.emailVerifiedAt
              ? `Đã xác thực · ${date(account.emailVerifiedAt)}`
              : 'Chưa xác thực',
          ],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cx(
              'grid grid-cols-[145px_minmax(0,1fr)] gap-3 py-2.5 text-small max-sm:grid-cols-[110px_minmax(0,1fr)] max-sm:text-caption',
              index < 4 && 'border-b border-line-subtle'
            )}
          >
            <dt className="text-ink-subtle">{label}</dt>
            <dd
              className={cx(
                'm-0 [overflow-wrap:anywhere]',
                label === 'Xác thực email' && account.emailVerifiedAt && 'text-success'
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {account.statusReason && (
        <div
          className={cx(
            'mt-4 flex items-start gap-2.5 rounded-lg px-3 py-3 text-caption leading-relaxed',
            account.status === 'locked'
              ? 'bg-[#fcf0f3] text-[#a85568]'
              : 'bg-[#fcf3de] text-[#947328]'
          )}
        >
          <Icon name="info" size={17} className="mt-0.5 shrink-0" />
          <div>
            <strong>
              {account.status === 'locked' ? 'Lý do khóa tài khoản' : 'Lý do hạn chế'}
            </strong>
            <p className="mt-1.5">{account.statusReason}</p>
          </div>
        </div>
      )}

      <h4 className="mb-2 mt-5 text-small font-bold">Huy hiệu</h4>
      <div className="flex flex-wrap gap-1.5">
        {account.badges.length ? (
          account.badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1 rounded-md border border-[#d1e6d9] bg-[#f1faf5] px-2 py-1 text-caption text-[#4a8c69]"
            >
              <Icon name="star" size={13} />
              {badge}
            </span>
          ))
        ) : (
          <p className="text-small text-ink-muted">Chưa có huy hiệu</p>
        )}
      </div>

      <h4 className="mb-2 mt-5 text-small font-bold">Quản lý tài khoản</h4>
      <div className="flex flex-wrap gap-2.5">
        <UserActions account={account} actor={actor} onAction={onAction} expanded />
      </div>

      {protectedAccount && (
        <p className="mt-3.5 flex items-start gap-1.5 text-caption leading-relaxed text-ink-subtle">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
          Tài khoản quản trị được bảo vệ khỏi thao tác khóa và thay đổi quyền tại đây.
        </p>
      )}

      {logs.length > 0 && (
        <>
          <h4 className="mb-2 mt-5 text-small font-bold">Thao tác gần đây</h4>
          <ol className="m-0 list-none p-0">
            {logs.slice(0, 5).map((log) => (
              <li
                key={log.id}
                className="mt-2 rounded-r-md border-l-3 border-[#afc5e2] bg-[#f5f8fc] px-3.5 py-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-caption font-semibold text-[#4a6a8e]">
                    {USER_ACTIONS[log.action].label}
                  </strong>
                  <time className="text-[11px] text-ink-subtle" dateTime={log.createdAt}>
                    {dateTime(log.createdAt)}
                  </time>
                </div>
                <small className="mt-1 block text-[11px] text-ink-subtle">
                  Thực hiện bởi @{log.actor}
                </small>
                {log.reason && (
                  <p className="mt-2 text-caption leading-relaxed text-ink-muted">{log.reason}</p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  )
}

function UserActionDialog({ account, actor, action, onConfirm, onClose, error }) {
  const [reason, setReason] = useState('')
  const [attempted, setAttempted] = useState(false)
  const settings = USER_ACTIONS[action]
  const unavailable = userActionUnavailable(account, actor, action)
  const invalidReason = attempted && action === 'lock' && reason.trim().length < 5

  const submit = (event) => {
    event.preventDefault()
    setAttempted(true)
    if (action === 'lock' && reason.trim().length < 5) return
    onConfirm(reason)
  }

  return (
    <Dialog
      title={settings.label}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <button
            type="submit"
            form="admin-user-action-form"
            className={cx(
              'inline-flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-small font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45',
              actionTones[settings.tone],
              focusRing
            )}
            disabled={Boolean(unavailable)}
          >
            <Icon name={settings.icon} size={16} />
            {settings.label}
          </button>
        </>
      }
    >
      <form
        id="admin-user-action-form"
        className="flex flex-col gap-3"
        onSubmit={submit}
        noValidate
      >
        <div className="flex items-center gap-3 rounded-lg border border-[#d6e2ef] bg-[#f8fafd] p-3.5">
          <Avatar account={account} />
          <div className="min-w-0">
            <strong className="block text-lead text-[#365676]">{account.name}</strong>
            <span className="mt-1 block break-words text-caption text-[#768ba5]">
              @{account.username} · {account.email}
            </span>
          </div>
        </div>
        <p className="my-2 text-small leading-relaxed text-ink-muted">{settings.description}</p>
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-[#f5f8fc] p-3 text-small">
          <span className="mr-auto text-caption text-ink-subtle">Hiện tại</span>
          {['lock', 'unlock'].includes(action) ? (
            <>
              <Status status={account.status} />
              <Icon name="next" size={15} className="text-ink-subtle" />
              <Status
                status={action === 'lock' ? 'locked' : account.beforeLock?.status || 'active'}
              />
            </>
          ) : (
            <>
              <Role role={account.role} />
              <Icon name="next" size={15} className="text-ink-subtle" />
              <Role role={action === 'grant' ? 'moderator' : 'user'} />
            </>
          )}
        </div>
        <label htmlFor="admin-user-reason" className="text-small font-semibold text-ink-secondary">
          Lý do{' '}
          {action === 'lock' ? (
            <span className="text-danger-ink">*</span>
          ) : (
            <small className="font-normal text-ink-subtle">(không bắt buộc)</small>
          )}
        </label>
        <textarea
          id="admin-user-reason"
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-required={action === 'lock'}
          aria-invalid={invalidReason}
          className={cx(
            'w-full resize-y rounded-lg border bg-surface px-3 py-2 text-small leading-relaxed text-ink outline-none placeholder:text-ink-subtle focus:border-focus focus:ring-2 focus:ring-focus/20',
            invalidReason ? 'border-danger' : 'border-line-strong'
          )}
          placeholder={
            action === 'lock'
              ? 'Nhập căn cứ hoặc lý do khóa tài khoản…'
              : 'Ghi chú cho thao tác này…'
          }
        />
        <span className="text-right text-[11px] text-ink-subtle">{reason.length}/500</span>
        {invalidReason && (
          <p className="text-caption text-danger-ink" role="alert">
            Vui lòng nhập lý do khóa có ít nhất 5 ký tự.
          </p>
        )}
        {(error || unavailable) && (
          <p className="text-caption text-danger-ink" role="alert">
            {error || unavailable}
          </p>
        )}
      </form>
    </Dialog>
  )
}

export default function Users() {
  const { user } = useAuth()
  const actor = user || {
    id: 'guest-admin',
    username: 'admin',
    email: 'admin@lostlink.vn',
    role: 'admin',
  }
  const [userState, setUserState] = useState(() => createAdminUsers())
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const { users, logs } = userState
  const {
    filters,
    setFilter,
    resetFilters,
    setPage,
    currentPage,
    filteredItems: filtered,
    visibleItems: visible,
  } = usePaginatedFilter({
    items: users,
    initialFilters: USER_FILTERS,
    filterFn: filterAdminUsers,
    pageSize: PAGE_SIZE,
  })
  const selected = modal ? users.find((account) => account.id === modal.id) : null
  const counts = {
    all: users.length,
    active: users.filter((account) => account.status === 'active').length,
    moderator: users.filter((account) => account.role === 'moderator').length,
    locked: users.filter((account) => account.status === 'locked').length,
  }

  const changeFilter = (key, value) => {
    setFilter(key, value)
    setNotice('')
  }

  const resetFiltersAndNotice = () => {
    resetFilters()
    setNotice('')
  }

  const exportUsers = () => {
    if (!filtered.length) return
    downloadCsv('LostLink_Danh_sach_nguoi_dung.csv', usersToRows(filtered))
    setNotice(`Đã xuất ${number(filtered.length)} tài khoản ra CSV.`)
  }

  const openProfile = (id) => {
    setActionError('')
    setModal({ kind: 'profile', id })
  }

  const openAction = (id, action, fromProfile = false) => {
    setActionError('')
    setModal({ kind: 'action', id, action, fromProfile })
  }

  const closeAction = () => {
    setActionError('')
    setModal(modal?.fromProfile ? { kind: 'profile', id: modal.id } : null)
  }

  const confirmAction = (reason) => {
    const result = applyUserAction(userState, {
      id: selected.id,
      action: modal.action,
      reason,
      actor,
    })
    if (result.error) {
      setActionError(result.error)
      return
    }
    setUserState(result.state)
    setNotice(`${completedActions[modal.action]} @${selected.username}.`)
    closeAction()
  }

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <section
        className="mb-6 grid grid-cols-4 gap-[18px] max-xl:grid-cols-2 max-xl:gap-3.5 max-sm:gap-2.5"
        aria-label="Tổng quan người dùng"
      >
        {[
          [
            'all',
            'Tổng tài khoản',
            'users',
            'border-[#2e6db4] from-white to-[#e8f0fb] text-[#2e6db4]',
          ],
          [
            'active',
            'Đang hoạt động',
            'check',
            'border-[#238d78] from-white to-[#e9f6f1] text-[#238d78]',
          ],
          [
            'moderator',
            'Moderator',
            'shield',
            'border-[#7b60b1] from-white to-[#f0ebfa] text-[#7b60b1]',
          ],
          [
            'locked',
            'Đang bị khóa',
            'lock',
            'border-[#bc5870] from-white to-[#fbeef2] text-[#bc5870]',
          ],
        ].map(([key, label, icon, tone]) => (
          <article
            key={key}
            className={cx(
              'flex items-center gap-[17px] rounded-[10px] border border-t-3 bg-linear-to-br via-white px-[22px] py-[22px] shadow-[0_3px_10px_#16233a08] max-sm:gap-2.5 max-sm:px-3 max-sm:py-3.5',
              tone
            )}
          >
            <span className="inline-flex rounded-[10px] bg-white/70 p-3 max-sm:p-2">
              <Icon name={icon} size={23} className="max-sm:size-[19px]" />
            </span>
            <div>
              <span className="block text-small font-medium text-[#62758d] max-sm:text-caption">
                {label}
              </span>
              <strong className="mt-1.5 block text-[30px] font-bold leading-tight text-[#233d59] max-sm:text-[25px]">
                {number(counts[key])}
              </strong>
            </div>
          </article>
        ))}
      </section>

      <section
        className="grid grid-cols-[minmax(240px,1.7fr)_minmax(140px,1fr)_minmax(150px,1fr)_minmax(165px,1fr)_auto] items-end gap-4 rounded-xl border border-[#b4c6db] bg-surface p-4 shadow-card max-xl:grid-cols-3 max-sm:grid-cols-2 max-sm:gap-x-2.5 max-sm:gap-y-3.5"
        aria-label="Bộ lọc người dùng"
      >
        <label className="flex min-w-0 flex-col gap-2 text-small font-semibold text-ink-secondary max-xl:col-span-2 max-sm:col-span-2">
          Tìm tài khoản
          <span className="relative">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3 top-2.5 text-[#7a8fa8]"
            />
            <input
              type="search"
              value={filters.query}
              onChange={(event) => changeFilter('query', event.target.value)}
              placeholder="Tên, email hoặc mã tài khoản…"
              className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-[38px] pr-3 text-small font-normal text-ink outline-none placeholder:text-ink-subtle focus:border-focus focus:ring-2 focus:ring-focus/20"
            />
          </span>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-small font-semibold text-ink-secondary">
          Vai trò
          <select
            value={filters.role}
            onChange={(event) => changeFilter('role', event.target.value)}
            className="h-9 w-full cursor-pointer rounded-lg border border-line-strong bg-surface px-3 text-small font-normal text-ink outline-none focus:border-focus focus:ring-2 focus:ring-focus/20"
          >
            <option value="">Tất cả vai trò</option>
            {Object.entries(USER_ROLES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-small font-semibold text-ink-secondary">
          Trạng thái
          <select
            value={filters.status}
            onChange={(event) => changeFilter('status', event.target.value)}
            className="h-9 w-full cursor-pointer rounded-lg border border-line-strong bg-surface px-3 text-small font-normal text-ink outline-none focus:border-focus focus:ring-2 focus:ring-focus/20"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(USER_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-small font-semibold text-ink-secondary">
          Sắp xếp
          <select
            value={filters.sort}
            onChange={(event) => changeFilter('sort', event.target.value)}
            className="h-9 w-full cursor-pointer rounded-lg border border-line-strong bg-surface px-3 text-small font-normal text-ink outline-none focus:border-focus focus:ring-2 focus:ring-focus/20"
          >
            <option value="newest">Tham gia gần nhất</option>
            <option value="reputation-desc">Uy tín cao nhất</option>
            <option value="reputation-asc">Uy tín thấp nhất</option>
            <option value="name">Tên A – Z</option>
          </select>
        </label>
        <div className="flex items-center gap-2 max-xl:col-span-3 max-xl:justify-end max-sm:col-span-2">
          <button
            type="button"
            className={cx(
              'inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-ink-muted hover:bg-primary-subtle hover:text-primary',
              focusRing
            )}
            onClick={resetFiltersAndNotice}
            aria-label="Đặt lại bộ lọc người dùng"
            title="Đặt lại bộ lọc"
          >
            <Icon name="reset" />
          </button>
          <Button variant="primary" onClick={exportUsers} disabled={!filtered.length}>
            <Icon name="download" size={16} />
            Xuất CSV
          </Button>
        </div>
      </section>

      {notice && (
        <div
          className="mt-[18px] flex items-center gap-2.5 rounded-lg border border-[#acd8c4] bg-[#edf9f2] px-4 py-3 text-small text-[#287c5e]"
          role="status"
        >
          <Icon name="check" size={18} />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            className={cx(
              'ml-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-[#d9f1e3]',
              focusRing
            )}
            onClick={() => setNotice('')}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <div className="my-6 flex items-center justify-between gap-4 max-sm:flex-wrap max-sm:gap-2">
        <h2 className="flex items-center gap-2.5 text-lead font-semibold text-[#253e59]">
          Danh sách người dùng
          <span className="rounded-md bg-[#e1ecfa] px-2 py-1 text-caption text-[#34689b]">
            {number(filtered.length)}
          </span>
        </h2>
        <span className="text-caption text-[#73869d]" aria-live="polite">
          {number(filtered.length)} / {number(users.length)} tài khoản
        </span>
      </div>

      <DataTable
        variant="admin"
        caption="Người dùng, vai trò, trạng thái, ngày tham gia và thao tác"
        ariaLabel="Bảng người dùng, cuộn ngang để xem thêm"
        minWidth="min-w-[1030px]"
        columns={[
          ['Tài khoản', 'w-[34%]'],
          ['Vai trò', 'w-[15%]'],
          ['Trạng thái', 'w-[14%]'],
          ['Ngày tham gia', 'w-[15%]'],
          ['Thao tác', 'w-[22%]'],
        ]}
        empty={
          !filtered.length && (
            <div className="flex flex-col items-center px-5 py-14 text-center text-ink-subtle">
              <Icon name="users" size={36} />
              <h3 className="mb-2 mt-4 text-lead font-semibold text-ink">
                Không tìm thấy tài khoản phù hợp
              </h3>
              <p className="mb-4 text-caption">Thử tìm theo tên, email hoặc thay đổi bộ lọc.</p>
              <Button onClick={resetFiltersAndNotice}>Xóa bộ lọc</Button>
            </div>
          )
        }
      >
        {visible.map((account) => (
          <tr
            key={account.id}
            className={cx('hover:bg-[#f7fafd]', account.status === 'locked' && 'bg-[#fffbfc]')}
          >
            <td className="border-b border-[#e2eaf3] px-4 py-[18px]">
              <div className="flex items-center gap-3">
                <Avatar account={account} />
                <div className="min-w-0">
                  <button
                    type="button"
                    className={cx(
                      'inline text-left text-small font-semibold leading-relaxed text-[#233e5e] hover:text-primary hover:underline',
                      focusRing
                    )}
                    onClick={() => openProfile(account.id)}
                  >
                    {account.name}
                  </button>
                  {isCurrentUser(account, actor) && (
                    <span className="ml-1.5 rounded bg-[#e4eefc] px-1.5 py-0.5 text-[10px] text-[#396dad]">
                      Bạn
                    </span>
                  )}
                  <span className="mt-1 block break-words text-caption text-[#74859b]">
                    {account.email}
                  </span>
                </div>
              </div>
            </td>
            <td className="border-b border-[#e2eaf3] px-4 py-[18px]">
              <Role role={account.role} />
            </td>
            <td className="border-b border-[#e2eaf3] px-4 py-[18px]">
              <Status status={account.status} />
            </td>
            <td className="border-b border-[#e2eaf3] px-4 py-[18px] text-small text-ink-secondary">
              <time dateTime={account.createdAt}>{date(account.createdAt)}</time>
              <span className="mt-1.5 block text-[11px] text-[#8797ab]">{account.id}</span>
            </td>
            <td className="border-b border-[#e2eaf3] px-4 py-[18px]">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={cx(
                    'inline-flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#c8d8eb] bg-[#f8fbff] px-2 py-1.5 text-caption font-medium text-[#376490] hover:border-[#86a9d2] hover:bg-[#e7f0fc]',
                    focusRing
                  )}
                  onClick={() => openProfile(account.id)}
                >
                  <Icon name="eye" size={15} />
                  Hồ sơ
                </button>
                <UserActions
                  account={account}
                  actor={actor}
                  onAction={(action) => openAction(account.id, action)}
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
        noun="tài khoản"
      />

      {selected && modal?.kind === 'profile' && (
        <UserProfile
          account={selected}
          actor={actor}
          logs={logs.filter((log) => log.userId === selected.id)}
          onClose={() => setModal(null)}
          onAction={(action) => openAction(selected.id, action, true)}
        />
      )}
      {selected && modal?.kind === 'action' && (
        <UserActionDialog
          key={`${selected.id}-${modal.action}`}
          account={selected}
          actor={actor}
          action={modal.action}
          onConfirm={confirmAction}
          onClose={closeAction}
          error={actionError}
        />
      )}
    </div>
  )
}
