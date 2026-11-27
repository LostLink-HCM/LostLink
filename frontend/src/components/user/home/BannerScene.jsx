import { OUTLINE } from '../../auth/scene/theme'

const FLIGHT = 'M66 28 C 330 -8, 780 -8, 1044 28'

function PaperPlane() {
  return (
    <svg
      viewBox="-24 -12 48 24"
      className="absolute top-[5%] left-1/2 h-6 w-12 -translate-x-1/2 -translate-y-1/2"
    >
      <path d="M-10 -7 L12 0 L-10 7 L-5 0 Z" fill="#fff" {...OUTLINE} strokeWidth="1.5" />
      <path d="M-5 0 L12 0" stroke="#94a3b8" strokeWidth="1.2" />
    </svg>
  )
}

export default function BannerScene() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[1110px] -translate-x-1/2 xl:block"
    >
      <svg viewBox="0 0 1110 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path
          d={FLIGHT}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeDasharray="1 9"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <PaperPlane />
    </div>
  )
}
