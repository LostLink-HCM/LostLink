import { useId, useState } from 'react'
import Button from '../../backoffice/Button'
import Dialog from '../../backoffice/Dialog'
import IconButton from '../../backoffice/IconButton'
import { cx, focusRing } from '../../backoffice/classes'

import { inputClass, labelClass } from './styles'

export function FormError({ children, id, subtle = false }) {
  return (
    <p
      id={id}
      className={cx('m-0 text-small', subtle ? 'text-danger/80' : 'text-danger-ink')}
      role="alert"
    >
      {children}
    </p>
  )
}

export function Hint({ children, id }) {
  return (
    <small id={id} className="block text-caption leading-relaxed font-normal text-ink-muted">
      {children}
    </small>
  )
}

// Khung một nhóm nội dung trong tab
export function Panel({ title, description, action, className, children }) {
  return (
    <section
      className={cx(
        'min-w-0 overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-soft',
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-primary-faint px-4.5 py-3.5">
        <div className="min-w-0">
          <h3 className="m-0 text-lead font-semibold text-primary">{title}</h3>
          {description && (
            <p className="mt-1 mb-0 text-small leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

// Danh sách ô nhập một dòng (alias, mục "Bên trong có"), nút + để thêm ô
export function TextListField({
  label,
  itemLabel,
  value,
  onChange,
  hint,
  placeholder,
  errors = [],
}) {
  const listId = useId()
  const update = (index, next) => onChange(value.map((item, i) => (i === index ? next : item)))

  return (
    <div className={labelClass}>
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <IconButton
          label={`Thêm ${itemLabel}`}
          icon="plus"
          bordered
          onClick={() => onChange([...value, ''])}
        />
      </div>
      {hint && <Hint>{hint}</Hint>}
      {value.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {value.map((item, index) => {
            const error = errors[index]
            const errorId = `${listId}-error-${index}`
            return (
              <div key={index} className="min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    className={cx(
                      inputClass,
                      error && 'border-danger/35 focus:border-danger/50 focus:ring-danger/10'
                    )}
                    value={item}
                    onChange={(event) => update(index, event.target.value)}
                    placeholder={placeholder}
                    aria-label={`${itemLabel} ${index + 1}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                  />
                  <IconButton
                    label={`Xóa ${itemLabel} ${index + 1}`}
                    icon="close"
                    danger
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                  />
                </div>
                {error && (
                  <FormError id={errorId} subtle>
                    {error}
                  </FormError>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Ô số có đơn vị nằm bên phải
export function NumberField({ label, unit, hint, error, className, ...props }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cx(labelClass, className)}>
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={cx(inputClass, 'tabular-nums', unit && 'pr-28')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-small font-normal text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {error ? (
        <FormError id={`${id}-error`}>{error}</FormError>
      ) : (
        hint && <Hint id={`${id}-hint`}>{hint}</Hint>
      )}
    </div>
  )
}

// Nhóm nút chọn một, dùng cho kiểu suy giảm và vai trò ghép cặp
export function Segmented({ label, options, value, onChange }) {
  return (
    <div className={labelClass}>
      <span>{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-1 rounded-xl bg-primary-subtle p-1 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]"
      >
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cx(
                'min-h-9 cursor-pointer rounded-lg px-2.5 py-1.5 text-small font-semibold transition',
                active
                  ? 'bg-white text-primary shadow-raised'
                  : 'text-ink-muted hover:bg-white/60 hover:text-primary',
                focusRing
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Hộp thoại xác nhận xóa, nút Hủy được focus sẵn để Enter không xóa nhầm
export function ConfirmDeleteDialog({ title, confirmLabel, onConfirm, onClose, children }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const close = () => {
    if (!saving) onClose()
  }
  const confirm = async () => {
    setSaving(true)
    setError('')
    try {
      await onConfirm()
      setSaving(false)
      onClose()
    } catch (confirmError) {
      setError(confirmError.message || 'Không thực hiện được thao tác. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      title={title}
      onClose={close}
      footer={
        <>
          <Button data-autofocus onClick={close} disabled={saving}>
            Hủy
          </Button>
          <Button variant="danger-subtle" onClick={confirm} disabled={saving}>
            {saving ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-body leading-relaxed text-ink-secondary">
        {children}
        {error && <FormError>{error}</FormError>}
      </div>
    </Dialog>
  )
}

// Thanh Hủy / Lưu ở cuối mỗi tab có form
export function SaveBar({
  formId,
  dirty,
  error,
  saving = false,
  busy = false,
  blocked = false,
  onReset,
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line-soft pt-4">
      <div className="mr-auto min-w-0" aria-live="polite">
        {error ? (
          <FormError>{error}</FormError>
        ) : (
          dirty && <span className="text-small text-warning">Có thay đổi chưa lưu</span>
        )}
      </div>
      <Button disabled={!dirty || saving || busy} onClick={onReset}>
        Hủy
      </Button>
      <Button
        type="submit"
        form={formId}
        variant="primary"
        icon="check"
        disabled={!dirty || saving || busy || blocked}
      >
        {saving ? 'Đang lưu…' : busy ? 'Đang tải ảnh…' : 'Lưu thay đổi'}
      </Button>
    </div>
  )
}
