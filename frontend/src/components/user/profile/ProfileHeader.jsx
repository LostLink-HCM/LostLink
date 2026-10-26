import { badgeTone, joinedLabel, quarterLabel } from '../../../lib/userProfiles'
import Avatar from '../Avatar'
import Card from '../Card'
import { cx } from '../classes'

const badgeTones = {
  good: 'bg-success-soft text-success',
  love: 'bg-[#fdecef] text-[#d93a5b]',
  bad: 'bg-danger-soft text-danger-ink',
  neutral: 'bg-neutral-soft text-neutral',
}

// Phần đầu hồ sơ: ảnh đại diện, tên, huy hiệu, giới thiệu và các nút hành động
export default function ProfileHeader({ profile, actions, children }) {
  const meta = [
    joinedLabel(profile.joinedAt),
    profile.rank && `Hạng ${profile.rank} bảng vinh danh ${quarterLabel()}`,
  ].filter(Boolean)

  return (
    <Card as="section" aria-label={`Hồ sơ của ${profile.username}`} className="mb-5 p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Avatar initials={profile.initials} size="2xl" />

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
              {profile.badges.map((badge) => (
                <li
                  key={badge}
                  className={cx(
                    'rounded-full px-2.5 py-1 text-tiny font-semibold',
                    badgeTones[badgeTone(badge)]
                  )}
                >
                  {badge}
                </li>
              ))}
            </ul>
          )}

          {profile.bio && <p className="m-0 mb-1.5 text-small text-ink-secondary">{profile.bio}</p>}
          {meta.length > 0 && <p className="m-0 text-tiny text-ink-subtle">{meta.join(' · ')}</p>}
        </div>

        {actions && <div className="flex flex-wrap gap-2 sm:self-start">{actions}</div>}
      </div>

      {children}
    </Card>
  )
}
