import { useRef, useState } from 'react'
import { cx, focusRing } from '../classes'

const clamp = (value) => Math.min(96, Math.max(4, value))
const KEY_STEP = 2
const KEY_MOVES = {
  ArrowLeft: [-KEY_STEP, 0],
  ArrowRight: [KEY_STEP, 0],
  ArrowUp: [0, -KEY_STEP],
  ArrowDown: [0, KEY_STEP],
}

// Vài trục đường, sông vẽ nền cho bản đồ minh hoạ (toạ độ theo %)
const BACKGROUND_ROADS = [
  'M-5 30 C 30 24, 60 36, 105 28',
  'M-5 78 C 35 84, 70 70, 105 76',
  'M46 -5 C 40 30, 52 70, 44 105',
  'M78 -5 C 82 40, 72 60, 80 105',
]

// Bản đồ minh hoạ cho phần giao diện.
export default function LocationMap({
  point,
  road,
  label,
  emptyText,
  draggable,
  onMove,
  ringPercent,
}) {
  const ref = useRef(null)
  const [dragging, setDragging] = useState(false)

  const moveTo = (e) => {
    const rect = ref.current.getBoundingClientRect()
    onMove({
      x: clamp(((e.clientX - rect.left) / rect.width) * 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100),
    })
  }

  const onKeyDown = (e) => {
    const move = KEY_MOVES[e.key]
    if (!move) return
    e.preventDefault()
    onMove({ x: clamp(point.x + move[0]), y: clamp(point.y + move[1]) })
  }

  const dragHandlers = draggable && {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
      moveTo(e)
    },
    onPointerMove: (e) => dragging && moveTo(e),
    onPointerUp: () => setDragging(false),
    onPointerCancel: () => setDragging(false),
  }

  return (
    <div
      ref={ref}
      {...dragHandlers}
      className={cx(
        'relative h-60 overflow-hidden rounded-2xl border border-line bg-[#eef2f7] select-none sm:h-80',
        draggable && 'touch-none',
        draggable && (dragging ? 'cursor-grabbing' : 'cursor-crosshair')
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[image:linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-size-[30px_30px] opacity-70"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
      >
        <ellipse cx="18" cy="18" rx="12" ry="9" className="fill-[#dcefe0]" />
        <path
          d="M-5 62 C 25 54, 55 72, 105 58"
          fill="none"
          strokeWidth="16"
          vectorEffect="non-scaling-stroke"
          className="stroke-[#cfe3f5]"
        />
        {BACKGROUND_ROADS.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-white"
          />
        ))}
        {road && (
          <g strokeLinecap="round">
            <line
              x1={road.line[0]}
              y1={road.line[1]}
              x2={road.line[2]}
              y2={road.line[3]}
              strokeWidth="26"
              vectorEffect="non-scaling-stroke"
              className="stroke-primary/20"
            />
            <line
              x1={road.line[0]}
              y1={road.line[1]}
              x2={road.line[2]}
              y2={road.line[3]}
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
              className="stroke-primary"
            />
          </g>
        )}
      </svg>

      {point && !road && ringPercent != null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-primary/45 bg-primary/12 transition-[width]"
          style={{ left: `${point.x}%`, top: `${point.y}%`, width: `${ringPercent}%` }}
        />
      )}

      {point && !road && (
        <div className="absolute" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
          {/* Vùng mờ người khác nhìn thấy thay cho vị trí chính xác */}
          {ringPercent == null && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-36 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-primary/45 bg-primary/12 sm:size-52"
            />
          )}
          {draggable ? (
            <button
              type="button"
              aria-label="Ghim vị trí, dùng phím mũi tên để di chuyển"
              onKeyDown={onKeyDown}
              className={cx(
                'absolute -translate-x-1/2 -translate-y-full cursor-grab rounded-full border-0 bg-transparent p-1',
                focusRing
              )}
            >
              <PinShape />
            </button>
          ) : (
            <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-full p-1">
              <PinShape />
            </span>
          )}
        </div>
      )}

      {!point && !road && (
        <div className="absolute inset-0 grid place-items-center p-4">
          <span className="rounded-full bg-surface/95 px-4 py-2 text-center text-caption text-ink-muted shadow-card">
            {emptyText}
          </span>
        </div>
      )}

      {label && (
        <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-24px)] truncate rounded-lg bg-surface/95 px-3 py-2 text-caption font-medium text-ink shadow-card">
          {label}
        </div>
      )}
      {draggable && (
        <div className="pointer-events-none absolute right-3 bottom-3 rounded-lg bg-ink/80 px-3 py-1.5 text-tiny text-white">
          Bấm hoặc kéo để đặt ghim
        </div>
      )}
    </div>
  )
}

function PinShape() {
  return (
    <span className="relative block size-6 -rotate-45 rounded-[99px_99px_99px_2px] bg-danger shadow-[0_4px_10px_rgb(0_0_0/0.22)]">
      <span className="absolute inset-[7px] rounded-full bg-white" />
    </span>
  )
}
