import { cx, focusRing } from './classes'

const variants = {
  primary: 'border-transparent bg-primary text-white hover:bg-primary-hover',
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

// Nút chính cỡ lớn có bóng để nổi bật là hành động chính của trang
const raised = 'shadow-[0_6px_16px_-6px_rgb(46_109_180/0.7)]'

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
    variant === 'primary' && size === 'xl' && raised,
    block && 'w-full',
    focusRing,
    className
  )
}
