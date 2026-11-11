import { useId } from 'react'
import {
  DEFAULT_MOUTH,
  LOOK_UP_WHEN_OOPS,
  PUPILS,
  SHOW_WHEN_HAPPY,
  SHOW_WHEN_OOPS,
  SHOW_WHEN_PLAYFUL,
  SHOW_WHEN_SAD,
} from './mood'
import { CHEEK, INK, LINE, OUTLINE, PINK, SPRING } from './theme'

const FUR = '#fbf8f4'
const SHADE = '#e8e1ea'
const STRIPE = '#cfc6d8'
const WHISKER = '#b9b0c4'

const BODY = 'M-46 0 C-54 -40 -54 -92 -40 -116 C-30 -132 30 -132 40 -116 C54 -92 54 -40 46 0 Z'
const TAIL = 'M-40 -14 C-78 -14 -86 -52 -64 -70'

// Mèo trắng ngồi bên trái, toạ độ gốc là điểm giữa chân trên mặt đất
export default function Cat() {
  const clipId = useId()
  const shadeId = useId()

  return (
    <g transform="translate(130 382)">
      <ellipse cy="1" rx="52" ry="6" fill="#000" opacity="0.16" />
      <g className="group-data-[mood=happy]/scene:animate-auth-hop">
        <g className="origin-[-40px_-14px] animate-auth-cat-tail group-data-[mood=lost]/scene:[animation-duration:6s] group-data-[mood=happy]/scene:[animation-duration:0.9s]">
          <path d={TAIL} fill="none" stroke={LINE} strokeWidth="14.4" strokeLinecap="round" />
          <path d={TAIL} fill="none" stroke={FUR} strokeWidth="10" strokeLinecap="round" />
        </g>

        {/* Buồn thì thở dài chậm */}
        <g className="origin-[0_0] animate-auth-breathe group-data-[mood=lost]/scene:animate-auth-sigh">
          {/* Tai cụp xuống khi buồn */}
          <g
            className={`origin-[0_-118px] transition-[scale,translate] duration-300 group-data-[mood=lost]/scene:translate-y-2 group-data-[mood=lost]/scene:scale-y-84 group-data-[mood=sad]/scene:translate-y-2 group-data-[mood=sad]/scene:scale-y-84`}
          >
            <path d="M-40 -106 L-44 -148 L-12 -126 Z" fill={FUR} {...OUTLINE} />
            <path d="M40 -106 L44 -148 L12 -126 Z" fill={FUR} {...OUTLINE} />
            <path d="M-36 -116 L-39 -139 L-22 -126 Z" fill={PINK} />
            <path d="M36 -116 L39 -139 L22 -126 Z" fill={PINK} />
          </g>

          <defs>
            <clipPath id={clipId}>
              <path d={BODY} />
            </clipPath>
            <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={SHADE} stopOpacity="0" />
              <stop offset="0.75" stopColor={SHADE} />
            </linearGradient>
          </defs>
          <path d={BODY} fill={FUR} {...OUTLINE} />
          <rect
            x="4"
            y="-140"
            width="52"
            height="140"
            fill={`url(#${shadeId})`}
            clipPath={`url(#${clipId})`}
          />
          <path
            d="M-7 -121 v8 M0 -123 v10 M7 -121 v8"
            fill="none"
            stroke={STRIPE}
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          <g
            className={`transition-[translate,rotate] duration-300 ${SPRING} group-data-[mood=lost]/scene:translate-y-[3px] group-data-[mood=sad]/scene:animate-auth-shake group-data-[mood=look]/scene:translate-x-[3px] group-data-[mood=look]/scene:rotate-4 group-data-[mood=shy]/scene:-rotate-4`}
          >
            <g className="origin-center animate-auth-blink transform-fill">
              <g className="transition-opacity group-data-[mood=happy]/scene:opacity-0">
                <g
                  className={`${PUPILS} group-data-[mood=lost]/scene:translate-x-0 group-data-[mood=lost]/scene:translate-y-[3px] group-data-[mood=peek]/scene:-translate-y-[3px] ${LOOK_UP_WHEN_OOPS}`}
                >
                  <ellipse cx="-17" cy="-90" rx="7.5" ry="9" fill={INK} />
                  <ellipse cx="17" cy="-90" rx="7.5" ry="9" fill={INK} />
                  <circle cx="-14.5" cy="-93.5" r="2.7" fill="#fff" />
                  <circle cx="19.5" cy="-93.5" r="2.7" fill="#fff" />
                  <circle cx="-19" cy="-86" r="1.2" fill="#fff" />
                  <circle cx="15" cy="-86" r="1.2" fill="#fff" />
                </g>
              </g>
            </g>
            <path
              d="M-26 -104 Q-18 -105 -10 -110 M26 -104 Q18 -105 10 -110"
              fill="none"
              {...OUTLINE}
              className={SHOW_WHEN_SAD}
            />
            <path
              d="M-24 -88 Q-17 -98 -10 -88 M10 -88 Q17 -98 24 -88"
              fill="none"
              {...OUTLINE}
              strokeWidth="2.8"
              className={SHOW_WHEN_HAPPY}
            />
            <path d="M-4.5 -78 h9 l-4.5 5 z" fill={PINK} {...OUTLINE} strokeWidth="1.6" />
            <path
              d="M-7 -70 q3.5 4 7 0 q3.5 4 7 0"
              fill="none"
              {...OUTLINE}
              strokeWidth="1.9"
              className={DEFAULT_MOUTH}
            />
            <path
              d="M-6 -65 q6 -6 12 0"
              fill="none"
              {...OUTLINE}
              strokeWidth="1.9"
              className={SHOW_WHEN_SAD}
            />
            <path
              d="M-8 -70 q8 13 16 0 z"
              fill="#c94b5e"
              {...OUTLINE}
              strokeWidth="1.8"
              className={SHOW_WHEN_PLAYFUL}
            />
            <ellipse
              cy="-67"
              rx="3.6"
              ry="4.4"
              fill="#c94b5e"
              {...OUTLINE}
              strokeWidth="1.7"
              className={SHOW_WHEN_OOPS}
            />
            <ellipse cx="-30" cy="-75" rx="7" ry="4.2" fill={CHEEK} opacity="0.7" />
            <ellipse cx="30" cy="-75" rx="7" ry="4.2" fill={CHEEK} opacity="0.7" />
            <path
              d="M-38 -80 l-17 -3 M-38 -73 l-17 2 M38 -80 l17 -3 M38 -73 l17 2"
              stroke={WHISKER}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>

          {/* Hai chân trước, đưa lên che mắt khi người dùng gõ mật khẩu */}
          <g
            className={`transition-[translate] duration-400 ${SPRING} group-data-[mood=shy]/scene:-translate-y-20 group-data-[mood=peek]/scene:-translate-y-17`}
          >
            <ellipse cx="-17" cy="-6" rx="12.5" ry="8.5" fill={FUR} {...OUTLINE} />
            <path
              d="M-21 -9 v4 M-13 -9 v4"
              stroke="#c9c0d2"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Chân phải khều cuộn len sang cho cún */}
            <g className="group-data-[story=toss]/scene:animate-auth-paw-bat">
              <ellipse cx="17" cy="-6" rx="12.5" ry="8.5" fill={FUR} {...OUTLINE} />
              <path
                d="M13 -9 v4 M21 -9 v4"
                stroke="#c9c0d2"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}
