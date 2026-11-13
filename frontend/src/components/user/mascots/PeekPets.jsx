import { useId } from 'react'
import { CHEEK, INK, LINE, OUTLINE, PINK } from '../../auth/scene/theme'

export function PeekCat({ className = 'h-full w-auto' }) {
  const FUR = '#fbf8f4'
  const TAIL = 'M40 -60 C70 -62 80 -96 62 -114'

  return (
    <svg viewBox="-62 -152 148 92" className={className}>
      <g className="origin-[40px_-60px] animate-auth-cat-tail">
        <path d={TAIL} fill="none" stroke={LINE} strokeWidth="14.4" strokeLinecap="round" />
        <path d={TAIL} fill="none" stroke={FUR} strokeWidth="10" strokeLinecap="round" />
      </g>
      <path d="M-40 -106 L-44 -148 L-12 -126 Z" fill={FUR} {...OUTLINE} />
      <path d="M40 -106 L44 -148 L12 -126 Z" fill={FUR} {...OUTLINE} />
      <path d="M-36 -116 L-39 -139 L-22 -126 Z" fill={PINK} />
      <path d="M36 -116 L39 -139 L22 -126 Z" fill={PINK} />
      <path
        d="M-46 0 C-54 -40 -54 -92 -40 -116 C-30 -132 30 -132 40 -116 C54 -92 54 -40 46 0 Z"
        fill={FUR}
        {...OUTLINE}
      />
      <path
        d="M-7 -121 v8 M0 -123 v10 M7 -121 v8"
        stroke="#cfc6d8"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <g className="origin-center animate-auth-blink transform-fill">
        <ellipse cx="-17" cy="-90" rx="7.5" ry="9" fill={INK} />
        <ellipse cx="17" cy="-90" rx="7.5" ry="9" fill={INK} />
        <circle cx="-14.5" cy="-93.5" r="2.7" fill="#fff" />
        <circle cx="19.5" cy="-93.5" r="2.7" fill="#fff" />
      </g>
      <path d="M-4.5 -78 h9 l-4.5 5 z" fill={PINK} {...OUTLINE} strokeWidth="1.6" />
      <path d="M-7 -70 q3.5 4 7 0 q3.5 4 7 0" fill="none" {...OUTLINE} strokeWidth="1.9" />
      <ellipse cx="-30" cy="-75" rx="7" ry="4.2" fill={CHEEK} opacity="0.7" />
      <ellipse cx="30" cy="-75" rx="7" ry="4.2" fill={CHEEK} opacity="0.7" />
      <path
        d="M-38 -80 l-17 -3 M-38 -73 l-17 2 M38 -80 l17 -3 M38 -73 l17 2"
        stroke="#b9b0c4"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Hai chân bám lên mép */}
      <ellipse cx="-24" cy="-62" rx="12" ry="8" fill={FUR} {...OUTLINE} />
      <ellipse cx="24" cy="-62" rx="12" ry="8" fill={FUR} {...OUTLINE} />
      <path
        d="M-28 -66 v4 M-20 -66 v4 M20 -66 v4 M28 -66 v4"
        stroke="#c9c0d2"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PeekDog({ className = 'h-full w-auto' }) {
  const clipId = useId()
  const FUR = '#fff7ec'
  const PATCH = '#f0913a'
  const TAIL = 'M38 -60 C62 -62 72 -90 60 -108'
  const BODY = 'M-40 -20 C-50 -72 -42 -134 0 -136 C42 -134 50 -72 40 -20 C26 -10 -26 -10 -40 -20 Z'

  return (
    <svg viewBox="-66 -160 146 100" className={className}>
      <defs>
        <clipPath id={clipId}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <g className="origin-[38px_-60px] animate-auth-dog-tail [animation-duration:1.6s]">
        <path d={TAIL} fill="none" stroke={LINE} strokeWidth="14.4" strokeLinecap="round" />
        <path d={TAIL} fill="none" stroke={PATCH} strokeWidth="10" strokeLinecap="round" />
      </g>
      <path d={BODY} fill={FUR} {...OUTLINE} />
      <path
        d="M0 -142 C34 -142 54 -116 48 -88 C30 -82 12 -92 4 -112 C2 -122 0 -132 0 -142 Z"
        fill={PATCH}
        clipPath={`url(#${clipId})`}
      />
      <path d="M18 -128 L40 -156 L44 -116 Z" fill={PATCH} {...OUTLINE} />
      <path d="M25 -128 L38 -145 L39 -124 Z" fill={PINK} />
      <path
        d="M-28 -128 C-52 -132 -64 -106 -56 -84 C-46 -80 -36 -96 -28 -114 Z"
        fill={PATCH}
        {...OUTLINE}
      />
      <g className="origin-center animate-auth-blink transform-fill [animation-delay:-2.2s]">
        <ellipse cx="-16" cy="-98" rx="6.8" ry="8.2" fill={INK} />
        <ellipse cx="16" cy="-100" rx="6.4" ry="7.8" fill={INK} />
        <circle cx="-13.6" cy="-101" r="2.4" fill="#fff" />
        <circle cx="18.2" cy="-103" r="2.2" fill="#fff" />
      </g>
      <ellipse cx="-1" cy="-82" rx="7.5" ry="5.5" fill={INK} />
      <ellipse cx="-3.5" cy="-83.5" rx="2.4" ry="1.4" fill="#fff" />
      <path d="M-14 -73 q6.5 5.5 13 0 q6.5 5.5 13 0" fill="none" {...OUTLINE} strokeWidth="1.9" />
      <ellipse cx="-28" cy="-82" rx="6.5" ry="4" fill={CHEEK} opacity="0.7" />
      <ellipse cx="28" cy="-86" rx="6" ry="3.6" fill={CHEEK} opacity="0.7" />
      {/* Hai chân bám lên mép */}
      <ellipse cx="-22" cy="-62" rx="11" ry="8" fill={FUR} {...OUTLINE} />
      <ellipse cx="22" cy="-62" rx="11" ry="8" fill={FUR} {...OUTLINE} />
    </svg>
  )
}
