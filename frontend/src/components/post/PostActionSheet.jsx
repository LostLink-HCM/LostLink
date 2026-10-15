import { useEffect, useRef } from 'react'
import Icon from '../common/Icon'
import { cx, focusRing } from '../moderator/classes'

const rowClass = cx(
  'flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-3.5 py-3 text-left text-small font-medium transition-colors',
  focusRing
)

// Bảng chọn trượt từ dưới lên, chỉ dùng trên mobile thay cho cột hành động bên phải
export default function PostActionSheet({ open, onClose, actions }) {
  const sheetRef = useRef(null)

  useEffect(() => {
    if (!open) return
    sheetRef.current?.querySelector('button')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Đóng"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-ink/45 backdrop-blur-[2px]"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tuỳ chọn bài đăng"
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-dialog motion-safe:animate-ll-fade"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line-strong"
        />
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {actions.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  action.onClick()
                }}
                className={cx(
                  rowClass,
                  action.tone === 'primary' && 'font-semibold text-primary hover:bg-primary-subtle',
                  action.tone === 'danger' && 'text-danger-ink hover:bg-danger-soft',
                  !action.tone && 'text-ink hover:bg-surface-muted'
                )}
              >
                <Icon name={action.icon} size={18} />
                {action.label}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className={cx(
            'mt-2 h-11 w-full cursor-pointer rounded-full border border-line bg-surface text-small font-semibold text-ink-secondary hover:bg-surface-muted',
            focusRing
          )}
        >
          Huỷ
        </button>
      </div>
    </div>
  )
}
