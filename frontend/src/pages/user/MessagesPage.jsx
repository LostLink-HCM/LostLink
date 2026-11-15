import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { acceptClaim, declineClaim, sendContactRequest } from '../../api/claims'
import {
  closeConversation,
  confirmReturn,
  getConversation,
  markConversationRead,
  openSupport,
  reopenConversation,
  sendMessage,
} from '../../api/conversations'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import Avatar from '../../components/user/Avatar'
import Button from '../../components/user/Button'
import Dialog from '../../components/user/Dialog'
import IconButton from '../../components/user/IconButton'
import { cardClass } from '../../components/user/Card'
import { cx } from '../../components/user/classes'
import AttachedPost from '../../components/user/messages/AttachedPost'
import Composer from '../../components/user/messages/Composer'
import ThreadList from '../../components/user/messages/ThreadList'
import TradePanel from '../../components/user/messages/TradePanel'
import { checkImages } from '../../lib/user/composePost'
import { postPath } from '../../lib/user/homeFeed'
import {
  appendMessage,
  dayLabel,
  filterThreads,
  isClosedByMe,
  isSameDay,
  threadNotes,
  timeLabel,
  toMessage,
  validateMessage,
} from '../../lib/user/messages'
import { onSocket } from '../../lib/socket'
import { profilePath } from '../../lib/user/profiles'

const STATUS_LINES = {
  open: ['Kênh trò chuyện đã mở', 'text-primary', 'bg-primary'],
  request: ['Chưa kết nối · yêu cầu trò chuyện', 'text-warning', 'bg-warning'],
  pending: ['Đang chờ đồng ý trò chuyện', 'text-warning', 'bg-warning'],
  incoming: ['Đang chờ bạn duyệt', 'text-warning', 'bg-warning'],
  returned: ['Đã trao trả', 'text-success', 'bg-success'],
  declined: ['Yêu cầu đã bị từ chối', 'text-ink-muted', 'bg-ink-subtle'],
  locked: ['Hội thoại đã khoá', 'text-ink-muted', 'bg-ink-subtle'],
}

const FAILED = 'Đã có lỗi xảy ra, vui lòng thử lại.'
const SEND_FAILED = 'Gửi tin nhắn thất bại, vui lòng thử lại.'

// Lỗi server (5xx, mất kết nối) dùng câu chung, lỗi nghiệp vụ hiện đúng thông báo của server
const errorText = (error, fallback = FAILED) =>
  error.status && error.status < 500
    ? (error.fieldErrors?.body ?? error.fieldErrors?.image ?? error.message)
    : fallback

