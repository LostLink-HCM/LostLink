import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import Logo from '../../auth/scene/Logo'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'
import HeaderPets from './HeaderPets'
import SearchBox from './SearchBox'
import SlidingTabs from './SlidingTabs'
import UserMenu from './UserMenu'

// Sao chỉ hiện chiều và đêm, độ đậm lấy từ --au-star-opacity theo data-auth-time
const STARS = [
  [8, 28],
  [21, 66],
  [34, 18],
  [47, 52],
  [58, 24],
  [69, 70],
  [81, 30],
  [92, 58],
]
  .map(([x, y]) => `radial-gradient(1.2px 1.2px at ${x}% ${y}%, #fff 50%, transparent 51%)`)
  .join(', ')

// Nút chính trên header dùng cùng màu nút của khu auth, đổi theo giờ
const ctaClass =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border-0 bg-linear-to-b from-au-primary-light to-au-primary-dark px-4 text-small font-semibold whitespace-nowrap text-au-on-primary no-underline shadow-au-button transition hover:brightness-110'
const glassClass =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-small font-semibold whitespace-nowrap text-white no-underline transition-colors hover:bg-white/18'

// Mặt trời, mặt trời lặn hoặc trăng khuyết theo giờ
// Nửa mặt trời hoặc trăng khuyết lặn sau mép dưới header, màu nhạt để không bị nhầm là nút
function SkyOrb({ time }) {
  return (
    <span aria-hidden="true" className="pointer-events-none h-5 w-10 shrink-0 overflow-hidden">
      <span
        className={cx(
          'block size-10 rounded-full opacity-60 [background:radial-gradient(circle,color-mix(in_srgb,var(--color-au-sun)_70%,white)_0_42%,transparent_70%)]',
          time === 'night' &&
            '[mask-image:radial-gradient(circle_at_78%_22%,transparent_13px,#000_14px)]'
        )}
      />
    </span>
  )
}

export default function SiteHeader({ time, search, unreadMessages = 0, unreadNotifications = 0 }) {
  const { user } = useAuth()
  const unread = user ? unreadMessages : 0
  const unreadAlerts = user ? unreadNotifications : 0
  // Điện thoại: ô tìm thu thành nút kính lúp, bấm mới mở đè lên header
  const [searchOpen, setSearchOpen] = useState(false)

  const tabs = [
    { to: '/', end: true, label: 'Trang chủ', icon: 'home' },
    { to: '/trending', label: 'Tin hot', icon: 'trendUp' },
    {
      to: '/messages',
      label: 'Tin nhắn',
      icon: 'chat',
      badge: unread,
      unit: 'hội thoại',
    },
    {
      to: '/notifications',
      label: 'Thông báo',
      icon: 'bell',
      badge: unreadAlerts,
      unit: 'thông báo',
    },
    // Từ xl bảng vinh danh đã nằm ở cột phải trang chủ
    {
      to: '/leaderboard',
      label: 'Bảng vinh danh',
      icon: 'trophy',
      className: 'xl:hidden',
    },
  ]

  return (
    <header className="sticky top-0 z-40 bg-au-sky-1 max-lg:rounded-b-2xl bg-linear-to-r from-au-sky-1 via-au-sky-2 to-au-sky-3 text-white shadow-[0_6px_24px_-14px_rgb(5_11_22/0.7)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-(--au-star-opacity)"
        style={{ backgroundImage: STARS }}
      />
      <div className="relative mx-auto flex h-16 max-w-360 items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:gap-4 lg:px-8 xl:gap-5">
        <Link
          to="/"
          aria-label="LostLink - Trang chủ"
          className={cx(
            'flex shrink-0 items-center gap-2.5 rounded-lg text-white no-underline',
            focusRing
          )}
        >
          <Logo tone="header" className="block size-7.5" />
          <span className="text-title font-bold tracking-tight max-sm:hidden">LostLink</span>
        </Link>

        <SlidingTabs items={tabs} label="Điều hướng chính" className="hidden shrink-0 lg:flex" />

        {/* Khoảng trống còn lại của header, nửa mặt trời hoặc trăng nằm trên mép dưới */}
        <div className="flex min-w-0 flex-1 items-end self-stretch lg:justify-end">
          <SkyOrb time={time} />
        </div>

        <HeaderPets className="h-7 shrink-0 self-end max-[359px]:hidden lg:hidden xl:flex" />

        <SearchBox
          id="header-search"
          tone="sky"
          {...search}
          className="hidden shrink-0 lg:block lg:w-44 xl:w-64 2xl:w-72"
        />

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Tìm bài đăng"
            onClick={() => setSearchOpen(true)}
            className={cx(
              'grid size-9 cursor-pointer place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/18 lg:hidden',
              focusRing
            )}
          >
            <Icon name="search" size={17} />
          </button>
          {user ? (
            <>
              <Link
                to="/posts/new"
                aria-label="Đăng bài"
                className={cx(ctaClass, 'max-sm:px-2.5', focusRing)}
              >
                <Icon name="compose" size={16} />
                <span className="hidden sm:inline">Đăng bài</span>
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              {/* Header mobile hết chỗ cho tab Bảng vinh danh nên để nút riêng */}
              <NavLink
                to="/leaderboard"
                aria-label="Bảng vinh danh"
                title="Bảng vinh danh"
                className={cx(
                  'grid size-10 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/18 lg:hidden',
                  focusRing
                )}
              >
                <Icon name="trophy" size={18} />
              </NavLink>
              <Link to="/login" className={cx(glassClass, focusRing)}>
                Đăng nhập
              </Link>
              <Link to="/register" className={cx(ctaClass, 'max-sm:hidden', focusRing)}>
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="absolute inset-0 z-20 flex items-center gap-2 rounded-[inherit] bg-au-sky-1 bg-linear-to-r from-au-sky-1 to-au-sky-2 px-3 motion-safe:animate-ll-fade lg:hidden">
          <SearchBox
            id="header-search-mobile"
            tone="sky"
            autoFocus
            {...search}
            onSearch={(value) => {
              search.onSearch(value)
              setSearchOpen(false)
            }}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className={cx(
              'shrink-0 cursor-pointer rounded-full border-0 bg-transparent px-2 py-2 text-small font-semibold text-white/85 hover:text-white',
              focusRing
            )}
          >
            Huỷ
          </button>
        </div>
      )}
    </header>
  )
}
