import { useEffect, useRef, useState } from 'react'
import { AREAS } from '../../../data/homeFeed'
import { useFeedCategoryList } from '../../../hooks/useFeedCategories'
import Icon from '../../common/Icon'
import { cardClass } from '../Card'
import { cx, focusRing } from '../classes'
import CategoryIcon from './CategoryIcon'
import PaperPlaneScene from './PaperPlaneScene'
import { SKY_STARS } from './skyStars'

const HEADER_HEIGHT = 64

export default function HomeHero({ search, area, category, onFilter, onSearchPassed }) {
  const searchRef = useRef(null)

  useEffect(() => {
    const node = searchRef.current
    if (!node || !onSearchPassed) return undefined
    const observer = new IntersectionObserver(
      ([entry]) =>
        onSearchPassed(!entry.isIntersecting && entry.boundingClientRect.top < HEADER_HEIGHT),
      { rootMargin: `-${HEADER_HEIGHT}px 0px 0px 0px` }
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      onSearchPassed(false)
    }
  }, [onSearchPassed])

  return (
    <section aria-label="Tìm đồ thất lạc">
      <div className="relative overflow-hidden bg-au-sky-1 bg-linear-to-r from-au-sky-1 via-au-sky-2 to-au-sky-3 px-4 pt-7 pb-10 max-lg:-mt-4 sm:px-6 sm:pt-9 sm:pb-12 lg:pt-8 lg:pb-14">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-(--au-star-opacity)"
          style={{ backgroundImage: SKY_STARS }}
        />
        <PaperPlaneScene />
        <p className="relative m-0 text-center text-[15px] leading-snug font-bold tracking-tight text-balance text-white sm:text-display lg:text-[28px]">
          Đánh rơi hay nhặt được, LostLink giúp{' '}
          <span className="whitespace-nowrap text-au-accent">kết nối</span> bạn
        </p>
      </div>

      <div ref={searchRef} className="relative mx-auto -mt-7 max-w-3xl px-4 sm:px-6">
        <HeroSearch search={search} area={area} onArea={(value) => onFilter({ area: value })} />
      </div>

      <div className="mx-auto mt-4 max-w-360 px-4 sm:px-6 lg:px-10">
        <CategoryStrip value={category} onPick={(value) => onFilter({ category: value })} />
      </div>
    </section>
  )
}

function HeroSearch({ search, area, onArea }) {
  const { value, onChange, onSearch, onClear } = search
  const submit = (e) => {
    e.preventDefault()
    if (value.trim()) onSearch(value.trim())
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="relative flex items-center gap-1.5 rounded-2xl bg-surface p-1.5 shadow-dialog ring-1 ring-line transition focus-within:ring-2 focus-within:ring-primary/45"
    >
      <label htmlFor="hero-search" className="sr-only">
        Tìm bài đăng
      </label>
      <Icon name="search" size={18} className="ml-2.5 shrink-0 text-ink-subtle" />
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

      <div className="relative hidden h-10 shrink-0 items-center rounded-xl border border-line text-ink-secondary focus-within:border-primary sm:flex">
        <Icon name="pin" size={15} className="pointer-events-none absolute left-2.5 text-primary" />
        <label htmlFor="hero-area" className="sr-only">
          Khu vực
        </label>
        <select
          id="hero-area"
          value={area}
          onChange={(e) => onArea(e.target.value)}
          className="h-full w-40 cursor-pointer appearance-none rounded-xl border-0 bg-transparent pr-7 pl-8 text-small font-medium text-ink outline-none"
        >
          <option value="">Tất cả khu vực</option>
          {AREAS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Icon
          name="next"
          size={14}
          className="pointer-events-none absolute right-2 rotate-90 text-ink-subtle"
        />
      </div>

      <button
        type="submit"
        className={cx(
          'inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border-0 bg-primary px-3 text-small font-semibold text-white transition-colors hover:bg-primary-hover sm:px-5',
          focusRing
        )}
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
  const image = icon && !broken

  return (
    <span
      className={cx(
        'grid size-10 place-items-center rounded-2xl transition',
        image ? 'sm:size-11' : 'sm:size-10',
        image
          ? active
            ? 'bg-primary-soft ring-2 ring-primary'
            : 'bg-surface-muted'
          : active
            ? 'bg-primary text-white'
            : 'bg-primary-soft text-primary'
      )}
    >
      {image ? (
        <img
          src={icon}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-9 object-contain transition-transform group-hover:scale-110 sm:size-10"
        />
      ) : (
        <CategoryIcon name={name} size={20} />
      )}
    </span>
  )
}

function CategoryStrip({ value, onPick }) {
  const { categories, loading } = useFeedCategoryList()
  const items = [{ slug: '', name: 'Tất cả', icon: ALL_ICON }, ...categories]
  const listRef = useRef(null)
  const [atEnd, setAtEnd] = useState(true)

  const checkEnd = () => {
    const el = listRef.current
    if (el) setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }

  useEffect(() => {
    checkEnd()
    window.addEventListener('resize', checkEnd)
    return () => window.removeEventListener('resize', checkEnd)
  }, [categories])

  return (
    <div className={cx(cardClass, 'relative overflow-hidden')}>
      <div
        ref={listRef}
        role="group"
        aria-label="Lọc theo danh mục"
        aria-busy={loading}
        onScroll={checkEnd}
        className="flex justify-between gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] sm:px-2 sm:py-1.5"
      >
        {loading
          ? Array.from({ length: 9 }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="flex w-11 shrink-0 flex-col items-center gap-1 py-1 sm:w-18 sm:py-1.5 lg:w-24"
              >
                <span className="size-10 animate-pulse rounded-2xl bg-line-subtle sm:size-11" />
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
                    'group flex w-11 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl border-0 py-1 text-caption leading-tight transition-colors sm:w-18 sm:px-1 sm:py-1.5 lg:w-24',
                    active
                      ? 'font-semibold text-primary sm:bg-primary-soft'
                      : 'bg-transparent font-medium text-ink-secondary hover:bg-primary-subtle hover:text-primary',
                    focusRing
                  )}
                >
                  <CategoryThumb icon={icon} name={name} active={active} />
                  <span className="line-clamp-2 text-center max-sm:sr-only">{name}</span>
                </button>
              )
            })}
      </div>
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-surface to-transparent transition-opacity sm:hidden',
          atEnd ? 'opacity-0' : 'opacity-100'
        )}
      />
    </div>
  )
}
