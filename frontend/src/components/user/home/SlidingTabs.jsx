import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from '../../common/Icon'
import CountBadge from '../CountBadge'
import { cx, focusRing } from '../classes'

const SPRING = 'ease-[cubic-bezier(0.3,1.3,0.5,1)]'

const LAYOUTS = {
  // Thanh tab ngang trên header máy tính
  bar: {
    nav: 'relative flex items-center gap-0.5',
    item: 'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-small',
    pill: 'rounded-full bg-white/16 ring-1 ring-white/18 ring-inset',
    active: 'text-white',
    idle: 'text-white/70 hover:text-white',
    iconSize: 15,
    // Khổ lg còn thêm tab Bảng vinh danh, bỏ icon cho vừa header
    iconClass: 'hidden xl:block',
    badge: '',
    badgeSize: 'sm',
  },
  // Thanh tab đáy màn hình điện thoại
  bottom: {
    // Các cột chia đều theo số mục
    nav: 'relative grid auto-cols-fr grid-flow-col items-center gap-1',
    item: 'flex h-12 items-center justify-center rounded-full',
    // Nền viên thuốc trong mờ phủ mục đang chọn, icon đổi sang màu nhấn theo giờ và nét dày hơn
    pill: 'rounded-full bg-white/12 ring-1 ring-white/10 ring-inset',
    active: 'text-au-accent [&_svg]:stroke-[2.3]',
    idle: 'text-white/65 hover:text-white',
    // Thanh đáy chỉ có icon, tên mục vẫn đọc được bằng trình đọc màn hình
    labelClass: 'sr-only',
    iconSize: 21,
    iconClass: '',
    badge: 'absolute top-1 left-[calc(50%+3px)] ring-2 ring-au-sky-1',
    badgeSize: 'sm',
  },
}

// Tab có thanh nền trượt tới mục đang chọn
export default function SlidingTabs({ items, layout = 'bar', label, className }) {
  const { pathname } = useLocation()
  const navRef = useRef(null)
  const [pill, setPill] = useState(null)
  // Lần đo đầu đặt thanh vào chỗ luôn, không trượt từ góc trái sang
  const [ready, setReady] = useState(false)
  const style = LAYOUTS[layout]

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return undefined

    const measure = () => {
      const active = nav.querySelector('a[aria-current="page"]')
      if (!active || !active.offsetWidth) {
        setPill(null)
        return
      }
      setPill({
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight,
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [pathname])

  useLayoutEffect(() => {
    if (!pill || ready) return undefined
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [pill, ready])

  return (
    <nav ref={navRef} aria-label={label} className={cx(style.nav, className)}>
      {pill && (
        <span
          aria-hidden="true"
          className={cx(
            'pointer-events-none absolute top-0 left-0',
            style.pill,
            ready &&
              `transition-[transform,width,height] duration-450 ${SPRING} motion-reduce:transition-none`
          )}
          style={{
            width: pill.w,
            height: pill.h,
            transform: `translate(${pill.x}px, ${pill.y}px)`,
          }}
        ></span>
      )}

      {items.map(({ to, end, label: text, icon, badge = 0, unit, className: itemClass }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={badge ? `${text}, ${badge} ${unit} chưa đọc` : undefined}
          className={({ isActive }) =>
            cx(
              'relative z-10 font-medium whitespace-nowrap no-underline transition-colors',
              style.item,
              isActive ? style.active : style.idle,
              focusRing,
              itemClass
            )
          }
        >
          <Icon name={icon} size={style.iconSize} className={style.iconClass} />
          <span className={style.labelClass}>{text}</span>
          {badge > 0 && (
            <CountBadge
              count={badge > 9 ? '9+' : badge}
              size={style.badgeSize}
              className={style.badge}
            />
          )}
        </NavLink>
      ))}
    </nav>
  )
}
