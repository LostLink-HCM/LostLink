import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import Icon from '../../components/common/Icon'
import Button from '../../components/user/Button'
import Dialog from '../../components/user/Dialog'
import IconButton from '../../components/user/IconButton'
import Avatar from '../../components/user/Avatar'
import { cardClass } from '../../components/user/Card'
import { cx } from '../../components/user/classes'
import AttachedPost from '../../components/user/messages/AttachedPost'
import Composer from '../../components/user/messages/Composer'
import ThreadList from '../../components/user/messages/ThreadList'
import TradePanel from '../../components/user/messages/TradePanel'
import { checkImages } from '../../lib/composePost'
import {
  acceptRequest,
  closedBy,
  confirmReturn,
  dayLabel,
  declineRequest,
  filterThreads,
  isClosedByMe,
  isSameDay,
  openThread,
  sendMessage,
  threadNotes,
  timeLabel,
  validateMessage,
} from '../../lib/userMessages'
import { profilePath } from '../../lib/userProfiles'

const STATUS_LINES = {
  open: ['Kênh trò chuyện đã mở', 'text-primary', 'bg-primary'],
  request: ['Chưa kết nối · yêu cầu trò chuyện', 'text-warning', 'bg-warning'],
  pending: ['Đang chờ duyệt', 'text-warning', 'bg-warning'],
  incoming: ['Đang chờ duyệt', 'text-warning', 'bg-warning'],
  returned: ['Đã trao trả', 'text-success', 'bg-success'],
  declined: ['Hội thoại đã đóng', 'text-ink-muted', 'bg-ink-subtle'],
}

const statusLine = (thread) => {
  const closer = closedBy(thread)
  if (!closer) return STATUS_LINES[thread.status]
  const who = closer === 'me' ? 'Bạn' : thread.peer.name
  return [`${who} đã đóng hội thoại`, 'text-ink-muted', 'bg-ink-subtle']
}

function SystemNote({ children, tone = 'primary' }) {
  return (
    <p
      className={cx(
        'm-0 self-center rounded-full px-3.5 py-1.5 text-center text-tiny font-medium',
        tone === 'primary' ? 'bg-primary-soft text-primary' : 'bg-line-subtle text-ink-muted'
      )}
    >
      {children}
    </p>
  )
}

function Bubble({ message, label }) {
  const mine = message.sender === 'me'
  return (
    <div
      className={cx(
        'flex max-w-[78%] flex-col',
        mine ? 'items-end self-end' : 'items-start self-start'
      )}
    >
      {label && <span className="mb-1 px-1 text-tiny font-semibold text-warning">{label}</span>}
      {message.image ? (
        <img
          src={message.image}
          alt="Ảnh đã gửi"
          className="max-h-64 max-w-full rounded-2xl border border-line object-cover"
        />
      ) : (
        <p
          className={cx(
            'm-0 rounded-2xl px-4 py-2.5 text-small leading-relaxed break-words whitespace-pre-wrap',
            mine ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-line-subtle text-ink'
          )}
        >
          {message.text}
        </p>
      )}
      <time dateTime={message.createdAt} className="mt-1 px-1 text-micro text-ink-subtle">
        {timeLabel(message.createdAt)}
      </time>
    </div>
  )
}

// Tin nhắn và ghi chú hệ thống xếp chung theo thời gian, cùng thời điểm thì tin nhắn đứng trước
const timeline = (thread) =>
  [
    ...thread.messages.map((message) => ({ at: message.createdAt, message })),
    ...threadNotes(thread).map((note) => ({ at: note.at, note })),
  ].sort((left, right) => Date.parse(left.at) - Date.parse(right.at))

function Conversation({ thread, now }) {
  const items = timeline(thread)

  return (
    <>
      {thread.status === 'request' && (
        <div className="max-w-115 self-center rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-center">
          <p className="m-0 mb-1 text-small font-bold text-warning">Yêu cầu trò chuyện</p>
          <p className="m-0 text-caption leading-relaxed text-ink-secondary">
            Bạn được gửi <strong>một tin nhắn giới thiệu</strong> duy nhất. Khi {thread.peer.name}{' '}
            đồng ý, kênh trò chuyện mới mở hẳn.
          </p>
        </div>
      )}

      {items.map(({ at, message, note }, index) => {
        const newDay = index === 0 || !isSameDay(items[index - 1].at, at)
        return (
          <Fragment key={message ? message.id : `${note.at}-${note.text}`}>
            {newDay && (
              <div className="flex items-center gap-3 text-micro text-ink-subtle before:h-px before:flex-1 before:bg-line-subtle after:h-px after:flex-1 after:bg-line-subtle">
                {dayLabel(at, now)}
              </div>
            )}
            {note ? (
              <SystemNote tone={note.tone}>{note.text}</SystemNote>
            ) : (
              <Bubble
                message={message}
                label={
                  message === thread.messages[0] && ['incoming', 'pending'].includes(thread.status)
                    ? 'Tin nhắn giới thiệu'
                    : ''
                }
              />
            )}
          </Fragment>
        )
      })}

      {thread.status === 'pending' && (
        <SystemNote tone="muted">Đã hết lượt nhắn, chờ {thread.peer.name} phản hồi</SystemNote>
      )}
      {thread.status === 'returned' && <SystemNote>Cả hai đã xác nhận trao trả</SystemNote>}
      {thread.status === 'declined' && (
        <SystemNote tone="muted">Yêu cầu trò chuyện đã bị từ chối</SystemNote>
      )}
    </>
  )
}

