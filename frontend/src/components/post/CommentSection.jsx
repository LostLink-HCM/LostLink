import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { timeAgo } from '../../lib/homeFeed'
import { cx, focusRing } from '../moderator/classes'

const MAX_LENGTH = 500

const textareaClass =
  'block w-full resize-y rounded-xl border border-line bg-surface-muted px-3.5 py-3 text-small text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary focus:bg-surface focus:ring-3 focus:ring-primary/12 aria-invalid:border-danger'

const smallButton = (variant) =>
  cx(
    'inline-flex h-8 cursor-pointer items-center rounded-full border px-3.5 text-caption font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary'
      ? 'border-primary bg-primary text-white hover:bg-primary-hover'
      : variant === 'danger'
        ? 'border-danger/30 bg-danger-soft text-danger-ink hover:border-danger/60'
        : 'border-line bg-surface text-ink-secondary hover:bg-surface-muted',
    focusRing
  )

const linkButton = cx(
  'cursor-pointer border-0 bg-transparent p-0 text-[10.5px] font-medium text-ink-subtle hover:text-primary',
  focusRing
)

const validate = (text) => {
  if (!text.trim()) return 'Vui lòng nhập nội dung bình luận.'
  if (text.trim().length > MAX_LENGTH) return `Bình luận tối đa ${MAX_LENGTH} ký tự.`
  return ''
}

const Avatar = ({ name, mine }) => (
  <span
    className={cx(
      'grid size-9 shrink-0 place-items-center rounded-full text-[10.5px] font-bold',
      mine ? 'bg-primary-soft text-primary' : 'bg-line-subtle text-ink-secondary'
    )}
  >
    {name.slice(0, 2).toUpperCase()}
  </span>
)

function CommentItem({ comment, mine, now, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [text, setText] = useState(comment.text)
  const [error, setError] = useState('')

  const save = () => {
    const message = validate(text)
    setError(message)
    if (message) return
    onEdit(comment.id, text.trim())
    setEditing(false)
  }

  return (
    <li className="flex gap-3">
      <Avatar name={comment.author} mine={mine} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2">
          <span className="text-caption font-semibold text-ink">{comment.author}</span>
          {mine && <span className="text-[10px] font-semibold text-primary">Bạn</span>}
          <time dateTime={comment.createdAt} className="text-[10.5px] text-ink-subtle">
            {timeAgo(comment.createdAt, Math.max(now, Date.parse(comment.createdAt)))}
            {comment.editedAt && ' · đã sửa'}
          </time>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`edit-${comment.id}`} className="sr-only">
              Sửa bình luận
            </label>
            <textarea
              id={`edit-${comment.id}`}
              rows={2}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError('')
              }}
              aria-invalid={error ? true : undefined}
              className={textareaClass}
            />
            {error && <p className="m-0 text-caption text-danger-ink">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={save} className={smallButton('primary')}>
                Lưu
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setText(comment.text)
                  setError('')
                }}
                className={smallButton()}
              >
                Huỷ
              </button>
            </div>
          </div>
        ) : (
          <p className="m-0 text-small leading-relaxed whitespace-pre-line text-ink-secondary [overflow-wrap:anywhere]">
            {comment.text}
          </p>
        )}

        {mine && !editing && (
          <div className="mt-1.5 flex items-center gap-3">
            {confirming ? (
              <>
                <span className="text-[10.5px] text-ink-muted">Xoá bình luận này?</span>
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  className={smallButton('danger')}
                >
                  Xoá
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={smallButton()}
                >
                  Không
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setEditing(true)} className={linkButton}>
                  Sửa
                </button>
                <button type="button" onClick={() => setConfirming(true)} className={linkButton}>
                  Xoá
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

// Guest chỉ đọc bình luận (G01); User được thêm, sửa và xoá bình luận của mình (U07)
export default function CommentSection({ comments, user, now, onAdd, onEdit, onDelete }) {
  const location = useLocation()
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const message = validate(text) || onAdd(text.trim())
    setError(message)
    if (!message) setText('')
  }

  return (
    <section
      aria-labelledby="comments-heading"
      className="rounded-2xl border border-line bg-surface p-5 shadow-card lg:p-6"
    >
      <h2 id="comments-heading" className="m-0 mb-4 text-lead font-bold text-ink">
        Bình luận · {comments.length}
      </h2>

      {user ? (
        <form noValidate onSubmit={submit} className="mb-6 flex gap-3">
          <Avatar name={user.username} mine />
          <div className="min-w-0 flex-1">
            <label htmlFor="new-comment" className="sr-only">
              Viết bình luận
            </label>
            <textarea
              id="new-comment"
              rows={3}
              value={text}
              maxLength={MAX_LENGTH}
              onChange={(e) => {
                setText(e.target.value)
                setError('')
              }}
              placeholder="Bạn nhìn thấy món này ở đâu chưa? Kể giúp nhé…"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'new-comment-error' : undefined}
              className={textareaClass}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              {error ? (
                <p id="new-comment-error" role="alert" className="m-0 text-caption text-danger-ink">
                  {error}
                </p>
              ) : (
                <span className="text-[10.5px] text-ink-subtle">
                  {text.length}/{MAX_LENGTH}
                </span>
              )}
              <button type="submit" className={smallButton('primary')}>
                Gửi bình luận
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-caption text-warning">
            Đăng nhập để bình luận, lưu bài hoặc liên hệ người đăng.
          </p>
          <Link
            to="/login"
            state={{ from: location.pathname }}
            className={cx(
              'inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-caption font-semibold text-white no-underline hover:bg-primary-hover',
              focusRing
            )}
          >
            Đăng nhập
          </Link>
        </div>
      )}

      {comments.length ? (
        <ul className="m-0 flex list-none flex-col gap-5 p-0">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              mine={comment.author === user?.username}
              now={now}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-caption text-ink-subtle">Chưa có bình luận nào.</p>
      )}
    </section>
  )
}
