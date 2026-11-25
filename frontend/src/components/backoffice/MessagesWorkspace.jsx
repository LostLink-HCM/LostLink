import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../common/Icon'
import Button from './Button'
import Dialog from './Dialog'
import IconButton from './IconButton'
import { cx } from './classes'
import { EMPTY_QUICK_REPLIES } from '../../lib/backoffice/quickReplies'
import {
  getBackofficeConversation,
  listBackofficeContacts,
  listBackofficeConversations,
  markBackofficeConversationUnread,
  openBackofficeConversation,
  sendBackofficeMessage,
  setBackofficeConversationPriority,
} from '../../api/backofficeMessages'
import { onSocket } from '../../lib/socket'
import useBackofficeActionLock from '../../hooks/useBackofficeActionLock'
import {
  MESSAGE_LIMIT,
  appendRemoteMessage,
  filterThreads,
  markThreadUnread,
  contactName,
  mergeConversation,
  normalizeInbox,
  openThread as openThreadState,
  replaceThread,
} from '../../lib/backoffice/messages'

const MODERATOR_SYNC_INTERVAL_MS = 60_000

const avatarColors = {
  blue: 'bg-[#dfeafa] text-[#35679e]',
  purple: 'bg-[#ede8fa] text-[#7553ae]',
  amber: 'bg-[#fff0d8] text-[#9c702d]',
  green: 'bg-[#ddf0e7] text-[#397b62]',
  rose: 'bg-[#f7e5ec] text-[#a45a77]',
}

const dateKey = (value) => new Date(value).toLocaleDateString('vi-VN')
const capitalizeFirst = (value) => (value ? `${value[0].toUpperCase()}${value.slice(1)}` : '')
const timeLabel = (value) =>
  new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
const dayLabel = (value) => (dateKey(value) === dateKey(Date.now()) ? 'Hôm nay' : dateKey(value))
const previewTime = (value) =>
  dateKey(value) === dateKey(Date.now())
    ? timeLabel(value)
    : new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

