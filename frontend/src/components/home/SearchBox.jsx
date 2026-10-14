import Icon from '../common/Icon'
import { cx, focusRing } from '../moderator/classes'

export default function SearchBox({ id, value, onChange, onSearch, onClear, className }) {
  const submit = (e) => {
    e.preventDefault()
    if (value.trim()) onSearch(value.trim())
  }

  return (
    <form role="search" onSubmit={submit} className={cx('relative', className)}>
      <label htmlFor={id} className="sr-only">
        Tìm bài đăng
      </label>
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-subtle"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tìm theo tên đồ vật, khu vực…"
        className="h-10 w-full rounded-full border border-line bg-surface-muted pr-10 pl-10 text-small text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary focus:bg-surface focus:ring-3 focus:ring-primary/12 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Xoá từ khoá"
          onClick={onClear}
          className={cx(
            'absolute top-1/2 right-2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-subtle hover:bg-line-subtle hover:text-ink',
            focusRing
          )}
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </form>
  )
}
