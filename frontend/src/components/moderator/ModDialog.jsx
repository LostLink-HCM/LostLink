import { useEffect, useRef } from 'react'
import ModIcon from './ModIcon'

export default function ModDialog({ title, children, footer, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog ref={ref} className="mod-dialog" aria-labelledby="mod-dialog-title" onCancel={onClose} onClick={(event) => { if (event.target === ref.current) onClose() }}>
      <div className="mod-dialog-inner">
        <header><h2 id="mod-dialog-title">{title}</h2><button className="mod-icon-button" onClick={onClose} aria-label="Đóng"><ModIcon name="close" /></button></header>
        <div className="mod-dialog-body">{children}</div>
        <footer>{footer || <button className="mod-button" onClick={onClose}>Đóng</button>}</footer>
      </div>
    </dialog>
  )
}
