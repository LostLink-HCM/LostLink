import { useEffect, useRef, useState } from 'react'
import { useFeedCategoryList } from '../../../hooks/useFeedCategories'
import Icon from '../../common/Icon'
import { buttonClass } from '../buttonClass'
import { cx, focusRing } from '../classes'
import CategoryIcon from './CategoryIcon'
import BannerScene from './BannerScene'
import { SKY_STARS } from './skyStars'

const HEADER_HEIGHT = 64

export default function HomeHero({ search, category, onFilter, onSearchPassed, hot = false }) {
  const searchRef = useRef(null)

  useEffect(() => {
    if (!onSearchPassed) return undefined
    const check = () => {
      const node = searchRef.current
      if (node) onSearchPassed(node.getBoundingClientRect().bottom <= HEADER_HEIGHT)
    }
    check()
    const frame = requestAnimationFrame(check)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      onSearchPassed(false)
    }
  }, [onSearchPassed])

  return (
    <section aria-label="Tìm đồ thất lạc">
      <div className="relative overflow-hidden rounded-b-[28px] bg-au-sky-1 bg-linear-to-r from-au-sky-1 via-au-sky-2 to-au-sky-3 px-4 pt-7 pb-5 max-lg:-mt-4 sm:rounded-b-[44px] sm:px-6 sm:pt-9 sm:pb-7 lg:pt-6 lg:pb-6">
        <Ribbons />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_45%_70%_at_88%_0%,color-mix(in_srgb,var(--color-au-sun)_58%,transparent),transparent_70%),radial-gradient(ellipse_30%_45%_at_4%_100%,color-mix(in_srgb,var(--color-au-sun)_16%,transparent),transparent_70%)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-(--au-star-opacity)"
          style={{ backgroundImage: SKY_STARS }}
        />
        <BannerScene hot={hot} />
        {hot && (
          <p className="relative m-0 mb-2 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1 text-caption font-semibold text-white ring-1 ring-white/25 backdrop-blur-[2px] ring-inset">
              <span aria-hidden="true">🔥</span>
              Tin hot
            </span>
          </p>
        )}
        <p className="relative m-0 text-center text-lg leading-snug font-bold tracking-tight text-balance text-white sm:text-display lg:text-[28px]">
          {hot ? (
            <>
              Những tin đang được cộng đồng{' '}
              <span className="whitespace-nowrap text-au-accent">quan tâm</span>
            </>
          ) : (
            <>
              Đánh rơi hay nhặt được, LostLink giúp{' '}
              <span className="whitespace-nowrap text-au-accent">kết nối</span> bạn
            </>
          )}
        </p>

        <div ref={searchRef} className="relative mx-auto mt-4 max-w-3xl">
          <HeroSearch search={search} />
        </div>

        <div className="relative mx-auto mt-3 max-w-212">
          <CategoryStrip value={category} onPick={(value) => onFilter({ category: value })} />
        </div>
      </div>
    </section>
  )
}

function Ribbons() {
  return (
    <svg
      viewBox="0 0 1200 300"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    >
      <path
        d="M-50 250 C250 140 450 330 760 210 C980 120 1100 190 1260 130 L1260 300 L-50 300Z"
        fill="#fff"
        opacity="0.07"
      />
      <path
        d="M-50 110 C200 30 420 190 700 100 C930 30 1080 80 1260 20"
        fill="none"
        stroke="#fff"
        strokeWidth="46"
        strokeLinecap="round"
        opacity="0.06"
      />
      <path
        d="M-50 175 C220 95 460 255 760 155 C960 95 1100 145 1260 95"
        fill="none"
        stroke="#bfe3ff"
        strokeWidth="14"
        strokeLinecap="round"
        opacity="0.12"
      />
      <circle cx="140" cy="50" r="80" fill="#fff" opacity="0.05" />
      <circle cx="1080" cy="240" r="100" fill="#7dd3fc" opacity="0.08" />
    </svg>
  )
}

function HeroSearch({ search }) {
  const { value, onChange, onSearch, onClear } = search
  const submit = (e) => {
    e.preventDefault()
    if (value.trim()) onSearch(value.trim())
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="relative flex items-center gap-1.5 rounded-full bg-surface p-1.5 shadow-dialog ring-1 ring-line transition focus-within:ring-2 focus-within:ring-primary/45"
    >
      <label htmlFor="hero-search" className="sr-only">
        Tìm bài đăng
      </label>
      <Icon name="search" size={18} className="ml-3 shrink-0 text-ink-subtle" />
      <input
        id="hero-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tìm đồ vật, khu vực, người đăng…"
        className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-body text-ink outline-none placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Xoá từ khoá"
          onClick={onClear}
          className={cx(
            'grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-subtle hover:bg-line-subtle hover:text-ink',
            focusRing
          )}
        >
          <Icon name="close" size={14} />
        </button>
      )}

      <button
        type="submit"
        className={buttonClass({
          variant: 'primary',
          size: 'lg',
          className: 'max-sm:px-3 sm:px-5',
        })}
      >
        <Icon name="search" size={16} className="sm:hidden" />
        <span className="max-sm:sr-only">Tìm kiếm</span>
      </button>
    </form>
  )
}

