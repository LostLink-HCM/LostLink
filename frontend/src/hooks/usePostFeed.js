import { useCallback, useEffect, useRef, useState } from 'react'
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

// Danh sách bài công khai từ server, tải lại khi đổi bộ lọc, từ khóa, cách sắp xếp
// hoặc người đăng nhập (người đã đăng nhập không thấy bài của người mình đã chặn)
export default function usePostFeed({ filters, keyword, hot, viewerId }) {
  // Kết quả đang hiển thị thuộc về bộ lọc nào. Khác bộ lọc hiện tại nghĩa là đang tải
  const key = JSON.stringify([filters, keyword, hot, viewerId ?? null])
  const [feed, setFeed] = useState({
    key: null,
    items: [],
    total: 0,
    page: 0,
    hasMore: false,
    error: '',
    // Mã lỗi từ server, vd CATEGORY_NOT_FOUND khi danh mục đang lọc vừa bị xoá
    errorCode: '',
    loadingMore: false,
  })
  const [retry, setRetry] = useState(0)
  // Chỉ nhận kết quả của lần gọi mới nhất, bỏ kết quả về muộn của lần gọi cũ
  const latest = useRef(0)

  const fetchPage = useCallback(
    (page) => listPosts(buildPostQuery(filters, keyword, { hot, page })),
    [filters, keyword, hot]
  )

  useEffect(() => {
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

  return { ...feed, status, canLoadMore, reload, loadMore, retryMore }
}