export default function MessagesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { posts, now, chat, setChat, setPostStatus, notify, reviews } = useOutletContext()
  const { closeConversation, reopenConversation, blockedUsers } = useOutletContext()
  const [query, setQuery] = useState('')
  // Vào từ bài đăng thì mobile mở thẳng hội thoại
  const [mobileConversation, setMobileConversation] = useState(
    Boolean(location.state?.openConversation)
  )
  const [showInfo, setShowInfo] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const active = chat.threads.find((thread) => thread.id === chat.activeId)
  // Hội thoại mình đã đóng tách sang mục Đã đóng
  const [folder, setFolder] = useState(active && isClosedByMe(active) ? 'closed' : 'open')
  const threads = useMemo(
    () =>
      filterThreads(chat.threads, query).filter(
        (thread) => isClosedByMe(thread) === (folder === 'closed')
      ),
    [chat.threads, query, folder]
  )
  const closedUnread = chat.threads.reduce(
    (count, thread) => count + (isClosedByMe(thread) ? thread.unread : 0),
    0
  )
  const draft = chat.drafts[active?.id] || ''
  const status = active && statusLine(active)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [active?.id, active?.messages.length, active?.status, mobileConversation])

  const select = (id) => {
    setChat((prev) => openThread(prev, id))
    setMobileConversation(true)
    setShowInfo(false)
    setError('')
  }

  const updateDraft = (text) => {
    setError('')
    setChat((prev) => ({ ...prev, drafts: { ...prev.drafts, [active.id]: text } }))
  }

  const send = () => {
    const intro = active.status === 'request'
    const problem = validateMessage(draft, { intro })
    if (problem) {
      setError(problem)
      return
    }
    setChat((prev) => sendMessage(prev, active.id, { text: draft }))
    if (intro) notify(`Đã gửi lời giới thiệu, chờ ${active.peer.name} đồng ý.`)
    inputRef.current?.focus()
  }

  const sendImage = (file) => {
    const { accepted, errors } = checkImages([file], 0)
    if (!accepted.length) {
      setError(errors[0])
      return
    }
    setError('')
    setChat((prev) => sendMessage(prev, active.id, { image: URL.createObjectURL(file) }))
  }

  const updatePost = (nextStatus) => {
    if (active.post.id != null) setPostStatus(active.post.id, nextStatus)
  }

  const accept = () => {
    setChat((prev) => acceptRequest(prev, active.id))
    updatePost('contacted')
    notify(`Đã mở kênh trò chuyện với ${active.peer.name}.`)
  }

  const decline = () => {
    setChat((prev) => declineRequest(prev, active.id))
    notify(`Đã từ chối yêu cầu của ${active.peer.name}.`)
  }

  const confirm = () => {
    setChat((prev) => confirmReturn(prev, active.id))
    setDialog(null)
    if (active.confirmed.peer) {
      updatePost('returned')
      // Cả hai đã xác nhận thì chuyển sang đánh giá và gửi lời cảm ơn
      navigate(`/messages/${active.id}/review`)
    } else {
      notify(`Đã ghi nhận, LostLink sẽ nhắc ${active.peer.name} xác nhận.`)
    }
  }

  const close = () => {
    closeConversation(active)
    setDialog(null)
    setFolder('closed')
    notify('Đã đóng hội thoại.')
  }

  const reopen = () => {
    const available = reopenConversation(active)
    setFolder('open')
    notify(
      available ? 'Đã mở lại hội thoại, bài đăng chuyển lại Đã liên hệ.' : 'Đã mở lại hội thoại.'
    )
  }

  const linkable = (post) => post.id != null && posts.some((item) => item.id === post.id)

  const tradePanel = active && (
    <TradePanel
      thread={active}
      onConfirm={() => setDialog('confirm')}
      reviewed={Boolean(reviews[active.id])}
      onReview={() => navigate(`/messages/${active.id}/review`)}
      onClose={() => setDialog('close')}
    />
  )

  return (
    <div className="mx-auto max-w-360 px-4 pt-5 pb-6 sm:px-6 lg:px-10">
      <div
        className={cx(
          'grid h-[calc(100dvh-7rem)] min-h-130 grid-cols-1 gap-4 lg:h-[calc(100dvh-7.5rem)]',
          'md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_300px]'
        )}
      >
        <section
          aria-label="Danh sách hội thoại"
          className={cx(
            cardClass,
            'flex min-h-0 flex-col overflow-hidden',
            mobileConversation && 'max-md:hidden'
          )}
        >
          <ThreadList
            threads={threads}
            activeId={chat.activeId}
            drafts={chat.drafts}
            query={query}
            onQueryChange={setQuery}
            folder={folder}
            onFolderChange={setFolder}
            closedUnread={closedUnread}
            onOpen={select}
            now={now}
          />
        </section>

        {active ? (
          <section
            aria-label={`Trò chuyện với ${active.peer.name}`}
            className={cx(
              cardClass,
              'flex min-h-0 flex-col overflow-hidden',
              !mobileConversation && 'max-md:hidden'
            )}
          >
            <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
              <IconButton
                icon="back"
                label="Về danh sách hội thoại"
                className="md:hidden"
                onClick={() => setMobileConversation(false)}
              />
              <span className="max-sm:hidden">
                <Avatar initials={active.peer.initials} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 truncate text-small font-semibold text-ink">
                  {active.peer.name}
                </h2>
                <p className={cx('m-0 flex items-center gap-1.5 text-tiny', status[1])}>
                  <span className={cx('size-1.5 shrink-0 rounded-full', status[2])} />
                  <span className="truncate">{status[0]}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton
                  icon="user"
                  label="Xem trang cá nhân"
                  onClick={() => navigate(profilePath(active.peer.name))}
                />
                <IconButton
                  icon="flag"
                  label={`Báo cáo ${active.peer.name}`}
                  tone="danger"
                  onClick={() => navigate(`/messages/${active.id}/report`)}
                />
                <IconButton
                  icon="info"
                  label="Trao trả và chỗ hẹn"
                  className={cx('xl:hidden', showInfo && 'bg-primary-soft text-primary')}
                  aria-expanded={showInfo}
                  aria-controls="chat-trade-panel"
                  onClick={() => setShowInfo((value) => !value)}
                />
              </div>
            </header>

            {showInfo && (
              <div
                id="chat-trade-panel"
                className="flex max-h-[55%] flex-col gap-3 overflow-y-auto border-b border-line bg-surface-muted p-3 xl:hidden"
              >
                {tradePanel}
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain bg-surface-muted/60 px-4 py-4 sm:px-6"
            >
              <AttachedPost post={active.post} linkable={linkable(active.post)} />
              <Conversation thread={active} now={now} />
            </div>

            <Composer
              thread={active}
              blocked={blockedUsers.has(active.peer.name)}
              draft={draft}
              error={error}
              inputRef={inputRef}
              onDraftChange={updateDraft}
              onSend={send}
              onPickImage={sendImage}
              onAccept={accept}
              onDecline={decline}
              onReopen={reopen}
            />
          </section>
        ) : (
          <div
            className={cx(
              cardClass,
              'flex flex-col items-center justify-center gap-3 text-center text-ink-subtle max-md:hidden'
            )}
          >
            <Icon name="chat" size={40} />
            <p className="m-0 text-lead font-semibold text-ink-secondary">
              Chọn một hội thoại để bắt đầu
            </p>
          </div>
        )}

        <aside
          aria-label="Trao trả và chỗ hẹn"
          className="hidden min-h-0 flex-col gap-3 overflow-y-auto xl:flex"
        >
          {tradePanel}
        </aside>
      </div>

      {dialog === 'confirm' && (
        <Dialog
          title="Xác nhận đã trao trả?"
          size="sm"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>Huỷ</Button>
              <Button variant="primary" data-autofocus onClick={confirm}>
                Xác nhận
              </Button>
            </>
          }
        >
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            Chỉ xác nhận khi món đồ đã thực sự được trao tận tay. Khi cả bạn và {active.peer.name}{' '}
            cùng xác nhận, bài đăng chuyển sang Đã trao trả và không hoàn tác được.
          </p>
        </Dialog>
      )}

      {dialog === 'close' && (
        <Dialog
          title="Đóng hội thoại?"
          size="sm"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>Quay lại trò chuyện</Button>
              <Button variant="danger" data-autofocus onClick={close}>
                Đóng hội thoại
              </Button>
            </>
          }
        >
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-small leading-relaxed text-ink-secondary">
            <li>{active.peer.name} vẫn nhắn được, bạn không nhận thông báo.</li>
            <li>Mở lại bất cứ lúc nào ở mục Đã đóng.</li>
          </ul>
        </Dialog>
      )}
    </div>
  )
}
