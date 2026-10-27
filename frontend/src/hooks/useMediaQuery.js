import { useSyncExternalStore } from 'react'

// Theo dõi một media query, tự cập nhật khi đổi kích thước màn hình
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches
  )
}
