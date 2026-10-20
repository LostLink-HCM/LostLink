import { cx } from './classes'

export const cardClass = 'rounded-2xl border border-line bg-surface shadow-card'

const paddings = { none: '', sm: 'p-4', md: 'p-5' }

// Khung nền trắng bo góc dùng cho mọi khối nội dung của khu người dùng
export default function Card({ as: Tag = 'div', padding = 'none', className, ...props }) {
  return <Tag className={cx(cardClass, paddings[padding], className)} {...props} />
}
