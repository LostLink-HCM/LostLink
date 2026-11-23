import { OUTLINE } from '../../auth/scene/theme'
import { PeekCat, PeekDog } from '../mascots/PeekPets'

const FLIGHT = 'M150 70 C 380 -14, 820 -14, 1050 70'
const LOOP = '4.4s'

export default function PaperPlaneScene() {
  return (
    <svg
      viewBox="0 0 1200 124"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden size-full lg:block"
    >
      <path
        d={FLIGHT}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.4"
        strokeWidth="2"
        strokeDasharray="1 9"
        strokeLinecap="round"
        className="motion-safe:animate-hero-dash"
      />

      <g opacity="0" className="motion-reduce:hidden">
        <path d="M-10 -7 L12 0 L-10 7 L-5 0 Z" fill="#fff" {...OUTLINE} strokeWidth="1.5" />
        <path d="M-5 0 L12 0" stroke="#94a3b8" strokeWidth="1.2" />
        <animateMotion
          path={FLIGHT}
          dur={LOOP}
          rotate="auto"
          repeatCount="indefinite"
          keyPoints="0;0;1;1"
          keyTimes="0;0.1;0.68;1"
          calcMode="linear"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0;0"
          keyTimes="0;0.1;0.66;0.72;1"
          dur={LOOP}
          repeatCount="indefinite"
        />
      </g>

      <g className="origin-bottom [transform-box:fill-box] motion-safe:animate-hero-launch">
        <PeekCat className="" x="96" y="56" width="110" height="68" />
      </g>
      <g className="origin-bottom [transform-box:fill-box] motion-safe:animate-hero-hop">
        <PeekDog className="" x="996" y="53" width="104" height="71" />
      </g>
    </svg>
  )
}
