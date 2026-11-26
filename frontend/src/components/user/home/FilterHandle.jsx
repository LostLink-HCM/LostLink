import { useRef, useState } from 'react'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

const OPEN_DRAG = 24
const MOVE_START = 6
const TOP_GAP = 96
const BOTTOM_GAP = 140
const STORAGE_KEY = 'll-filter-handle-y'

const clampTop = (top) =>
  Math.min(Math.max(top, TOP_GAP), Math.max(TOP_GAP, window.innerHeight - BOTTOM_GAP))

const savedTop = () => {
  const ratio = Number(localStorage.getItem(STORAGE_KEY))
  return ratio > 0 && ratio < 1 ? clampTop(ratio * window.innerHeight) : null
}

export default function FilterHandle({ visible, activeCount = 0, onOpen }) {
  const [top, setTop] = useState(savedTop)
  const drag = useRef(null)
  const suppressClick = useRef(false)

  const label = activeCount ? `Mở bộ lọc, đang chọn ${activeCount} tiêu chí` : 'Mở bộ lọc'

  const onPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    drag.current = { x: e.clientX, y: e.clientY, top: rect.top + rect.height / 2, mode: null }
    suppressClick.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const state = drag.current
    if (!state) return
    const dx = e.clientX - state.x
    const dy = e.clientY - state.y
    if (!state.mode) {
      if (Math.abs(dy) > MOVE_START && Math.abs(dy) > Math.abs(dx)) state.mode = 'move'
      else if (dx > OPEN_DRAG) {
        state.mode = 'open'
        suppressClick.current = true
        onOpen()
      }
    }
    if (state.mode === 'move') {
      state.last = clampTop(state.top + dy)
      setTop(state.last)
    }
  }

  const onPointerEnd = () => {
    const state = drag.current
    drag.current = null
    if (state?.mode !== 'move') return
    suppressClick.current = true
    if (state.last != null)
      localStorage.setItem(STORAGE_KEY, String(state.last / window.innerHeight))
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-hidden={!visible || undefined}
      tabIndex={visible ? 0 : -1}
      onClick={() => {
        if (suppressClick.current) suppressClick.current = false
        else onOpen()
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={top == null ? undefined : { top }}
      className={cx(
        'fixed top-1/2 left-0 z-40 flex h-16 w-7 -translate-y-1/2 cursor-grab touch-none flex-col items-center justify-center gap-1 rounded-r-2xl border border-l-0 border-primary/35 bg-surface/95 text-primary shadow-[0_6px_18px_-6px_rgb(22_35_58/0.35)] backdrop-blur-sm transition-transform duration-200 active:cursor-grabbing lg:hidden',
        visible ? 'translate-x-0' : 'pointer-events-none -translate-x-full',
        focusRing
      )}
    >
      <Icon name="menu" size={16} />
      {activeCount > 0 && (
        <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-micro leading-4 font-bold text-white">
          {activeCount}
        </span>
      )}
    </button>
  )
}
