import { useEffect, useId, useRef } from 'react'
import IconButton from './IconButton'

const widths = { sm: 'max-w-[440px]', md: 'max-w-[560px]', lg: 'max-w-[680px]' }

export default function Dialog({
  title,
  showHeader = true,
  showTitle = true,
  onClose,
  footer,
  size = 'md',
  scrollableContent = false,
  children,
}) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    dialog.querySelector('[data-autofocus]')?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={showHeader && showTitle && title ? titleId : undefined}
      aria-label={showHeader && showTitle && title ? undefined : title || 'Hộp thoại'}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto ${scrollableContent ? 'flex max-h-[calc(100dvh-40px)] flex-col overflow-hidden' : 'max-h-[calc(100dvh-40px)] overflow-y-auto'} w-[calc(100vw-32px)] ${widths[size]} rounded-2xl bg-surface p-0 text-ink shadow-dialog backdrop:bg-sidebar/45 backdrop:backdrop-blur-[3px]`}
    >
      {showHeader && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-muted px-5 py-3 max-sm:px-4">
          {showTitle && title && (
            <h2 id={titleId} className="text-lead font-bold">
              {title}
            </h2>
          )}
          <IconButton icon="close" label="Đóng" onClick={onClose} />
        </header>
      )}
      <div
        className={`${scrollableContent ? 'min-h-0 flex-1 overflow-y-auto' : ''} px-5 py-4 max-sm:p-4`}
      >
        {children}
      </div>
      {footer && (
        <footer className="flex shrink-0 flex-wrap justify-end gap-2.5 border-t border-line px-5 py-3 max-sm:px-4">
          {footer}
        </footer>
      )}
    </dialog>
  )
}
