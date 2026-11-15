import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { answerQuestion, getClaimState } from '../../api/claims'
import Icon from '../../components/common/Icon'
import Button from '../../components/user/Button'
import { buttonClass } from '../../components/user/buttonClass'
import BackLink from '../../components/user/BackLink'
import Card from '../../components/user/Card'
import EmptyState from '../../components/user/EmptyState'
import Note from '../../components/user/Note'
import { cx } from '../../components/user/classes'
import AttachedPost from '../../components/user/messages/AttachedPost'
import { postPath } from '../../lib/user/homeFeed'

const pageClass = 'mx-auto max-w-180 px-4 pt-5 pb-10 sm:px-6 lg:pt-7'

// Không trả lời được: bài không tồn tại, không có câu hỏi, bài của mình hoặc không còn nhận đồ
function Unavailable({ post, title, description, children }) {
  return (
    <div className={pageClass}>
      <BackLink to={post ? postPath(post) : '/'}>
        {post ? 'Quay lại bài đăng' : 'Về trang chủ'}
      </BackLink>
      <Card>
        <EmptyState icon="lock" title={title} description={description} />
        {children && <div className="flex justify-center gap-3 pb-10">{children}</div>}
      </Card>
    </div>
  )
}

// Từ trang chi tiết đã có sẵn câu hỏi (state.claim), mở thẳng link thì tải lại
function useClaimState(id) {
  const { state } = useLocation()
  const initial = state?.claim?.post?.id === id ? state.claim : null
  const [result, setResult] = useState({ claim: initial, error: null })

  useEffect(() => {
    if (initial) return undefined
    let active = true
    getClaimState(id)
      .then((res) => active && setResult({ claim: res.data, error: null }))
      .catch((error) => active && setResult({ claim: null, error }))
    return () => {
      active = false
    }
  }, [id, initial])

  return { ...result, loading: !result.claim && !result.error }
}

