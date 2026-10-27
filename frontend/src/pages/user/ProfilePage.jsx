import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import BackLink from '../../components/user/BackLink'
import Button from '../../components/user/Button'
import { buttonClass } from '../../components/user/buttonClass'
import Card from '../../components/user/Card'
import Dialog from '../../components/user/Dialog'
import EmptyState from '../../components/user/EmptyState'
import Note from '../../components/user/Note'
import { cx, focusRing } from '../../components/user/classes'
import PostCard from '../../components/user/home/PostCard'
import ProfileHeader from '../../components/user/profile/ProfileHeader'
import ReputationCard from '../../components/user/profile/ReputationCard'
import ReviewList from '../../components/user/profile/ReviewList'
import {
  PROFILE_TABS,
  averageRating,
  findProfile,
  postsBy,
  profilePath,
  reviewsAbout,
} from '../../lib/user/profiles'

const COMING_SOON = 'Chức năng này đang được phát triển.'
// Trang của mình chỉ hiện bài Đang tìm và Đã liên hệ
const OWN_STATUSES = ['searching', 'contacted']

// Hộp thoại xác nhận chặn / bỏ chặn
const CONFIRMS = {
  block: {
    title: 'Chặn người dùng này?',
    body: 'Tin của họ sẽ bị ẩn khỏi trang chủ của bạn và hội thoại giữa hai người sẽ bị khóa.',
    action: 'Xác nhận',
  },
  unblock: {
    title: 'Bỏ chặn người dùng này?',
    body: 'Tin của họ sẽ hiển thị lại trên trang chủ của bạn.',
    action: 'Xác nhận',
  },
}
const pageClass = 'mx-auto max-w-300 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'

const tabClass = (active) =>
  cx(
    'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-caption font-semibold transition-colors',
    active
      ? 'border-primary bg-primary text-white'
      : 'border-line bg-surface text-ink-secondary hover:bg-surface-muted',
    focusRing
  )

// Có trang trước trong lịch sử thì quay lại đúng chỗ (bài đăng, tin nhắn...), không thì về Trang chủ
function useBack() {
  const location = useLocation()
  const navigate = useNavigate()
  return location.key === 'default' ? () => navigate('/') : () => navigate(-1)
}

// Trang cá nhân: hồ sơ người khác hoặc của chính mình
export default function ProfilePage() {
  const { username } = useParams()
  // Đổi người xem thì làm mới bộ lọc và hộp thoại
  return <ProfileView key={username} username={username} />
}

