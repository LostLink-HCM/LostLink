import { LogoLens } from './Logo'
import { YARN, YARN_LINE } from './theme'

const BUBBLE =
  'M212 132 C192 116 206 80 234 88 C238 64 276 58 288 80 C312 70 336 96 322 116 C342 132 326 166 300 160 C290 180 252 182 242 166 C214 172 196 150 212 132 Z'

// Mèo nghĩ tới cuộn len, chỉ hiện trong nhịp arrive
export default function ThoughtBubble() {
  return (
    <g className="origin-[262px_130px] opacity-0 group-data-[story=arrive]/scene:animate-auth-bubble">
      <g transform="translate(0 4)" fill="#000" opacity="0.16">
        <circle cx="188" cy="214" r="6.5" />
        <circle cx="207" cy="191" r="10" />
        <path d={BUBBLE} />
      </g>
      <g fill="#fff">
        <circle cx="188" cy="214" r="6.5" />
        <circle cx="207" cy="191" r="10" />
        <path d={BUBBLE} />
      </g>
      <LogoLens tone="dark">
        <g className="origin-[262px_128px] group-data-[story=arrive]/scene:animate-auth-think">
          <circle cx="262" cy="128" r="13" fill={YARN} />
          <path
            d="M251 123 q11 -6 22 3 M253 134 q9 -13 20 -11 M256 117 q4 11 13 22"
            fill="none"
            stroke={YARN_LINE}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text x="298" y="108" fill="#8a93a8" fontSize="22" fontWeight="700">
            ?
          </text>
        </g>
      </LogoLens>
      <path
        d="M246 117 a17 17 0 0 1 9 -8"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  )
}
