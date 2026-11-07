import { useEffect, useRef } from 'react'

// Gọi onReach khi phần tử mốc (đặt cuối danh sách) đi vào vùng cách mép dưới màn hình
// `distance` px, tức người dùng cuộn gần tới cuối. Tạo lại observer mỗi khi danh sách dài thêm,
// để nếu mốc vẫn còn trong vùng (trang ngắn) thì tải tiếp ngay
export default function useInfiniteScroll({ enabled, onReach, itemCount, distance = 800 }) {
  const sentinel = useRef(null)
  const callback = useRef(onReach)

  useEffect(() => {
    callback.current = onReach
  })

  useEffect(() => {
    const node = sentinel.current
    if (!enabled || !node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current()
      },
      { rootMargin: `0px 0px ${distance}px 0px` }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, itemCount, distance])

  return sentinel
}
