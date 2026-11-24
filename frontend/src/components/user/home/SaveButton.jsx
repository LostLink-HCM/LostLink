import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

export default function SaveButton({ saved, onClick, size = 'md', className }) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? 'Bỏ lưu bài' : 'Lưu bài'}
      title={saved ? 'Bỏ lưu bài' : 'Lưu bài'}
      onClick={onClick}
      className={cx(
        'grid shrink-0 cursor-pointer place-items-center rounded-full border transition-colors',
        size === 'sm' ? 'h-7 px-2' : 'h-8 px-2.5',
        saved
          ? 'border-amber-400 bg-amber-100 text-amber-500 [&_path]:fill-current'
          : 'border-line bg-surface text-ink-muted hover:border-amber-400 hover:text-amber-500',
        focusRing,
        className
      )}
    >
      <Icon name="bookmark" size={size === 'sm' ? 13 : 15} />
    </button>
  )
}
