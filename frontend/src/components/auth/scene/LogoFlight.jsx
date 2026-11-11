import { useEffectEvent, useLayoutEffect, useRef } from 'react'
import Logo from './Logo'
import { LOGO_VIEWBOX } from './theme'

const FLY_MS = 950

// Vị trí logo trong cảnh và quãng bay tới logo trên header, tính theo px màn hình
function measure(svg, target) {
  const matrix = svg?.getScreenCTM()
  if (!matrix || !target) return null
  const { x, y, size } = LOGO_VIEWBOX
  const from = new DOMPoint(x, y).matrixTransform(matrix)
  const to = new DOMPoint(x + size, y + size).matrixTransform(matrix)
  const box = target.getBoundingClientRect()
  const width = to.x - from.x
  return {
    left: from.x,
    top: from.y,
    size: width,
    dx: box.left - from.x,
    dy: box.top - from.y,
    scale: box.width / width,
  }
}

// Bay theo đường cong từ cảnh lên header, đổi dần từ logo bong bóng sang logo header
export default function LogoFlight({ sceneRef, targetRef, onDone }) {
  const flyRef = useRef(null)
  const darkRef = useRef(null)
  const lightRef = useRef(null)
  const finish = useEffectEvent(() => onDone())

  useLayoutEffect(() => {
    const flight = measure(sceneRef.current, targetRef?.current)
    if (!flight) {
      finish()
      return
    }
    const { left, top, size, dx, dy, scale } = flight
    const el = flyRef.current
    Object.assign(el.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${size}px`,
      height: `${size}px`,
    })
    const timing = { duration: FLY_MS, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }
    const move = el.animate(
      [
        { transform: 'translate(0, 0) scale(1)' },
        {
          transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(${1 + (scale - 1) * 0.5})`,
          offset: 0.5,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      ],
      timing
    )
    const dark = darkRef.current.animate([{ opacity: 1 }, { opacity: 0 }], timing)
    const light = lightRef.current.animate([{ opacity: 0 }, { opacity: 1 }], timing)
    move.onfinish = finish
    return () => [move, dark, light].forEach((a) => a.cancel())
  }, [sceneRef, targetRef])

  return (
    <div ref={flyRef} className="fixed z-50 origin-top-left">
      <div ref={darkRef} className="absolute inset-0">
        <Logo tone="dark" className="block size-full" />
      </div>
      <div ref={lightRef} className="absolute inset-0 opacity-0">
        <Logo tone="header" className="block size-full" />
      </div>
    </div>
  )
}