function Avatar({ contact, small = false, moderator = false, label }) {
  const initials = moderator
    ? (label || 'MO').slice(0, 2).toUpperCase()
    : contact?.role === 'admin'
      ? 'AD'
      : contact?.initials || 'LL'

  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-caption font-bold',
        small ? 'size-7.5 rounded-lg text-[10px]' : 'size-10',
        moderator
          ? 'bg-primary text-white'
          : avatarColors[contact?.color] || 'bg-primary-soft text-primary'
      )}
    >
      {contact?.avatarUrl && !moderator ? (
        <img src={contact.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}

function SearchField({ value, onChange, placeholder, label }) {
  return (
    <label
      className={cx(
        'flex min-w-0 items-center gap-2 rounded-lg border border-transparent',
        'bg-slate-100 px-2.5 text-ink-subtle transition-colors',
        'focus-within:border-blue-300 focus-within:bg-white'
      )}
    >
      <Icon name="search" size={16} />
      <input
        aria-label={label}
        className="h-9 min-w-0 w-full bg-transparent text-small text-ink outline-none
          placeholder:text-ink-subtle"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </label>
  )
}

function NewConversation({ peerRoles, onSelect, onSearch, onClose }) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState(peerRoles[0]?.[0] || 'user')
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectError, setSelectError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  useEffect(() => {
    let active = true
    const timer = setTimeout(
      async () => {
        setLoading(true)
        setError('')
        try {
          const result = await onSearch({ peerRole: role, q: query.trim() })
          if (active) setContacts(result)
        } catch (loadError) {
          if (active) setError(loadError.message)
        } finally {
          if (active) setLoading(false)
        }
      },
      query.trim() ? 250 : 0
    )
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [onSearch, query, role])

  return (
    <Dialog title="Cuộc trò chuyện mới" onClose={onClose} size="sm">
      <div className="mb-4 flex gap-2" role="group" aria-label="Loại người nhận">
        {peerRoles.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={role === value}
            className={cx(
              'rounded-lg px-3 py-2 text-small font-semibold transition-colors',
              role === value
                ? 'bg-primary-soft text-primary'
                : 'bg-slate-100 text-ink-muted hover:text-primary'
            )}
            onClick={() => setRole(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <SearchField
        label="Tìm người nhận"
        placeholder="Tìm theo tên hoặc email…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="mt-3 max-h-85 overflow-y-auto">
        {contacts.map((contact) => (
          <button
            type="button"
            key={contact.id}
            className="flex w-full items-center gap-3 rounded-lg p-3 text-left
              transition-colors hover:bg-surface-muted"
            disabled={Boolean(selectedId)}
            onClick={async () => {
              setSelectedId(contact.id)
              setSelectError('')
              try {
                await onSelect(contact.id)
              } catch (selectFailure) {
                setSelectError(selectFailure.message)
              } finally {
                setSelectedId('')
              }
            }}
          >
            <Avatar contact={contact} />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-small">{contactName(contact)}</strong>
              <small className="mt-1 block break-all text-caption text-ink-subtle">
                {contact.email}
              </small>
            </span>
            <Icon name="next" size={16} />
          </button>
        ))}
        {loading && (
          <p className="px-2 py-5 text-center text-caption text-ink-subtle">Đang tải người nhận…</p>
        )}
        {(error || selectError) && (
          <p role="alert" className="px-2 py-4 text-center text-caption text-red-700">
            {error || selectError}
          </p>
        )}
        {!loading && !error && !contacts.length && (
          <p className="px-2 py-6 text-center text-small text-ink-subtle">
            Không tìm thấy người nhận phù hợp.
          </p>
        )}
      </div>
    </Dialog>
  )
}

export default function MessagesWorkspace({
  messageState,
  setMessageState,
  workspaceRole,
  user,
  quickReplies = EMPTY_QUICK_REPLIES,
}) {
  const peerRoles =
    workspaceRole === 'admin'
      ? [['moderator', 'Moderator']]
      : [
          ['user', 'Người dùng'],
          ['admin', 'Admin'],
        ]
  const allowedRoles = workspaceRole === 'admin' ? ['moderator'] : ['user', 'admin']
  const [role, setRole] = useState(workspaceRole === 'admin' ? 'moderator' : '')
  const [query, setQuery] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [newConversation, setNewConversation] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [mobileConversation, setMobileConversation] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [remoteInbox, setRemoteInbox] = useState(null)
  const scrollRef = useRef(null)
  const composeRef = useRef(null)
  const imageInputRef = useRef(null)
  const activeIdRef = useRef(messageState.activeId)

  useEffect(() => {
    activeIdRef.current = messageState.activeId
  }, [messageState.activeId])

  const refreshInbox = useCallback(async () => {
    try {
      const data = await listBackofficeConversations({ page: 1, limit: 100 })
      setMessageState((previous) => normalizeInbox(data, previous))
      setLoadError('')
    } catch (error) {
      setLoadError(error.message)
    }
  }, [setMessageState])

  const hasRemoteFilters = Boolean(query.trim() || role || unreadOnly)
  const filterKey = JSON.stringify({ q: query.trim(), peerRole: role, unreadOnly })
  const refreshFilteredInbox = useCallback(async () => {
    if (!hasRemoteFilters) return
    try {
      const data = await listBackofficeConversations({
        page: 1,
        limit: 100,
        ...(query.trim() && { q: query.trim() }),
        ...(role && { peerRole: role }),
        ...(unreadOnly && { unreadOnly: true }),
      })
      setRemoteInbox({ key: filterKey, data })
    } catch (error) {
      setActionError(error.message)
    }
  }, [filterKey, hasRemoteFilters, query, role, unreadOnly])

  const refreshInboxView = useCallback(() => {
    if (hasRemoteFilters) void refreshFilteredInbox()
    else void refreshInbox()
  }, [hasRemoteFilters, refreshFilteredInbox, refreshInbox])

  useEffect(() => {
    if (!hasRemoteFilters) return undefined
    const timer = setTimeout(() => void refreshFilteredInbox(), query.trim() ? 250 : 0)
    return () => clearTimeout(timer)
  }, [filterKey, hasRemoteFilters, query, refreshFilteredInbox])

  const loadThread = useCallback(
    async (id) => {
      const data = await getBackofficeConversation(id)
      setMessageState((previous) => mergeConversation(previous, data.thread))
      return data.thread
    },
    [setMessageState]
  )

  useEffect(() => {
    let activeEffect = true
    listBackofficeConversations({ page: 1, limit: 100 })
      .then((data) => {
        if (activeEffect) setMessageState((previous) => normalizeInbox(data, previous))
      })
      .catch((error) => {
        if (activeEffect) setLoadError(error.message)
      })
      .finally(() => {
        if (activeEffect) setLoading(false)
      })

    const unsubscribeMessage = onSocket('message:new', (message) => {
      if (!activeEffect) return
      const incoming = {
        ...message,
        text: message.text ?? message.body ?? '',
        image: message.image ?? null,
        createdAt: message.createdAt ?? message.sentAt,
      }
      setMessageState((previous) => {
        const thread = previous.threads.find((item) => item.id === message.conversationId)
        const isOwnMessage = message.senderId
          ? String(message.senderId) === String(user?.id)
          : message.sender === 'me'
        const isOtherModerator =
          workspaceRole === 'moderator' &&
          (message.supportType ?? thread?.supportType) === 'user' &&
          message.senderRole === 'moderator'
        const updated = appendRemoteMessage(
          previous,
          {
            ...incoming,
            sender: isOwnMessage ? 'me' : isOtherModerator ? 'staff' : 'peer',
          },
          { countAsUnread: !isOtherModerator }
        )
        return workspaceRole === 'moderator'
          ? {
              ...updated,
              threads: updated.threads.map((thread) =>
                thread.processing && !thread.processing.ownedByMe
                  ? { ...thread, unread: 0 }
                  : thread
              ),
            }
          : updated
      })
      refreshInboxView()
      if (activeIdRef.current === message.conversationId) {
        void loadThread(message.conversationId).catch((error) => setActionError(error.message))
      }
    })
    const unsubscribeUpdate = onSocket('conversation:updated', ({ conversationId } = {}) => {
      if (!activeEffect) return
      refreshInboxView()
      if (conversationId && String(activeIdRef.current) === String(conversationId)) {
        void loadThread(conversationId).catch((error) => setActionError(error.message))
      }
    })
    return () => {
      activeEffect = false
      unsubscribeMessage()
      unsubscribeUpdate()
    }
  }, [loadThread, refreshInboxView, setMessageState, user?.id, workspaceRole])

  useEffect(() => {
    if (workspaceRole !== 'moderator') return undefined
    const interval = window.setInterval(() => {
      refreshInboxView()
      if (activeIdRef.current) {
        void loadThread(activeIdRef.current).catch((error) => setActionError(error.message))
      }
    }, MODERATOR_SYNC_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [loadThread, refreshInboxView, workspaceRole])

  const retryInbox = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await listBackofficeConversations({ page: 1, limit: 100 })
      setMessageState((previous) => normalizeInbox(data, previous))
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const searchContacts = useCallback(async (filters) => {
    const data = await listBackofficeContacts(filters)
    return data.items
  }, [])

  const sourceState =
    hasRemoteFilters && remoteInbox?.key === filterKey
      ? normalizeInbox(remoteInbox.data, messageState)
      : messageState
  const visibleContacts = sourceState.contacts.filter((contact) =>
    allowedRoles.includes(contact.role)
  )
  const visibleContactIds = new Set(visibleContacts.map((contact) => contact.id))
  const visibleThreads = sourceState.threads.filter((thread) =>
    visibleContactIds.has(thread.contactId)
  )
  const visibleState = { ...sourceState, threads: visibleThreads, contacts: visibleContacts }
  const filtered = filterThreads(visibleState, { role, query, unreadOnly })
  const active = visibleThreads.find((thread) => thread.id === messageState.activeId)
  const contact = active && visibleContacts.find((entry) => entry.id === active.contactId)
  const requiresReplyLock =
    workspaceRole === 'moderator' && (active?.supportType === 'user' || contact?.role === 'user')
  const draft = messageState.drafts[active?.id] || ''
  const keepReplyLockWhileHidden = Boolean(draft.trim() || selectedImage || sending)
  const shouldHoldReplyLock = requiresReplyLock && keepReplyLockWhileHidden
  const replyLock = useBackofficeActionLock(
    shouldHoldReplyLock ? 'conversation' : null,
    shouldHoldReplyLock ? active.id : null,
    !keepReplyLockWhileHidden
  )
  const anotherModeratorProcessing = Boolean(
    requiresReplyLock &&
    replyLock.status !== 'owned' &&
    active?.processing &&
    !active.processing.ownedByMe
  )
  const lockIsBusy = replyLock.status === 'busy' || anotherModeratorProcessing
  const canCompose =
    !requiresReplyLock ||
    (!lockIsBusy &&
      replyLock.status !== 'error' &&
      (!shouldHoldReplyLock || replyLock.status === 'owned' || replyLock.status === 'checking'))
  const canReply =
    !requiresReplyLock || (!lockIsBusy && (!shouldHoldReplyLock || replyLock.status === 'owned'))
  const lockHolderUsername = replyLock.holder?.username || active?.processing?.moderator?.username
  const lockHolderLabel = capitalizeFirst(lockHolderUsername) || 'Moderator khác'
  const unreadCount = visibleThreads.reduce((count, thread) => count + thread.unread, 0)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [active?.id, active?.messages.length, mobileConversation])

  const openThread = (id) => {
    setMessageState((previous) => openThreadState(previous, id))
    setShowReplies(false)
    setShowInfo(false)
    setMobileConversation(true)
    setAnnouncement('')
    setActionError('')
    void loadThread(id).catch((error) => setActionError(error.message))
  }

  const startThread = async (contactId) => {
    setActionError('')
    try {
      const data = await openBackofficeConversation(contactId)
      setMessageState((previous) => mergeConversation(previous, data.thread))
      setRemoteInbox(null)
      setNewConversation(false)
      setRole(workspaceRole === 'admin' ? 'moderator' : '')
      setQuery('')
      setUnreadOnly(false)
      setShowInfo(false)
      setShowReplies(false)
      setMobileConversation(true)
      void refreshFilteredInbox()
    } catch (error) {
      setActionError(error.message)
      throw error
    }
  }

  const updateDraft = (text) => {
    if (!active) return
    setMessageState((previous) => ({
      ...previous,
      drafts: { ...previous.drafts, [active.id]: text },
    }))
  }

  const send = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (
      !active ||
      !contact ||
      !canReply ||
      (!text && !selectedImage) ||
      text.length > MESSAGE_LIMIT ||
      sending
    )
      return
    setActionError('')
    setSending(true)
    try {
      const message = await sendBackofficeMessage(active.id, {
        body: text,
        image: selectedImage,
        ...(requiresReplyLock && { lockToken: replyLock.token }),
      })
      setMessageState((previous) => {
        const appended = appendRemoteMessage(previous, message)
        return {
          ...appended,
          drafts: { ...appended.drafts, [active.id]: '' },
          threads: appended.threads.map((thread) =>
            thread.id === active.id ? { ...thread, unread: 0 } : thread
          ),
        }
      })
      setSelectedImage(null)
      if (imageInputRef.current) imageInputRef.current.value = ''
      setAnnouncement(`Đã gửi tin nhắn tới ${contactName(contact)}.`)
      setShowReplies(false)
      void refreshInbox()
      void refreshFilteredInbox()
      composeRef.current?.focus()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setSending(false)
    }
  }

  const togglePriority = async () => {
    if (!active) return
    const value = !active.priority
    setActionError('')
    try {
      await setBackofficeConversationPriority(active.id, value)
      setMessageState((previous) => replaceThread(previous, active.id, { priority: value }))
      setAnnouncement(
        '\u0110\u00e3 c\u1eadp nh\u1eadt m\u1ee9c \u01b0u ti\u00ean h\u1ed9i tho\u1ea1i.'
      )
      void refreshFilteredInbox()
    } catch (error) {
      setActionError(error.message)
    }
  }

  const markUnread = async () => {
    if (!active || !contact) return
    try {
      await markBackofficeConversationUnread(active.id)
      setMessageState((previous) => markThreadUnread(previous, active.id))
      setAnnouncement(`Đã đánh dấu hội thoại với ${contactName(contact)} là chưa đọc.`)
      leaveConversation()
      void refreshFilteredInbox()
    } catch (error) {
      setActionError(error.message)
    }
  }

  const leaveConversation = () => {
    setMobileConversation(false)
    if (window.matchMedia('(max-width: 700px)').matches) {
      setMessageState((previous) => ({ ...previous, activeId: null }))
    }
  }

  const chooseImage = (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setActionError('Ảnh phải có định dạng JPG, PNG hoặc WEBP.')
      if (imageInputRef.current) imageInputRef.current.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionError('Ảnh không được lớn hơn 5 MB.')
      if (imageInputRef.current) imageInputRef.current.value = ''
      return
    }
    setActionError('')
    setSelectedImage(file)
  }

  const insertReply = (text) => {
    updateDraft(`${draft}${draft.trim() ? '\n' : ''}${text}`.slice(0, MESSAGE_LIMIT))
    setShowReplies(false)
    composeRef.current?.focus()
  }

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-3 max-sm:py-4">
      {loadError && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-small text-red-800"
        >
          <span>{loadError}</span>
          <Button type="button" variant="secondary" size="sm" onClick={retryInbox}>
            Thử lại
          </Button>
        </div>
      )}
      {actionError && actionError !== loadError && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-small text-red-800"
        >
          {actionError}
        </div>
      )}
      <div
        className={cx(
          'grid h-[calc(100dvh-9rem)] min-h-150 grid-cols-[minmax(265px,300px)_minmax(0,1fr)]',
          'overflow-hidden rounded-xl border border-line-strong bg-surface shadow-card',
          'max-xl:grid-cols-[minmax(240px,270px)_minmax(0,1fr)]',
          'max-[700px]:h-[calc(100dvh-8.5rem)] max-[700px]:min-h-150 max-[700px]:grid-cols-1'
        )}
      >
        <section
          aria-label="Danh sách hội thoại"
          className={cx(
            'flex min-h-0 min-w-0 flex-col border-r border-line-strong bg-[#fcfdff]',
            'max-[700px]:border-r-0',
            mobileConversation && 'max-[700px]:hidden'
          )}
        >
          <div className="px-4 pt-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-lead font-bold">Hội thoại</h2>
                <span className="text-caption text-ink-subtle">{unreadCount} tin chưa đọc</span>
              </div>
              <IconButton
                icon="compose"
                label="Soạn tin mới"
                bordered
                className="border-[#b8cce1] bg-primary-soft text-primary hover:bg-blue-100"
                onClick={() => setNewConversation(true)}
              />
            </div>
            <SearchField
              label="Tìm hội thoại"
              placeholder={workspaceRole === 'admin' ? 'Tìm tên…' : 'Tìm tên, mã hồ sơ…'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {workspaceRole !== 'admin' && (
              <div
                className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1"
                role="group"
                aria-label="Lọc người trò chuyện"
              >
                {[['', 'Tất cả'], ...peerRoles].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={role === value}
                    className={cx(
                      'flex-1 rounded-md px-1 py-1.5 text-[11px] font-semibold',
                      'text-ink-muted transition-colors',
                      role === value && 'bg-white text-primary shadow-sm'
                    )}
                    onClick={() => setRole(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 py-4 text-caption text-ink-subtle">
              <span>{filtered.length} cuộc trò chuyện</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-ink-muted">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={unreadOnly}
                  onChange={(event) => setUnreadOnly(event.target.checked)}
                />
                Chưa đọc
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loading && !filtered.length && (
              <p role="status" className="px-4 py-8 text-center text-caption text-ink-subtle">
                Đang tải hội thoại…
              </p>
            )}
            {filtered.map((thread) => {
              const peer = visibleContacts.find((entry) => entry.id === thread.contactId)
              const last = thread.messages.at(-1) || thread.lastMessage
              const isActive = messageState.activeId === thread.id
              return (
                <button
                  type="button"
                  key={thread.id}
                  aria-current={isActive ? 'true' : undefined}
                  className={cx(
                    'relative mb-1 flex w-full items-start gap-2.5 rounded-lg',
                    'px-2.5 py-3.5 text-left',
                    'transition-colors hover:bg-slate-100',
                    !isActive && thread.unread && 'bg-primary-soft',
                    thread.unread && 'font-semibold'
                  )}
                  onClick={() => openThread(thread.id)}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary"
                    />
                  )}
                  <Avatar contact={peer} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-1.5">
                      <strong className="min-w-0 truncate text-small">{contactName(peer)}</strong>
                      <time
                        className="shrink-0 text-[10px] text-ink-subtle"
                        dateTime={last?.createdAt || thread.createdAt}
                      >
                        {previewTime(last?.createdAt || thread.createdAt)}
                      </time>
                    </span>
                    {thread.processing && (
                      <small className="mt-1 block truncate text-[10px] font-medium text-primary">
                        Đang xử lý bởi{' '}
                        {thread.processing.ownedByMe
                          ? 'bạn'
                          : capitalizeFirst(thread.processing.moderator.username || 'Moderator')}
                      </small>
                    )}
                    <span className="mt-1.5 flex items-center gap-1.5">
                      {thread.priority && <Icon name="flag" size={12} />}
                    </span>
                    <span
                      className={cx(
                        'mt-1.5 block truncate text-caption text-ink-muted',
                        thread.unread && 'font-semibold text-ink-secondary'
                      )}
                    >
                      {last
                        ? last.image && !last.text
                          ? `${last.sender === 'staff' ? `${last.senderName || 'Moderator'}: ` : ''}Đã gửi một ảnh`
                          : `${last.sender === 'staff' ? `${last.senderName || 'Moderator'}: ` : ''}${last.text}`
                        : 'Bắt đầu cuộc trò chuyện'}
                    </span>
                  </span>
                  {thread.unread > 0 && (
                    <span
                      className="absolute left-1 top-1/2 grid min-w-4 -translate-y-1/2
                        place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white"
                    >
                      {thread.unread}
                    </span>
                  )}
                </button>
              )
            })}
            {!loading && !filtered.length && (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-ink-subtle">
                <Icon name="chat" size={30} />
                <strong className="text-small text-ink-secondary">
                  Không có hội thoại phù hợp
                </strong>
                <p className="text-caption leading-relaxed">
                  Thử đổi bộ lọc hoặc bắt đầu một cuộc trò chuyện mới.
                </p>
                <button
                  type="button"
                  className="cursor-pointer text-caption font-semibold text-primary hover:underline"
                  onClick={() => {
                    setRole(workspaceRole === 'admin' ? 'moderator' : '')
                    setQuery('')
                    setUnreadOnly(false)
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        </section>

        {active && contact ? (
          <section
            aria-label={`Trò chuyện với ${contactName(contact)}`}
            className={cx(
              'flex min-w-0 min-h-0 flex-col bg-white',
              contact.role !== 'user' && 'bg-[#fffefe]',
              mobileConversation ? 'max-[700px]:flex' : 'max-[700px]:hidden'
            )}
          >
            <header
              className="flex items-center gap-3 border-b border-line-strong px-5 py-4
                max-xl:px-4 max-sm:px-3"
            >
              <IconButton
                icon="back"
                label="Về danh sách hội thoại"
                className="hidden max-[700px]:inline-flex"
                onClick={leaveConversation}
              />
              <Avatar contact={contact} />
              <div className="min-w-0 flex-1">
                <strong className="block min-w-0 truncate text-lead font-semibold text-ink">
                  {contactName(contact)}
                </strong>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton
                  icon="flag"
                  label={active.priority ? 'Bỏ ưu tiên' : 'Đánh dấu ưu tiên'}
                  className={active.priority ? 'bg-warning-soft text-warning' : ''}
                  aria-pressed={active.priority}
                  onClick={togglePriority}
                />
                <IconButton
                  icon="info"
                  label="Thông tin hội thoại"
                  className={showInfo ? 'bg-primary-soft text-primary' : ''}
                  aria-expanded={showInfo}
                  aria-controls="message-contact-info"
                  onClick={() => setShowInfo((value) => !value)}
                />
              </div>
            </header>

            {requiresReplyLock && !canReply && (
              <p
                role="status"
                className="border-b border-line-subtle px-5 py-2.5 text-caption font-medium text-warning max-sm:px-3"
              >
                {lockIsBusy
                  ? `Bạn không thể gửi tin nhắn vì ${lockHolderLabel} đang xử lý hội thoại này`
                  : replyLock.status === 'checking'
                    ? 'Đang xác nhận quyền phản hồi hội thoại…'
                    : 'Chưa xác nhận được quyền phản hồi. Vui lòng thử lại.'}
              </p>
            )}

            {showInfo && (
              <div
                id="message-contact-info"
                className="grid grid-cols-[1.2fr_1fr] gap-4 border-b border-line-subtle
                  bg-surface-muted px-5 py-3.5 max-sm:grid-cols-1 max-sm:gap-3 max-sm:px-3"
              >
                <div>
                  <span className="block text-caption text-ink-subtle">Liên hệ</span>
                  <strong
                    className={cx(
                      'mt-1 block break-all text-small font-medium',
                      'text-ink-secondary'
                    )}
                  >
                    {contact.email}
                  </strong>
                  <small className="mt-1 block text-caption text-ink-subtle">
                    {contact.description}
                  </small>
                </div>
                <div>
                  <span className="block text-caption text-ink-subtle">Cuộc trò chuyện</span>
                  <small className="mt-1 block text-caption text-ink-subtle">
                    Bắt đầu {dayLabel(active.createdAt)}
                  </small>
                </div>
              </div>
            )}

            <div
              ref={scrollRef}
              className="min-h-25 flex-1 overflow-y-auto overscroll-contain px-6 py-3 pb-5
                max-xl:px-4 max-sm:px-3"
            >
              {active.messages.map((message, index) => {
                const outgoing = message.sender === 'me' || message.sender === 'staff'
                return (
                  <Fragment key={message.id}>
                    {(index === 0 ||
                      dateKey(active.messages[index - 1].createdAt) !==
                        dateKey(message.createdAt)) && (
                      <div
                        className="my-3 flex items-center gap-3 text-[10px] text-ink-subtle
                        before:h-px before:flex-1 before:bg-line-subtle after:h-px
                        after:flex-1 after:bg-line-subtle"
                      >
                        <span>{dayLabel(message.createdAt)}</span>
                      </div>
                    )}
                    <article
                      className={cx(
                        'mb-5 flex items-start gap-2.5',
                        outgoing && 'flex-row-reverse'
                      )}
                    >
                      {message.sender === 'me' ? (
                        <Avatar small moderator label={user?.username || workspaceRole} />
                      ) : message.sender === 'staff' ? (
                        <Avatar
                          contact={{
                            role: 'moderator',
                            avatarUrl: message.senderAvatarUrl,
                            initials: message.senderName,
                          }}
                          small
                        />
                      ) : (
                        <Avatar contact={contact} small />
                      )}
                      <div
                        className={cx(
                          'min-w-0 max-w-[min(76%,560px)]',
                          outgoing && 'flex flex-col items-end'
                        )}
                      >
                        <div
                          className={cx(
                            'mb-1.5 mt-0.5 flex flex-wrap items-center gap-2',
                            outgoing && 'justify-end'
                          )}
                        >
                          {message.sender === 'staff' && message.senderName && (
                            <small className="text-caption font-medium text-ink-muted">
                              {message.senderName}
                            </small>
                          )}
                          <time
                            className="text-caption text-ink-muted"
                            dateTime={message.createdAt}
                          >
                            {timeLabel(message.createdAt)}
                          </time>
                        </div>
                        <div
                          className={cx(
                            'whitespace-pre-wrap break-words rounded-lg border px-3 py-2.5',
                            'text-body leading-relaxed',
                            outgoing
                              ? 'rounded-tr-none border-[#a9c3df] border-r-2 border-r-[#709cca]' +
                                  ' bg-[#e5effb] text-[#20486f]'
                              : contact.role !== 'user'
                                ? 'rounded-tl-none border-[#d0c2e3] bg-[#f3eef9] text-[#55426f]'
                                : 'rounded-tl-none border-[#ccd8e5] bg-[#f1f5fa] text-ink'
                          )}
                        >
                          {message.image && (
                            <button
                              type="button"
                              aria-label="Xem ảnh tin nhắn"
                              className="mb-2 block overflow-hidden rounded-md"
                              onClick={() => setImagePreview(message.image)}
                            >
                              <img
                                src={message.image}
                                alt="Ảnh đính kèm trong tin nhắn"
                                className="max-h-64 max-w-full object-contain"
                              />
                            </button>
                          )}
                          {message.text && <p>{message.text}</p>}
                        </div>
                      </div>
                    </article>
                  </Fragment>
                )
              })}
              {!active.messages.length && (
                <div
                  className="flex h-full min-h-50 flex-col items-center justify-center gap-3
                    px-5 text-center text-ink-subtle"
                >
                  <Avatar contact={contact} />
                  <h3 className="text-lead font-semibold text-ink-secondary">Bắt đầu trao đổi</h3>
                  <p className="max-w-75 text-small leading-relaxed">
                    {contact.role !== 'user'
                      ? 'Thảo luận nghiệp vụ hoặc đề nghị hỗ trợ xử lý hồ sơ.'
                      : 'Gửi lời chào và cho người dùng biết bạn có thể hỗ trợ gì.'}
                  </p>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-line-strong px-5 pb-3 max-xl:px-4 max-sm:px-3">
              <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-caption font-semibold
                    text-ink-muted hover:text-primary"
                  aria-expanded={showReplies}
                  disabled={!canCompose}
                  onClick={() => setShowReplies((value) => !value)}
                >
                  <Icon name="reply" size={15} />
                  Trả lời nhanh
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-caption font-semibold
                    text-ink-muted hover:text-primary disabled:cursor-not-allowed
                    disabled:opacity-50"
                  disabled={active.unread > 0}
                  onClick={markUnread}
                >
                  <Icon name="mail" size={15} />
                  {active.unread > 0 ? 'Đã đánh dấu chưa đọc' : 'Đánh dấu chưa đọc'}
                </button>
              </div>

              {showReplies && canCompose && (
                <div
                  className="mb-2.5 max-h-35 overflow-y-auto rounded-lg border border-line
                    bg-surface-muted p-1.5"
                  id="quick-replies"
                >
                  {(quickReplies[contact.role === 'user' ? 'user' : 'internal'] || []).map(
                    (reply) => (
                      <button
                        type="button"
                        key={reply.id}
                        className="flex w-full items-center justify-between gap-3 rounded-md p-2
                          text-left text-caption leading-relaxed text-ink-muted hover:bg-primary-soft
                          hover:text-primary"
                        onClick={() => insertReply(reply.text)}
                      >
                        {reply.text}
                        <Icon name="next" size={13} />
                      </button>
                    )
                  )}
                </div>
              )}

              <form
                className="rounded-lg border border-[#91aac4] p-2.5 transition-shadow
                  focus-within:border-primary focus-within:shadow-[0_0_0_2px_#e0ebf8]"
                onSubmit={send}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Chọn ảnh đính kèm"
                  onChange={(event) => chooseImage(event.target.files?.[0])}
                />
                <label className="sr-only" htmlFor="message-draft">
                  Tin nhắn cho {contactName(contact)}
                </label>
                <textarea
                  id="message-draft"
                  ref={composeRef}
                  rows={3}
                  wrap="soft"
                  maxLength={MESSAGE_LIMIT}
                  value={draft}
                  disabled={!canCompose}
                  onChange={(event) => updateDraft(event.target.value)}
                  placeholder="Viết tin nhắn"
                  className="block max-h-35 min-h-14 w-full resize-none break-words bg-transparent text-small
                    leading-relaxed text-ink outline-none placeholder:text-ink-subtle"
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      event.preventDefault()
                      send(event)
                    }
                  }}
                />
                {selectedImage && (
                  <div className="mb-2 flex items-center gap-2 rounded-md bg-surface-muted px-2.5 py-2 text-caption">
                    <Icon name="image" size={15} />
                    <span className="min-w-0 flex-1 truncate">{selectedImage.name}</span>
                    <button
                      type="button"
                      className="text-ink-muted hover:text-danger"
                      aria-label="Bỏ ảnh đính kèm"
                      onClick={() => {
                        setSelectedImage(null)
                        if (imageInputRef.current) imageInputRef.current.value = ''
                      }}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2.5 pt-2">
                  <span className="min-w-0 flex-1 text-[10px] text-ink-subtle max-xl:hidden">
                    Enter để gửi · Shift + Enter xuống dòng
                  </span>
                  <small className="text-[10px] text-ink-subtle">
                    {draft.length}/{MESSAGE_LIMIT}
                  </small>
                  <IconButton
                    icon="image"
                    label="Đính kèm ảnh"
                    disabled={sending || !canCompose}
                    onClick={() => imageInputRef.current?.click()}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={(!draft.trim() && !selectedImage) || sending || !canReply}
                  >
                    <Icon name="send" size={16} />
                    {sending ? 'Đang gửi…' : 'Gửi'}
                  </Button>
                </div>
              </form>
              <span role="status" className="sr-only">
                {announcement}
              </span>
            </div>
          </section>
        ) : (
          <div
            className="flex min-h-0 flex-col items-center justify-center gap-3 text-center
              text-ink-subtle max-[700px]:hidden"
          >
            <Icon name="chat" size={40} />
            <h3 className="text-title font-semibold text-ink-secondary">
              Chọn một hội thoại để bắt đầu
            </h3>
          </div>
        )}
      </div>

      {newConversation && (
        <NewConversation
          peerRoles={peerRoles}
          onSelect={startThread}
          onSearch={searchContacts}
          onClose={() => setNewConversation(false)}
        />
      )}
      {imagePreview && (
        <Dialog title="Ảnh trong tin nhắn" onClose={() => setImagePreview(null)} size="lg">
          <img
            src={imagePreview}
            alt="Ảnh đính kèm trong tin nhắn"
            className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain"
          />
        </Dialog>
      )}
    </div>
  )
}
