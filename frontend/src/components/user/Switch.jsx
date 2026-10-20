import { cx, focusRing } from './classes'

// Công tắc bật/tắt kèm nhãn, cả dòng bấm được
export default function Switch({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cx(
        'flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-1 py-2 text-left',
        focusRing
      )}
    >
      <span className="min-w-0 flex-1 text-caption text-ink-secondary">{label}</span>
      <span
        className={cx(
          'flex h-5.5 w-9.5 shrink-0 rounded-full p-0.5 transition-colors',
          checked ? 'bg-primary' : 'bg-line-strong'
        )}
      >
        <span
          className={cx(
            'size-4.5 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-4'
          )}
        />
      </span>
    </button>
  )
}
