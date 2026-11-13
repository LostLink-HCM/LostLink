import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { timeAgo } from '../../../lib/user/homeFeed'
import { profilePath } from '../../../lib/user/profiles'
import Avatar from '../Avatar'
import Button from '../Button'
import { buttonClass } from '../buttonClass'
import Card from '../Card'
import { cx, focusRing } from '../classes'

const MAX_LENGTH = 500

const textareaClass =
  'block w-full resize-y rounded-xl border border-line bg-surface-muted px-3.5 py-3 text-small text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary focus:bg-surface focus:ring-3 focus:ring-primary/12 aria-invalid:border-danger'

const linkButton = cx(
  'cursor-pointer border-0 bg-transparent p-0 text-tiny font-medium text-ink-subtle hover:text-primary',
  focusRing
)

const validate = (text) => {
  if (!text.trim()) return 'Vui lòng nhập nội dung bình luận.'
  if (text.trim().length > MAX_LENGTH) return `Bình luận tối đa ${MAX_LENGTH} ký tự.`
  return ''
}

// onEdit, onDelete trả về lỗi (có thể là Promise), rỗng là thành công
function CommentItem({ comment, mine, now, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [text, setText] = useState(comment.text)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    let message = validate(text)
    if (!message) {
      setBusy(true)
      message = (await onEdit(comment.id, text.trim())) || ''
      setBusy(false)
    }
    setError(message)
    if (!message) setEditing(false)
  }

  const remove = async () => {
    setBusy(true)
    const message = (await onDelete(comment.id)) || ''
    setBusy(false)
    setConfirming(false)
    setError(message)
  }

  return (
    <li className="flex gap-3">
      <Link
        to={profilePath(comment.author)}
        aria-label={`Xem trang cá nhân của ${comment.author}`}
        className={cx('shrink-0 self-start rounded-full', focusRing)}
      >
        <Avatar name={comment.author} size="md" tone={mine ? 'primary' : 'neutral'} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2">
          <Link
            to={profilePath(comment.author)}
            className={cx(
              'rounded text-caption font-semibold text-ink underline-offset-2 hover:text-primary hover:underline',
              focusRing
            )}
          >
            {comment.author}
          </Link>
          {mine && <span className="text-micro font-semibold text-primary">Bạn</span>}
          <time dateTime={comment.createdAt} className="text-tiny text-ink-subtle">
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
              <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu'}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setText(comment.text)
                  setError('')
                }}
              >
                Huỷ
              </Button>
            </div>
          </div>
        ) : (
          <p className="m-0 text-small leading-relaxed whitespace-pre-line text-ink-secondary [overflow-wrap:anywhere]">
            {comment.text}
          </p>
        )}
        {!editing && error && (
          <p role="alert" className="m-0 mt-1 text-caption text-danger-ink">
            {error}
          </p>
        )}

        {mine && !editing && (
          <div className="mt-1.5 flex items-center gap-3">
            {confirming ? (
              <>
                <span className="text-tiny text-ink-muted">Xoá bình luận này?</span>
                <Button variant="dangerSoft" size="sm" onClick={remove} disabled={busy}>
                  Xoá
                </Button>
                <Button size="sm" onClick={() => setConfirming(false)}>
                  Không
                </Button>
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

// Guest chỉ đọc bình luận; User được thêm, sửa và xoá bình luận của mình
export default function CommentSection({ comments, user, now, onAdd, onEdit, onDelete }) {
  const location = useLocation()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  // onAdd trả về lỗi (có thể là Promise); lỗi thì giữ nội dung đã nhập
  const submit = async (e) => {
    e.preventDefault()
    if (sending) return
    let message = validate(text)
    if (!message) {
      setSending(true)
      message = (await onAdd(text.trim())) || ''
      setSending(false)
    }
    setError(message)
    if (!message) setText('')
  }

  return (
    <Card as="section" aria-labelledby="comments-heading" className="p-5 lg:p-6">
      <h2 id="comments-heading" className="m-0 mb-4 text-lead font-bold text-ink">
        Bình luận · {comments.length}
      </h2>

      {user ? (
        <form noValidate onSubmit={submit} className="mb-6 flex gap-3">
          <Avatar name={user.username} size="md" />
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
                <span className="text-tiny text-ink-subtle">
                  {text.length}/{MAX_LENGTH}
                </span>
              )}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={sending}
                aria-busy={sending || undefined}
              >
                {sending ? 'Đang gửi…' : 'Gửi bình luận'}
              </Button>
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
            className={buttonClass({ variant: 'primary' })}
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
    </Card>
  )
}