// Trả lời câu hỏi xác minh của người nhặt
export default function VerifyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { inbox } = useOutletContext()
  const { claim, error, loading } = useClaimState(id)
  const [choice, setChoice] = useState(null)
  // passed | failed sau khi gửi, kèm hội thoại vừa mở
  const [answer, setAnswer] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  if (loading) {
    return (
      <div className={pageClass} role="status" aria-label="Đang tải câu hỏi xác minh">
        <div className="h-80 animate-pulse rounded-2xl bg-line-subtle" />
      </div>
    )
  }

  if (error) {
    const failed = error.code === 'VERIFICATION_FAILED'
    return (
      <Unavailable
        title={
          failed
            ? 'Xác minh không thành công'
            : error.status === 404
              ? 'Không tìm thấy bài đăng'
              : 'Không thể nhận đồ từ bài này'
        }
        description={error.message}
      >
        {failed && (
          <Link to="/posts/new" className={buttonClass({ variant: 'primary' })}>
            Đăng tin mất đồ
          </Link>
        )}
      </Unavailable>
    )
  }

  const { post } = claim
  if (claim.step !== 'verify') {
    const chatting = ['chat', 'requested'].includes(claim.step)
    return (
      <Unavailable
        post={post}
        title={chatting ? 'Bạn đã liên hệ về bài này' : 'Bài này không có câu hỏi xác minh'}
        description={
          chatting
            ? 'Mở trang Tin nhắn để tiếp tục trao đổi với người đăng.'
            : 'Bạn có thể gửi yêu cầu liên hệ cho người đăng từ trang bài đăng.'
        }
      >
        {chatting && (
          <Link to="/messages" className={buttonClass({ variant: 'primary' })}>
            Mở tin nhắn
          </Link>
        )}
      </Unavailable>
    )
  }

  const { question } = claim
  const result = answer?.correct === true ? 'passed' : answer ? 'failed' : null

  const submit = async (event) => {
    event.preventDefault()
    if (choice === null || result || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const { data } = await answerQuestion(id, choice)
      setAnswer(data)
    } catch (err) {
      if (err.code === 'ALREADY_ANSWERED') setAnswer({ correct: false })
      else setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openChat = async () => {
    await inbox.reload().catch(() => {})
    inbox.open(answer.conversationId)
    navigate('/messages', { state: { openConversation: true } })
  }

  // Để sau: chưa gửi thì lượt trả lời vẫn còn
  const later = () => navigate(postPath(post))

  return (
    <div className={pageClass}>
      <BackLink to={postPath(post)}>Quay lại bài đăng</BackLink>

      <Card className="p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded-full bg-warning-soft px-3 py-1 text-tiny font-bold tracking-wide text-warning uppercase">
            Câu hỏi của người nhặt
          </span>
          <span className="text-caption text-ink-muted">Chỉ trả lời được một lần</span>
        </div>
        <h1 className="m-0 text-title font-bold tracking-tight text-ink sm:text-heading">
          Trả lời một câu để xác nhận đây là đồ của bạn
        </h1>
        <p className="m-0 mt-1.5 mb-5 text-small leading-relaxed text-ink-muted">
          Người nhặt để lại một câu hỏi mà chỉ chủ nhân mới biết. Trả lời đúng là hai bên nhắn tin
          được ngay.
        </p>

        <div className="mb-5">
          <AttachedPost post={post} linkable to={postPath(post)} />
        </div>

        <form noValidate onSubmit={submit}>
          <fieldset
            disabled={Boolean(result) || submitting}
            className="m-0 rounded-2xl border border-line bg-surface-muted p-4 sm:p-5"
          >
            <legend className="float-left mb-4 w-full p-0 text-lead font-semibold text-ink">
              {question.text}
            </legend>
            <div className="clear-both flex flex-col gap-2.5">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className={cx(
                    'flex items-center gap-3 rounded-xl border-[1.5px] border-line bg-surface px-4 py-3.5 text-body text-ink transition-colors',
                    'has-checked:border-primary has-checked:bg-primary-soft',
                    'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
                    result ? 'cursor-default' : 'cursor-pointer hover:border-primary/40'
                  )}
                >
                  <input
                    type="radio"
                    name="answer"
                    checked={choice === option.id}
                    onChange={() => setChoice(option.id)}
                    className="size-4.5 shrink-0 accent-primary"
                  />
                  {option.text}
                </label>
              ))}
            </div>
          </fieldset>

          {submitError && (
            <Note icon="warning" tone="danger" className="mt-4">
              {submitError}
            </Note>
          )}
          {result === 'passed' && (
            <Note icon="check" tone="success" className="mt-4">
              <strong className="block text-small text-success">Chính xác rồi</strong>
              Kênh trò chuyện đã mở, bạn có thể nhắn cho {post.author} để hẹn nhận lại đồ.
            </Note>
          )}
          {result === 'failed' && (
            <Note icon="warning" tone="danger" className="mt-4">
              <strong className="block text-small text-danger-ink">
                Xác minh không thành công
              </strong>
              Đáp án không khớp nên bạn không thể trả lời lại với bài này. Nếu vẫn tin đây là đồ của
              mình, hãy đăng tin mất đồ để người nhặt tìm đến bạn.
            </Note>
          )}

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
            {result === 'passed' ? (
              <Button variant="primary" size="xl" className="sm:ml-auto" onClick={openChat}>
                <Icon name="chat" size={16} />
                Mở kênh trò chuyện
              </Button>
            ) : result === 'failed' ? (
              <>
                <Link to={postPath(post)} className={buttonClass({ size: 'xl' })}>
                  Về bài đăng
                </Link>
                <Link
                  to="/posts/new"
                  className={buttonClass({
                    variant: 'primary',
                    size: 'xl',
                    className: 'sm:ml-auto',
                  })}
                >
                  Đăng tin mất đồ
                </Link>
              </>
            ) : (
              <>
                <Button size="xl" onClick={later}>
                  Để sau
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="xl"
                  disabled={choice === null || submitting}
                  className="sm:flex-1"
                >
                  {submitting ? 'Đang gửi…' : 'Gửi câu trả lời'}
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
