import { useId } from 'react'
import { LOOK_UP_WHEN_OOPS, PUPILS, SHOW_WHEN_HAPPY } from './mood'
import { CHEEK, INK, LINE, OUTLINE, PINK, SPRING } from './theme'

const FUR = '#fff7ec'
const SHADE = '#efe2cd'
const PATCH = '#f0913a'
const PATCH_SHADE = '#d97a26'

const BODY = 'M-40 -20 C-50 -72 -42 -134 0 -136 C42 -134 50 -72 40 -20 C26 -10 -26 -10 -40 -20 Z'
const TAIL = 'M36 -48 C58 -52 66 -76 56 -90'
const COLLAR = 'M-37 -58 q37 17 74 0'

// Ẩn mắt mở khi cún nhắm mắt (người dùng gõ mật khẩu) hoặc cười
const EYES_OPEN =
  'transition-opacity group-data-[mood=happy]/scene:opacity-0 group-data-[mood=shy]/scene:opacity-0 group-data-[mood=peek]/scene:opacity-0'
const EYES_SHUT =
  'opacity-0 transition-opacity group-data-[mood=shy]/scene:opacity-100 group-data-[mood=peek]/scene:opacity-100'

// Cún bên phải, toạ độ gốc là điểm giữa chân trên mặt đất
export default function Dog() {
  const clipId = useId()
  const shadeId = useId()

  return (
    <g className="group-data-[story=arrive]/scene:animate-auth-dog-in group-data-[story=lose]/scene:animate-auth-dog-out">
      <g transform="translate(460 382)">
        <ellipse cy="1" rx="46" ry="6" fill="#000" opacity="0.16" />
        <g className="group-data-[mood=happy]/scene:animate-auth-hop-late">
          <g className="group-data-[story=arrive]/scene:animate-auth-dog-stop group-data-[story=lose]/scene:animate-auth-dog-lose">
            {/* Bụi bay lên lúc cún dừng lại */}
            <circle
              cx="54"
              cy="-8"
              r="7"
              fill="#fff"
              className="origin-center opacity-0 transform-fill group-data-[story=arrive]/scene:animate-auth-puff"
            />
            <circle
              cx="64"
              cy="-4"
              r="5"
              fill="#fff"
              className="origin-center opacity-0 transform-fill group-data-[story=arrive]/scene:animate-auth-puff-late"
            />

            <g className="origin-[36px_-48px] animate-auth-dog-tail group-data-[mood=happy]/scene:[animation-duration:0.45s]">
              <path d={TAIL} fill="none" stroke={LINE} strokeWidth="14.4" strokeLinecap="round" />
              <path d={TAIL} fill="none" stroke={PATCH} strokeWidth="10" strokeLinecap="round" />
            </g>

            {/* Chân trái chạy và đá, chân phải chỉ chạy */}
            <g className="origin-[-16px_-24px] group-data-[story=arrive]/scene:animate-auth-legs-in-l group-data-[story=back]/scene:animate-auth-kick group-data-[story=lose]/scene:animate-auth-legs-out-l">
              <rect x="-24" y="-26" width="16" height="26" rx="7" fill={FUR} {...OUTLINE} />
            </g>
            <g className="origin-[16px_-24px] group-data-[story=arrive]/scene:animate-auth-legs-in-r group-data-[story=lose]/scene:animate-auth-legs-out-r">
              <rect x="8" y="-26" width="16" height="26" rx="7" fill={FUR} {...OUTLINE} />
            </g>

            <g className="origin-[0_0] animate-auth-breathe">
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
              <g clipPath={`url(#${clipId})`}>
                <rect x="2" y="-140" width="50" height="130" fill={`url(#${shadeId})`} />
                <path
                  d="M0 -142 C34 -142 54 -116 48 -88 C30 -82 12 -92 4 -112 C2 -122 0 -132 0 -142 Z"
                  fill={PATCH}
                />
                <circle cx="32" cy="-40" r="11" fill={PATCH} />
              </g>

              <path d="M18 -128 L40 -156 L44 -116 Z" fill={PATCH} {...OUTLINE} />
              <path d="M25 -128 L38 -145 L39 -124 Z" fill={PINK} />
              <path
                d="M-28 -128 C-52 -132 -64 -106 -56 -84 C-46 -80 -36 -96 -28 -114 Z"
                fill={PATCH}
                {...OUTLINE}
              />
              <path
                d="M-50 -110 C-56 -100 -57 -92 -54 -86 C-50 -88 -46 -94 -43 -100 Z"
                fill={PATCH_SHADE}
                opacity="0.7"
              />

              <path d={COLLAR} fill="none" stroke={LINE} strokeWidth="10.4" strokeLinecap="round" />
              <path d={COLLAR} fill="none" stroke="#e2525e" strokeWidth="6" strokeLinecap="round" />
              <circle cx="0" cy="-44" r="6" fill="#ffd36b" {...OUTLINE} strokeWidth="1.8" />

              <g
                className={`transition-[translate,rotate] duration-300 ${SPRING} group-data-[mood=sad]/scene:rotate-9 group-data-[mood=look]/scene:-translate-x-[3px]`}
              >
                <g className="origin-center animate-auth-blink transform-fill [animation-delay:-2.2s]">
                  <g className={EYES_OPEN}>
                    <g className={`${PUPILS} ${LOOK_UP_WHEN_OOPS}`}>
                      <ellipse cx="-16" cy="-98" rx="6.8" ry="8.2" fill={INK} />
                      <ellipse cx="16" cy="-100" rx="6.4" ry="7.8" fill={INK} />
                      <circle cx="-13.6" cy="-101" r="2.4" fill="#fff" />
                      <circle cx="18.2" cy="-103" r="2.2" fill="#fff" />
                    </g>
                  </g>
                </g>
                <path
                  d="M-23 -98 q7 5 14 0 M9 -100 q7 5 14 0"
                  fill="none"
                  {...OUTLINE}
                  strokeWidth="2.6"
                  className={EYES_SHUT}
                />
                <path
                  d="M-23 -96 q7 -10 14 0 M9 -98 q7 -10 14 0"
                  fill="none"
                  {...OUTLINE}
                  strokeWidth="2.6"
                  className={SHOW_WHEN_HAPPY}
                />
                <ellipse cx="-1" cy="-82" rx="7.5" ry="5.5" fill={INK} />
                <ellipse cx="-3.5" cy="-83.5" rx="2.4" ry="1.4" fill="#fff" />
                <path
                  d="M-4 -71 q0 13 6.5 13 q6.5 0 6.5 -13 z"
                  fill="#ff8a98"
                  {...OUTLINE}
                  strokeWidth="1.8"
                />
                <path
                  d="M-14 -73 q6.5 5.5 13 0 q6.5 5.5 13 0"
                  fill="none"
                  {...OUTLINE}
                  strokeWidth="1.9"
                />
                <ellipse cx="-28" cy="-82" rx="6.5" ry="4" fill={CHEEK} opacity="0.7" />
                <ellipse cx="28" cy="-86" rx="6" ry="3.6" fill={CHEEK} opacity="0.7" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}
