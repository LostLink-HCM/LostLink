import { Link } from 'react-router-dom'
import Logo from './scene/Logo'

export default function BrandMark({ logoRef, hideLogo = false, landed = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 text-au-ink no-underline">
      <span
        ref={logoRef}
        className={`block size-8 ${hideLogo ? 'opacity-0' : ''} ${landed ? 'motion-safe:animate-auth-land' : ''}`}
      >
        <Logo tone="header" className="block size-full" />
      </span>
      <span className="text-[17px] font-bold tracking-[-.01em]">LostLink</span>
    </Link>
  )
}
