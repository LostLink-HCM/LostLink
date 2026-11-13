import { useRef } from 'react'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

// yyyy-mm-dd → dd/mm/yyyy
const toVietnamese = (value) => (value ? value.split('-').reverse().join('/') : '')

export default function DateField({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  describedBy,
  className,
}) {
  const inputRef = useRef(null)

  const openPicker = () => {
    const input = inputRef.current
    try {
      input.showPicker()
    } catch {
      // Trình duyệt cũ không có showPicker: focus vào ô gốc để người dùng gõ
      input.focus()
    }
  }

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={openPicker}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cx(
          'flex w-full cursor-pointer items-center justify-between gap-1 text-left',
          className,
          focusRing
        )}
      >
        <span className={value ? 'text-ink' : 'text-ink-subtle'}>
          {toVietnamese(value) || 'dd/mm/yyyy'}
        </span>
        <Icon name="calendar" size={13} className="shrink-0 text-ink-subtle" />
      </button>
      <input
        ref={inputRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
      />
    </div>
  )
}
