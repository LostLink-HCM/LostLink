import { useState } from 'react'
import { useAuthSceneReaction } from './scene/SceneContext'

const inputClass =
  'h-9.5 w-full rounded-au-control border border-white/16 bg-white/6 px-3 text-small text-au-ink outline-none transition placeholder:text-au-ink/40 focus:border-au-accent focus:bg-white/10 focus:ring-3 focus:ring-au-accent/16 aria-invalid:border-au-danger aria-invalid:focus:ring-au-danger/20 disabled:opacity-60'

const labelClass = 'text-au-label font-semibold text-au-ink/60'

export function Field({ id, label, error, hint, trailing, className = '', ...props }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  useAuthSceneReaction(error)

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} ${trailing ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>
        )}
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-au-hint text-au-danger-ink">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="text-au-hint text-au-ink/55">
            {hint}
          </span>
        )
      )}
    </div>
  )
}

export function PasswordField({ className = '', ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <Field
      {...props}
      // Ẩn nút xem mật khẩu có sẵn của Edge để không bị trùng với nút bên dưới
      className={`[&::-ms-reveal]:hidden ${className}`}
      type={visible ? 'text' : 'password'}
      // Đánh dấu ô mật khẩu để mèo che mắt khi người dùng gõ (xem AuthScene)
      data-secret=""
      trailing={
        <button
          type="button"
          // Giữ focus ở ô nhập khi bấm nút, người dùng gõ tiếp được ngay
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-au-ink/55 transition-colors hover:text-au-ink focus-visible:outline-2 focus-visible:outline-au-accent"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" />}
          </svg>
        </button>
      }
    />
  )
}

export function OtpBox(props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={`${inputClass} h-11 min-w-0 px-0 text-center text-title font-semibold`}
      {...props}
    />
  )
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={`h-10 w-full cursor-pointer rounded-au-control border-0 bg-linear-to-b from-au-primary-light to-au-primary-dark text-au-button font-semibold text-au-on-primary shadow-au-button transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-au-accent active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Alert({ tone = 'error', children }) {
  const tones = {
    error: 'border-au-danger/35 bg-au-danger/12 text-au-danger-ink',
    info: 'border-au-accent/35 bg-au-accent/12 text-au-link-hover',
  }
  // Khung báo lỗi vừa hiện thì mèo và cún tỏ ra buồn
  useAuthSceneReaction(tone === 'error')

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mb-3.5 rounded-au-control border px-3 py-2 text-caption ${tones[tone]}`}
    >
      {children}
    </div>
  )
}

export function TextLink({ as: Component = 'button', className = '', ...props }) {
  return (
    <Component
      className={`cursor-pointer border-0 bg-transparent p-0 font-semibold text-au-link no-underline hover:text-au-link-hover disabled:cursor-default disabled:text-au-ink/35 ${className}`}
      {...props}
    />
  )
}

// Tiêu đề chính của các trang auth, margin dưới truyền qua className
export function AuthHeading({ className = 'mb-1', ...props }) {
  return (
    <h1 className={`mt-0 font-sans text-au-title font-bold text-au-ink ${className}`} {...props} />
  )
}

export function FieldLegend({ children }) {
  return <legend className={`mb-1 p-0 ${labelClass}`}>{children}</legend>
}

// Lựa chọn nhận email thông báo, mặc định được chọn
export function EmailOptInCheckbox({ checked, onChange }) {
  return (
    <label
      className={`flex cursor-pointer gap-2 rounded-au-control border px-3 py-2 transition-colors ${
        checked ? 'border-au-accent/34 bg-au-accent/10' : 'border-white/14 bg-white/4'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-px size-3.5 flex-none cursor-pointer accent-au-primary"
      />
      <span className="self-center text-caption font-medium">
        Nhận email khi có tin liên quan đến món đồ của bạn
      </span>
    </label>
  )
}

// Ô đồng ý điều khoản, bắt buộc tích trước khi tạo tài khoản
export function TermsCheckbox({ checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-au-note leading-normal text-au-ink/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-px size-3.5 flex-none cursor-pointer accent-au-primary"
      />
      <span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật</span>
    </label>
  )
}

// Khung ghi chú phụ, ví dụ nhắc kiểm tra thư mục Spam
export function Note({ className = '', children }) {
  return (
    <div
      className={`rounded-au-control bg-white/5 px-3 py-2 text-au-note text-au-ink/55 ${className}`}
    >
      {children}
    </div>
  )
}
