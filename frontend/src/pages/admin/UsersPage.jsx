import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import Button from '../../components/backoffice/Button'
import DataTable from '../../components/backoffice/DataTable'
import Dialog from '../../components/backoffice/Dialog'
import Pagination from '../../components/backoffice/Pagination'
import { cx, focusRing } from '../../components/backoffice/classes'
import { downloadCsv } from '../../lib/csv'
import {
  isCurrentUser,
  USER_ACTIONS,
  USER_FILTERS,
  USER_ROLES,
  USER_STATUSES,
  usersToRows,
  userActionUnavailable,
} from '../../lib/admin/users'
import { applyAdminUserAction, getAdminUser, listAdminUsers } from '../../lib/admin/usersApi'
import usePaginatedFilter from '../../hooks/usePaginatedFilter'

const PAGE_SIZE = 8
const identityFilter = (items) => items
const completedActions = {
  lock: 'Đã khóa tài khoản',
  unlock: 'Đã mở khóa tài khoản',
  grant: 'Đã cấp quyền Moderator cho',
  revoke: 'Đã thu hồi quyền Moderator của',
}
const number = (value) => new Intl.NumberFormat('vi-VN').format(value)
const date = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa có')
const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : 'Chưa có'

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

const statusTextTones = {
  active: 'text-[#438b76]',
  locked: 'text-[#c27687]',
  restricted: 'text-[#b28b4c]',
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
      {account.avatarUrl ? (
        <img src={account.avatarUrl} alt="" className="size-full rounded-xl object-cover" />
      ) : (
        account.initials
      )}
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

function Status({ status, plain = false }) {
  return (
    <span
      className={cx(
        'whitespace-nowrap text-small font-semibold leading-tight',
        !plain && 'inline-flex rounded-md px-2.5 py-1.5',
        plain ? statusTextTones[status] : statusTones[status]
      )}
    >
      {USER_STATUSES[status]}
    </span>
  )
}

function ActionButton({
  action,
  account,
  actor,
  expanded = false,
  showIcon = true,
  label,
  onAction,
}) {
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
      {showIcon && <Icon name={settings.icon} size={15} />}
      {label || (expanded ? settings.label : shortLabels[action])}
    </button>
  )
}

function UserActions({
  account,
  actor,
  onAction,
  expanded = false,
  showIcons = true,
  labels,
  roleFirst = false,
}) {
  const statusAction = account.status === 'locked' ? 'unlock' : 'lock'
  const roleAction = account.role === 'moderator' ? 'revoke' : 'grant'
  const actions = roleFirst ? [roleAction, statusAction] : [statusAction, roleAction]

  return (
    <>
      {actions.map((action) => (
        <ActionButton
          key={action}
          action={action}
          account={account}
          actor={actor}
          expanded={expanded}
          showIcon={showIcons}
          label={labels?.[action]}
          onAction={onAction}
        />
      ))}
    </>
  )
}

