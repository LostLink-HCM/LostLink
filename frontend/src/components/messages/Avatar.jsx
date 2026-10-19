import { cx } from '../moderator/classes'

export default function Avatar({ initials, small = false }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary',
        small ? 'size-7 text-[10px]' : 'size-10.5 text-caption'
      )}
    >
      {initials}
    </span>
  )
}
