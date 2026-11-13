import { CHEEK, INK, LINE, OUTLINE, PINK } from '../../auth/scene/theme'

const FUR = '#fbf8f4'
const TAIL = 'M134 72 C152 84 116 94 92 86'

export default function SleepingCat({ className = '' }) {
  return (
    <svg viewBox="0 0 170 96" aria-hidden="true" className={className}>
      <ellipse cx="86" cy="88" rx="62" ry="5" fill="#000" opacity="0.1" />
      <g className="origin-[86px_86px] animate-auth-breathe">
        <path
          d="M34 84 C26 62 44 44 76 42 C112 40 138 52 140 70 C142 80 134 86 122 86 L42 86 C38 86 35 86 34 84 Z"
          fill={FUR}
          {...OUTLINE}
        />
        <path d="M30 50 L24 24 L44 40 Z" fill={FUR} {...OUTLINE} />
        <path d="M62 40 L74 20 L76 48 Z" fill={FUR} {...OUTLINE} />
        <path d="M31 44 L28 31 L38 40 Z" fill={PINK} />
        <path d="M66 41 L72 30 L72 44 Z" fill={PINK} />
        <ellipse cx="50" cy="62" rx="27" ry="23" fill={FUR} {...OUTLINE} />
        <path
          d="M45 43 v5 M50 42 v6 M55 43 v5"
          stroke="#cfc6d8"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M34 62 q5 4 10 0 M56 62 q5 4 10 0"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M47 68 h6 l-3 3.4 z" fill={PINK} {...OUTLINE} strokeWidth="1.4" />
        <ellipse cx="34" cy="71" rx="5" ry="3" fill={CHEEK} opacity="0.7" />
        <ellipse cx="66" cy="71" rx="5" ry="3" fill={CHEEK} opacity="0.7" />
        <path d={TAIL} fill="none" stroke={LINE} strokeWidth="12" strokeLinecap="round" />
        <path d={TAIL} fill="none" stroke={FUR} strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="72" cy="84" rx="10" ry="5.5" fill={FUR} {...OUTLINE} />
      </g>
      <g fill="#8aa0c2" fontFamily="inherit" fontWeight="700">
        <text x="92" y="32" fontSize="12" className="motion-safe:animate-ll-twinkle">
          z
        </text>
        <text
          x="104"
          y="18"
          fontSize="16"
          className="motion-safe:animate-ll-twinkle [animation-delay:1.2s]"
        >
          z
        </text>
      </g>
    </svg>
  )
}
