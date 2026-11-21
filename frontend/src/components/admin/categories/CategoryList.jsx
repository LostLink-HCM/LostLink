import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../../backoffice/classes'

export default function CategoryList({ categories, total, loading = false, selectedId, onSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listboxId = useId()
  const selected = categories.find((category) => category.id === selectedId)
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')
    return categories.filter((category) =>
      `${category.name} ${category.aliases.join(' ')}`
        .toLocaleLowerCase('vi')
        .includes(normalizedQuery)
    )
  }, [categories, query])

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const openMenu = () => {
    setQuery('')
    setActiveIndex(
      Math.max(
        0,
        categories.findIndex((category) => category.id === selectedId)
      )
    )
    setOpen(true)
  }

  const chooseCategory = (category) => {
    onSelect(category.id)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setQuery('')
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openMenu()
      if (!filtered.length) return
      setActiveIndex((current) =>
        event.key === 'ArrowDown'
          ? (current + 1) % filtered.length
          : (current - 1 + filtered.length) % filtered.length
      )
      return
    }
    if (event.key === 'Enter' && open && filtered.length) {
      event.preventDefault()
      chooseCategory(filtered[Math.min(activeIndex, filtered.length - 1)])
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <div>
        <div className="mb-2 flex items-baseline gap-3">
          <label
            htmlFor={`${listboxId}-input`}
            className="text-small font-semibold text-ink-secondary"
          >
            Danh mục: {total}
          </label>
        </div>
        <div ref={rootRef} className="relative z-30">
          <div className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-3 transition focus-within:border-primary-muted focus-within:ring-4 focus-within:ring-primary/10">
            <Icon name="search" size={18} className="shrink-0 text-ink-subtle" />
            <input
              ref={inputRef}
              id={`${listboxId}-input`}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={
                open && filtered.length ? `${listboxId}-option-${activeIndex}` : undefined
              }
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-body font-medium text-ink-secondary outline-none placeholder:font-normal placeholder:text-ink-subtle"
              value={open ? query : (selected?.name ?? '')}
              placeholder="Tìm hoặc chọn danh mục"
              onFocus={() => {
                if (!open) openMenu()
              }}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
                setOpen(true)
              }}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              aria-label={open ? 'Đóng danh sách danh mục' : 'Mở danh sách danh mục'}
              aria-expanded={open}
              onClick={() => {
                if (open) {
                  setOpen(false)
                  setQuery('')
                } else {
                  openMenu()
                  inputRef.current?.focus()
                }
              }}
              className={cx(
                'grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-muted transition hover:bg-primary-faint hover:text-primary',
                focusRing
              )}
            >
              <Icon name="next" size={18} className={open ? '-rotate-90' : 'rotate-90'} />
            </button>
          </div>

          {open && (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Danh sách danh mục"
              className="absolute top-[calc(100%+8px)] right-0 left-0 z-50 max-h-72 overflow-auto rounded-xl border border-line-soft bg-surface p-1.5 shadow-raised"
            >
              {filtered.map((category, index) => {
                const active = index === activeIndex
                const isSelected = category.id === selectedId
                return (
                  <button
                    key={category.id}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cx(
                      'flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-ink-secondary transition-colors',
                      active ? 'bg-primary-faint' : 'hover:bg-primary-faint',
                      isSelected && 'font-semibold text-primary',
                      focusRing
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => chooseCategory(category)}
                  >
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    {isSelected && (
                      <Icon name="check" size={17} className="shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
              {!filtered.length && (
                <p className="m-0 px-3 py-5 text-center text-small text-ink-muted">
                  {loading ? 'Đang tải danh mục…' : 'Không tìm thấy danh mục'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
