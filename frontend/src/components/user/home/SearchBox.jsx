import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

const TONES = {
  light: {
    icon: 'text-ink-subtle',
    input:
      'h-10 border-line bg-surface-muted text-ink placeholder:text-ink-subtle focus:border-primary focus:bg-surface',
    clear: 'text-ink-subtle hover:bg-line-subtle hover:text-ink',
  },
  sky: {
    icon: 'text-primary',
    input:
      'h-9 border-white bg-white text-primary shadow-[0_2px_8px_-3px_rgb(5_11_22/0.45)] placeholder:text-primary/60 focus:border-primary',
    clear: 'text-primary/70 hover:bg-primary-soft hover:text-primary',
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
