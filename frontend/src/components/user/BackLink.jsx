import { Link } from 'react-router-dom'
import Icon from '../common/Icon'
import { cx, focusRing } from './classes'

const backClass = cx(
  'mb-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent p-0 text-caption font-medium text-ink-muted no-underline hover:text-primary',
  focusRing
)

// Liên kết quay lại ở đầu các trang con của khu người dùng; có onClick thì là nút (ví dụ quay lại trang trước)
export default function BackLink({ to, onClick, children }) {
  const content = (
    <>
      <Icon name="back" size={16} />
      {children}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={backClass}>
        {content}
      </button>
    )
  }
  return (
    <Link to={to} className={backClass}>
      {content}
    </Link>
  )
}
