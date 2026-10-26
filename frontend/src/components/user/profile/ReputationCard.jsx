import { formatRating } from '../../../lib/user/profiles'
import Card from '../Card'

// Điểm uy tín cộng đồng và số liệu đi kèm
export default function ReputationCard({ profile, rating }) {
  const stats = [
    ['Món đã trao trả', profile.returned],
    ['Đánh giá trung bình', rating == null ? 'Chưa có' : `${formatRating(rating)} / 5`],
  ]

  return (
    <Card as="section" padding="md">
      <h2 className="m-0 mb-3 text-body font-bold text-ink">Uy tín cộng đồng</h2>
      <p className="m-0 mb-4 flex items-baseline gap-2">
        <span className="text-[34px] leading-none font-bold tracking-tight text-primary">
          {profile.reputation}
        </span>
        <span className="text-caption text-ink-muted">điểm</span>
      </p>
      <dl className="m-0 grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col-reverse rounded-xl bg-surface-muted px-3 py-2.5"
          >
            <dt className="text-tiny text-ink-subtle">{label}</dt>
            <dd className="m-0 text-lead font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
