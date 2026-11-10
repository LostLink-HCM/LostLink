import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

const itemClass = cx(
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-small font-medium transition-colors',
  focusRing
)

// Nút ⋯ mở menu thao tác với bài. actions: [{ label, icon, onClick, tone? }], danger ở cuối.
// Mũi tên lên/xuống chuyển mục, Esc đóng và trả focus về nút ⋯
export default function PostMenu({ title, actions }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined
    const items = () => [...ref.current.querySelectorAll('[role="menuitem"]')]
    items()[0]?.focus()

    const onPointer = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
        return
      }
      if (e.key === 'Tab') {
        setOpen(false)
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const list = items()
      const step = e.key === 'ArrowDown' ? 1 : -1
      const index = list.indexOf(document.activeElement)
      list[(index + step + list.length) % list.length]?.focus()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (action) => () => {
    setOpen(false)
    action.onClick()
  }
  const main = actions.filter((action) => action.tone !== 'danger')
  const danger = actions.filter((action) => action.tone === 'danger')

  return (
    // Nằm trên lớp link của thẻ, đang mở thì nổi trên các thẻ bên dưới
    <div ref={ref} className={cx('relative', open ? 'z-30' : 'z-10')}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Tuỳ chọn bài ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'grid size-8 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink',
          open && 'bg-surface-muted text-ink',
          focusRing
        )}
      >
        <Icon name="more" size={18} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Thao tác với bài ${title}`}
          className="absolute top-full right-0 mt-1.5 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-dialog"
        >
          {main.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={choose(action)}
              className={cx(itemClass, 'text-ink-secondary hover:bg-primary-subtle hover:text-ink')}
            >
              <Icon name={action.icon} size={15} className="shrink-0" />
              {action.label}
            </button>
          ))}
          {main.length > 0 && danger.length > 0 && (
            <div role="separator" className="my-1 h-px bg-line" />
          )}
          {danger.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={choose(action)}
              className={cx(itemClass, 'text-danger-ink hover:bg-danger-soft')}
            >
              <Icon name={action.icon} size={15} className="shrink-0" />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
