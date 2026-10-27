import { useAuth } from '../../auth/AuthContext'
import RightRail from '../../components/user/home/RightRail'
import { quarterLabel } from '../../lib/user/reputation'

// Màn hình nhỏ không có cột phải => bảng vinh danh có trang riêng, Guest cũng xem được
export default function LeaderboardPage() {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-140 px-4 pt-5 pb-10 sm:px-6 lg:pt-7">
      <h1 className="m-0 mb-1 text-heading font-bold tracking-tight text-ink">Bảng vinh danh</h1>
      <p className="m-0 mb-5 text-small text-ink-muted">
        Người tốt bụng của cộng đồng LostLink · {quarterLabel()}
      </p>
      <RightRail isGuest={!user} limit={10} titled={false} />
    </div>
  )
}
