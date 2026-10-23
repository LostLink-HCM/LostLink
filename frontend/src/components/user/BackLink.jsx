import { Link } from 'react-router-dom'
import Icon from '../common/Icon'
import { cx, focusRing } from './classes'

// Liên kết quay lại ở đầu các trang con của khu người dùng
export default function BackLink({ to, children }) {
  return (
    <Link
      to={to}
      className={cx(
        'mb-4 inline-flex items-center gap-1.5 rounded-lg text-caption font-medium text-ink-muted no-underline hover:text-primary',
        focusRing
      )}
    >
      <Icon name="back" size={16} />
      {children}
    </Link>
  )
}
