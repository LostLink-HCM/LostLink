import Starfield from './Starfield'
import { PAUSE_ALL } from './theme'

function CloudShape({ className }) {
  return (
    <g className={className}>
      <rect x="8" y="34" width="164" height="30" rx="15" />
      <circle cx="50" cy="38" r="22" />
      <circle cx="90" cy="30" r="28" />
      <circle cx="132" cy="40" r="19" />
    </g>
  )
}

// Đàn chim trôi cùng mây
const BIRD = 'M0 6 Q5 0 10 6 Q15 0 20 6'
const FLOCKS = [
  {
    className: 'top-[15%] [animation-duration:70s] [animation-delay:-18s]',
    birds: [
      [0, 10, '0s'],
      [26, 0, '-0.12s'],
      [44, 14, '-0.22s'],
    ],
  },
  {
    className: 'top-[30%] [animation-duration:86s] [animation-delay:-60s]',
    birds: [
      [0, 4, '-0.08s'],
      [22, 12, '-0.2s'],
    ],
  },
]

// Độ trễ âm để khi mở trang mây đã ở giữa đường
const CLOUDS = [
  { width: 150, className: 'top-[9%] [animation-delay:-40s]' },
  { width: 110, className: 'top-[24%] [animation-duration:160s] [animation-delay:-110s]' },
  { width: 84, className: 'top-[4%] [animation-duration:140s] [animation-delay:-80s]' },
]

// Màu lấy từ token au-* nên tự đổi theo data-auth-time
export default function Sky({ time, paused = false }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 overflow-hidden motion-reduce:**:animate-none ${paused ? PAUSE_ALL : ''}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_40%,var(--color-au-glow),transparent_70%)]" />
      <div className="absolute inset-x-0 top-0 bottom-[30%] opacity-(--au-star-opacity) transition-opacity duration-1000">
        <Starfield count={110} />
      </div>

      {time === 'night' ? (
        <div className="absolute top-(--au-sun-top) left-(--au-sun-left) size-12 rounded-full shadow-[inset_-11px_-2px_0_0_var(--color-au-sun),0_0_60px_14px_var(--color-au-sun-glow)]" />
      ) : (
        <div className="absolute top-(--au-sun-top) left-(--au-sun-left) size-16 rounded-full bg-au-sun shadow-[0_0_0_14px_var(--color-au-sun-glow),0_0_80px_30px_var(--color-au-sun-glow)] transition-[top,left] duration-1000" />
      )}

      {CLOUDS.map(({ width, className }) => (
        <div
          key={className}
          className={`absolute -left-55 opacity-(--au-cloud-opacity) animate-auth-drift ${className}`}
        >
          <svg width={width} height={width * 0.4} viewBox="0 0 180 72" className="block">
            <g transform="translate(0 5)">
              <CloudShape className="fill-au-cloud-shade" />
            </g>
            <CloudShape className="fill-au-cloud" />
          </svg>
        </div>
      ))}

      {FLOCKS.map(({ className, birds }) => (
        <div key={className} className={`absolute -left-20 animate-auth-drift ${className}`}>
          <svg width="94" height="46" viewBox="0 0 70 34" className="block overflow-visible">
            {birds.map(([x, y, delay]) => (
              <g key={x} transform={`translate(${x} ${y})`}>
                <path
                  d={BIRD}
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animationDelay: delay }}
                  className="origin-[10px_6px] animate-auth-flap stroke-au-bird"
                />
              </g>
            ))}
          </svg>
        </div>
      ))}
    </div>
  )
}