const ALL_ICON = '/images/categories/tat-ca.png'

function CategoryThumb({ icon, name, active }) {
  const [broken, setBroken] = useState(false)

  if (icon && !broken) {
    return (
      <span
        className={cx(
          'grid size-11 place-items-center rounded-2xl transition sm:size-14',
          active && 'ring-2 ring-primary/55'
        )}
      >
        <img
          src={icon}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-10 object-contain transition-[translate,filter] duration-200 group-hover:-translate-y-1 group-hover:drop-shadow-[0_6px_5px_rgb(15_23_42/0.2)] sm:size-12"
        />
      </span>
    )
  }

  return (
    <span
      className={cx(
        'grid size-10 place-items-center rounded-2xl transition sm:size-12',
        active ? 'bg-primary text-white' : 'bg-primary-soft text-primary'
      )}
    >
      <CategoryIcon name={name} size={22} />
    </span>
  )
}

function CategoryStrip({ value, onPick }) {
  const { categories, loading } = useFeedCategoryList()
  const items = [{ slug: '', name: 'Tất cả', icon: ALL_ICON }, ...categories]
  const listRef = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  const checkEdges = () => {
    const el = listRef.current
    if (!el) return
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    })
  }

  const scrollBy = (direction) => {
    const el = listRef.current
    if (!el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  useEffect(() => {
    checkEdges()
    window.addEventListener('resize', checkEdges)
    return () => window.removeEventListener('resize', checkEdges)
  }, [categories])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/88 shadow-[0_14px_34px_-18px_rgb(5_11_22/0.55)] backdrop-blur-md">
      <div
        ref={listRef}
        role="group"
        aria-label="Lọc theo danh mục"
        aria-busy={loading}
        onScroll={checkEdges}
        className="flex justify-between gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] sm:px-2 sm:py-1.5"
      >
        {loading
          ? Array.from({ length: 9 }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="flex w-11 shrink-0 flex-col items-center gap-1 py-1 sm:w-18 sm:py-1.5 lg:w-22"
              >
                <span className="size-10 animate-pulse rounded-2xl bg-line-subtle sm:size-14" />
                <span className="hidden h-2.5 w-12 animate-pulse rounded bg-line-subtle sm:block" />
              </span>
            ))
          : items.map(({ slug, name, icon }) => {
              const active = value === slug
              return (
                <button
                  key={slug || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPick(slug)}
                  className={cx(
                    'group flex w-12 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl border-0 bg-transparent py-1 text-caption leading-tight transition-colors sm:w-18 sm:px-1 sm:py-1.5 lg:w-22',
                    active
                      ? 'font-bold text-primary'
                      : 'font-medium text-ink-secondary hover:text-primary',
                    focusRing
                  )}
                >
                  <CategoryThumb icon={icon} name={name} active={active} />
                  <span className="line-clamp-2 text-center text-balance max-sm:sr-only sm:min-h-[2lh]">
                    {name}
                  </span>
                </button>
              )
            })}
      </div>
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-white/90 to-transparent transition-opacity',
          edges.start ? 'opacity-0' : 'opacity-100'
        )}
      />
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-white/90 to-transparent transition-opacity',
          edges.end ? 'opacity-0' : 'opacity-100'
        )}
      />
      {!edges.start && (
        <StripArrow
          label="Danh mục trước"
          icon="back"
          className="left-2"
          onClick={() => scrollBy(-1)}
        />
      )}
      {!edges.end && (
        <StripArrow
          label="Xem thêm danh mục"
          icon="next"
          className="right-2"
          onClick={() => scrollBy(1)}
        />
      )}
    </div>
  )
}

function StripArrow({ label, icon, className, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(
        'absolute top-1/2 hidden size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink-secondary shadow-[0_6px_16px_-6px_rgb(15_23_42/0.35)] transition-colors hover:text-primary sm:grid',
        focusRing,
        className
      )}
    >
      <Icon name={icon} size={18} />
    </button>
  )
}
