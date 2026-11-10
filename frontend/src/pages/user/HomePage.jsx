import { useEffect, useRef, useState } from 'react'
import { NavLink, useOutletContext } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import Button from '../../components/user/Button'
import Card, { cardClass } from '../../components/user/Card'
import EmptyState from '../../components/user/EmptyState'
import { cx, focusRing } from '../../components/user/classes'
import FeedFilters from '../../components/user/home/FeedFilters'
import PostCard from '../../components/user/home/PostCard'
import RightRail from '../../components/user/home/RightRail'
import SearchBox from '../../components/user/home/SearchBox'
import StickyPanel from '../../components/user/home/StickyPanel'
import useInfiniteScroll from '../../hooks/useInfiniteScroll'
import usePostFeed from '../../hooks/usePostFeed'
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  isDefaultView,
  validateFilters,
} from '../../lib/user/homeFeed'

// Trên mobile không có thanh điều hướng nên chuyển giữa hai trang bằng tab
const FEEDS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/trending', label: 'Tin hot' },
]

// Dùng chung cho Trang chủ và Tin hot gần đây (hot), cùng bộ lọc, chỉ khác cách sắp xếp
export default function HomePage({ hot = false }) {
  const { user } = useAuth()
  const { now, search, keyword, filters, interactions } = useOutletContext()
  const { draft, setDraft, applied, setApplied } = filters
  const [filterError, setFilterError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Lọc, tìm kiếm, sắp xếp và ẩn bài của người đã chặn đều làm ở server
  const feed = usePostFeed({ filters: applied, keyword, hot, viewerId: user?.id })

  // Áp dụng/xóa bộ lọc hoặc tìm từ khóa khi đang cuộn giữa danh sách thì đưa về đầu trang
  // để thấy kết quả mới từ bài đầu tiên. Bỏ qua lần hiển thị đầu tiên của trang
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [applied, keyword])

  // Danh mục đang lọc không còn tồn tại: bỏ riêng bộ lọc danh mục, giữ các tiêu chí khác
  const showAllCategories = () => {
    setDraft((prev) => ({ ...prev, category: '' }))
    setApplied((prev) => ({ ...prev, category: '' }))
  }

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
    // Hiện "Xóa lọc" khi đang chọn dở hoặc đã áp dụng bất kỳ tiêu chí nào khác mặc định
    activeCount: Math.max(countActiveFilters(draft), countActiveFilters(applied)),
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
        <h1 className="sr-only">{hot ? 'Tin hot gần đây' : 'Bài đăng mới trên LostLink'}</h1>

        <nav
          aria-label="Chọn cách xem bài đăng"
          className="mb-3 flex gap-1 rounded-full bg-line-subtle p-1 lg:hidden"
        >
          {FEEDS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                cx(
                  'flex-1 rounded-full py-1.5 text-center text-caption font-semibold no-underline transition-colors',
                  isActive
                    ? 'bg-surface text-primary shadow-card'
                    : 'text-ink-muted hover:text-ink',
                  focusRing
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Trên mobile bộ lọc nằm trong drawer, mở bằng nút cạnh ô tìm kiếm */}
        <div className="mb-4 flex items-center gap-2 lg:hidden">
          <SearchBox id="feed-search" {...search} className="min-w-0 flex-1" />
          <Button size="lg" onClick={() => setDrawerOpen(true)}>
            <Icon name="settings" size={14} />
            Bộ lọc
          </Button>
        </div>

        <main className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_272px]">
          <StickyPanel
            aria-label="Bộ lọc bài đăng"
            className={cx(cardClass, 'hidden p-4 lg:block')}
          >
            <FeedFilters {...filterProps} idPrefix="filter" />
          </StickyPanel>

          <section
            aria-label="Danh sách bài đăng"
            aria-busy={feed.status === 'loading'}
            className="min-w-0"
          >
            <FeedList
              feed={feed}
              now={now}
              interactions={interactions}
              defaultView={isDefaultView(applied, keyword)}
              onShowAllCategories={showAllCategories}
            />
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

// Danh mục đang lọc vừa bị xoá: gợi ý bỏ bộ lọc danh mục để xem tiếp
const CATEGORY_GONE = 'CATEGORY_NOT_FOUND'

function FeedList({ feed, now, interactions, defaultView, onShowAllCategories }) {
  // Cuộn gần tới cuối danh sách thì tự tải trang sau, không cần bấm nút
  const sentinel = useInfiniteScroll({
    enabled: feed.canLoadMore,
    onReach: feed.loadMore,
    itemCount: feed.items.length,
  })

  if (feed.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Đang tải danh sách bài đăng">
        {[0, 1, 2].map((key) => (
          <FeedSkeleton key={key} />
        ))}
      </div>
    )
  }

  // không tải được trang đầu
  if (feed.status === 'error') {
    return (
      <Card>
        <EmptyState icon="warning" title={feed.error} />
        <div className="flex justify-center pb-10">
          {feed.errorCode === CATEGORY_GONE ? (
            <Button onClick={onShowAllCategories}>Xem tất cả danh mục</Button>
          ) : (
            <Button onClick={feed.reload}>Thử lại</Button>
          )}
        </div>
      </Card>
    )
  }

  if (!feed.items.length) {
    return (
      <Card>
        {defaultView ? (
          <EmptyState icon="search" title="Chưa có bài đăng phù hợp" />
        ) : (
          <EmptyState
            icon="search"
            title="Không tìm thấy bài đăng phù hợp"
            description="Thử từ khoá khác, mở rộng khoảng thời gian hoặc bấm “Xóa lọc”."
          />
        )}
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {feed.items.map((post) => {
        const state = interactions.stateOf(post)
        return (
          <PostCard
            key={post.id}
            post={post}
            now={now}
            commentCount={post.commentCount}
            liked={state.liked}
            likeCount={state.likes}
            onToggleLike={() => interactions.toggleLike(post)}
          />
        )
      })}

      {/* Mốc vô hình cuối danh sách, đi vào vùng gần màn hình thì tải tiếp */}
      <div ref={sentinel} aria-hidden="true" />

      <div aria-live="polite" className="text-center text-caption text-ink-subtle">
        {feed.status === 'loadingMore' && <FeedSkeleton />}
        {/* Tải thêm bị lỗi: giữ nguyên danh sách và vị trí cuộn, dừng tự tải tới khi người dùng chọn */}
        {feed.error && (
          <div role="alert" className="flex flex-col items-center gap-2 py-2">
            <p className="m-0 text-danger">{feed.error}</p>
            {feed.errorCode === CATEGORY_GONE ? (
              <Button onClick={onShowAllCategories}>Xem tất cả danh mục</Button>
            ) : (
              <Button onClick={feed.retryMore}>Thử lại</Button>
            )}
          </div>
        )}
        {!feed.hasMore && !feed.error && (
          <p className="m-0 py-2">Đã hiển thị hết {feed.total.toLocaleString('vi-VN')} bài đăng</p>
        )}
      </div>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className={cx(cardClass, 'flex h-40 gap-4 p-4 text-left sm:h-56')}>
      <div className="h-full w-24 shrink-0 animate-pulse rounded-xl bg-line-subtle sm:w-44" />
      <div className="flex flex-1 flex-col gap-3 py-1">
        <div className="h-3 w-1/3 animate-pulse rounded bg-line-subtle" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-line-subtle" />
        <div className="h-3 w-full animate-pulse rounded bg-line-subtle" />
      </div>
    </div>
  )
}
