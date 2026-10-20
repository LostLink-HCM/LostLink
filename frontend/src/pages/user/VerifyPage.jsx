import { useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import Button from '../../components/user/Button'
import { buttonClass } from '../../components/user/buttonClass'
import Card from '../../components/user/Card'
import EmptyState from '../../components/user/EmptyState'
import Note from '../../components/user/Note'
import { cx, focusRing } from '../../components/user/classes'
import AttachedPost from '../../components/user/messages/AttachedPost'
import { openThread, postSnapshot } from '../../lib/userMessages'

const pageClass = 'mx-auto max-w-180 px-4 pt-5 pb-10 sm:px-6 lg:pt-7'

function BackLink({ to, children }) {
  return (
    <Link
      to={to}
      className={cx(
        'mb-4 inline-flex items-center gap-1.5 rounded-lg text-caption font-medium text-ink-muted no-underline hover:text-primary',
        focusRing
      )}
    >
      <Icon name="back" size={16} />
      {children}
    </Link>
  )
}

// Không trả lời được: bài không tồn tại, không có câu hỏi, bài của mình hoặc không còn Đang tìm
function Unavailable({ postId, title, description }) {
  return (
    <div className={pageClass}>
      <BackLink to={postId ? `/posts/${postId}` : '/'}>
        {postId ? 'Quay lại bài đăng' : 'Về trang chủ'}
      </BackLink>
      <Card>
        <EmptyState icon="lock" title={title} description={description} />
      </Card>
    </div>
  )
}

// Trả lời câu hỏi xác minh của người nhặt
export default function VerifyPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { posts, chat, setChat, verifications, answerQuestion } = useOutletContext()
  const [choice, setChoice] = useState(null)

  const post = posts.find((item) => String(item.id) === id)
  const result = post && verifications[post.id]

  if (!post) {
    return (
      <Unavailable
        title="Không tìm thấy bài đăng"
        description="Bài đăng không tồn tại hoặc đã bị ẩn."
      />
    )
  }
  if (post.type !== 'found' || !post.question) {
    return (
      <Unavailable
        postId={post.id}
        title="Bài này không có câu hỏi xác minh"
        description="Bạn có thể gửi yêu cầu liên hệ cho người đăng từ trang bài đăng."
      />
    )
  }
  if (post.author === user.username) {
    return (
      <Unavailable
        postId={post.id}
        title="Đây là bài đăng của bạn"
        description="Bạn không thể tự trả lời câu hỏi xác minh của mình."
      />
    )
  }
  if (!result && post.status !== 'searching') {
    return (
      <Unavailable
        postId={post.id}
        title="Không thể nhận đồ từ bài này"
        description="Bài đăng không còn ở trạng thái Đang tìm."
      />
    )
  }

  const { question } = post

  const submit = (event) => {
    event.preventDefault()
    if (choice === null || result) return
    answerQuestion(post, choice)
  }

  const openChat = () => {
    const thread = chat.threads.find((item) => item.post.id === post.id)
    if (thread) setChat((prev) => openThread(prev, thread.id))
    navigate('/messages', { state: { openConversation: true } })
  }

  return (
    <div className={pageClass}>
      <BackLink to={`/posts/${post.id}`}>Quay lại bài đăng</BackLink>

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
          <AttachedPost post={postSnapshot(post)} linkable />
        </div>

        <form noValidate onSubmit={submit}>
          <fieldset
            disabled={Boolean(result)}
            className="m-0 rounded-2xl border border-line bg-surface-muted p-4 sm:p-5"
          >
            <legend className="float-left mb-4 w-full p-0 text-lead font-semibold text-ink">
              {question.text}
            </legend>
            <div className="clear-both flex flex-col gap-2.5">
              {question.options.map((text, index) => (
                <label
                  key={text}
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
                    checked={choice === index}
                    onChange={() => setChoice(index)}
                    className="size-4.5 shrink-0 accent-primary"
                  />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>

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
                <Link to={`/posts/${post.id}`} className={buttonClass({ size: 'xl' })}>
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
                <Button size="xl" onClick={() => navigate(`/posts/${post.id}`)}>
                  Để sau
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="xl"
                  disabled={choice === null}
                  className="sm:flex-1"
                >
                  Gửi câu trả lời
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
