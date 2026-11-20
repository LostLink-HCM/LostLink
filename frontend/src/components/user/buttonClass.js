import { cx, focusRing } from './classes'

const primary =
  'border-transparent bg-linear-to-b from-au-primary-light to-au-primary-dark text-au-on-primary shadow-au-button hover:brightness-110'

const variants = {
  primary,
  cta: primary,
  secondary: 'border-line bg-surface text-ink-secondary hover:bg-surface-muted',
  soft: 'border-primary/25 bg-primary-soft text-primary hover:bg-primary-subtle',
  outline: 'border-primary/25 bg-surface text-primary hover:bg-primary-subtle',
  danger: 'border-transparent bg-danger text-white hover:brightness-95',
  dangerSoft: 'border-danger/30 bg-danger-soft text-danger-ink hover:border-danger/60',
  ghost:
    'border-transparent bg-transparent text-ink-muted hover:bg-primary-subtle hover:text-primary',
}

const sizes = {
  sm: 'h-8 px-3.5 text-caption',
  md: 'h-9 px-4 text-caption',
  lg: 'h-10 px-4 text-small',
  xl: 'h-11 px-5 text-small',
}

// Dùng cho thẻ không phải <button>, ví dụ <Link> trông như nút
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  block = false,
  pressed = false,
  className,
} = {}) {
  return cx(
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border font-semibold whitespace-nowrap no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-45',
    pressed ? 'border-primary/40 bg-primary-soft text-primary' : variants[variant],
    sizes[size],
    block && 'w-full',
    focusRing,
    className
  )
}
