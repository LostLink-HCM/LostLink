import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/common/Icon'
import EmptyState from '../components/moderator/EmptyState'
import { cx, focusRing } from '../components/moderator/classes'
import FeedFilters from '../components/home/FeedFilters'
import PostCard from '../components/home/PostCard'
import RightRail from '../components/home/RightRail'
import SearchBox from '../components/home/SearchBox'
import StickyPanel from '../components/home/StickyPanel'
import { DEFAULT_FILTERS, filterPosts, validateFilters } from '../lib/homeFeed'

export default function HomePage() {
  const { user } = useAuth()
  const { posts, comments, now, search, keyword, filters, liked, toggleLike } = useOutletContext()
  const { draft, setDraft, applied, setApplied } = filters
  const [filterError, setFilterError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const shown = useMemo(
    () => filterPosts(posts, applied, keyword, now),
    [posts, applied, keyword, now]
  )

  const commentCounts = useMemo(() => {
    const counts = {}
    for (const item of comments) counts[item.postId] = (counts[item.postId] ?? 0) + 1
    return counts
  }, [comments])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const filterProps = {
    draft,
    error: filterError,
    onChange: (patch) => {
      setDraft((prev) => ({ ...prev, ...patch }))
      setFilterError('')
    },
    onApply: () => {
      const error = validateFilters(draft)
      setFilterError(error)
      if (error) return
      setApplied(draft)
      setDrawerOpen(false)
    },
    onReset: () => {
      setDraft(DEFAULT_FILTERS)
      setApplied(DEFAULT_FILTERS)
      setFilterError('')
    },
  }

  return (
    <>
      <div className="mx-auto max-w-360 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7">
        <h1 className="sr-only">Bài đăng mới trên LostLink</h1>

        {/* Trên mobile bộ lọc nằm trong drawer, mở bằng nút cạnh ô tìm kiếm */}
        <div className="mb-4 flex items-center gap-2 lg:hidden">
          <SearchBox id="feed-search" {...search} className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={cx(
              'inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-caption font-medium text-ink',
              focusRing
            )}
          >
            <Icon name="settings" size={14} />
            Bộ lọc
          </button>
        </div>

        <main className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_272px]">
          <StickyPanel
            aria-label="Bộ lọc bài đăng"
            className="hidden rounded-2xl border border-line bg-surface p-4 shadow-card lg:block"
          >
            <FeedFilters {...filterProps} idPrefix="filter" />
          </StickyPanel>

          <section aria-label="Danh sách bài đăng" className="min-w-0">
            {shown.length ? (
              <div className="flex flex-col gap-4">
                {shown.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    now={now}
                    commentCount={commentCounts[post.id] ?? 0}
                    liked={liked.has(post.id)}
                    onToggleLike={() => toggleLike(post.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-surface">
                <EmptyState
                  icon="search"
                  title="Không tìm thấy bài đăng phù hợp"
                  description="Thử từ khoá khác, mở rộng khoảng thời gian hoặc bấm “Xóa lọc”."
                />
              </div>
            )}
          </section>

          <StickyPanel aria-label="Cộng đồng" className="hidden xl:block">
            <RightRail isGuest={!user} />
          </StickyPanel>
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng bộ lọc"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 cursor-default border-0 bg-ink/45 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Bộ lọc bài đăng"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-85 flex-col rounded-r-3xl bg-surface shadow-dialog motion-safe:animate-ll-fade"
          >
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setDrawerOpen(false)}
                className={cx(
                  'grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-muted hover:bg-line-subtle',
                  focusRing
                )}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <FeedFilters {...filterProps} idPrefix="drawer-filter" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
