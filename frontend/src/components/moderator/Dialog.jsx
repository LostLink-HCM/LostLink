import { useEffect, useId, useRef } from 'react'
import IconButton from './IconButton'

const widths = { sm: 'max-w-[440px]', md: 'max-w-[560px]', lg: 'max-w-[680px]' }

// Dùng <dialog> gốc: có sẵn focus trap, Esc để đóng và backdrop
export default function Dialog({ title, onClose, footer, size = 'md', children }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    // autoFocus của React chạy trước khi dialog mở nên bị showModal ghi đè; dùng data-autofocus thay thế
    dialog.querySelector('[data-autofocus]')?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // Bấm ra vùng tối bên ngoài thì đóng
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto max-h-[calc(100dvh-40px)] w-[calc(100vw-32px)] ${widths[size]} overflow-y-auto rounded-2xl bg-surface p-0 text-ink shadow-dialog backdrop:bg-sidebar/45 backdrop:backdrop-blur-[3px]`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-5 py-3 max-sm:px-4">
        <h2 id={titleId} className="text-lead font-bold">
          {title}
        </h2>
        <IconButton icon="close" label="Đóng" onClick={onClose} />
      </header>
      <div className="px-5 py-4 max-sm:p-4">{children}</div>
      {footer && (
        <footer className="flex flex-wrap justify-end gap-2.5 border-t border-line px-5 py-3 max-sm:px-4">
          {footer}
        </footer>
      )}
    </dialog>
  )
}
