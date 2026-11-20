import { Link } from 'react-router-dom'
import { useQuarterRank } from '../../../hooks/useQuarterRank'
import { joinedLabel } from '../../../lib/user/profiles'
import Avatar from '../Avatar'
import Card from '../Card'
import RankFrame from '../RankFrame'
import { cx } from '../classes'

const badgeTones = {
  good: 'bg-success-soft text-success',
  love: 'bg-[#fdecef] text-[#d93a5b]',
  bad: 'bg-danger-soft text-danger-ink',
  neutral: 'bg-neutral-soft text-neutral',
}

// Phần đầu hồ sơ: ảnh đại diện, tên, huy hiệu, giới thiệu và các nút hành động
// stats: vài số liệu nhỏ hiện dưới tên (số bài, món đã trao trả, đánh giá)
export default function ProfileHeader({ profile, stats = [], actions, children }) {
  const meta = [joinedLabel(profile.joinedAt)].filter(Boolean)
  // Top 5 bảng vinh danh quý này có khung ảnh theo hạng như ở bảng vinh danh
  const rank = useQuarterRank(profile.username)

  return (
    <Card as="section" aria-label={`Hồ sơ của ${profile.username}`} className="mb-5 p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        {rank ? (
          // Ảnh cùng cỡ với ảnh thường (80px, 96px từ sm); hoạ tiết chỉ lấn lên trên và xuống dưới, không đè tên
          <RankFrame
            rank={rank}
            initials={profile.initials}
            src={profile.avatarUrl}
            unitClass="[--u:2.5px] sm:[--u:3px]"
            className="-my-[calc(var(--u)*5)]"
          />
        ) : (
          <Avatar initials={profile.initials} src={profile.avatarUrl} size="2xl" />
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="m-0 truncate text-heading font-bold tracking-tight text-ink">
              {profile.username}
            </h1>
            {profile.isMe && (
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-tiny font-semibold text-primary">
                Bạn
              </span>
            )}
          </div>

          {profile.badges.length > 0 && (
            <ul aria-label="Huy hiệu" className="m-0 mb-2.5 flex list-none flex-wrap gap-1.5 p-0">
              {profile.badges.map((badge) => {
                const { name, tone } = badge
                return (
                  <li
                    key={name}
                    title={badge.description || undefined}
                    className={cx(
                      'rounded-full px-2.5 py-1 text-tiny font-semibold',
                      badgeTones[tone] ?? badgeTones.neutral
                    )}
                  >
                    {name}
                  </li>
                )
              })}
            </ul>
          )}

          {profile.bio && <p className="m-0 mb-1.5 text-small text-ink-secondary">{profile.bio}</p>}
          {/* Hồ sơ của mình chưa có giới thiệu thì gợi ý viết thêm */}
          {!profile.bio && profile.isMe && (
            <p className="m-0 mb-1.5 text-small text-ink-muted">
              Thêm vài dòng giới thiệu để mọi người biết bạn hơn.{' '}
              <Link to="/settings/profile" className="font-semibold text-primary hover:underline">
                Viết giới thiệu
              </Link>
            </p>
          )}
          {stats.length > 0 && (
            <p className="m-0 mb-1 text-small font-medium text-ink-secondary">
              {stats.join(' · ')}
            </p>
          )}
          {meta.length > 0 && <p className="m-0 text-tiny text-ink-subtle">{meta.join(' · ')}</p>}
        </div>

        {actions && <div className="flex flex-wrap gap-2 sm:self-start">{actions}</div>}
      </div>

      {children}
    </Card>
  )
}
