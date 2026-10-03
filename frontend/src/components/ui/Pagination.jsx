import IconButton from './IconButton'
import { cx, focusRing } from './classes'

export default function Pagination({ page, total, pageSize, onChange, noun = 'mục' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total ? (page - 1) * pageSize + 1 : 0

  return (
    <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-between gap-4 text-small text-ink-subtle">
      <span>Hiển thị {first}–{Math.min(page * pageSize, total)} trong số {total} {noun}</span>
      <div className="flex gap-1.5">
        <IconButton icon="back" label="Trang trước" bordered disabled={page === 1} onClick={() => onChange(page - 1)} />
        {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
          <button
            key={number}
            type="button"
            aria-label={`Trang ${number}`}
            aria-current={page === number ? 'page' : undefined}
            onClick={() => onChange(number)}
            className={cx(
              'size-8 cursor-pointer rounded-md border text-small font-semibold',
              page === number ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-muted hover:bg-primary-subtle hover:text-primary',
              focusRing,
            )}
          >
            {number}
          </button>
        ))}
        <IconButton icon="next" label="Trang sau" bordered disabled={page === pages} onClick={() => onChange(page + 1)} />
      </div>
    </nav>
  )
}