function ProfileView({ username }) {
  const { user } = useAuth()
  const back = useBack()
  const ctx = useOutletContext()
  const { posts, comments, now, liked, toggleLike, chat, reviews, notify } = ctx
  const { followedUsers, toggleFollowUser, blockedUsers, blockUser, unblockUser } = ctx
  const [tab, setTab] = useState('')
  const [confirming, setConfirming] = useState(null) // null | 'block' | 'unblock'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const profile = useMemo(() => findProfile(username, { posts, me: user }), [username, posts, user])

  const reviewList = useMemo(
    () => reviewsAbout(username, { threads: chat.threads, myReviews: reviews, me: user }),
    [username, chat.threads, reviews, user]
  )

  const commentCounts = useMemo(() => {
    const counts = {}
    for (const item of comments) counts[item.postId] = (counts[item.postId] ?? 0) + 1
    return counts
  }, [comments])

  // Tài khoản không tồn tại hoặc đã bị xóa
  if (!profile) {
    return (
      <div className={pageClass}>
        <BackLink onClick={back}>Quay lại</BackLink>
        <Card>
          <EmptyState
            icon="user"
            title="Không tìm thấy người dùng"
            description="Tài khoản không tồn tại hoặc đã bị xóa."
          />
        </Card>
      </div>
    )
  }

  const blocked = blockedUsers.has(username)
  const following = followedUsers.has(username)
  const listOf = (type = '') =>
    postsBy(posts, username, type).filter(
      (post) => !profile.isMe || OWN_STATUSES.includes(post.status)
    )
  const allPosts = listOf()
  const shown = listOf(tab)

  // Bỏ theo dõi chỉ đổi nút, không cần thông báo
  const toggleFollow = () => {
    toggleFollowUser(username)
    if (!following) notify('Đã theo dõi người dùng.')
  }

  const confirmAction = () => {
    if (confirming === 'block') {
      blockUser(username)
      notify('Đã chặn người dùng.')
    } else unblockUser(username)
    setConfirming(null)
  }

  // Hồ sơ của mình không có Theo dõi, Chặn, Báo cáo
  const actions = profile.isMe ? (
    <Button onClick={() => notify(COMING_SOON)}>
      <Icon name="edit" size={15} />
      Chỉnh sửa hồ sơ
    </Button>
  ) : (
    <>
      {/* Đã chặn thì ẩn nút Theo dõi và đổi Chặn thành Bỏ chặn */}
      {!blocked && (
        <Button
          variant={following ? 'secondary' : 'primary'}
          pressed={following}
          onClick={toggleFollow}
        >
          <Icon name="bell" size={15} />
          {following ? 'Đang theo dõi' : 'Theo dõi'}
        </Button>
      )}
      {blocked ? (
        <Button onClick={() => setConfirming('unblock')}>Bỏ chặn</Button>
      ) : (
        <Button variant="dangerSoft" onClick={() => setConfirming('block')}>
          Chặn
        </Button>
      )}
      <Link
        to={`${profilePath(username)}/report`}
        className={buttonClass({ variant: 'ghost' })}
        aria-label={`Báo cáo ${username}`}
      >
        <Icon name="flag" size={15} />
        Báo cáo
      </Link>
    </>
  )

  const emptyPosts = profile.isMe && allPosts.length === 0

  return (
    <div className={pageClass}>
      <BackLink onClick={back}>Quay lại</BackLink>

      <ProfileHeader profile={profile} actions={actions}>
        {blocked && (
          <Note icon="lock" tone="warning" className="mt-5">
            Bạn đã chặn {username}. Tin của họ không hiện ở Trang chủ của bạn và hội thoại giữa hai
            người đã bị khóa.
          </Note>
        )}
      </ProfileHeader>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="profile-posts" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="profile-posts" className="m-0 text-title font-bold text-ink">
              Bài đăng
            </h2>
            <div role="group" aria-label="Lọc theo loại tin" className="flex gap-2">
              {PROFILE_TABS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={tab === item.value}
                  onClick={() => setTab(item.value)}
                  className={tabClass(tab === item.value)}
                >
                  {item.label}
                  <span className="opacity-70">{listOf(item.value).length}</span>
                </button>
              ))}
            </div>
          </div>

          {shown.length > 0 ? (
            <div className="flex flex-col gap-4">
              {shown.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  commentCount={commentCounts[post.id] ?? 0}
                  liked={liked.has(post.id)}
                  onToggleLike={() => toggleLike(post.id)}
                  now={now}
                />
              ))}
            </div>
          ) : (
            <Card>
              {emptyPosts ? (
                // Chưa đăng bài nào thì gợi ý đăng bài
                <div className="pb-8">
                  <EmptyState icon="compose" title="Bạn chưa có bài đăng nào" />
                  <div className="flex justify-center">
                    <Link to="/posts/new" className={buttonClass({ variant: 'primary' })}>
                      Đăng bài
                    </Link>
                  </div>
                </div>
              ) : (
                // Chưa có bài theo bộ lọc đang chọn
                <EmptyState icon="search" title="Chưa có dữ liệu" />
              )}
            </Card>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <ReputationCard profile={profile} rating={averageRating(reviewList)} />
          {/* Trống: trang của mình "Chưa có đánh giá nào", người khác "Chưa có dữ liệu" */}
          <ReviewList
            reviews={reviewList}
            me={user.username}
            emptyText={profile.isMe ? 'Chưa có đánh giá nào' : 'Chưa có dữ liệu'}
          />
        </aside>
      </div>

      {confirming && (
        <Dialog
          title={CONFIRMS[confirming].title}
          size="sm"
          onClose={() => setConfirming(null)}
          footer={
            <>
              <Button onClick={() => setConfirming(null)} data-autofocus>
                Hủy
              </Button>
              <Button
                variant={confirming === 'block' ? 'danger' : 'primary'}
                onClick={confirmAction}
              >
                {CONFIRMS[confirming].action}
              </Button>
            </>
          }
        >
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            {CONFIRMS[confirming].body}
          </p>
        </Dialog>
      )}
    </div>
  )
}
