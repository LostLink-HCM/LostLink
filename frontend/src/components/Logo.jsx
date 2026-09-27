export default function Logo({ size = 42, animated = true }) {
  const originCenter = { transformBox: 'view-box', transformOrigin: '32px 32px' }
  const magClass = animated ? 'motion-safe:animate-logo-mag' : ''
  const pinClass = animated ? 'motion-safe:animate-logo-pin' : ''

  return (
    <span
      className="relative inline-flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {animated && (
        <span
          className="pointer-events-none absolute rounded-full motion-safe:animate-logo-glow"
          style={{
            inset: -size * 0.3,
            background: 'radial-gradient(circle, rgba(46,109,180,0.24), rgba(46,109,180,0) 68%)',
          }}
        />
      )}

      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="relative z-10 block" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="llHeadG" x1="20" y1="15" x2="38" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3E86D6" />
            <stop offset="1" stopColor="#2E6DB4" />
          </linearGradient>
        </defs>

        <g className={magClass} style={animated ? originCenter : undefined}>
          <path d="M43 42 L55 54" stroke="#1B3358" strokeWidth="7" strokeLinecap="round" />
          <path d="M45.3 35.6 A18 18 0 1 1 34.6 10.9" stroke="#1B3358" strokeWidth="5" strokeLinecap="round" />
          <path d="M34.6 10.9 A18 18 0 0 1 45.3 35.6" stroke="#9AA7BA" strokeWidth="5" strokeLinecap="round" />
          <path d="M16 38 C22 43 40 43 47 38.5 C46 47 38 50 30 50 C22 50 17 45 16 38 Z" fill="#1B3358" />
        </g>

        <circle
          cx="29"
          cy="28"
          r="9"
          fill="rgba(142,192,242,0.9)"
          className={animated ? 'motion-safe:animate-logo-snap' : ''}
          style={{ transformBox: 'fill-box', transformOrigin: 'center', opacity: 0 }}
        />

        <g className={pinClass} style={animated ? originCenter : undefined}>
          <path d="M29 14.5 C23.8 14.5 19.6 18.7 19.6 23.9 C19.6 31 29 40.2 29 40.2 C29 40.2 38.4 31 38.4 23.9 C38.4 18.7 34.2 14.5 29 14.5 Z" fill="url(#llHeadG)" />
          <circle cx="29" cy="23.7" r="4.1" fill="#fff" />
        </g>
      </svg>
    </span>
  )
}
