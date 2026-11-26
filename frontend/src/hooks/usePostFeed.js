import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigationType } from 'react-router-dom'
import { listPosts } from '../api/posts'
import { buildPostQuery, toFeedPost } from '../lib/user/homeFeed'

const LOAD_ERROR = 'Không thể tải danh sách bài đăng, vui lòng thử lại.'

// Lỗi kiểm tra dữ liệu (422) có câu thông báo cụ thể, lỗi khác dùng câu chung
const messageOf = (err) => (err.status === 422 ? err.message : LOAD_ERROR)

const toPage = (res) => {
  const now = Date.now()
  return {
    items: res.data.items.map((card) => toFeedPost(card, now)),
    total: res.data.total,
    hasMore: res.data.hasMore,
  }
}

const EMPTY_FEED = {
  key: null,
  items: [],
  total: 0,
  page: 0,
  hasMore: false,
  error: '',
  // Mã lỗi từ server, vd CATEGORY_NOT_FOUND khi danh mục đang lọc vừa bị xoá
  errorCode: '',
  loadingMore: false,
}

const SAVED_TTL_MS = 10 * 60 * 1000
const SAVED_MAX = 4
const saved = new Map()

const remember = (key, entry) => {
  saved.delete(key)
  saved.set(key, { ...entry, savedAt: Date.now() })
  if (saved.size > SAVED_MAX) saved.delete(saved.keys().next().value)
}

export const markFeedPostViewed = (postId, views) => {
  for (const entry of saved.values()) {
    entry.feed = {
      ...entry.feed,
      items: entry.feed.items.map((item) =>
        item.id === postId
          ? { ...item, views, viewer: item.viewer ? { ...item.viewer, seen: true } : item.viewer }
          : item
      ),
    }
  }
}

const restorable = (key, navigationType) => {
  const entry = saved.get(key)
  return navigationType === 'POP' && entry && Date.now() - entry.savedAt < SAVED_TTL_MS
    ? entry
    : null
}

// Danh sách bài công khai từ server, tải lại khi đổi bộ lọc, từ khóa, cách sắp xếp
// hoặc người đăng nhập (người đã đăng nhập không thấy bài của người mình đã chặn)
export default function usePostFeed({ filters, keyword, hot, viewerId }) {
  // Kết quả đang hiển thị thuộc về bộ lọc nào. Khác bộ lọc hiện tại nghĩa là đang tải
  const key = JSON.stringify([filters, keyword, hot, viewerId ?? null])
  const navigationType = useNavigationType()
  const [restored] = useState(() => restorable(key, navigationType))
  const [feed, setFeed] = useState(() => (restored ? restored.feed : EMPTY_FEED))
  const [retry, setRetry] = useState(0)
  // Chỉ nhận kết quả của lần gọi mới nhất, bỏ kết quả về muộn của lần gọi cũ
  const latest = useRef(0)
  const feedRef = useRef(feed)
  useEffect(() => {
    feedRef.current = feed
  })

  const fetchPage = useCallback(
    (page) => listPosts(buildPostQuery(filters, keyword, { hot, page })),
    [filters, keyword, hot]
  )

  useEffect(
    () => () => {
      const current = feedRef.current
      if (current.key && current.page > 0 && !current.error) {
        remember(current.key, { feed: { ...current, loadingMore: false }, scrollY: window.scrollY })
      }
    },
    []
  )

  useEffect(() => {
    if (feedRef.current.key === key) return
    const requestId = ++latest.current
    fetchPage(1)
      .then((res) => {
        if (requestId !== latest.current) return
        setFeed({ key, page: 1, error: '', errorCode: '', loadingMore: false, ...toPage(res) })
      })
      .catch((err) => {
        if (requestId !== latest.current) return
        setFeed({
          key,
          items: [],
          total: 0,
          page: 0,
          hasMore: false,
          error: messageOf(err),
          errorCode: err.code ?? '',
          loadingMore: false,
        })
      })
  }, [fetchPage, key, retry])

  // Tự tải được trang sau khi: đã có trang đầu của đúng bộ lọc hiện tại, còn bài,
  // không đang tải và không có lỗi. Có lỗi thì dừng hẳn cho tới khi người dùng bấm Thử lại,
  // để mốc cuối danh sách không gọi API lặp liên tục
  const canLoadMore =
    feed.key === key && feed.page > 0 && feed.hasMore && !feed.loadingMore && !feed.error

  const loadMore = async () => {
    if (!canLoadMore) return
    const requestId = ++latest.current
    const page = feed.page + 1
    setFeed((prev) => ({ ...prev, loadingMore: true, error: '', errorCode: '' }))
    try {
      const next = toPage(await fetchPage(page))
      if (requestId !== latest.current) return
      setFeed((prev) => ({
        ...prev,
        ...next,
        items: [...prev.items, ...next.items],
        page,
        loadingMore: false,
      }))
    } catch (err) {
      if (requestId !== latest.current) return
      // Tải thêm bị lỗi thì vẫn giữ danh sách và vị trí cuộn đang có
      setFeed((prev) => ({
        ...prev,
        loadingMore: false,
        error: messageOf(err),
        errorCode: err.code ?? '',
        // Danh mục đã bị xoá thì không còn trang nào để tải
        hasMore: err.code === 'CATEGORY_NOT_FOUND' ? false : prev.hasMore,
      }))
    }
  }

  // Bấm "Thử lại" sau khi tải thêm bị lỗi
  const retryMore = () => setFeed((prev) => ({ ...prev, error: '', errorCode: '' }))

  const reload = () => {
    setFeed((prev) => ({ ...prev, key: null }))
    setRetry((count) => count + 1)
  }

  let status = 'ready'
  if (feed.key !== key) status = 'loading'
  else if (feed.page === 0 && feed.error) status = 'error'
  else if (feed.loadingMore) status = 'loadingMore'

  return {
    ...feed,
    status,
    canLoadMore,
    reload,
    loadMore,
    retryMore,
    restoredScrollY: restored?.scrollY ?? null,
  }
}
