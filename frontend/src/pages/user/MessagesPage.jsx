import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import {
  acquireBackofficeActionLock,
  releaseBackofficeActionLock,
} from '../../api/backofficeActionLocks'
import { acceptClaim, declineClaim, sendContactRequest } from '../../api/claims'
import {
  answerCounterpart,
  closeConversation,
  confirmReturn,
  getConversation,
  markConversationRead,
  openSupport,
  reopenConversation,
  sendMessage,
} from '../../api/conversations'
import { useAuth } from '../../auth/AuthContext'
import useBackofficeActionLock from '../../hooks/useBackofficeActionLock'
import Icon from '../../components/common/Icon'
import Button from '../../components/user/Button'
import Dialog from '../../components/user/Dialog'
import IconButton from '../../components/user/IconButton'
import { cardClass } from '../../components/user/Card'
import { cx } from '../../components/user/classes'
import AttachedPost from '../../components/user/messages/AttachedPost'
import Composer from '../../components/user/messages/Composer'
import CounterpartAsk from '../../components/user/messages/CounterpartAsk'
import PendingTrade from '../../components/user/messages/PendingTrade'
import PostSwitcher from '../../components/user/messages/PostSwitcher'
import ThreadAvatar from '../../components/user/messages/ThreadAvatar'
import ThreadList from '../../components/user/messages/ThreadList'
import TradeBar from '../../components/user/messages/TradeBar'
import TradePanel from '../../components/user/messages/TradePanel'
import PostMenu from '../../components/user/post/PostMenu'
import { checkImages } from '../../lib/user/composePost'
import { postPath } from '../../lib/user/homeFeed'
import {
  appendMessage,
  canClose,
  counterpartAsks,
  dayLabel,
  filterThreads,
  groupThreads,
  isClosedByMe,
  isSameDay,
  pendingTrades,
  samePeerThreads,
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
  expired: ['Yêu cầu đã hết hiệu lực', 'text-ink-muted', 'bg-ink-subtle'],
  ended: ['Bài đã kết thúc', 'text-ink-muted', 'bg-ink-subtle'],
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
  if (thread.support === 'handler')
    return ['Yêu cầu hỗ trợ từ người dùng', 'text-primary', 'bg-primary']
  if (thread.support === 'internal') return ['Trao đổi nội bộ', 'text-ink-muted', 'bg-ink-subtle']
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
      {thread.support === 'requester' && messages.length === 0 && (
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
      {thread.status === 'expired' && (
        <SystemNote tone="muted">Bài đã kết thúc, yêu cầu trò chuyện không còn hiệu lực</SystemNote>
      )}
      {thread.status === 'ended' && (
        <SystemNote tone="muted">
          {thread.post?.status === 'returned' ? 'Bài đã được trao trả' : 'Người đăng đã đóng bài'}
        </SystemNote>
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

// Bài đính kèm: claim đơn phương chỉ có bài chung; đi từ manh mối thì hiện cả hai bài, bài của mình trước
function AttachedPosts({ thread }) {
  const linkOf = (post) => ({
    linkable: Boolean(post?.slug),
    to: post?.slug ? postPath(post) : undefined,
  })
  if (!thread.counterpart) return <AttachedPost post={thread.post} {...linkOf(thread.post)} />
  const posts = [thread.post, thread.counterpart].sort((a, b) => Number(b?.mine) - Number(a?.mine))
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {posts.map((post) => (
        <AttachedPost
          key={post.id}
          post={post}
          label={post.mine ? 'Bài của bạn' : `Bài của ${thread.peer.name}`}
          {...linkOf(post)}
        />
      ))}
    </div>
  )
}

export default function MessagesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  // Admin/Moderator: không tự liên hệ LostLink, xem yêu cầu hỗ trợ được giao ngay trong danh sách
  const staff = ['admin', 'moderator'].includes(user?.role)
  const { now, notify, inbox, setChatOpen } = useOutletContext()
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
  const groups = useMemo(
    () =>
      groupThreads(
        filterThreads(threads, query).filter(
          (thread) => isClosedByMe(thread) === (folder === 'closed')
        )
      ),
    [threads, query, folder]
  )
  const peerThreads = active ? samePeerThreads(threads, active) : []
  const pending = active ? pendingTrades(threads, active) : []
  const asks = active ? counterpartAsks(threads, active) : []
  const closedUnread = threads.reduce(
    (count, thread) => count + (isClosedByMe(thread) ? thread.unread : 0),
    0
  )
  const draft = drafts[active?.id] || ''

  // Moderator trả lời yêu cầu hỗ trợ trong hàng chờ chung: đang gõ thì giữ quyền xử lý như ở
  // backoffice để Moderator khác thấy, ai đang xử lý thì báo sớm
  const handling = active?.support === 'handler'
  const holdLock = handling && Boolean(draft.trim())
  const replyLock = useBackofficeActionLock(
    holdLock ? 'conversation' : null,
    holdLock ? active.id : null,
    true
  )
  const lockNotice =
    holdLock && replyLock.status === 'busy'
      ? `${replyLock.holder?.username ?? 'Moderator khác'} đang xử lý yêu cầu này, bạn chưa gửi được.`
      : ''

  // Xin quyền xử lý ngay trước khi gửi (gửi ảnh không qua ô nhập vẫn cần)
  const lockFor = async () => {
    if (!handling) return {}
    const result = await acquireBackofficeActionLock('conversation', active.id, replyLock.token)
    if (!result.acquired) {
      const holder = result.lockedBy?.username ?? 'Moderator khác'
      throw Object.assign(new Error(`${holder} đang xử lý yêu cầu này.`), { status: 409 })
    }
    return { lockToken: result.token }
  }
  const status = active && statusLine(active)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [active?.id, messages.length, active?.status, mobileConversation])

  // Báo cho hộp thư hội thoại đang mở ở đây (trang này cũng đánh dấu đã đọc trên server);
  // rời trang thì thôi, tin mới lại được tính chưa đọc
  const viewingId = active?.type === 'conversation' ? active.id : null
  const { setViewing } = inbox
  useEffect(() => {
    setViewing(viewingId)
    return () => setViewing(null)
  }, [viewingId, setViewing])

  const chatShown = mobileConversation && Boolean(active)
  useEffect(() => {
    setChatOpen?.(chatShown)
    return () => setChatOpen?.(false)
  }, [chatShown, setChatOpen])

  const select = (id) => {
    inbox.open(id)
    setMobileConversation(true)
    setShowInfo(false)
    setError('')
  }

  const switchTo = (id) => {
    const thread = threads.find((item) => item.id === id)
    if (thread) setFolder(isClosedByMe(thread) ? 'closed' : 'open')
    select(id)
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
      const { data } = await sendMessage(active.id, { body: draft.trim(), ...(await lockFor()) })
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
      const lock = await lockFor()
      const { data } = await sendMessage(active.id, { image: file, ...lock })
      // Gửi ảnh khi không gõ gì: trả quyền xử lý ngay cho Moderator khác
      if (lock.lockToken && !draft.trim()) {
        releaseBackofficeActionLock('conversation', active.id, lock.lockToken).catch(() => {})
      }
      detail.append(toMessage(data, user.username))
    })
    if (err) setError(errorText(err, SEND_FAILED))
  }

  // Yêu cầu đã hết hiệu lực hoặc được xử lý ở nơi khác (409) thì tải lại danh sách
  const failRespond = (err) => {
    notify(errorText(err))
    if (err.status === 409) inbox.reload().catch(() => {})
  }

  const accept = async () => {
    const err = await run(async () => {
      const { data } = await acceptClaim(active.claimId)
      await inbox.reload()
      inbox.open(data.conversationId)
      notify(`Đã mở kênh trò chuyện với ${active.peer.name}.`)
    })
    if (err) failRespond(err)
  }

  // Từ chối không hoàn tác được nên hỏi lại trước khi gửi
  const decline = async () => {
    const target = dialog.target
    setDialog(null)
    const err = await run(async () => {
      const { data } = await declineClaim(target.claimId)
      inbox.putClaim(data)
      notify(`Đã từ chối yêu cầu trò chuyện của ${target.peer.name}.`)
    })
    if (err) failRespond(err)
  }

  // Thao tác trên hội thoại (xác nhận, đóng, mở lại): server trả hội thoại mới
  const act = async (request, onDone, target = active) => {
    setDialog(null)
    const err = await run(async () => {
      const { data } = await request(target.id)
      inbox.putConversation(data)
      onDone(data)
    })
    if (err) {
      notify(errorText(err))
      if (err.status === 409) inbox.reload().catch(() => {})
    }
  }

  const openDialog = (kind, target = active) => setDialog({ kind, target })
  const dialogTarget = dialog?.target
  const fromCard = dialogTarget && dialogTarget.id !== active?.id

  const confirm = () =>
    act(
      confirmReturn,
      (data) => {
        if (fromCard) {
          notify(
            data.returned
              ? `Hai bên đã xác nhận trao trả bài “${dialogTarget.post.title}”.`
              : `Đã ghi nhận, LostLink sẽ nhắc ${dialogTarget.peer.name} xác nhận.`
          )
          return
        }
        // Cả hai đã xác nhận thì chuyển sang đánh giá và gửi lời cảm ơn
        if (data.returned) navigate(`/messages/${data.id}/review`)
        else notify(`Đã ghi nhận, LostLink sẽ nhắc ${active.peer.name} xác nhận.`)
      },
      dialogTarget
    )

  const close = () =>
    act(
      closeConversation,
      () => {
        if (fromCard) {
          notify(`Đã đóng hội thoại về bài “${dialogTarget.post.title}”.`)
          return
        }
        setFolder('closed')
        notify('Đã đóng hội thoại.')
      },
      dialogTarget
    )

  // Không phải đồ của tôi / không phải chủ món đồ: đóng hội thoại, manh mối giữa hai bài thành Không phải
  const closeNotMine = () =>
    act(
      (id) => closeConversation(id, { notMatch: true }),
      () => {
        setFolder('closed')
        notify('Đã đóng hội thoại, LostLink sẽ không gợi ý lại hai bài này cho nhau.')
      }
    )

  // Câu hỏi cùng món: một bài thì Đúng/Không, nhiều bài thì chọn một (postId) hoặc bỏ qua
  const answer = (thread, same, postId) =>
    act(
      (id) => answerCounterpart(id, same, postId),
      () => {
        const options = thread.counterpartAsk
        if (!same) {
          notify(
            options.length === 1
              ? `Đã ghi nhận, bài “${options[0].title}” vẫn giữ nguyên.`
              : 'Đã ghi nhận, các bài của bạn vẫn giữ nguyên.'
          )
          return
        }
        const chosen = options.find((item) => item.id === postId) ?? options[0]
        notify(`Bài “${chosen.title}” đã chuyển sang Đã trao trả.`)
        inbox.reload().catch(() => {})
      },
      thread
    )

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
  const chatActions = active
    ? [
        trade &&
          !active.peer.deleted && {
            label: 'Xem trang cá nhân',
            icon: 'user',
            onClick: () => navigate(profilePath(active.peer.name)),
          },
        trade &&
          !active.peer.deleted && {
            label: `Báo cáo ${active.peer.name}`,
            icon: 'flag',
            tone: 'danger',
            onClick: () => navigate(`/users/${active.peer.name}/report`),
          },
        canClose(active) && {
          label: 'Đóng hội thoại',
          icon: 'close',
          tone: 'danger',
          onClick: () => openDialog('close'),
        },
      ].filter(Boolean)
    : []

  return (
    <div className="mx-auto max-w-360 px-4 pt-5 pb-6 sm:px-6 lg:px-10 lg:pb-5">
      <div
        className={cx(
          // Màn rộng: cao vừa màn hình (thanh trên 4rem, đệm trên và dưới 1.25rem), không sinh thanh cuộn trang
          'grid min-h-130 grid-cols-1 gap-4 lg:h-[calc(100dvh-6.5rem)]',
          chatShown || !setChatOpen
            ? 'h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))]'
            : 'h-[calc(100dvh-12rem-env(safe-area-inset-bottom))]',
          'md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]'
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
            groups={groups}
            activeId={activeId}
            drafts={drafts}
            query={query}
            onQueryChange={setQuery}
            folder={folder}
            onFolderChange={setFolder}
            closedUnread={closedUnread}
            onOpen={select}
            onContactModerator={staff ? undefined : contactModerator}
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
            <header className="flex items-center gap-3 border-b border-line px-4 py-2 sm:px-5">
              <IconButton
                icon="back"
                label="Về danh sách hội thoại"
                className="md:hidden"
                onClick={() => setMobileConversation(false)}
              />
              <span className="max-sm:hidden">
                <ThreadAvatar thread={active} size="md" />
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
                {chatActions.length > 0 && (
                  <PostMenu label="Tuỳ chọn hội thoại" actions={chatActions} />
                )}
                <IconButton
                  icon="info"
                  label="Thông tin hội thoại và chỗ hẹn"
                  className={cx(showInfo && 'bg-primary-soft text-primary')}
                  aria-expanded={showInfo}
                  aria-controls="chat-trade-panel"
                  onClick={() => setShowInfo((value) => !value)}
                />
              </div>
            </header>

            <PostSwitcher threads={peerThreads} activeId={active.id} onSelect={switchTo} />
            {/* Ngoài vùng cuộn nên luôn nằm ở đầu khung chat */}
            <TradeBar
              thread={active}
              busy={busy}
              onConfirm={() => openDialog('confirm')}
              onNotMine={() => openDialog('notMine')}
              onReview={() => navigate(`/messages/${active.id}/review`)}
            />
            {pending.map((thread) => (
              <PendingTrade
                key={thread.id}
                thread={thread}
                busy={busy}
                onConfirm={() => openDialog('confirm', thread)}
                onMismatch={() => openDialog('close', thread)}
                onOpen={() => switchTo(thread.id)}
              />
            ))}
            {asks.map((thread) => (
              <CounterpartAsk
                key={thread.id}
                thread={thread}
                busy={busy}
                onAnswer={(same, postId) => answer(thread, same, postId)}
              />
            ))}

            {showInfo && (
              <div
                id="chat-trade-panel"
                className="grid max-h-[55%] gap-3 overflow-y-auto border-b border-line bg-surface-muted p-3 sm:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]"
              >
                <TradePanel thread={active} />
              </div>
            )}

            <div
              ref={scrollRef}
              className="relative flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain bg-surface-muted/60 px-4 py-4 [scrollbar-width:thin] sm:px-6"
            >
              {trade && <AttachedPosts thread={active} />}
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
              notice={lockNotice}
              inputRef={inputRef}
              onDraftChange={updateDraft}
              onSend={send}
              onPickImage={sendImage}
              onAccept={accept}
              onDecline={() => openDialog('decline')}
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
      </div>

      {dialog?.kind === 'confirm' && (
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
            {fromCard && (
              <>
                Bài <strong className="text-ink">“{dialogTarget.post.title}”</strong>.{' '}
              </>
            )}
            Chỉ xác nhận khi món đồ đã thực sự được trao tận tay. Khi cả bạn và{' '}
            {dialogTarget.peer.name} cùng xác nhận, bài đăng chuyển sang Đã trao trả và không hoàn
            tác được.
          </p>
        </Dialog>
      )}

      {dialog?.kind === 'close' && (
        <Dialog
          title={fromCard ? 'Món đồ không khớp?' : 'Đóng hội thoại?'}
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
            {fromCard && (
              <>
                Hội thoại về bài <strong className="text-ink">“{dialogTarget.post.title}”</strong>{' '}
                sẽ được đóng.{' '}
              </>
            )}
            Bên kia vẫn nhắn được nhưng bạn sẽ không nhận thông báo. Bạn có thể mở lại bất cứ lúc
            nào ở mục Đã đóng.
          </p>
        </Dialog>
      )}

      {dialog?.kind === 'decline' && (
        <Dialog
          title="Từ chối yêu cầu trò chuyện?"
          size="sm"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)} data-autofocus>
                Huỷ
              </Button>
              <Button variant="danger" onClick={decline}>
                Từ chối
              </Button>
            </>
          }
        >
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            {dialogTarget.peer.name} sẽ không nhắn được cho bạn về bài{' '}
            <strong className="text-ink">“{dialogTarget.post.title}”</strong>. Thao tác này không
            hoàn tác được.
          </p>
        </Dialog>
      )}

      {dialog?.kind === 'notMine' && (
        <Dialog
          title={dialogTarget.receiver ? 'Không phải đồ của bạn?' : 'Không phải chủ món đồ?'}
          size="sm"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)} data-autofocus>
                Quay lại trò chuyện
              </Button>
              <Button variant="danger" onClick={closeNotMine}>
                Xác nhận không phải
              </Button>
            </>
          }
        >
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            Hội thoại sẽ được đóng, {dialogTarget.peer.name} vẫn nhắn được nhưng bạn sẽ không nhận
            thông báo. Bạn có thể mở lại ở mục Đã đóng.
          </p>
          <p className="m-0 mt-2 text-small leading-relaxed text-ink-secondary">
            Manh mối giữa hai bài (nếu có) sẽ chuyển sang{' '}
            <strong className="text-ink">Không phải</strong> và LostLink không gợi ý lại, phần này
            không hoàn tác được.
          </p>
        </Dialog>
      )}
    </div>
  )
}
