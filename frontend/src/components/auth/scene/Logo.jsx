import { useId } from 'react'
import { LOGO_VIEWBOX } from './theme'

// Vẽ riêng với common/Logo để tách được ghim và kính lúp khi diễn hoạt cảnh
const TONES = {
  dark: { ring: '#22304a', glass: '#dff1ff' },
  // Thêm viền sáng để vành đậm không chìm vào nền trời
  header: { ring: '#22304a', glass: '#dff1ff', edge: '#eaf1fb' },
}

export function LogoPinGradient({ id }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fb923c" />
      <stop offset="1" stopColor="#c2410c" />
    </linearGradient>
  )
}

// children nằm giữa mặt kính và vành kính
export function LogoLens({ tone = 'dark', children }) {
  const { ring, glass, edge } = TONES[tone]

  return (
    <g>
      {edge && (
        <g stroke={edge} fill="none">
          <path d="M283 149 L298 164" strokeWidth="13" strokeLinecap="round" />
          <circle cx="262" cy="128" r="26" strokeWidth="10" />
        </g>
      )}
      <path d="M283 149 L298 164" stroke={ring} strokeWidth="9" strokeLinecap="round" />
      <circle cx="262" cy="128" r="26" fill={glass} />
      {children}
      <circle cx="262" cy="128" r="26" fill="none" stroke={ring} strokeWidth="6" />
    </g>
  )
}

export function LogoPin({ gradientId }) {
  return (
    <g>
      <path
        d="M262 141 C255 133 250 126 250 119 a12 12 0 0 1 24 0 c0 7 -5 14 -12 22z"
        fill={`url(#${gradientId})`}
      />
      <circle cx="262" cy="119" r="4.4" fill="#fff" />
    </g>
  )
}

export default function Logo({ tone = 'header', className = '' }) {
  const gradientId = useId()
  const { x, y, size } = LOGO_VIEWBOX

  return (
    <svg
      viewBox={`${x} ${y} ${size} ${size}`}
      overflow="visible"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <LogoPinGradient id={gradientId} />
      </defs>
      <LogoLens tone={tone} />
      <LogoPin gradientId={gradientId} />
    </svg>
  )
}
