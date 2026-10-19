import { useRef } from 'react'
import Icon from '../common/Icon'
import Button from '../moderator/Button'
import { cx, focusRing } from '../moderator/classes'
import { ACCEPTED_IMAGE_TYPES } from '../../lib/composePost'
import { MESSAGE_LIMIT } from '../../lib/userMessages'

const iconButton = cx(
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 transition-colors disabled:cursor-not-allowed',
  focusRing
)

const LOCKED = {
  declined: 'Yêu cầu trò chuyện đã bị từ chối.',
  closed: 'Hội thoại đã đóng vì không đúng món đồ.',
}

export default function Composer({
  thread,
  draft,
  error,
  inputRef,
  onDraftChange,
  onSend,
  onPickImage,
  onAccept,
  onDecline,
}) {
  const galleryRef = useRef(null)
  const { status, peer } = thread

  if (status === 'incoming') {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3.5 sm:px-5">
        <p className="m-0 min-w-0 flex-1 text-caption text-ink-secondary">
          <strong>{peer.name}</strong> muốn trò chuyện về bài đăng của bạn.
        </p>
        <div className="flex gap-2">
          <Button className="rounded-full" onClick={onDecline}>
            Từ chối
          </Button>
          <Button variant="primary" className="rounded-full" onClick={onAccept}>
            Đồng ý
          </Button>
        </div>
      </div>
    )
  }

  if (LOCKED[status]) {
    return (
      <p className="m-0 flex items-center gap-2 border-t border-line bg-surface-muted px-5 py-4 text-caption text-ink-muted">
        <Icon name="lock" size={15} />
        {LOCKED[status]}
      </p>
    )
  }

  // Đã trao trả vẫn nhắn tiếp được
  const open = status === 'open' || status === 'returned'
  const pending = status === 'pending'
  const placeholder = pending
    ? `Đã hết lượt, chờ ${peer.name} đồng ý trò chuyện`
    : open
      ? `Nhắn tin cho ${peer.name}…`
      : `Viết một lời giới thiệu ngắn cho ${peer.name}…`

  const submit = (event) => {
    event.preventDefault()
    if (!pending) onSend()
  }

  const pickFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onPickImage(file)
  }

  return (
    <div className="border-t border-line px-4 pt-3 pb-4 sm:px-5">
      {!open && (
        <p className="m-0 mb-2.5 text-[10.5px] text-ink-subtle">
          {pending ? 'Đã dùng 1/1 tin nhắn giới thiệu' : 'Còn 1/1 tin nhắn giới thiệu'}
        </p>
      )}

      <form
        onSubmit={submit}
        className={cx(
          'flex items-end gap-1.5 rounded-2xl border p-1.5 transition-shadow',
          pending
            ? 'border-line bg-surface-muted'
            : 'border-line-strong bg-surface focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-primary-soft)]',
          error && 'border-danger'
        )}
      >
        {open && (
          <>
            <button
              type="button"
              aria-label="Gửi ảnh"
              title="Gửi ảnh (JPG, PNG, WEBP, tối đa 5 MB)"
              onClick={() => galleryRef.current?.click()}
              className={cx(
                iconButton,
                'bg-transparent text-ink-muted hover:bg-primary-soft hover:text-primary'
              )}
            >
              <Icon name="image" size={19} />
            </button>
            <input
              ref={galleryRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              className="hidden"
              tabIndex={-1}
              onChange={pickFile}
            />
          </>
        )}
        <label htmlFor="chat-draft" className="sr-only">
          {open ? `Tin nhắn cho ${peer.name}` : `Tin nhắn giới thiệu cho ${peer.name}`}
        </label>
        <textarea
          id="chat-draft"
          ref={inputRef}
          rows={1}
          maxLength={MESSAGE_LIMIT}
          disabled={pending}
          value={pending ? '' : draft}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'chat-error' : undefined}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter gửi, Shift + Enter xuống dòng; bỏ qua lúc đang gõ bộ gõ tiếng Việt
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              submit(event)
            }
          }}
          className={cx(
            'field-sizing-content max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-small leading-relaxed text-ink outline-none placeholder:text-ink-subtle disabled:cursor-not-allowed',
            !open && 'pl-2'
          )}
        />
        {!pending && draft.length > MESSAGE_LIMIT * 0.9 && (
          <span className="pb-2 text-[10px] text-ink-subtle">
            {draft.length}/{MESSAGE_LIMIT}
          </span>
        )}
        <button
          type="submit"
          aria-label="Gửi"
          disabled={pending || !draft.trim()}
          className={cx(
            iconButton,
            'bg-primary text-white hover:bg-primary-hover disabled:bg-line-strong'
          )}
        >
          <Icon name="send" size={16} />
        </button>
      </form>
      {error && (
        <p id="chat-error" role="alert" className="m-0 mt-1.5 text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
