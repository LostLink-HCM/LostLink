import { useId } from 'react'
import { cx, focusRing } from './classes'

const control =
  'w-full min-w-0 rounded-lg border border-line-strong bg-surface text-small text-ink placeholder:text-ink-subtle disabled:cursor-default disabled:bg-surface-muted aria-invalid:border-danger'

// Bọc label, gợi ý và lỗi; children nhận id + aria-* qua render prop để nối đúng label
export default function Field({ label, hint, error, required, className, children }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-small font-semibold text-ink-secondary">
          {label}
          {required && <span className="ml-1 font-normal text-ink-muted">(bắt buộc)</span>}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-danger-ink">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-caption text-ink-muted">{hint}</p>
      )}
    </div>
  )
}

export function Input({ className, ...props }) {
  return <input className={cx(control, 'h-9 px-3', focusRing, className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return <select className={cx(control, 'h-9 cursor-pointer px-3', focusRing, className)} {...props}>{children}</select>
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx(control, 'min-h-24 resize-y px-3 py-2 leading-relaxed', focusRing, className)} {...props} />
}
