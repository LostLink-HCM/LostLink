import { Link, useLocation } from 'react-router-dom'
import { useCommunityBoard } from '../../../hooks/useCommunityBoard'
import { profilePath } from '../../../lib/user/profiles'
import { communityStatItems, quarterLabel } from '../../../lib/user/reputation'
import Icon from '../../common/Icon'
import Card from '../Card'
import RankFrame from '../RankFrame'
import { cx, focusRing } from '../classes'
import { SKY_STARS } from './skyStars'

function LeaderRow({ leader }) {
  return (
    <>
      {/* Ô khung 48px có phần đệm cho hoạ tiết; kéo sát lại để các dòng gọn hơn */}
      <RankFrame
        rank={leader.rank}
        name={leader.username}
        src={leader.avatarUrl}
        showRank
        className="-my-1"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-caption font-semibold text-ink">
          {leader.username}
        </span>
        <span className="block text-micro text-ink-subtle">{leader.returned} món đã trao trả</span>
      </span>
      <span className="text-small font-bold text-primary">
        {leader.points}
        <span className="sr-only"> điểm trong quý</span>
      </span>
    </>
  )
}

export default function RightRail({ isGuest, limit = 5, titled = true }) {
  const { pathname } = useLocation()
  const { leaders, stats, loading, failed } = useCommunityBoard(limit)
  if (failed) return null

  return (
    <div className="flex flex-col gap-4">
      <Card as="section" padding="sm" aria-label={titled ? undefined : 'Bảng vinh danh'}>
        {titled && (
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="m-0 text-body font-bold text-ink">Bảng vinh danh</h2>
            <span className="text-micro text-ink-subtle">{quarterLabel()}</span>
          </div>
        )}
        {loading ? (
          <div role="status" aria-label="Đang tải bảng vinh danh" className="flex flex-col gap-2">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-10 animate-pulse rounded-xl bg-line-subtle" />
            ))}
          </div>
        ) : leaders.length ? (
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
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
                    'flex items-center gap-3 rounded-xl px-2 py-1.5 no-underline transition-colors hover:bg-surface-muted',
                    focusRing
                  )}
                >
                  <LeaderRow leader={leader} />
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
        {!loading && leaders.length > 0 && (
          <Link
            to="/leaderboard"
            className={cx(
              'mt-2 flex items-center justify-center gap-1 rounded-xl py-2 text-caption font-semibold text-primary no-underline transition-colors hover:bg-primary-subtle',
              focusRing
            )}
          >
            Xem bảng vinh danh
            <Icon name="next" size={14} />
          </Link>
        )}
        {!loading && !leaders.length && (
          <p className="m-0 rounded-xl bg-surface-muted px-3 py-5 text-center text-caption text-ink-muted">
            Quý này chưa có lượt trao trả nào
          </p>
        )}
      </Card>

      {/* Nền trời giống header, chiều và đêm có thêm sao */}
      <section className="relative isolate overflow-hidden rounded-2xl bg-au-sky-1 bg-linear-to-br from-au-sky-1 to-au-sky-2 px-4.5 py-4 text-white">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-(--au-star-opacity)"
          style={{ backgroundImage: SKY_STARS }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-12 -z-10 size-36 rounded-full bg-au-glow blur-2xl"
        />
        <h2 className="m-0 mb-3 text-body font-bold">Cộng đồng LostLink</h2>
        {/* Cột trái vừa đủ nhãn ngắn, cột phải lấy phần còn lại để nhãn dài không xuống hàng */}
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3.5">
          {(stats ? communityStatItems(stats) : []).map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="mt-0.5 text-micro whitespace-nowrap text-white/70">{stat.label}</dt>
              <dd
                className={cx(
                  'm-0 text-[18px] font-bold tracking-tight',
                  stat.accent ? 'text-au-accent' : 'text-white'
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
