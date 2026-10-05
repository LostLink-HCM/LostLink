import { useId } from 'react'

// Hình vẽ theo toạ độ gốc 1024px của logo, đưa về khung 64x64 để dùng chung keyframe logo-*
const FIT = 'scale(0.07683) translate(-119 -103)'
const CENTER = { transformBox: 'view-box', transformOrigin: '32px 32px' }

export default function Logo({ size = 40, animated = false, className = '' }) {
  // Mỗi logo một id gradient, tránh trùng khi trang có nhiều logo
  const gradientId = useId()

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {animated && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full motion-safe:animate-logo-glow"
          style={{
            inset: -size * 0.3,
            background: 'radial-gradient(circle, rgba(46,109,180,0.24), rgba(46,109,180,0) 68%)',
          }}
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="relative block"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="312"
            y1="233"
            x2="614"
            y2="643"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#3E86D6" />
            <stop offset="1" stopColor="#2F6FB8" />
          </linearGradient>
        </defs>

        <g
          className={animated ? 'motion-safe:animate-logo-mag' : undefined}
          style={animated ? CENTER : undefined}
        >
          <g transform={FIT}>
            <path
              d="M682.2 667.2 L879 863"
              stroke="#1B3358"
              strokeWidth="112"
              strokeLinecap="round"
            />
            <circle cx="463" cy="448" r="288" stroke="#1B3358" strokeWidth="80" />
            <path d="M556.8 175.7 A288 288 0 0 1 722.9 572" stroke="#9AA7BA" strokeWidth="80" />
          </g>
        </g>

        {animated && (
          <circle
            cx="26.4"
            cy="21.6"
            r="7"
            fill="rgba(142,192,242,0.9)"
            className="motion-safe:animate-logo-snap"
            style={{ transformBox: 'fill-box', transformOrigin: 'center', opacity: 0 }}
          />
        )}

        <g
          className={animated ? 'motion-safe:animate-logo-pin' : undefined}
          style={animated ? CENTER : undefined}
        >
          <g transform={FIT}>
            <path
              d="M463 643 C430 606 312 488 312 384 A151 151 0 0 1 614 384 C614 488 496 606 463 643 Z"
              fill={`url(#${gradientId})`}
            />
            <circle cx="463" cy="379" r="65" fill="#fff" />
          </g>
        </g>
      </svg>
    </span>
  )
}
