export function StepHeading({ title, description }) {
  return (
    <header className="mb-5">
      <h2 className="m-0 text-title font-bold tracking-tight text-ink">{title}</h2>
      {description && (
        <p className="m-0 mt-1.5 text-small leading-relaxed text-ink-muted">{description}</p>
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
