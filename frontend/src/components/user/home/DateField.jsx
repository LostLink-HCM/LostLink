import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

// yyyy-mm-dd → dd/mm/yyyy
const toVietnamese = (value) => (value ? value.split('-').reverse().join('/') : '')

// Ô hiển thị ngày đã chọn, bấm để mở lịch tiếng Việt (MiniCalendar) do khung cha hiển thị
export default function DateField({
  id,
  value,
  open,
  controls,
  onToggle,
  invalid,
  describedBy,
  className,
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cx(
        'flex w-full cursor-pointer items-center justify-between gap-1 text-left',
        className,
        open && 'border-primary ring-3 ring-primary/12',
        focusRing
      )}
    >
      <span className={value ? 'text-ink' : 'text-ink-subtle'}>
        {toVietnamese(value) || 'dd/mm/yyyy'}
      </span>
      <Icon
        name="calendar"
        size={13}
        className={cx('shrink-0', open ? 'text-primary' : 'text-ink-subtle')}
      />
    </button>
  )
}
