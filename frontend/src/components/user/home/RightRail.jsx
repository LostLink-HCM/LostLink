import { Link, useLocation } from 'react-router-dom'
import { communityStats } from '../../../data/homeFeed'
import { profilePath } from '../../../lib/user/profiles'
import { quarterLabel, quarterLeaders } from '../../../lib/user/reputation'
import Avatar from '../Avatar'
import Card from '../Card'
import { cx, focusRing } from '../classes'

// Huy hiệu vàng, bạc, đồng cho ba người đứng đầu, kèm viền cùng màu quanh ảnh đại diện
const MEDALS = {
  1: { badge: 'bg-[#f5c542] text-[#5c4100]', ring: 'ring-[#f5c542]' },
  2: { badge: 'bg-[#c9d1dc] text-[#3a4352]', ring: 'ring-[#c9d1dc]' },
  3: { badge: 'bg-[#e0a274] text-[#5a2e0e]', ring: 'ring-[#e0a274]' },
}

function LeaderRow({ leader }) {
  const medal = MEDALS[leader.rank]
  return (
    <>
      <span
        className={cx(
          'grid size-5.5 shrink-0 place-items-center rounded-full text-micro font-bold',
          medal ? medal.badge : 'text-ink-subtle'
        )}
      >
        {leader.rank}
      </span>
      <Avatar
        name={leader.username}
        size="sm"
        tone="neutral"
        className={medal && `ring-2 ring-offset-1 ${medal.ring}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-caption font-semibold text-ink">
          {leader.username}
        </span>
        <span className="block text-micro text-ink-subtle">{leader.returned} món đã trao trả</span>
      </span>
      <span className="text-small font-bold text-primary">{leader.points}</span>
    </>
  )
}
export default function RightRail({ isGuest, limit = 5, titled = true }) {
  const { pathname } = useLocation()
  const leaders = quarterLeaders().slice(0, limit)

  return (
    <div className="flex flex-col gap-4">
      <Card as="section" padding="sm" aria-label={titled ? undefined : 'Bảng vinh danh'}>
        {titled && (
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="m-0 text-body font-bold text-ink">Bảng vinh danh</h2>
            <span className="text-micro text-ink-subtle">{quarterLabel()}</span>
          </div>
        )}
        <p className="mt-0 mb-3 text-tiny text-ink-muted">
          Xếp theo điểm uy tín kiếm được trong quý
        </p>
        {leaders.length ? (
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {leaders.map((leader) => (
              <li key={leader.username}>
                {/* Guest đăng nhập xong quay về trang đang xem */}
                <Link
                  to={isGuest ? '/login' : profilePath(leader.username)}
                  state={isGuest ? { from: pathname } : undefined}
                  title={
                    isGuest ? 'Đăng nhập để xem hồ sơ' : `Xem trang cá nhân của ${leader.username}`
                  }
                  className={cx(
                    'flex items-center gap-3 rounded-xl px-2 py-2 no-underline transition-colors hover:bg-surface-muted',
                    focusRing
                  )}
                >
                  <LeaderRow leader={leader} />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 rounded-xl bg-surface-muted px-3 py-5 text-center text-caption text-ink-muted">
            Quý này chưa có lượt trao trả nào
          </p>
        )}
      </Card>

      <section className="rounded-2xl bg-[#1b3358] p-4.5 text-white">
        <h2 className="m-0 mb-4.5 text-body font-bold">Cộng đồng LostLink</h2>
        <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-5">
          {communityStats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="mt-0.5 text-micro text-[#94a4bc]">{stat.label}</dt>
              <dd
                className={cx(
                  'm-0 text-[18px] font-bold tracking-tight',
                  stat.accent ? 'text-[#8fc0f2]' : 'text-white'
                )}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
