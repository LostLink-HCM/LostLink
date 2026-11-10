import { toReviewItems } from '../../../lib/user/profiles'
import BackLink from '../BackLink'
import Button from '../Button'
import Card from '../Card'
import EmptyState from '../EmptyState'
import { cx, focusRing } from '../classes'
import ReputationCard from './ReputationCard'
import ReviewList from './ReviewList'

// Phần dùng chung của trang cá nhân (của mình và của người khác)

export const profilePageClass = 'mx-auto max-w-300 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'

export function ProfileLoading() {
  return (
    <div className={profilePageClass} role="status" aria-label="Đang tải hồ sơ">
      <div className="mb-5 h-40 animate-pulse rounded-2xl bg-line-subtle" />
      <div className="h-64 animate-pulse rounded-2xl bg-line-subtle" />
    </div>
  )
}

// 404 báo không tìm thấy người dùng, lỗi khác cho thử lại
export function ProfileLoadError({ error, back, onRetry }) {
  const missing = error.status === 404
  return (
    <div className={profilePageClass}>
      <BackLink onClick={back}>Quay lại</BackLink>
      <Card className="pb-8">
        <EmptyState
          icon={missing ? 'user' : 'warning'}
          title={missing ? 'Không tìm thấy người dùng' : 'Không thể tải hồ sơ, vui lòng thử lại'}
          description={missing ? 'Tài khoản không tồn tại hoặc đã bị xóa.' : undefined}
        />
        {!missing && (
          <div className="flex justify-center">
            <Button onClick={onRetry}>Thử lại</Button>
          </div>
        )}
      </Card>
    </div>
  )
}

const tabClass = (active) =>
  cx(
    'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-caption font-semibold transition-colors',
    active
      ? 'border-primary bg-primary text-white'
      : 'border-line bg-surface text-ink-secondary hover:bg-surface-muted',
    focusRing
  )

// Mục Bài đăng: tab lọc kèm số bài, danh sách và nội dung khi trống (empty)
export function ProfilePosts({ tabs, tab, onTab, posts, inTab, renderPost, note, empty }) {
  const shown = posts.filter((post) => inTab(post, tab))
  return (
    <section aria-labelledby="profile-posts" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="profile-posts" className="m-0 text-title font-bold text-ink">
          Bài đăng
        </h2>
        <div role="group" aria-label="Lọc bài đăng" className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={tab === item.value}
              onClick={() => onTab(item.value)}
              className={tabClass(tab === item.value)}
            >
              {item.label}
              <span className="opacity-70">
                {posts.filter((post) => inTab(post, item.value)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {shown.length > 0 && note}
      {shown.length > 0 ? (
        <div className="flex flex-col gap-4">{shown.map(renderPost)}</div>
      ) : (
        <Card>{empty(tab)}</Card>
      )}
    </section>
  )
}

// Cột phải: uy tín cộng đồng và "Người khác nói gì"
export function ProfileAside({ profile, data, me, emptyText }) {
  return (
    <aside className="flex flex-col gap-4">
      <ReputationCard profile={profile} rating={data.rating.average} />
      <ReviewList reviews={toReviewItems(data.reviews)} me={me} emptyText={emptyText} />
    </aside>
  )
}
