import { useRef } from 'react'
import Icon from '../../common/Icon'
import Button from '../../backoffice/Button'
import { cx, focusRing } from '../../backoffice/classes'
import CategoryAvatar from './CategoryAvatar'

// Cột trái: ô tìm theo tên hoặc alias và danh sách danh mục đã lọc
export default function CategoryList({
  categories,
  total,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  listRef,
}) {
  const searchRef = useRef(null)
  const clearQuery = () => {
    onQueryChange('')
    searchRef.current?.focus()
  }

  return (
    <aside className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-soft min-[801px]:sticky min-[801px]:top-4">
      <div className="border-b border-line-soft bg-linear-to-b from-primary-subtle to-primary-faint px-4.5 pt-5 pb-4">
        <div className="mb-3.5 flex items-baseline justify-between gap-2">
          <strong className="text-lead font-semibold text-primary">Danh mục</strong>
          <span className="text-small text-ink-muted">{total} danh mục</span>
        </div>
        <label className="flex h-9.5 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-ink-subtle transition focus-within:border-primary-muted focus-within:ring-4 focus-within:ring-primary/10">
          <Icon name="search" size={16} />
          <input
            ref={searchRef}
            className="w-full min-w-0 bg-transparent text-small text-ink-secondary outline-none placeholder:text-ink-subtle"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && onQueryChange('')}
            placeholder="Tìm danh mục hoặc alias…"
            aria-label="Tìm danh mục hoặc alias"
          />
          {query && (
            <button
              type="button"
              aria-label="Xóa từ khóa tìm kiếm"
              onClick={clearQuery}
              className={cx(
                '-mr-1.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-ink-subtle transition-colors hover:bg-primary-subtle hover:text-primary',
                focusRing
              )}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </label>
      </div>
      <div
        ref={listRef}
        className="grid max-h-[calc(100dvh-220px)] min-h-0 grid-cols-1 content-start gap-0.5 overflow-auto p-2 max-[800px]:max-h-70 max-[800px]:grid-cols-2 max-[600px]:grid-cols-1"
        aria-label="Danh sách danh mục"
      >
        {categories.map((category) => {
          const active = selectedId === category.id
          return (
            <button
              key={category.id}
              type="button"
              aria-current={active || undefined}
              className={cx(
                'flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-ink-secondary transition-colors hover:bg-primary-faint',
                active && 'bg-primary-soft text-primary',
                focusRing
              )}
              onClick={() => onSelect(category.id)}
            >
              <CategoryAvatar
                src={category.icon}
                className={cx(
                  'size-9 rounded-xl transition',
                  active && 'shadow-raised ring-2 ring-white'
                )}
              />
              <strong className="min-w-0 flex-1 truncate text-small font-semibold">
                {category.name}
              </strong>
              <Icon
                name="next"
                size={15}
                className={cx('shrink-0', active ? 'text-primary' : 'text-line-strong')}
              />
            </button>
          )
        })}
        {!categories.length && (
          <div className="flex flex-col items-center gap-2.5 px-4 py-11 text-small text-ink-muted">
            <Icon name="search" size={26} />
            <span>Không tìm thấy danh mục</span>
            <Button size="sm" icon="close" onClick={clearQuery}>
              Xóa từ khóa
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
