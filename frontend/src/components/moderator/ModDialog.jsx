import { useEffect, useRef } from 'react'
import ModIcon from './ModIcon'

export default function ModDialog({ title, children, footer, onClose, classes = {} }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog ref={ref} className={classes.dialog ?? 'mod-dialog'} aria-labelledby="mod-dialog-title" onCancel={onClose} onClick={(event) => { if (event.target === ref.current) onClose() }}>
      <div className={classes.inner ?? 'mod-dialog-inner'}>
        <header className={classes.header}><h2 id="mod-dialog-title" className={classes.title}>{title}</h2><button className={classes.close ?? 'mod-icon-button'} onClick={onClose} aria-label="Đóng"><ModIcon name="close" /></button></header>
        <div className={classes.body ?? 'mod-dialog-body'}>{children}</div>
        <footer className={classes.footer}>{footer || <button className={classes.button ?? 'mod-button'} onClick={onClose}>Đóng</button>}</footer>
      </div>
    </dialog>
  )
}
