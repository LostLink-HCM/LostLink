import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { blockUser, followUser, getUserProfile, unblockUser, unfollowUser } from '../../api/users'
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

const FAILED = 'Đã có lỗi xảy ra, vui lòng thử lại.'

// Trang cá nhân của người khác: theo dõi, chặn qua API; thao tác với bài như trang chi tiết bài
export default function UserProfilePage({ username }) {
  const navigate = useNavigate()
  const back = useBack()
  const { user } = useAuth()
  const ctx = useOutletContext()
  const { now, interactions, notify } = ctx
  // Hội thoại còn là dữ liệu mẫu ở UserLayout, đồng bộ để khóa/mở khóa ở trang Tin nhắn
  const { blockUser: lockChat, unblockUser: unlockChat } = ctx
  const load = useCallback(() => getUserProfile(username), [username])
  const { data, error, loading, reload } = useProfileData(load)
  const [tab, setTab] = useState('')
  const [confirming, setConfirming] = useState(null) // null | 'block' | 'unblock'
  // Trạng thái sau thao tác gần nhất, trước đó dùng trạng thái server trả kèm hồ sơ
  const [relation, setRelation] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  if (loading) return <ProfileLoading />
  if (error && !data) return <ProfileLoadError error={error} back={back} onRetry={reload} />

  const profile = toProfileView(data.profile, false)
  // Tên đúng như tài khoản (URL có thể khác hoa thường)
  const name = profile.username
  const posts = data.posts.map((card) => toFeedPost(card, now))
  const { following, blocked } = relation ?? data.viewer

  // Lỗi thì giữ nguyên trạng thái nút
  const run = async (action) => {
    setBusy(true)
    try {
      await action()
    } catch (err) {
      notify(err.status && err.status < 500 ? err.message : FAILED)
    } finally {
      setBusy(false)
    }
  }

  // Bỏ theo dõi chỉ đổi nút, không cần thông báo
  const toggleFollow = () =>
    run(async () => {
      const res = await (following ? unfollowUser(name) : followUser(name))
      setRelation({ following: res.data.following, blocked })
      if (res.data.following) notify('Đã theo dõi người dùng.')
    })

  // Chặn thì server bỏ theo dõi hai chiều; tải lại để ẩn/hiện bài của người đó
  const confirmAction = () => {
    const blocking = confirming === 'block'
    setConfirming(null)
    run(async () => {
      if (blocking) {
        await blockUser(name)
        lockChat(name)
        notify('Đã chặn người dùng.')
      } else {
        await unblockUser(name)
        unlockChat(name)
      }
      setRelation({ following: false, blocked: blocking })
      reload()
    })
  }

  // Thao tác với bài như trang chi tiết, đã chặn thì không liên hệ
  const viewerActions = (post) =>
    [
      !blocked &&
        CLAIMABLE_STATUSES.includes(post.status) && {
          label: post.type === 'lost' ? 'Tôi đang giữ món này' : 'Đây là đồ của tôi',
          icon: 'check',
          onClick: () => ctx.claimPost(post),
        },
      {
        label: interactions.stateOf(post).saved ? 'Bỏ lưu bài' : 'Lưu bài',
        icon: 'bookmark',
        onClick: () => interactions.toggleSaved(post),
      },
      {
        label: interactions.stateOf(post).following ? 'Bỏ theo dõi bài' : 'Theo dõi bài',
        icon: 'bell',
        onClick: () => interactions.toggleFollowed(post),
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
      liked={interactions.stateOf(post).liked}
      likeCount={interactions.stateOf(post).likes}
      onToggleLike={() => interactions.toggleLike(post)}
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
          disabled={busy}
          onClick={toggleFollow}
        >
          <Icon name="bell" size={15} />
          {following ? 'Đang theo dõi' : 'Theo dõi'}
        </Button>
      )}
      {blocked ? (
        <Button disabled={busy} onClick={() => setConfirming('unblock')}>
          Bỏ chặn
        </Button>
      ) : (
        <Button variant="dangerSoft" disabled={busy} onClick={() => setConfirming('block')}>
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
            Bạn đã chặn {name}.
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
