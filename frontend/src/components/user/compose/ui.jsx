// Dấu * đỏ cho trường bắt buộc, trình đọc màn hình đọc "bắt buộc"
export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-danger">
        *
      </span>
      <span className="sr-only"> (bắt buộc)</span>
    </>
  )
}

export function StepHeading({ title, description, required }) {
  return (
    <header className="mb-4">
      <h2 className="m-0 text-lead font-bold tracking-tight text-ink">
        {title}
        {required && <RequiredMark />}
      </h2>
      {description && (
        <p className="m-0 mt-1 text-caption leading-relaxed text-ink-muted">{description}</p>
      )}
    </header>
  )
}

export function FieldError({ id, children }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="m-0 mt-1.5 text-caption text-danger-ink">
      {children}
    </p>
  )
}
