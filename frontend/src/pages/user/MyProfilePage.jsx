import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { getMyProfile } from '../../api/users'
import Icon from '../../components/common/Icon'
import BackLink from '../../components/user/BackLink'
import Button from '../../components/user/Button'
import { buttonClass } from '../../components/user/buttonClass'
import EmptyState from '../../components/user/EmptyState'
import PostCard from '../../components/user/home/PostCard'
import { ClosePostDialog, DeletePostDialog } from '../../components/user/post/PostManageDialogs'
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
import { PROFILE_TABS, toProfileView } from '../../lib/user/profiles'

const COMING_SOON = 'Chức năng này đang được phát triển.'

// Tất cả, Mất đồ, Nhặt được gồm cả bài chờ duyệt; Chờ duyệt gồm Chờ duyệt và Bị từ chối
const REVIEWING_STATUSES = ['pending', 'rejected']
// Chờ duyệt đứng ngay sau Tất cả
const [ALL_TAB, ...TYPE_TABS] = PROFILE_TABS
const MY_TABS = [ALL_TAB, { value: 'reviewing', label: 'Chờ duyệt' }, ...TYPE_TABS]
const inTab = (post, tab) => {
  if (!tab) return true
  if (tab === 'reviewing') return REVIEWING_STATUSES.includes(post.status)
  return post.type === tab
}

// Bài từ API → dữ liệu PostCard, kèm quyền quản lý bài
const toMyPost = (card, now) => ({ ...toFeedPost(card, now), manage: card.manage })

// Nhãn trạng thái cạnh nhãn loại tin
const myPostTags = (post) => (
  <>
    <PostStatusTag status={post.status} />
    {post.manage.isHidden && <PostStatusTag status="hidden" />}
  </>
)

// Lý do bị từ chối ở cuối thẻ
const rejectReasonOf = (post) =>
  post.status === 'rejected' && post.manage.rejectReason ? (
    <p className="m-0 border-t border-line-subtle pt-3 text-caption text-danger-ink">
      Lý do từ chối: {post.manage.rejectReason}
    </p>
  ) : null

// Mục trong menu ⋯, không được phép thì không hiện
const ownerActions = (post, { onEdit, onClose, onDelete }) =>
  [
    post.manage.canEdit && { label: 'Sửa bài', icon: 'edit', onClick: onEdit },
    post.manage.canClose && { label: 'Đóng bài', icon: 'lock', onClick: onClose },
    { label: 'Xóa bài', icon: 'trash', tone: 'danger', onClick: onDelete },
  ].filter(Boolean)

// Trang cá nhân của mình: hồ sơ, bài của tôi (có quản lý bài), lời cảm ơn
export default function MyProfilePage() {
  const navigate = useNavigate()
  const back = useBack()
  const { now, liked, toggleLike, notify } = useOutletContext()
  const { data, error, loading, reload } = useProfileData(getMyProfile)
  const [tab, setTab] = useState('')
  // { kind: 'close' | 'delete', post }
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  if (loading) return <ProfileLoading />
  if (error && !data) return <ProfileLoadError error={error} back={back} onRetry={reload} />

  const profile = toProfileView(data.profile, true)
  // Bài công khai và bài chờ duyệt gộp một danh sách, mới nhất trước
  const posts = [...data.posts, ...data.reviewingPosts]
    .map((card) => toMyPost(card, now))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const closeDialog = () => setDialog(null)
  const done = (message) => {
    setDialog(null)
    notify(message)
    reload()
  }
  const failed = (failure, message) => {
    setDialog(null)
    notify(message)
    if (failure.status === 409) reload()
  }

  const renderPost = (post) => (
    <PostCard
      key={post.id}
      post={post}
      commentCount={post.commentCount}
      liked={liked.has(post.id)}
      onToggleLike={() => toggleLike(post.id)}
      now={now}
      menu={
        <PostMenu
          title={post.title}
          actions={ownerActions(post, {
            onEdit: () => navigate(`/posts/${post.id}/edit`),
            onClose: () => setDialog({ kind: 'close', post }),
            onDelete: () => setDialog({ kind: 'delete', post }),
          })}
        />
      }
      tags={myPostTags(post)}
      footer={rejectReasonOf(post)}
    />
  )

  // Chưa đăng bài nào thì gợi ý đăng bài, ở mọi tab
  const empty = (current) =>
    posts.length === 0 ? (
      <div className="pb-8">
        <EmptyState icon="compose" title="Bạn chưa có bài đăng nào" />
        <div className="flex justify-center">
          <Link to="/posts/new" className={buttonClass({ variant: 'primary' })}>
            Đăng bài
          </Link>
        </div>
      </div>
    ) : (
      <EmptyState
        icon="search"
        title={current === 'reviewing' ? 'Không có bài nào đang chờ duyệt' : 'Chưa có dữ liệu'}
      />
    )

  return (
    <div className={profilePageClass}>
      <BackLink onClick={back}>Quay lại</BackLink>

      <ProfileHeader
        profile={profile}
        actions={
          <Button onClick={() => notify(COMING_SOON)}>
            <Icon name="edit" size={15} />
            Chỉnh sửa hồ sơ
          </Button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProfilePosts
          tabs={MY_TABS}
          tab={tab}
          onTab={setTab}
          posts={posts}
          inTab={inTab}
          renderPost={renderPost}
          note={
            tab === 'reviewing' && (
              <p className="m-0 mb-4 text-caption text-ink-muted">
                Chỉ bạn thấy các bài này. Bài bị từ chối có thể sửa lại để gửi duyệt lần nữa.
              </p>
            )
          }
          empty={empty}
        />
        <ProfileAside
          profile={profile}
          data={data}
          me={profile.username}
          emptyText="Chưa có đánh giá nào"
        />
      </div>

      {dialog?.kind === 'close' && (
        <ClosePostDialog
          post={dialog.post}
          onClose={closeDialog}
          onDone={() => done('Cập nhật trạng thái bài thành công.')}
          onFailed={failed}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeletePostDialog
          post={dialog.post}
          activeTalks={dialog.post.manage.activeTalks}
          onClose={closeDialog}
          onDone={() => done('Đã xóa bài đăng.')}
          onFailed={failed}
        />
      )}
    </div>
  )
}
