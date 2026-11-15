import Icon from '../../common/Icon'
import Button from '../Button'
import Card from '../Card'
import { cx } from '../classes'
import { SAFE_MEETUPS, canClose } from '../../../lib/user/messages'

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

function InfoCard({ title, children }) {
  return (
    <Card as="section" padding="md">
      <h2 className="m-0 mb-1.5 text-body font-bold text-ink">{title}</h2>
      <div className="text-caption leading-relaxed text-ink-muted">{children}</div>
    </Card>
  )
}

export default function TradePanel({ thread, busy, onConfirm, onReview, onClose }) {
  const { status, peer, confirmed, closedBy } = thread

  if (thread.kind === 'support') {
    return (
      <InfoCard title="Hỗ trợ từ LostLink">
        <p className="m-0">
          LostLink sẽ hỗ trợ bạn khi có khiếu nại, giao dịch bị treo hoặc sự cố. Bạn có thể gửi kèm
          ảnh chụp màn hình.
        </p>
      </InfoCard>
    )
  }

  if (status === 'request' || status === 'pending') {
    return (
      <InfoCard title="Vì sao chỉ được một tin?">
        <p className="m-0">
          Giới hạn này giúp không ai bị nhắn tin dồn dập. Khi {peer.name} đồng ý, hai bạn nhắn tin
          bình thường. Nếu muốn nhận lại món đồ trên bài Nhặt được có câu hỏi xác minh, trả lời đúng
          câu hỏi sẽ mở kênh trò chuyện ngay.
        </p>
      </InfoCard>
    )
  }

  if (status === 'incoming') {
    return (
      <InfoCard title="Trước khi đồng ý">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-4">
          <li>Đọc kỹ lời giới thiệu, xem có khớp với món đồ của bạn không.</li>
          <li>Xem trang cá nhân và điểm uy tín của người gửi.</li>
          <li>Đồng ý thì bài chuyển sang Đã liên hệ, từ chối thì bài vẫn Đang tìm.</li>
        </ul>
      </InfoCard>
    )
  }

  if (status === 'declined' || status === 'locked' || closedBy) {
    return (
      <InfoCard title={closedBy === 'me' ? 'Bạn đã đóng hội thoại' : 'Hội thoại đã đóng'}>
        <p className="m-0">
          {status === 'declined'
            ? 'Yêu cầu trò chuyện đã bị từ chối, bài đăng vẫn ở trạng thái Đang tìm.'
            : status === 'locked'
              ? 'Hội thoại đã khoá nên không thể trao đổi hay xác nhận trao trả.'
              : closedBy === 'me'
                ? `Tin ${peer.name} gửi thêm vẫn được lưu nhưng không báo cho bạn, mở lại hội thoại để trao đổi tiếp.`
                : `${peer.name} đã đóng hội thoại vì món đồ không khớp. Bạn vẫn nhắn tin được nhưng không xác nhận trao trả được cho tới khi ${peer.name} mở lại.`}
        </p>
      </InfoCard>
    )
  }

  const returned = status === 'returned'

  return (
    <>
      {canClose(thread) && (
        <Button variant="dangerSoft" size="lg" block disabled={busy} onClick={onClose}>
          <Icon name="close" size={16} />
          Đóng hội thoại
        </Button>
      )}

      <Card as="section" padding="sm">
        <h2 className="m-0 mb-0.5 text-body font-bold text-ink">
          {returned ? 'Đã trao trả' : 'Đã nhận được đồ chưa?'}
        </h2>
        <p className="m-0 mb-3 text-caption leading-snug text-ink-muted">
          {returned
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
        {returned ? (
          <Button
            variant={thread.review ? 'secondary' : 'primary'}
            size="lg"
            block
            onClick={onReview}
          >
            <Icon name="star" size={16} />
            {thread.review ? 'Xem lại lời cảm ơn đã gửi' : 'Đánh giá và gửi lời cảm ơn'}
          </Button>
        ) : (
          <Button
            variant={confirmed.me ? 'secondary' : 'primary'}
            size="lg"
            block
            disabled={confirmed.me || busy}
            onClick={onConfirm}
          >
            {confirmed.me
              ? 'Bạn đã xác nhận rồi'
              : thread.receiver
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
