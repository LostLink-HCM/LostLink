import { Fragment, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import Badge from '../../components/moderator/Badge'
import Button from '../../components/moderator/Button'
import Dialog from '../../components/moderator/Dialog'
import IconButton from '../../components/moderator/IconButton'
import { cx } from '../../components/moderator/classes'
import {
  MESSAGE_LIMIT,
  filterModeratorThreads,
  markModeratorThreadUnread,
  moderatorContactName,
  openModeratorThread,
  sendModeratorMessage,
  startModeratorThread,
} from '../../lib/moderatorMessages'

const QUICK_REPLIES = {
  user: [
    'Chào bạn, mình đã tiếp nhận yêu cầu và đang kiểm tra thông tin.',
    'Bạn có thể bổ sung thời gian, địa điểm và các thông tin liên quan giúp mình không?',
    'Cảm ơn bạn đã phối hợp. Nếu cần hỗ trợ thêm, bạn cứ nhắn tại đây nhé.',
  ],
  internal: [
    'Mình đã tiếp nhận thông tin và sẽ kiểm tra lại hồ sơ.',
    'Nhờ bạn hỗ trợ xem xét trường hợp này. Mình sẽ bổ sung thông tin liên quan.',
  ],
}

const avatarColors = {
  blue: 'bg-[#dfeafa] text-[#35679e]',
  purple: 'bg-[#ede8fa] text-[#7553ae]',
  amber: 'bg-[#fff0d8] text-[#9c702d]',
  green: 'bg-[#ddf0e7] text-[#397b62]',
  rose: 'bg-[#f7e5ec] text-[#a45a77]',
}

const dateKey = (value) => new Date(value).toLocaleDateString('vi-VN')
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
        'inline-flex shrink-0 items-center justify-center rounded-[10px] text-caption font-bold',
        small ? 'size-7.5 rounded-lg text-[10px]' : 'size-10',
        moderator
          ? 'bg-primary text-white'
          : avatarColors[contact?.color] || 'bg-primary-soft text-primary'
      )}
    >
      {initials}
    </span>
  )
}

