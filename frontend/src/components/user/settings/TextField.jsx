import { useId, useState } from 'react'
import Icon from '../../common/Icon'
import { inputClass, labelClass } from '../compose/styles'
import { cx, focusRing } from '../classes'

// Ô nhập kèm nhãn, gợi ý và lỗi; password=true thì có nút hiện/ẩn mật khẩu
export default function TextField({
  label,
  error,
  hint,
  password = false,
  className,
  inputRef,
  ...props
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type={password && !visible ? 'password' : password ? 'text' : props.type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(inputClass, 'h-11 [&::-ms-reveal]:hidden', password && 'pr-11')}
          {...props}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={visible}
            className={cx(
              'absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-ink-subtle hover:text-ink',
              focusRing
            )}
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} size={16} />
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="m-0 mt-1.5 text-caption text-danger-ink">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="m-0 mt-1.5 text-caption text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
