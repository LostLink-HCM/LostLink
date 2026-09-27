import { Link } from 'react-router-dom'

export default function BrandMark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 text-au-ink no-underline">
      <svg width="30" height="30" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="llHeadG" x1="20" y1="15" x2="38" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3E86D6" />
            <stop offset="1" stopColor="#2E6DB4" />
          </linearGradient>
        </defs>
        <path d="M43 42 L55 54" stroke="#1B3358" strokeWidth="7" strokeLinecap="round" />
        <path d="M45.3 35.6 A18 18 0 1 1 34.6 10.9" stroke="#1B3358" strokeWidth="5" strokeLinecap="round" />
        <path d="M34.6 10.9 A18 18 0 0 1 45.3 35.6" stroke="#9AA7BA" strokeWidth="5" strokeLinecap="round" />
        <path d="M16 38 C22 43 40 43 47 38.5 C46 47 38 50 30 50 C22 50 17 45 16 38 Z" fill="#1B3358" />
        <path
          d="M29 14.5 C23.8 14.5 19.6 18.7 19.6 23.9 C19.6 31 29 40.2 29 40.2 C29 40.2 38.4 31 38.4 23.9 C38.4 18.7 34.2 14.5 29 14.5 Z"
          fill="url(#llHeadG)"
        />
        <circle cx="29" cy="23.7" r="4.1" fill="#fff" />
      </svg>
      <span className="text-[17px] font-bold tracking-[-.01em]">LostLink</span>
    </Link>
  )
}
