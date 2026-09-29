import { cx, focusRing } from './classes'

const variants = {
  primary: 'border-primary bg-primary text-white hover:bg-primary-hover',
  secondary: 'border-line bg-surface text-primary hover:bg-primary-subtle',
  danger: 'border-danger bg-danger text-white hover:brightness-95',
  success: 'border-success bg-success text-white hover:brightness-95',
  ghost: 'border-transparent bg-transparent text-ink-muted hover:bg-primary-subtle hover:text-primary',
}

const sizes = {
  md: 'h-9 px-3 text-small',
  sm: 'h-8 px-2.5 text-caption',
}

export default function Button({ variant = 'secondary', size = 'md', type = 'button', className, children, ...props }) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        focusRing,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
