import Icon from '../../common/Icon'
import Button from '../Button'
import { cx } from '../classes'

function Check({ done, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-ink-secondary">
      <span
        className={cx(
          'grid size-4 shrink-0 place-items-center rounded-full',
          done ? 'bg-success text-white' : 'border border-line-strong bg-surface'
        )}
      >
        {done && <Icon name="check" size={11} />}
      </span>
      {children}
    </span>
  )
}

// Dải trao trả dính ở đầu khung chat: ai đã xác nhận và nút đi tiếp. Chỉ hiện ở hội thoại trao đổi
// đang mở hoặc đã trao trả; các trường hợp khác chỉ có giải thích trong bảng ⓘ và ô nhập tin
export default function TradeBar({ thread, busy, onConfirm, onNotMine, onReview }) {
  const { status, peer, confirmed } = thread
  const shown =
    thread.type === 'conversation' &&
    thread.kind === 'trade' &&
    !thread.closedBy &&
    ['open', 'returned'].includes(status)
  if (!shown) return null

  if (status === 'returned') {
    return (
      <section
        aria-label="Trao trả"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-success/20 bg-success-soft px-4 py-1.5 sm:px-5"
      >
        <p className="m-0 flex min-w-0 flex-1 items-center gap-2 text-caption font-semibold text-success">
          <Icon name="check" size={16} className="shrink-0" />
          Đã trao trả, cả hai đã xác nhận.
        </p>
        <Button
          variant={thread.review ? 'secondary' : 'primary'}
          size="sm"
          onClick={onReview}
          className="max-sm:w-full"
        >
          <Icon name="star" size={14} />
          {thread.review ? 'Xem lại lời cảm ơn đã gửi' : 'Đánh giá và gửi lời cảm ơn'}
        </Button>
      </section>
    )
  }

  return (
    <section
      aria-label="Trao trả"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-1.5 sm:px-5"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        <Check done={confirmed.peer}>
          {peer.name} {confirmed.peer ? 'đã xác nhận' : 'chưa xác nhận'}
        </Check>
        <Check done={confirmed.me}>Bạn {confirmed.me ? 'đã xác nhận' : 'chưa xác nhận'}</Check>
        {confirmed.me && (
          <span className="text-tiny text-ink-subtle">
            Đang chờ {peer.name} xác nhận, LostLink sẽ nhắc họ.
          </span>
        )}
      </div>
      {!confirmed.me && (
        <div className="grid grid-cols-2 gap-2 max-sm:w-full max-[22rem]:grid-cols-1">
          <Button variant="dangerSoft" size="sm" disabled={busy} onClick={onNotMine}>
            {thread.receiver ? 'Không phải đồ của tôi' : 'Không phải chủ món đồ'}
          </Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={onConfirm}>
            {thread.receiver ? 'Tôi đã nhận được đồ' : 'Tôi đã trao trả đồ'}
          </Button>
        </div>
      )}
    </section>
  )
}
