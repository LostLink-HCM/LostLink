import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

// light: ô tìm trên nền trắng; sky: ô kính mờ trên header màu trời, bấm vào thì sáng lên
const TONES = {
  light: {
    icon: 'text-ink-subtle',
    input:
      'h-10 border-line bg-surface-muted text-ink placeholder:text-ink-subtle focus:border-primary focus:bg-surface',
    clear: 'text-ink-subtle hover:bg-line-subtle hover:text-ink',
  },
  sky: {
    icon: 'text-white/60 group-focus-within:text-ink-subtle',
    input:
      'h-9 border-white/18 bg-white/10 text-white placeholder:text-white/55 focus:border-white focus:bg-surface focus:text-ink focus:placeholder:text-ink-subtle',
    clear:
      'text-white/70 hover:bg-white/15 hover:text-white group-focus-within:text-ink-subtle group-focus-within:hover:bg-line-subtle',
  },
}

export default function SearchBox({
  id,
  value,
  onChange,
  onSearch,
  onClear,
  tone = 'light',
  autoFocus = false,
  className,
}) {
  const style = TONES[tone]
  const submit = (e) => {
    e.preventDefault()
    if (value.trim()) onSearch(value.trim())
  }

  return (
    <form role="search" onSubmit={submit} className={cx('group relative', className)}>
      <label htmlFor={id} className="sr-only">
        Tìm bài đăng
      </label>
      <Icon
        name="search"
        size={16}
        className={cx(
          'pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2',
          style.icon
        )}
      />
      <input
        id={id}
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tìm đồ vật, khu vực, người đăng…"
        className={cx(
          'w-full rounded-full border pr-10 pl-10 text-small outline-none transition focus:ring-3 focus:ring-primary/12 [&::-webkit-search-cancel-button]:hidden',
          style.input
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Xoá từ khoá"
          onClick={onClear}
          className={cx(
            'absolute top-1/2 right-2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent',
            style.clear,
            focusRing
          )}
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </form>
  )
}
