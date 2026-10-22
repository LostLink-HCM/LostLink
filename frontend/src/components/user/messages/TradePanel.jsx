import Icon from '../../common/Icon'
import Button from '../Button'
import Card from '../Card'
import { cx } from '../classes'
import { SAFE_MEETUPS } from '../../../data/userMessages'
import { isReceiver } from '../../../lib/userMessages'

function CheckRow({ done, children }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cx(
          'grid size-4.5 shrink-0 place-items-center rounded-full',
          done ? 'bg-success text-white' : 'border border-line-strong bg-surface'
        )}
      >
        {done && <Icon name="check" size={12} />}
      </span>
      <span className="text-caption text-ink-secondary">{children}</span>
    </div>
  )
}

export default function TradePanel({ thread, reviewed, onConfirm, onReview, onNotMine }) {
  const { status, peer, confirmed, post } = thread

  if (status === 'request' || status === 'pending') {
    return (
      <Card as="section" padding="md">
        <h2 className="m-0 mb-1.5 text-body font-bold text-ink">Vì sao chỉ được một tin?</h2>
        <p className="m-0 text-caption leading-relaxed text-ink-muted">
          Giới hạn này giúp không ai bị nhắn tin dồn dập. Khi {peer.name} đồng ý, hai bạn nhắn tin
          bình thường. Nếu muốn nhận lại món đồ trên bài Nhặt được có câu hỏi xác minh, trả lời đúng
          câu hỏi sẽ mở kênh trò chuyện ngay.
        </p>
      </Card>
    )
  }

  if (status === 'incoming') {
    return (
      <Card as="section" padding="md">
        <h2 className="m-0 mb-1.5 text-body font-bold text-ink">Trước khi đồng ý</h2>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-4 text-caption leading-relaxed text-ink-muted">
          <li>Đọc kỹ lời giới thiệu, xem có khớp với món đồ của bạn không.</li>
          <li>Xem trang cá nhân và điểm uy tín của người gửi.</li>
          <li>Đồng ý thì bài chuyển sang Đã liên hệ, từ chối thì bài vẫn Đang tìm.</li>
        </ul>
      </Card>
    )
  }

  if (status === 'declined' || status === 'closed') {
    return (
      <Card as="section" padding="md">
        <h2 className="m-0 mb-1.5 text-body font-bold text-ink">Hội thoại đã đóng</h2>
        <p className="m-0 text-caption leading-relaxed text-ink-muted">
          {status === 'declined'
            ? 'Yêu cầu trò chuyện đã bị từ chối, bài đăng vẫn ở trạng thái Đang tìm.'
            : 'Hai bên xác định không đúng món đồ. Liên kết giữa hai bài đã đóng, bài trở lại Đang tìm.'}
        </p>
      </Card>
    )
  }

  const receiver = isReceiver(post)

  return (
    <>
      {status === 'open' && (
        <Button variant="dangerSoft" size="lg" block onClick={onNotMine}>
          <Icon name="close" size={16} />
          {receiver ? 'Không phải đồ của tôi' : 'Không đúng món đồ'}
        </Button>
      )}

      <Card as="section" padding="sm">
        <h2 className="m-0 mb-0.5 text-body font-bold text-ink">
          {status === 'returned' ? 'Đã trao trả' : 'Đã nhận được đồ chưa?'}
        </h2>
        <p className="m-0 mb-3 text-caption leading-snug text-ink-muted">
          {status === 'returned'
            ? 'Cả hai đã xác nhận. Gửi lời cảm ơn để ghi nhận người kia nhé.'
            : 'Cả hai cùng xác nhận thì bài đăng mới chuyển sang Đã trao trả.'}
        </p>
        <div className="mb-3 flex flex-col gap-1.5 rounded-lg bg-surface-muted px-3 py-2.5">
          <CheckRow done={confirmed.peer}>
            {peer.name} {confirmed.peer ? 'đã xác nhận' : 'chưa xác nhận'}
          </CheckRow>
          <CheckRow done={confirmed.me}>
            Bạn {confirmed.me ? 'đã xác nhận' : 'chưa xác nhận'}
          </CheckRow>
        </div>
        {status === 'returned' ? (
          <Button variant={reviewed ? 'secondary' : 'primary'} size="lg" block onClick={onReview}>
            <Icon name="star" size={16} />
            {reviewed ? 'Xem lại lời cảm ơn đã gửi' : 'Đánh giá và gửi lời cảm ơn'}
          </Button>
        ) : (
          <Button
            variant={confirmed.me ? 'secondary' : 'primary'}
            size="lg"
            block
            disabled={confirmed.me}
            onClick={onConfirm}
          >
            {confirmed.me
              ? 'Bạn đã xác nhận rồi'
              : receiver
                ? 'Tôi đã nhận được đồ'
                : 'Tôi đã trao trả đồ'}
          </Button>
        )}
      </Card>

      {status === 'open' && (
        <Card as="section" padding="sm">
          <h2 className="m-0 mb-1 text-body font-bold text-ink">Gợi ý chỗ hẹn an toàn</h2>
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            {SAFE_MEETUPS.map((place) => (
              <li key={place.name} className="flex items-start gap-2.5 py-2 last:pb-0">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">
                  <span className="block text-caption font-semibold text-ink">{place.name}</span>
                  <span className="block text-tiny leading-snug text-ink-muted">{place.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