function UserProfileContent({ account, actor, onPreviewAvatar }) {
  const logs = account.recentActions

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 max-sm:gap-3">
        <div className="flex min-w-0 items-center gap-4 max-sm:gap-3">
          {account.avatarUrl ? (
            <button
              type="button"
              className={cx('shrink-0 cursor-zoom-in rounded-xl', focusRing)}
              aria-label={`Xem ảnh đại diện của ${account.username}`}
              title="Xem ảnh đại diện"
              onClick={onPreviewAvatar}
            >
              <Avatar account={account} large />
            </button>
          ) : (
            <Avatar account={account} large />
          )}
          <div className="min-w-0">
            <h3 className="text-title font-bold text-[#284663] [overflow-wrap:anywhere]">
              {account.name}
              {isCurrentUser(account, actor) && (
                <span className="ml-2 inline-flex rounded bg-[#e4eefc] px-1.5 py-0.5 align-middle text-[10px] font-medium text-[#396dad]">
                  Bạn
                </span>
              )}
            </h3>
            <p className="mt-2 text-small">
              <Role role={account.role} />
              <span className="whitespace-nowrap">
                {' '}
                - <Status status={account.status} plain />
              </span>
            </p>
          </div>
        </div>
        <section
          aria-label="Điểm uy tín"
          className="flex shrink-0 flex-col items-center rounded-xl border border-[#ecd8a8] bg-[#fffbf0] px-4 py-3 max-sm:px-3"
        >
          <div className="flex items-center gap-2 text-[#b08b32]">
            <Icon name="star" size={20} />
            <strong className="text-[28px] leading-tight text-[#88661d]">
              {number(account.reputationScore)}
            </strong>
          </div>
          <span className="mt-1 text-caption text-[#9a8862]">điểm uy tín</span>
        </section>
      </div>

      <h4 className="mb-2 mt-5 text-small font-bold">Thông tin tài khoản</h4>
      <dl className="mb-3">
        {[
          ['Email', account.email],
          ['Ngày tham gia', date(account.createdAt)],
          ['Cập nhật gần nhất', dateTime(account.updatedAt)],
          [
            'Truy cập gần nhất',
            account.lastActiveAt ? dateTime(account.lastActiveAt) : 'Chưa ghi nhận',
          ],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cx(
              'grid grid-cols-[145px_minmax(0,1fr)] gap-3 py-2.5 text-small max-sm:grid-cols-[110px_minmax(0,1fr)] max-sm:text-caption',
              index < 3 && 'border-b border-line-subtle'
            )}
          >
            <dt className="text-ink-subtle">{label}</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>

      <h4 className="mb-2 mt-5 text-small font-bold">Huy hiệu</h4>
      <div className="flex flex-wrap gap-1.5">
        {account.badges.length ? (
          account.badges.map((badge) => (
            <span
              key={badge.id}
              title={badge.description || badge.name}
              className="inline-flex items-center gap-1 rounded-md border border-[#d1e6d9] bg-[#f1faf5] px-2 py-1 text-caption text-[#4a8c69]"
            >
              <Icon name="star" size={13} />
              {badge.name}
            </span>
          ))
        ) : (
          <p className="text-small text-ink-muted">Chưa có huy hiệu</p>
        )}
      </div>

      <h4 className="mb-2 mt-5 text-small font-bold">Lịch sử</h4>
      {logs.length > 0 ? (
        <ol
          aria-label="Lịch sử tài khoản"
          tabIndex={0}
          className={cx(
            'm-0 max-h-72 list-none divide-y divide-line overflow-y-auto overscroll-contain rounded-lg border border-line p-0',
            focusRing
          )}
        >
          {logs.map((log) => (
            <li key={log.id} className="bg-[#f5f8fc] px-3.5 py-3">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <strong className="text-caption font-semibold text-[#4a6a8e]">
                  {USER_ACTIONS[log.action]?.label ||
                    (log.action === 'restrict' ? 'Hạn chế tài khoản' : 'Cập nhật tài khoản')}
                </strong>
                <time
                  className="whitespace-nowrap text-[11px] text-ink-subtle"
                  dateTime={log.createdAt}
                >
                  {dateTime(log.createdAt)}
                </time>
              </div>
              <small className="mt-1 block text-[11px] text-ink-subtle">
                Thực hiện bởi{' '}
                {log.actorRole === 'admin'
                  ? 'Admin'
                  : log.actor?.username
                    ? `@${log.actor.username}`
                    : log.actorRole && log.actorRole !== 'system'
                      ? 'tài khoản không còn tồn tại'
                      : 'hệ thống'}
              </small>
              {['lock', 'grant', 'revoke', 'restrict'].includes(log.action) &&
                log.reason?.trim() && (
                  <p className="mt-2 text-caption leading-relaxed text-ink-muted [overflow-wrap:anywhere]">
                    Lý do: {log.reason}
                  </p>
                )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-small text-ink-muted">Chưa có lịch sử quản lý tài khoản.</p>
      )}
    </>
  )
}

function UserProfile({ account, actor, loading, error, onRetry, onClose, onAction }) {
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)
  const profileReady = Boolean(account && !loading && !error)
  const protectedAccount =
    profileReady && (isCurrentUser(account, actor) || account.role === 'admin')

  return (
    <>
      <Dialog
        title="Hồ sơ người dùng"
        onClose={onClose}
        scrollableContent
        footer={
          <div className="w-full">
            {protectedAccount && (
              <p className="mb-3 flex items-start gap-1.5 text-caption leading-relaxed text-ink-subtle">
                <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
                Tài khoản quản trị được bảo vệ khỏi thao tác khóa và thay đổi quyền tại đây.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {profileReady && (
                <UserActions
                  account={account}
                  actor={actor}
                  onAction={onAction}
                  expanded
                  roleFirst
                  showIcons={false}
                  labels={{ lock: 'Khóa', unlock: 'Mở khóa' }}
                />
              )}
              <Button onClick={onClose}>Đóng</Button>
            </div>
          </div>
        }
      >
        {loading ? (
          <p role="status" className="py-8 text-center text-small text-ink-muted">
            Đang tải hồ sơ người dùng…
          </p>
        ) : error ? (
          <div role="alert" className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-small text-danger-ink">{error}</p>
            <Button onClick={onRetry}>Thử lại</Button>
          </div>
        ) : account ? (
          <UserProfileContent
            account={account}
            actor={actor}
            onPreviewAvatar={() => setAvatarPreviewOpen(true)}
          />
        ) : null}
      </Dialog>
      {profileReady && avatarPreviewOpen && account.avatarUrl && (
        <Dialog
          title="Ảnh đại diện"
          size="lg"
          scrollableContent
          onClose={() => setAvatarPreviewOpen(false)}
        >
          <img
            src={account.avatarUrl}
            alt={`Ảnh đại diện của ${account.username}`}
            className="mx-auto max-h-[calc(100dvh-180px)] max-w-full rounded-lg object-contain"
          />
        </Dialog>
      )}
    </>
  )
}

function UserActionDialog({
  account,
  actor,
  action,
  onConfirm,
  onClose,
  error,
  loading,
  onRetry,
  pending,
}) {
  const [reason, setReason] = useState('')
  const [attempted, setAttempted] = useState(false)
  const settings = USER_ACTIONS[action]
  const unavailable = userActionUnavailable(account, actor, action)
  const isStatusAction = ['lock', 'unlock'].includes(action)
  const submitLabel = action === 'lock' ? 'Khóa' : action === 'unlock' ? 'Mở khóa' : settings.label
  const reasonRequired = ['lock', 'grant', 'revoke'].includes(action)
  const invalidReason = attempted && reasonRequired && reason.trim().length < 5

  if (loading || !account) {
    return (
      <Dialog
        title={settings.label}
        onClose={onClose}
        footer={<Button onClick={onClose}>Hủy</Button>}
      >
        {loading ? (
          <p role="status" className="py-8 text-center text-ink-muted">
            Đang tải thông tin tài khoản…
          </p>
        ) : (
          <div role="alert" className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-danger-ink">{error}</p>
            <Button onClick={onRetry}>Thử lại</Button>
          </div>
        )}
      </Dialog>
    )
  }

  const submit = (event) => {
    event.preventDefault()
    if (pending || unavailable) return
    setAttempted(true)
    if (reasonRequired && reason.trim().length < 5) return
    onConfirm(reason)
  }

  return (
    <Dialog
      title={settings.label}
      onClose={onClose}
      scrollableContent
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            Hủy
          </Button>
          <button
            type="submit"
            form="admin-user-action-form"
            className={cx(
              'inline-flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-small font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45',
              actionTones[settings.tone],
              focusRing
            )}
            disabled={pending || Boolean(unavailable)}
          >
            {!isStatusAction && <Icon name={settings.icon} size={16} />}
            {pending ? 'Đang xử lý…' : submitLabel}
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
              {isStatusAction ? account.email : `@${account.username} · ${account.email}`}
            </span>
          </div>
        </div>
        {settings.description && (
          <p className="my-2 text-small leading-relaxed text-ink-muted">{settings.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-[#f5f8fc] p-3 text-small">
          <span className="mr-auto text-caption text-ink-subtle">Hiện tại</span>
          {isStatusAction ? (
            <>
              <Status status={account.status} />
              <Icon name="next" size={15} className="text-ink-subtle" />
              {action === 'lock' || account.unlockStatus ? (
                <Status status={action === 'lock' ? 'locked' : account.unlockStatus} />
              ) : (
                <span className="text-ink-muted">Chưa xác định</span>
              )}
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
          Lý do {reasonRequired && <span className="text-danger-ink">*</span>}
        </label>
        <textarea
          id="admin-user-reason"
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-required={reasonRequired}
          aria-invalid={invalidReason}
          disabled={pending}
          className={cx(
            'w-full resize-y rounded-lg border bg-surface px-3 py-2 text-small leading-relaxed text-ink outline-none placeholder:text-ink-subtle focus:border-focus focus:ring-2 focus:ring-focus/20',
            invalidReason ? 'border-danger' : 'border-line-strong'
          )}
          placeholder={
            action === 'lock' ? 'Nhập lý do khóa tài khoản' : 'Ghi chú cho thao tác này…'
          }
        />
        <span className="text-right text-[11px] text-ink-subtle">{reason.length}/500</span>
        {invalidReason && (
          <p className="text-caption text-danger-ink" role="alert">
            Vui lòng nhập lý do có ít nhất 5 ký tự.
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
  const actor = user
  const [listState, setListState] = useState({ key: null, items: [], error: '' })
  const [retryCount, setRetryCount] = useState(0)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const actionInFlight = useRef(false)
  const [profileState, setProfileState] = useState({ key: null, account: null, error: '' })
  const [profileVersion, setProfileVersion] = useState(0)
  const { filters, setFilter, resetFilters, setPage, currentPage } = usePaginatedFilter({
    items: listState.items,
    initialFilters: USER_FILTERS,
    filterFn: identityFilter,
    pageSize: PAGE_SIZE,
  })
  const requestFilters = useMemo(
    () => ({
      query: debouncedQuery,
      role: filters.role,
      status: filters.status,
      sort: filters.sort,
    }),
    [debouncedQuery, filters.role, filters.status, filters.sort]
  )
  const requestKey = JSON.stringify([requestFilters, retryCount])
  const listIsCurrent = listState.key === requestKey
  const queryDebouncing = filters.query.trim() !== debouncedQuery
  const loading = queryDebouncing || !listIsCurrent
  const listError = !loading ? listState.error : ''
  const users = loading || listError ? [] : listState.items
  const filtered = users
  const visible = users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const profileId = modal?.id || null
  const profileKey = profileId ? JSON.stringify([profileId, profileVersion]) : null
  const profileIsCurrent = profileState.key === profileKey
  const profileAccount = profileIsCurrent ? profileState.account : null
  const profileLoading = Boolean(profileId && !profileIsCurrent)
  const profileError = profileIsCurrent ? profileState.error : ''

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(filters.query.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [filters.query])

  useEffect(() => {
    if (queryDebouncing) return undefined
    let active = true
    listAdminUsers(requestFilters)
      .then((data) => {
        if (active) setListState({ key: requestKey, ...data, error: '' })
      })
      .catch((error) => {
        if (active) {
          setListState((previous) => ({
            ...previous,
            key: requestKey,
            items: [],
            error: error.message,
          }))
        }
      })
    return () => {
      active = false
    }
  }, [queryDebouncing, requestFilters, requestKey])

  useEffect(() => {
    if (!profileId) return undefined
    let active = true
    getAdminUser(profileId)
      .then((account) => {
        if (active) setProfileState({ key: profileKey, account, error: '' })
      })
      .catch((error) => {
        if (active) setProfileState({ key: profileKey, account: null, error: error.message })
      })
    return () => {
      active = false
    }
  }, [profileId, profileKey])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const changeFilter = (key, value) => {
    setFilter(key, value)
    setNotice('')
  }

  const resetFiltersAndNotice = () => {
    resetFilters()
    setRetryCount((previous) => previous + 1)
    setNotice('')
  }

  const exportUsers = () => {
    if (!filtered.length) return
    downloadCsv('LostLink_Danh_sach_nguoi_dung.csv', usersToRows(filtered))
    setNotice(`Đã xuất ${number(filtered.length)} tài khoản ra CSV.`)
  }

  const openProfile = (id) => {
    setActionError('')
    setProfileVersion((previous) => previous + 1)
    setModal({ kind: 'profile', id })
  }

  const openAction = (id, action, fromProfile = false) => {
    setActionError('')
    setProfileVersion((previous) => previous + 1)
    setModal({ kind: 'action', id, action, fromProfile })
  }

  const closeAction = () => {
    if (actionInFlight.current) return
    setActionError('')
    setModal(modal?.fromProfile ? { kind: 'profile', id: modal.id } : null)
  }

  const confirmAction = async (reason) => {
    if (actionInFlight.current || !profileAccount || modal?.kind !== 'action') return
    actionInFlight.current = true
    setActionPending(true)
    setActionError('')
    const { id, action, fromProfile } = modal
    try {
      const account = await applyAdminUserAction(id, action, reason)
      setProfileState({ key: profileKey, account, error: '' })
      setRetryCount((previous) => previous + 1)
      setNotice(`${completedActions[action]} ${account.username}.`)
      setModal(fromProfile ? { kind: 'profile', id } : null)
    } catch (error) {
      setActionError(error.fieldErrors?.reason || error.message)
    } finally {
      actionInFlight.current = false
      setActionPending(false)
    }
  }

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-4 max-sm:py-4">
      <section
        className="grid grid-cols-[minmax(240px,1.7fr)_minmax(140px,1fr)_minmax(150px,1fr)_minmax(165px,1fr)_auto] items-end gap-4 rounded-xl border border-[#b4c6db] bg-surface p-4 shadow-card max-xl:grid-cols-3 max-sm:grid-cols-2 max-sm:gap-x-2.5 max-sm:gap-y-3.5"
        aria-label="Bộ lọc người dùng"
      >
        <label className="flex min-w-0 flex-col gap-2 text-small font-semibold text-ink-secondary max-xl:col-span-2 max-sm:col-span-2">
          Tìm kiếm
          <span className="relative">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3 top-2.5 text-[#7a8fa8]"
            />
            <input
              type="search"
              maxLength={100}
              value={filters.query}
              onChange={(event) => changeFilter('query', event.target.value)}
              placeholder="Username hoặc email"
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
          <Button variant="primary" onClick={exportUsers} disabled={loading || !filtered.length}>
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

      <p className="mt-4 mb-2.5 text-small text-ink-subtle" aria-live="polite">
        {loading ? (
          'Đang tải danh sách người dùng…'
        ) : (
          <>
            Hiển thị {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} trong số {filtered.length} tài
            khoản
          </>
        )}
      </p>

      <DataTable
        variant="admin"
        caption="Người dùng, vai trò, trạng thái, ngày tham gia và thao tác"
        ariaLabel="Bảng người dùng, cuộn ngang để xem thêm"
        minWidth="min-w-[1100px] table-fixed"
        columns={[
          ['Tài khoản', 'w-[26%]'],
          ['Vai trò', 'w-[12%]'],
          ['Trạng thái', 'w-[15%]'],
          ['Ngày tham gia', 'w-[20%]'],
          ['Thao tác', 'w-[27%]'],
        ]}
        empty={
          (loading || listError || !filtered.length) && (
            <div
              className="flex flex-col items-center px-5 py-14 text-center text-ink-subtle"
              role={loading ? 'status' : listError ? 'alert' : undefined}
            >
              <Icon name="users" size={36} />
              <h3 className="mb-2 mt-4 text-lead font-semibold text-ink">
                {loading
                  ? 'Đang tải danh sách người dùng…'
                  : listError
                    ? 'Không tải được danh sách người dùng'
                    : 'Không tìm thấy tài khoản phù hợp'}
              </h3>
              {!loading && (
                <>
                  <p className="mb-4 text-caption">
                    {listError || 'Thử tìm theo tên, email hoặc thay đổi bộ lọc.'}
                  </p>
                  <Button
                    onClick={
                      listError
                        ? () => setRetryCount((previous) => previous + 1)
                        : resetFiltersAndNotice
                    }
                  >
                    {listError ? 'Thử lại' : 'Xóa bộ lọc'}
                  </Button>
                </>
              )}
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
                <div className="min-w-0">
                  <button
                    type="button"
                    title="Xem hồ sơ người dùng"
                    className={cx(
                      'inline text-left text-small font-semibold leading-relaxed text-[#233e5e] enabled:hover:text-primary enabled:hover:underline disabled:cursor-default',
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
            </td>
            <td className="border-b border-[#e2eaf3] px-4 py-[18px]">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  title="Xem hồ sơ người dùng"
                  className={cx(
                    'inline-flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#c8d8eb] bg-[#f8fbff] px-2 py-1.5 text-caption font-medium text-[#376490] enabled:hover:border-[#86a9d2] enabled:hover:bg-[#e7f0fc] disabled:cursor-not-allowed disabled:opacity-40',
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

      {!loading && !listError && (
        <Pagination
          page={currentPage}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
          noun="tài khoản"
          showSummary={false}
        />
      )}

      {modal?.kind === 'profile' && (
        <UserProfile
          account={profileAccount}
          actor={actor}
          loading={profileLoading}
          error={profileError}
          onRetry={() => setProfileVersion((previous) => previous + 1)}
          onClose={() => setModal(null)}
          onAction={(action) => openAction(modal.id, action, true)}
        />
      )}
      {modal?.kind === 'action' && (
        <UserActionDialog
          key={`${modal.id}-${modal.action}-${profileVersion}`}
          account={profileAccount}
          actor={actor}
          action={modal.action}
          onConfirm={confirmAction}
          onClose={closeAction}
          error={profileError || actionError}
          loading={profileLoading}
          onRetry={() => setProfileVersion((previous) => previous + 1)}
          pending={actionPending}
        />
      )}
    </div>
  )
}