function RoleBadge({ role }) {
  return (
    <Badge
      className={cx(
        'rounded px-1.5 py-0.5 text-[10px]',
        role === 'admin' ? 'bg-info-soft text-info' : 'bg-neutral-soft text-neutral'
      )}
    >
      {role === 'admin' ? 'Admin' : role === 'moderator' ? 'Moderator' : 'Người dùng'}
    </Badge>
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

function NewConversation({ contacts, peerRoles, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState(peerRoles[0]?.[0] || 'user')
  const filtered = contacts.filter(
    (contact) =>
      contact.role === role &&
      `${moderatorContactName(contact)} ${contact.email}`
        .toLocaleLowerCase('vi')
        .includes(query.trim().toLocaleLowerCase('vi'))
  )

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
        {filtered.map((contact) => (
          <button
            type="button"
            key={contact.id}
            className="flex w-full items-center gap-3 rounded-lg p-3 text-left
              transition-colors hover:bg-surface-muted"
            onClick={() => onSelect(contact.id)}
          >
            <Avatar contact={contact} />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-small">{moderatorContactName(contact)}</strong>
              <small className="mt-1 block break-all text-caption text-ink-subtle">
                {contact.email}
              </small>
            </span>
            <Icon name="next" size={16} />
          </button>
        ))}
        {!filtered.length && (
          <p className="px-2 py-6 text-center text-small text-ink-subtle">
            Không tìm thấy người nhận phù hợp.
          </p>
        )}
      </div>
    </Dialog>
  )
}

export default function Messages() {
  const { messageState, setMessageState } = useOutletContext()
  const { user } = useAuth()
  const workspaceRole = user?.role === 'admin' ? 'admin' : 'moderator'
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
  const scrollRef = useRef(null)
  const composeRef = useRef(null)

  const visibleContacts = messageState.contacts.filter((contact) =>
    allowedRoles.includes(contact.role)
  )
  const visibleContactIds = new Set(visibleContacts.map((contact) => contact.id))
  const visibleThreads = messageState.threads.filter((thread) =>
    visibleContactIds.has(thread.contactId)
  )
  const visibleState = { ...messageState, threads: visibleThreads, contacts: visibleContacts }
  const filtered = filterModeratorThreads(visibleState, { role, query, unreadOnly })
  const active = visibleThreads.find((thread) => thread.id === messageState.activeId)
  const contact = active && visibleContacts.find((entry) => entry.id === active.contactId)
  const draft = messageState.drafts[active?.id] || ''
  const unreadCount = visibleThreads.reduce((count, thread) => count + thread.unread, 0)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [active?.id, active?.messages.length, mobileConversation])

  const openThread = (id) => {
    setMessageState((previous) => openModeratorThread(previous, id))
    setShowReplies(false)
    setShowInfo(false)
    setMobileConversation(true)
    setAnnouncement('')
  }

  const startThread = (contactId) => {
    setMessageState((previous) => startModeratorThread(previous, contactId))
    setNewConversation(false)
    setRole(workspaceRole === 'admin' ? 'moderator' : '')
    setQuery('')
    setUnreadOnly(false)
    setShowInfo(false)
    setShowReplies(false)
    setMobileConversation(true)
  }

  const updateDraft = (text) => {
    if (!active) return
    setMessageState((previous) => ({
      ...previous,
      drafts: { ...previous.drafts, [active.id]: text },
    }))
  }

  const send = (event) => {
    event.preventDefault()
    if (!active || !contact || !draft.trim() || draft.trim().length > MESSAGE_LIMIT) return
    setMessageState((previous) => sendModeratorMessage(previous, active.id))
    setAnnouncement(`Đã lưu tin nhắn gửi tới ${moderatorContactName(contact)} trong phiên xem thử.`)
    setShowReplies(false)
    composeRef.current?.focus()
  }

  const toggleThread = (field) => {
    if (!active) return
    setMessageState((previous) => ({
      ...previous,
      threads: previous.threads.map((thread) =>
        thread.id === active.id ? { ...thread, [field]: !thread[field] } : thread
      ),
    }))
  }

  const markUnread = () => {
    if (!active || !contact) return
    setMessageState((previous) => markModeratorThreadUnread(previous, active.id))
    setAnnouncement(`Đã đánh dấu hội thoại với ${moderatorContactName(contact)} là chưa đọc.`)
    setMobileConversation(false)
  }

  const insertReply = (text) => {
    updateDraft(`${draft}${draft.trim() ? '\n' : ''}${text}`.slice(0, MESSAGE_LIMIT))
    setShowReplies(false)
    composeRef.current?.focus()
  }

  return (
    <div className="px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-3 max-sm:py-4">
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
              placeholder={
                workspaceRole === 'admin' ? 'Tìm tên hoặc nội dung…' : 'Tìm tên, mã hồ sơ…'
              }
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
            {filtered.map((thread) => {
              const peer = visibleContacts.find((entry) => entry.id === thread.contactId)
              const last = thread.messages.at(-1)
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
                      <strong className="min-w-0 truncate text-small">
                        {moderatorContactName(peer)}
                      </strong>
                      <time
                        className="shrink-0 text-[10px] text-ink-subtle"
                        dateTime={last?.createdAt || thread.createdAt}
                      >
                        {previewTime(last?.createdAt || thread.createdAt)}
                      </time>
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5">
                      <RoleBadge role={peer.role} />
                      {thread.priority && <Icon name="flag" size={12} />}
                      {thread.resolved && (
                        <span className="text-[10px] font-medium text-success">Đã xử lý</span>
                      )}
                    </span>
                    <span
                      className={cx(
                        'mt-1.5 block truncate text-caption text-ink-muted',
                        thread.unread && 'font-semibold text-ink-secondary'
                      )}
                    >
                      {messageState.drafts[thread.id]
                        ? `Bản nháp: ${messageState.drafts[thread.id]}`
                        : last
                          ? last.text
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
            {!filtered.length && (
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
            aria-label={`Trò chuyện với ${moderatorContactName(contact)}`}
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
                onClick={() => setMobileConversation(false)}
              />
              <Avatar contact={contact} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge role={contact.role} />
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton
                  icon="flag"
                  label={active.priority ? 'Bỏ ưu tiên' : 'Đánh dấu ưu tiên'}
                  className={active.priority ? 'bg-warning-soft text-warning' : ''}
                  aria-pressed={active.priority}
                  onClick={() => toggleThread('priority')}
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
                  <strong className="mt-1 block text-small font-medium text-ink-secondary">
                    {active.resolved ? 'Đã xử lý' : 'Đang trao đổi'}
                  </strong>
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
              {active.messages.map((message, index) => (
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
                      message.sender === 'me' && 'flex-row-reverse'
                    )}
                  >
                    {message.sender === 'me' ? (
                      <Avatar small moderator label={user?.username || workspaceRole} />
                    ) : (
                      <Avatar contact={contact} small />
                    )}
                    <div
                      className={cx(
                        'min-w-0 max-w-[min(76%,560px)]',
                        message.sender === 'me' && 'flex flex-col items-end'
                      )}
                    >
                      <div
                        className={cx(
                          'mb-1.5 mt-0.5 flex flex-wrap items-center gap-2',
                          message.sender === 'me' && 'justify-end'
                        )}
                      >
                        <time className="text-caption text-ink-muted" dateTime={message.createdAt}>
                          {timeLabel(message.createdAt)}
                        </time>
                      </div>
                      <p
                        className={cx(
                          'whitespace-pre-wrap break-words rounded-lg border px-3 py-2.5',
                          'text-body leading-relaxed',
                          message.sender === 'me'
                            ? 'rounded-tr-none border-[#a9c3df] border-r-2 border-r-[#709cca]' +
                                ' bg-[#e5effb] text-[#20486f]'
                            : contact.role !== 'user'
                              ? 'rounded-tl-none border-[#d0c2e3] bg-[#f3eef9] text-[#55426f]'
                              : 'rounded-tl-none border-[#ccd8e5] bg-[#f1f5fa] text-ink'
                        )}
                      >
                        {message.text}
                      </p>
                    </div>
                  </article>
                </Fragment>
              ))}
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
                <button
                  type="button"
                  className={cx(
                    'inline-flex items-center gap-1.5 text-caption font-semibold',
                    'text-ink-muted hover:text-success',
                    active.resolved && 'text-success'
                  )}
                  onClick={() => toggleThread('resolved')}
                >
                  <Icon name={active.resolved ? 'reset' : 'check'} size={15} />
                  {active.resolved ? 'Mở lại hội thoại' : 'Đánh dấu đã xử lý'}
                </button>
              </div>

              {showReplies && (
                <div
                  className="mb-2.5 max-h-35 overflow-y-auto rounded-lg border border-line
                    bg-surface-muted p-1.5"
                  id="quick-replies"
                >
                  {QUICK_REPLIES[contact.role === 'user' ? 'user' : 'internal'].map((reply) => (
                    <button
                      type="button"
                      key={reply}
                      className="flex w-full items-center justify-between gap-3 rounded-md p-2
                        text-left text-caption leading-relaxed text-ink-muted hover:bg-primary-soft
                        hover:text-primary"
                      onClick={() => insertReply(reply)}
                    >
                      {reply}
                      <Icon name="next" size={13} />
                    </button>
                  ))}
                </div>
              )}

              <form
                className="rounded-lg border border-[#91aac4] p-2.5 transition-shadow
                  focus-within:border-primary focus-within:shadow-[0_0_0_2px_#e0ebf8]"
                onSubmit={send}
              >
                <label className="sr-only" htmlFor="message-draft">
                  Tin nhắn cho {moderatorContactName(contact)}
                </label>
                <textarea
                  id="message-draft"
                  ref={composeRef}
                  rows={3}
                  maxLength={MESSAGE_LIMIT}
                  value={draft}
                  onChange={(event) => updateDraft(event.target.value)}
                  placeholder="Viết tin nhắn"
                  className="block max-h-35 min-h-14 w-full resize-none bg-transparent text-small
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
                <div className="flex items-center gap-2.5 pt-2">
                  <span className="min-w-0 flex-1 text-[10px] text-ink-subtle max-xl:hidden">
                    Enter để gửi · Shift + Enter xuống dòng
                  </span>
                  <small className="text-[10px] text-ink-subtle">
                    {draft.length}/{MESSAGE_LIMIT}
                  </small>
                  <Button type="submit" variant="primary" size="sm" disabled={!draft.trim()}>
                    <Icon name="send" size={16} />
                    Gửi
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
          contacts={visibleContacts}
          peerRoles={peerRoles}
          onSelect={startThread}
          onClose={() => setNewConversation(false)}
        />
      )}
    </div>
  )
}
