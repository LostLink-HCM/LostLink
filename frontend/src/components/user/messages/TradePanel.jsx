import { Link } from 'react-router-dom'
import Card from '../Card'
import { SAFE_MEETUPS } from '../../../lib/user/messages'

function InfoCard({ title, children }) {
  return (
    <Card as="section" padding="md">
      <h2 className="m-0 mb-1.5 text-body font-bold text-ink">{title}</h2>
      <div className="text-caption leading-relaxed text-ink-muted">{children}</div>
    </Card>
  )
}

// Bảng ⓘ của hội thoại: giải thích theo trạng thái và gợi ý chỗ hẹn. Thao tác trao trả ở TradeBar
export default function TradePanel({ thread }) {
  const { status, peer, closedBy } = thread

  if (thread.support === 'handler') {
    return (
      <InfoCard title="Yêu cầu hỗ trợ">
        <p className="m-0">
          {peer.name} cần LostLink hỗ trợ. Mọi Moderator đều thấy yêu cầu này; khi bạn bắt đầu trả
          lời, Moderator khác sẽ thấy bạn đang xử lý. Bạn có thể trả lời ngay tại đây hoặc trong{' '}
          <Link to="/moderator/messages" className="font-semibold text-primary">
            Quản lý tin nhắn
          </Link>
          .
        </p>
      </InfoCard>
    )
  }

  if (thread.support === 'internal') {
    return (
      <InfoCard title="Trao đổi nội bộ">
        <p className="m-0">
          Hội thoại giữa Admin và Moderator của LostLink, người dùng không xem được.
        </p>
      </InfoCard>
    )
  }

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

  if (status === 'expired') {
    return (
      <InfoCard title="Yêu cầu đã hết hiệu lực">
        <p className="m-0">
          Bài đăng đã được trao trả hoặc đã đóng trước khi yêu cầu được đồng ý, nên không thể trò
          chuyện về bài này nữa.
        </p>
      </InfoCard>
    )
  }

  if (status === 'ended') {
    const returned = thread.post?.status === 'returned'
    return (
      <InfoCard title={returned ? 'Bài đã được trao trả' : 'Bài đã đóng'}>
        <p className="m-0">
          {returned
            ? 'Bài này đã chuyển sang Đã trao trả nên không cần xác nhận trong hội thoại này nữa.'
            : 'Người đăng đã đóng bài nên không thể xác nhận trao trả qua bài này nữa.'}{' '}
          Hai bạn vẫn nhắn tin được.
        </p>
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

  if (status === 'returned') {
    return (
      <InfoCard title="Đã trao trả">
        <p className="m-0">
          Cả hai đã xác nhận nên bài đăng đã chuyển sang Đã trao trả. Gửi lời cảm ơn để ghi nhận{' '}
          {peer.name} nhé, hai bạn vẫn nhắn tin được.
        </p>
      </InfoCard>
    )
  }

  // Đang mở: cách xác nhận trao trả và gợi ý chỗ hẹn (nút xác nhận nằm ở dải trao trả)
  return (
    <>
      <InfoCard title="Xác nhận trao trả">
        <p className="m-0">
          Gặp nhau và nhận đồ xong thì cả hai bấm xác nhận ở dải trên đầu hội thoại. Khi cả hai cùng
          xác nhận, bài đăng chuyển sang Đã trao trả và không hoàn tác được.
        </p>
      </InfoCard>
      <InfoCard title="Gợi ý chỗ hẹn an toàn">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {SAFE_MEETUPS.map((place) => (
            <li key={place.name} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>
                <span className="block font-medium text-ink">{place.name}</span>
                {place.hint}
              </span>
            </li>
          ))}
        </ul>
      </InfoCard>
    </>
  )
}
