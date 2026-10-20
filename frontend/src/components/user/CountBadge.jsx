import { cx } from './classes'

const tones = { danger: 'bg-danger', primary: 'bg-primary' }
const sizes = { sm: 'h-4.5 min-w-4.5 px-1 text-micro', md: 'h-5 min-w-5 px-1.5 text-tiny' }

// Số đếm tròn: tin chưa đọc, thông báo mới
export default function CountBadge({ count, tone = 'danger', size = 'md', className, children }) {
  return (
    <span
      className={cx(
        'grid place-items-center rounded-full font-bold text-white',
        tones[tone],
        sizes[size],
        className
      )}
    >
      {count}
      {children}
    </span>
  )
}
