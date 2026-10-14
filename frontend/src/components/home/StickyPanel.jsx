import { useLayoutEffect, useRef, useState } from 'react'
const TOP_GAP = 100
const BOTTOM_GAP = 16

export default function StickyPanel({ className, children, ...props }) {
  const ref = useRef(null)
  const [top, setTop] = useState(TOP_GAP)

  useLayoutEffect(() => {
    const el = ref.current
    const update = () =>
      setTop(Math.min(TOP_GAP, window.innerHeight - el.offsetHeight - BOTTOM_GAP))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <aside ref={ref} className={`sticky ${className}`} style={{ top }} {...props}>
      {children}
    </aside>
  )
}
