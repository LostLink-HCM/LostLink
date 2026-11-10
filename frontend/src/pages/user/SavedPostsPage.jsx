import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { getSavedPosts } from '../../api/users'
import Icon from '../../components/common/Icon'
import BackLink from '../../components/user/BackLink'
import Button from '../../components/user/Button'
import Card, { cardClass } from '../../components/user/Card'
import EmptyState from '../../components/user/EmptyState'
import { cx } from '../../components/user/classes'
import PostCard from '../../components/user/home/PostCard'
import TypeTag from '../../components/user/home/TypeTag'
import PostStatusTag from '../../components/user/post/PostStatusTag'
import { useBack, useProfileData } from '../../hooks/useProfileData'
import { toFeedPost } from '../../lib/user/homeFeed'

const pageClass = 'mx-auto max-w-200 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'

// Bài đã lưu, mới lưu trước. Bài bị ẩn hiện mờ, vẫn bỏ lưu được
export default function SavedPostsPage() {
  const back = useBack()
  const { now, interactions } = useOutletContext()
  const { data, error, loading, reload } = useProfileData(getSavedPosts)
  // Bài vừa bỏ lưu thì ẩn ngay
  const [removed, setRemoved] = useState(() => new Set())

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const unsave = async (item) => {
    const saved = await interactions.toggleSaved({ id: item.id, viewer: { saved: true } })
    if (saved === false) setRemoved((prev) => new Set(prev).add(item.id))
  }

  const items = (data?.items ?? []).filter((item) => !removed.has(item.id))

  let content
  if (loading) {
    content = (
      <div className="flex flex-col gap-4" role="status" aria-label="Đang tải bài đã lưu">
        {[0, 1].map((key) => (
          <div key={key} className="h-48 animate-pulse rounded-2xl bg-line-subtle" />
        ))}
      </div>
    )
  } else if (error && !data) {
    content = (
      <Card className="pb-8">
        <EmptyState icon="warning" title="Không thể tải danh sách, vui lòng thử lại" />
        <div className="flex justify-center">
          <Button onClick={reload}>Thử lại</Button>
        </div>
      </Card>
    )
  } else if (!items.length) {
    content = (
      <Card>
        <EmptyState icon="bookmark" title="Bạn chưa lưu bài nào" />
      </Card>
    )
  } else {
    content = (
      <div className="flex flex-col gap-4">
        {items.map((item) =>
          item.available ? (
            <SavedCard
              key={item.id}
              item={item}
              now={now}
              interactions={interactions}
              onUnsave={unsave}
            />
          ) : (
            <UnavailableCard key={item.id} item={item} onUnsave={unsave} />
          )
        )}
      </div>
    )
  }

  return (
    <div className={pageClass}>
      <BackLink onClick={back}>Quay lại</BackLink>
      <h1 className="m-0 mb-1 text-heading font-bold tracking-tight text-ink">Đã lưu</h1>
      <p className="m-0 mb-5 text-small text-ink-muted">
        Bài bạn đã lưu để xem lại, mới lưu nằm trên cùng.
      </p>
      {content}
    </div>
  )
}

const unsaveButton = (item, onUnsave) => (
  <Button size="sm" onClick={() => onUnsave(item)} aria-label={`Bỏ lưu bài ${item.title}`}>
    <Icon name="bookmark" size={13} />
    Bỏ lưu
  </Button>
)

function SavedCard({ item, now, interactions, onUnsave }) {
  const post = toFeedPost(item, now)
  const state = interactions.stateOf(post)
  return (
    <PostCard
      post={post}
      now={now}
      commentCount={post.commentCount}
      liked={state.liked}
      likeCount={state.likes}
      onToggleLike={() => interactions.toggleLike(post)}
      tags={<PostStatusTag status={post.status} />}
      footer={<div className="flex justify-end">{unsaveButton(item, onUnsave)}</div>}
    />
  )
}

// Bài không còn công khai: chỉ còn tiêu đề
function UnavailableCard({ item, onUnsave }) {
  return (
    <article
      className={cx(cardClass, 'flex flex-col gap-3 p-4 opacity-70 sm:flex-row sm:items-center')}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <TypeTag type={item.type} />
          <span className="text-tiny text-ink-subtle">Bài không còn khả dụng</span>
        </div>
        <h2 className="m-0 truncate text-lead font-bold text-ink-secondary">{item.title}</h2>
      </div>
      {unsaveButton(item, onUnsave)}
    </article>
  )
}
