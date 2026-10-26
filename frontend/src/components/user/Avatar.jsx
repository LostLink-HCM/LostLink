import { cx } from './classes'

const sizes = {
  xs: 'size-6 text-[9.5px]',
  sm: 'size-8 text-micro',
  md: 'size-9 text-tiny',
  lg: 'size-10.5 text-caption',
  xl: 'size-11 text-small',
  '2xl': 'size-20 text-heading sm:size-24',
}

const tones = {
  primary: 'bg-primary-soft text-primary',
  neutral: 'bg-line-subtle text-ink-secondary',
}

export default function Avatar({ name, initials, size = 'lg', tone = 'primary', className }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center rounded-full font-bold',
        sizes[size],
        tones[tone],
        className
      )}
    >
      {initials ?? name.slice(0, 2).toUpperCase()}
    </span>
  )
}
