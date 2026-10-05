import { Link } from 'react-router-dom'
import Logo from '../common/Logo'

export default function BrandMark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 text-au-ink no-underline">
      <Logo size={30} />
      <span className="text-[17px] font-bold tracking-[-.01em]">LostLink</span>
    </Link>
  )
}