const statusLine = (thread) => {
  if (thread.kind === 'support') return ['Hỗ trợ từ LostLink', 'text-primary', 'bg-primary']
  if (thread.closedBy) {
    const who = thread.closedBy === 'me' ? 'Bạn' : thread.peer.name
    return [`${who} đã đóng hội thoại`, 'text-ink-muted', 'bg-ink-subtle']
  }
  return STATUS_LINES[thread.status]
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
        <a href={message.image} target="_blank" rel="noopener noreferrer">
          <img
            src={message.image}
            alt="Ảnh đã gửi"
            className="max-h-64 max-w-full rounded-2xl border border-line object-cover"
          />
        </a>
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
const timeline = (thread, messages) =>
  [
    ...messages.map((message) => ({ at: message.createdAt, message })),
    ...threadNotes(thread).map((note) => ({ at: note.at, note })),
  ].sort((left, right) => Date.parse(left.at) - Date.parse(right.at))

function Conversation({ thread, messages, now }) {
  const items = timeline(thread, messages)
  const isIntro = (message) => thread.type === 'claim' && message === messages[0]

  return (
    <>
      {thread.status === 'request' && (
        <div className="max-w-115 self-center rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-center">
          <p className="m-0 mb-1 text-small font-bold text-warning">Yêu cầu trò chuyện</p>
          <p className="m-0 text-caption leading-relaxed text-ink-secondary">
            Bạn chỉ được gửi <strong>1 tin nhắn giới thiệu</strong>. Khi {thread.peer.name} đồng ý,
            kênh trò chuyện mới mở hẳn.
          </p>
        </div>
      )}
      {thread.kind === 'support' && messages.length === 0 && (
        <SystemNote>Hãy mô tả vấn đề bạn gặp, LostLink sẽ phản hồi sớm nhất có thể.</SystemNote>
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
              <Bubble message={message} label={isIntro(message) ? 'Tin nhắn giới thiệu' : ''} />
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

// Tin nhắn của hội thoại đang mở: tải khi chọn, nhận tin mới qua socket
function useConversationDetail(thread, me, putConversation) {
  const conversationId = thread?.type === 'conversation' ? thread.id : null
  const [detail, setDetail] = useState({ id: null, messages: [], hasMore: false, error: null })

  useEffect(() => {
    if (!conversationId) return undefined
    let active = true
    const load = () =>
      getConversation(conversationId)
        .then(({ data }) => {
          if (!active) return
          putConversation(data)
          setDetail({
            id: data.id,
            messages: data.messages.map((message) => toMessage(message, me)),
            hasMore: data.hasMore,
            error: null,
          })
        })
        .catch(
          (error) =>
            active && setDetail({ id: conversationId, messages: [], hasMore: false, error })
        )
    load()
    const off = [
      onSocket('message:new', (message) => {
        if (message.conversationId !== conversationId) return
        setDetail((prev) => ({
          ...prev,
          messages: appendMessage(prev.messages, toMessage(message, me)),
        }))
        if (message.sender !== me) markConversationRead(conversationId).catch(() => {})
      }),
      onSocket('conversation:updated', ({ conversationId: id }) => id === conversationId && load()),
    ]
    return () => {
      active = false
      off.forEach((unsubscribe) => unsubscribe())
    }
  }, [conversationId, me, putConversation])

  const loading = Boolean(conversationId) && detail.id !== conversationId
  const append = (message) =>
    setDetail((prev) => ({ ...prev, messages: appendMessage(prev.messages, message) }))
  const loadOlder = async () => {
    const { data } = await getConversation(conversationId, detail.messages[0]?.createdAt)
    setDetail((prev) => ({
      ...prev,
      messages: [...data.messages.map((message) => toMessage(message, me)), ...prev.messages],
      hasMore: data.hasMore,
    }))
  }
  return { ...detail, loading, append, loadOlder }
}

export default function MessagesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { now, notify, inbox } = useOutletContext()
  const { threads, activeId, drafts } = inbox
  const [query, setQuery] = useState('')
  // Vào từ bài đăng thì mobile mở thẳng hội thoại
  const [mobileConversation, setMobileConversation] = useState(
    Boolean(location.state?.openConversation)
  )
  const [showInfo, setShowInfo] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const active = threads.find((thread) => thread.id === activeId)
  const detail = useConversationDetail(active, user.username, inbox.putConversation)
  const messages =
    active?.type === 'conversation'
      ? detail.messages
      : active?.type === 'claim'
        ? [active.intro]
        : []

  // Hội thoại mình đã đóng tách sang mục Đã đóng
  const [folder, setFolder] = useState(active && isClosedByMe(active) ? 'closed' : 'open')
  const visible = useMemo(
    () =>
      filterThreads(threads, query).filter(
        (thread) => isClosedByMe(thread) === (folder === 'closed')
      ),
    [threads, query, folder]
  )
  const closedUnread = threads.reduce(
    (count, thread) => count + (isClosedByMe(thread) ? thread.unread : 0),
    0
  )
  const draft = drafts[active?.id] || ''
  const status = active && statusLine(active)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [active?.id, messages.length, active?.status, mobileConversation])

  const select = (id) => {
    inbox.open(id)
    setMobileConversation(true)
    setShowInfo(false)
    setError('')
  }

  const updateDraft = (text) => {
    setError('')
    inbox.setDraft(active.id, text)
  }

  // Chạy một thao tác gọi API, chặn bấm lặp trong lúc chờ. Lỗi trả về để nơi gọi tự hiển thị
  const run = async (action) => {
    setBusy(true)
    try {
      await action()
      return null
    } catch (err) {
      return err
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    const intro = active.type === 'request'
    const problem = validateMessage(draft, { intro })
    if (problem) {
      setError(problem)
      return
    }
    const err = await run(async () => {
      if (intro) {
        const { data } = await sendContactRequest(active.post.id, draft.trim())
        inbox.putClaim(data, active.id)
        notify(`Đã gửi lời giới thiệu, chờ ${active.peer.name} đồng ý.`)
        return
      }
      const { data } = await sendMessage(active.id, { body: draft.trim() })
      detail.append(toMessage(data, user.username))
      inbox.setDraft(active.id, '')
    })
    // Lỗi thì giữ nội dung đang nhập để gửi lại
    if (err) setError(errorText(err, intro ? FAILED : SEND_FAILED))
    else inputRef.current?.focus()
  }

  const sendImage = async (file) => {
    const { accepted, errors } = checkImages([file], 0)
    if (!accepted.length) {
      setError(errors[0])
      return
    }
    setError('')
    const err = await run(async () => {
      const { data } = await sendMessage(active.id, { image: file })
      detail.append(toMessage(data, user.username))
    })
    if (err) setError(errorText(err, SEND_FAILED))
  }

  // Yêu cầu đã hết hiệu lực hoặc được xử lý ở nơi khác (409) thì tải lại danh sách
  const respond = async (accept) => {
    const err = await run(async () => {
      const { data } = await (accept ? acceptClaim : declineClaim)(active.claimId)
      if (accept) {
        await inbox.reload()
        inbox.open(data.conversationId)
        notify(`Đã mở kênh trò chuyện với ${active.peer.name}.`)
      } else {
        inbox.putClaim(data)
        notify(`Đã từ chối yêu cầu của ${active.peer.name}.`)
      }
    })
    if (err) {
      notify(errorText(err))
      if (err.status === 409) inbox.reload().catch(() => {})
    }
  }

  // Thao tác trên hội thoại (xác nhận, đóng, mở lại): server trả hội thoại mới
  const act = async (request, onDone) => {
    setDialog(null)
    const err = await run(async () => {
      const { data } = await request(active.id)
      inbox.putConversation(data)
      onDone(data)
    })
    if (err) {
      notify(errorText(err))
      if (err.status === 409) inbox.reload().catch(() => {})
    }
  }

  const confirm = () =>
    act(confirmReturn, (data) => {
      // Cả hai đã xác nhận thì chuyển sang đánh giá và gửi lời cảm ơn
      if (data.returned) navigate(`/messages/${data.id}/review`)
      else notify(`Đã ghi nhận, LostLink sẽ nhắc ${active.peer.name} xác nhận.`)
    })

  const close = () =>
    act(closeConversation, () => {
      setFolder('closed')
      notify('Đã đóng hội thoại.')
    })

  const reopen = () =>
    act(reopenConversation, () => {
      setFolder('open')
      notify('Đã mở lại hội thoại.')
    })

  const contactModerator = async () => {
    const err = await run(async () => {
      const { data } = await openSupport()
      inbox.putConversation(data)
      inbox.open(data.id)
      setFolder('open')
      setMobileConversation(true)
    })
    if (err) notify(errorText(err))
  }

  const trade = active?.kind === 'trade'
  const tradePanel = active && (
    <TradePanel
      thread={active}
      busy={busy}
      onConfirm={() => setDialog('confirm')}
      onReview={() => navigate(`/messages/${active.id}/review`)}
      onClose={() => setDialog('close')}
    />
  )

  return (
    <div className="mx-auto max-w-360 px-4 pt-5 pb-6 sm:px-6 lg:px-10">
      <div
        className={cx(
          'grid h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] min-h-130 grid-cols-1 gap-4 lg:h-[calc(100dvh-7.5rem)]',
          'md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_300px]'
        )}
      >
        <section
          aria-label="Danh sách hội thoại"
          className={cx(
            cardClass,
            'relative flex min-h-0 flex-col overflow-hidden',
            mobileConversation && 'max-md:hidden'
          )}
        >
          <ThreadList
            threads={visible}
            activeId={activeId}
            drafts={drafts}
            query={query}
            onQueryChange={setQuery}
            folder={folder}
            onFolderChange={setFolder}
            closedUnread={closedUnread}
            onOpen={select}
            onContactModerator={contactModerator}
            busy={busy}
            now={now}
          />
        </section>

        {active ? (
          <section
            aria-label={`Trò chuyện với ${active.peer.label ?? active.peer.name}`}
            className={cx(
              cardClass,
              'relative flex min-h-0 flex-col overflow-hidden',
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
                  {active.peer.label ?? active.peer.name}
                </h2>
                <p className={cx('m-0 flex items-center gap-1.5 text-tiny', status[1])}>
                  <span className={cx('size-1.5 shrink-0 rounded-full', status[2])} />
                  <span className="truncate">{status[0]}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {trade && (
                  <>
                    <IconButton
                      icon="user"
                      label="Xem trang cá nhân"
                      onClick={() => navigate(profilePath(active.peer.name))}
                    />
                    <IconButton
                      icon="flag"
                      label={`Báo cáo ${active.peer.name}`}
                      tone="danger"
                      onClick={() => navigate(`/users/${active.peer.name}/report`)}
                    />
                  </>
                )}
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
              className="relative flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain bg-surface-muted/60 px-4 py-4 sm:px-6"
            >
              {trade && (
                <AttachedPost
                  post={active.post}
                  linkable={Boolean(active.post?.slug)}
                  to={active.post?.slug ? postPath(active.post) : undefined}
                />
              )}
              {detail.hasMore && !detail.loading && (
                <Button
                  size="sm"
                  className="self-center"
                  onClick={() => detail.loadOlder().catch(() => notify(FAILED))}
                >
                  Xem tin nhắn cũ hơn
                </Button>
              )}
              {detail.loading ? (
                <p role="status" className="m-0 self-center text-caption text-ink-subtle">
                  Đang tải tin nhắn…
                </p>
              ) : detail.error && active.type === 'conversation' ? (
                <SystemNote tone="muted">Không tải được tin nhắn, vui lòng thử lại.</SystemNote>
              ) : (
                <Conversation thread={active} messages={messages} now={now} />
              )}
            </div>

            <Composer
              thread={active}
              busy={busy}
              draft={draft}
              error={error}
              inputRef={inputRef}
              onDraftChange={updateDraft}
              onSend={send}
              onPickImage={sendImage}
              onAccept={() => respond(true)}
              onDecline={() => respond(false)}
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
          className="relative hidden min-h-0 flex-col gap-3 overflow-y-auto xl:flex"
        >
          {tradePanel}
        </aside>
      </div>

      {dialog === 'confirm' && (
        <Dialog
          title="Xác nhận món đồ đã được trao trả?"
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
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            Bên kia vẫn nhắn được nhưng bạn sẽ không nhận thông báo. Bạn có thể mở lại bất cứ lúc
            nào ở mục Đã đóng.
          </p>
        </Dialog>
      )}
    </div>
  )
}
