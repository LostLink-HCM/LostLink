import { Link } from 'react-router-dom'
import { communityStats, leaders } from '../../../data/homeFeed'
import { profilePath, quarterLabel } from '../../../lib/user/profiles'
import Avatar from '../Avatar'
import Card from '../Card'
import { cx, focusRing } from '../classes'

function LeaderRow({ leader }) {
  return (
    <>
      <span
        className={cx(
          'w-5.5 text-center text-caption font-bold',
          leader.rank <= 3 ? 'text-primary' : 'text-ink-subtle'
        )}
      >
        {leader.rank}
      </span>
      <Avatar name={leader.username} size="sm" tone="neutral" />
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

export default function RightRail({ isGuest }) {
  return (
    <div className="flex flex-col gap-4">
      <Card as="section" padding="sm">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="m-0 text-body font-bold text-ink">Bảng vinh danh</h2>
          <span className="text-micro text-ink-subtle">{quarterLabel()}</span>
        </div>
        <p className="mt-0 mb-3 text-tiny text-ink-muted">Xếp theo điểm uy tín cộng đồng</p>
        <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
          {leaders.map((leader) => (
            <li key={leader.rank}>
              {/* Guest đăng nhập xong quay về Trang chủ */}
              <Link
                to={isGuest ? '/login' : profilePath(leader.username)}
                state={isGuest ? { from: '/' } : undefined}
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
