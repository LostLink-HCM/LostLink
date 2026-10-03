import { cx } from './classes'

const tones = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info',
  neutral: 'bg-neutral-soft text-neutral',
}

export default function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}
