import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { getUserProfile } from '../../api/users'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import BackLink from '../../components/user/BackLink'
import Button from '../../components/user/Button'
import { buttonClass } from '../../components/user/buttonClass'
import Dialog from '../../components/user/Dialog'
import EmptyState from '../../components/user/EmptyState'
import Note from '../../components/user/Note'
import PostCard from '../../components/user/home/PostCard'
import PostMenu from '../../components/user/post/PostMenu'
import PostStatusTag from '../../components/user/post/PostStatusTag'
import ProfileHeader from '../../components/user/profile/ProfileHeader'
import {
  ProfileAside,
  ProfileLoadError,
  ProfileLoading,
  ProfilePosts,
  profilePageClass,
} from '../../components/user/profile/ProfileSections'
import { useBack, useProfileData } from '../../hooks/useProfileData'
import { toFeedPost } from '../../lib/user/homeFeed'
import { PROFILE_TABS, profilePath, toProfileView } from '../../lib/user/profiles'

const inTab = (post, tab) => !tab || post.type === tab
// Chỉ liên hệ được khi bài chưa trao trả
const CLAIMABLE_STATUSES = ['searching', 'contacted']

// Hộp thoại xác nhận chặn / bỏ chặn
const CONFIRMS = {
  block: {
    title: 'Chặn người dùng này?',
    body: 'Tin của họ sẽ bị ẩn khỏi trang chủ của bạn và hội thoại giữa hai người sẽ bị khóa.',
  },
  unblock: {
    title: 'Bỏ chặn người dùng này?',
    body: 'Tin của họ sẽ hiển thị lại trên trang chủ của bạn.',
  },
}

// Trang cá nhân của người khác. Theo dõi, chặn và thao tác với bài chưa có API nên vẫn
// xử lý ở giao diện như trang chi tiết bài
export default function UserProfilePage({ username }) {
  const navigate = useNavigate()
  const back = useBack()
  const { user } = useAuth()
  const ctx = useOutletContext()
  const { now, liked, toggleLike, saved, followed, notify } = ctx
  const { followedUsers, toggleFollowUser, blockedUsers, blockUser, unblockUser } = ctx
  const load = useCallback(() => getUserProfile(username), [username])
  const { data, error, loading, reload } = useProfileData(load)
  const [tab, setTab] = useState('')
  const [confirming, setConfirming] = useState(null) // null | 'block' | 'unblock'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  if (loading) return <ProfileLoading />
  if (error && !data) return <ProfileLoadError error={error} back={back} onRetry={reload} />

  const profile = toProfileView(data.profile, false)
  // Tên đúng như tài khoản (URL có thể khác hoa thường)
  const name = profile.username
  const posts = data.posts.map((card) => toFeedPost(card, now))
  const blocked = blockedUsers.has(name)
  const following = followedUsers.has(name)

  // Bỏ theo dõi chỉ đổi nút, không cần thông báo
  const toggleFollow = () => {
    toggleFollowUser(name)
    if (!following) notify('Đã theo dõi người dùng.')
  }

  const confirmAction = () => {
    if (confirming === 'block') {
      blockUser(name)
      notify('Đã chặn người dùng.')
    } else unblockUser(name)
    setConfirming(null)
  }

  // Menu đóng ngay sau khi chọn nên báo kết quả lưu, theo dõi
  const toggleWithNotice = (set, toggle, on, off) => (post) => () => {
    toggle(post.id)
    notify(set.has(post.id) ? off : on)
  }
  const toggleSaved = toggleWithNotice(saved, ctx.toggleSaved, 'Đã lưu bài.', 'Đã bỏ lưu bài.')
  const toggleFollowed = toggleWithNotice(
    followed,
    ctx.toggleFollowed,
    'Đã theo dõi bài.',
    'Đã bỏ theo dõi bài.'
  )

  // Thao tác với bài như trang chi tiết, đã chặn thì không liên hệ
  const viewerActions = (post) =>
    [
      !blocked &&
        CLAIMABLE_STATUSES.includes(post.status) && {
          label: post.type === 'lost' ? 'Tôi đang giữ món này' : 'Đây là đồ của tôi',
          icon: 'check',
          onClick: () => ctx.contactAbout(post),
        },
      {
        label: saved.has(post.id) ? 'Bỏ lưu bài' : 'Lưu bài',
        icon: 'bookmark',
        onClick: toggleSaved(post),
      },
      {
        label: followed.has(post.id) ? 'Bỏ theo dõi bài' : 'Theo dõi bài',
        icon: 'bell',
        onClick: toggleFollowed(post),
      },
      {
        label: 'Báo cáo bài đăng',
        icon: 'flag',
        tone: 'danger',
        onClick: () => navigate(`/posts/${post.id}/report`, { state: { post } }),
      },
    ].filter(Boolean)

  const renderPost = (post) => (
    <PostCard
      key={post.id}
      post={post}
      commentCount={post.commentCount}
      liked={liked.has(post.id)}
      onToggleLike={() => toggleLike(post.id)}
      now={now}
      tags={<PostStatusTag status={post.status} />}
      menu={<PostMenu title={post.title} actions={viewerActions(post)} />}
    />
  )

  // Đã chặn thì ẩn nút Theo dõi và đổi Chặn thành Bỏ chặn
  const actions = (
    <>
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
        to={`${profilePath(name)}/report`}
        state={{ reportUser: { username: name } }}
        className={buttonClass({ variant: 'ghost' })}
        aria-label={`Báo cáo ${name}`}
      >
        <Icon name="flag" size={15} />
        Báo cáo
      </Link>
    </>
  )

  return (
    <div className={profilePageClass}>
      <BackLink onClick={back}>Quay lại</BackLink>

      <ProfileHeader profile={profile} actions={actions}>
        {blocked && (
          <Note icon="lock" tone="warning" className="mt-5">
            Bạn đã chặn {name}. Tin của họ không hiện ở Trang chủ của bạn và hội thoại giữa hai
            người đã bị khóa.
          </Note>
        )}
      </ProfileHeader>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProfilePosts
          tabs={PROFILE_TABS}
          tab={tab}
          onTab={setTab}
          posts={posts}
          inTab={inTab}
          renderPost={renderPost}
          empty={() => <EmptyState icon="search" title="Chưa có dữ liệu" />}
        />
        <ProfileAside
          profile={profile}
          data={data}
          me={user.username}
          emptyText="Chưa có dữ liệu"
        />
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
                Xác nhận
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
