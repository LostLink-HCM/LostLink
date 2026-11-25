import Icon from '../../common/Icon'
import Button from '../Button'
import { cx, focusRing } from '../classes'

export default function PendingTrade({ thread, busy, onConfirm, onMismatch, onOpen }) {
  const { peer, confirmed } = thread
  return (
    <section
      aria-label={`Bài chưa xong với ${peer.name}`}
      className="border-b border-warning/25 bg-warning-soft px-4 py-3 sm:px-5"
    >
      <p className="m-0 flex items-start gap-2 text-caption leading-snug text-ink-secondary">
        <Icon name="warning" size={16} className="mt-px shrink-0 text-warning" />
        <span>
          Bài <strong className="text-ink">“{thread.post.title}”</strong> với {peer.name} chưa xong.{' '}
          {confirmed.me
            ? `Bạn đã xác nhận, đang chờ ${peer.name} xác nhận.`
            : 'Hai bạn đã trao trả món này chưa?'}
        </span>
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-6">
        {!confirmed.me && (
          <>
            <Button variant="primary" size="sm" disabled={busy} onClick={onConfirm}>
              {thread.receiver ? 'Tôi đã nhận được đồ' : 'Tôi đã trao trả đồ'}
            </Button>
            <Button variant="dangerSoft" size="sm" disabled={busy} onClick={onMismatch}>
              Không khớp
            </Button>
          </>
        )}
        <button
          type="button"
          onClick={onOpen}
          className={cx(
            'inline-flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-1.5 py-1 text-caption font-semibold text-primary hover:underline',
            focusRing
          )}
        >
          Xem hội thoại
          <Icon name="next" size={14} />
        </button>
      </div>
    </section>
  )
}
