import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { cx } from '../classes'
import SlidingTabs from './SlidingTabs'

const SCROLL_STEP = 8
const TOP_ZONE = 80
const TYPING = 'input, textarea, select, [contenteditable="true"]'

function useAutoHide(pinned) {
  const { pathname } = useLocation()
  // Ghi trang đang bị ẩn thanh: sang trang khác thì tự hiện lại mà không cần reset
  const [hiddenOn, setHiddenOn] = useState(null)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    if (pinned) return undefined
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y < TOP_ZONE) setHiddenOn(null)
      else if (y > last + SCROLL_STEP) setHiddenOn(pathname)
      else if (y < last - SCROLL_STEP) setHiddenOn(null)
      else return
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname, pinned])

  useEffect(() => {
    const onFocusIn = (e) => setTyping(Boolean(e.target.closest?.(TYPING)))
    const onFocusOut = () => setTyping(false)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return (!pinned && hiddenOn === pathname) || typing
}

// Điện thoại không đủ chỗ cho tab trên header nên đưa xuống đáy màn hình, trong tầm ngón cái
export default function MobileTabBar({ unreadMessages = 0, unreadNotifications = 0 }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  // Trang Tin nhắn hay chuyển qua lại nên luôn giữ thanh
  const hidden = useAutoHide(pathname.startsWith('/messages'))

  const tabs = [
    { to: '/', end: true, label: 'Trang chủ', icon: 'home' },
    { to: '/trending', label: 'Tin hot', icon: 'trendUp' },
    {
      to: '/messages',
      label: 'Tin nhắn',
      icon: 'chat',
      badge: user ? unreadMessages : 0,
      unit: 'hội thoại',
    },
    {
      to: '/notifications',
      label: 'Thông báo',
      icon: 'bell',
      badge: user ? unreadNotifications : 0,
      unit: 'thông báo',
    },
  ]

  return (
    <div
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className={cx(
        'fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 rounded-full border border-white/10 bg-au-sky-1 bg-linear-to-r from-au-sky-1 to-au-sky-2 p-1.5 shadow-[0_12px_32px_-10px_rgb(5_11_22/0.55),0_2px_6px_rgb(5_11_22/0.2)] transition-transform duration-300 ease-out motion-reduce:transition-none lg:hidden',
        hidden && 'translate-y-[calc(100%+24px+env(safe-area-inset-bottom))]'
      )}
    >
      <SlidingTabs items={tabs} layout="bottom" label="Điều hướng chính" />
    </div>
  )
}
