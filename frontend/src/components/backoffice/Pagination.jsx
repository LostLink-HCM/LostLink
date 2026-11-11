import IconButton from './IconButton'
import { cx, focusRing } from './classes'

export default function Pagination({
  page,
  total,
  pageSize,
  onChange,
  noun = 'mục',
  showSummary = true,
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total ? (page - 1) * pageSize + 1 : 0
  const pageNumbers = new Set([1, pages])

  if (pages > 1) pageNumbers.add(2)
  if (pages > 2) pageNumbers.add(pages - 1)
  for (let number = Math.max(1, page - 1); number <= Math.min(pages, page + 1); number += 1) {
    pageNumbers.add(number)
  }

  const visiblePages = [...pageNumbers].sort((a, b) => a - b)
  const pageItems = []
  visiblePages.forEach((number, index) => {
    if (index > 0) {
      const previous = visiblePages[index - 1]
      if (number - previous === 2) pageItems.push(previous + 1)
      else if (number - previous > 2) pageItems.push(`ellipsis-${previous}-${number}`)
    }
    pageItems.push(number)
  })

  return (
    <nav
      aria-label="Phân trang"
      className={cx(
        'mt-4 flex flex-wrap items-center gap-4 text-small text-ink-subtle',
        showSummary ? 'justify-between' : 'justify-end'
      )}
    >
      {showSummary && (
        <span>
          Hiển thị {first}–{Math.min(page * pageSize, total)} trong số {total} {noun}
        </span>
      )}
      <div className="flex gap-1.5">
        <IconButton
          icon="back"
          label="Trang trước"
          bordered
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        />
        {pageItems.map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              aria-label={`Trang ${item}`}
              aria-current={page === item ? 'page' : undefined}
              onClick={() => onChange(item)}
              className={cx(
                'size-8 cursor-pointer rounded-md border text-small font-semibold',
                page === item
                  ? 'border-primary bg-primary text-white'
                  : 'border-line bg-surface text-ink-muted hover:bg-primary-subtle hover:text-primary',
                focusRing
              )}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              aria-hidden="true"
              className="inline-flex size-8 items-center justify-center text-small text-ink-muted"
            >
              …
            </span>
          )
        )}
        <IconButton
          icon="next"
          label="Trang sau"
          bordered
          disabled={page === pages}
          onClick={() => onChange(page + 1)}
        />
      </div>
    </nav>
  )
}
