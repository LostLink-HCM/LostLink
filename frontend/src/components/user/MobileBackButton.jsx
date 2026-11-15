import { useLocation, useNavigate } from 'react-router-dom'
import IconButton from './IconButton'
import { cx } from './classes'

export default function MobileBackButton({ className }) {
  const navigate = useNavigate()
  const location = useLocation()
  const back = () => (location.key === 'default' ? navigate('/') : navigate(-1))

  return (
    <IconButton
      icon="back"
      label="Quay lại"
      size={36}
      className={cx('-ml-2 text-ink-secondary lg:hidden', className)}
      onClick={back}
    />
  )
}
