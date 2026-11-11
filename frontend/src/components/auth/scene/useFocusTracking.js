import { useEffect, useRef, useState } from 'react'

// Ô mật khẩu có data-secret: đang ẩn chữ thì mèo che mắt, đang hiện thì hé nhìn
export function moodForFocus(el) {
  if (!(el instanceof HTMLInputElement)) return 'idle'
  if (el.dataset.secret !== undefined) return el.type === 'password' ? 'shy' : 'peek'
  if (el.type === 'checkbox' || el.type === 'radio') return 'idle'
  return 'look'
}

function lookForFocus(el) {
  if (moodForFocus(el) !== 'look') return { x: 0, y: 0 }
  return { x: Math.max(-2, Math.min(4, -2 + el.value.length * 0.25)), y: 2 }
}

// Nét mặt và hướng nhìn theo ô đang nhập, kèm thời điểm người dùng thao tác gần nhất
export default function useFocusTracking() {
  const lastInput = useRef(0)
  const [focusMood, setFocusMood] = useState('idle')
  const [look, setLook] = useState({ x: 0, y: 0 })

  useEffect(() => {
    let timer = 0
    lastInput.current = performance.now()
    const sync = () => {
      const el = document.activeElement
      lastInput.current = performance.now()
      setFocusMood(moodForFocus(el))
      setLook(lookForFocus(el))
    }
    // Đợi trình duyệt chuyển focus xong, hoặc React đổi type của ô mật khẩu xong
    const syncLater = () => {
      clearTimeout(timer)
      timer = setTimeout(sync, 0)
    }
    document.addEventListener('focusin', sync)
    document.addEventListener('focusout', syncLater)
    document.addEventListener('input', sync)
    document.addEventListener('click', syncLater)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', sync)
      document.removeEventListener('focusout', syncLater)
      document.removeEventListener('input', sync)
      document.removeEventListener('click', syncLater)
    }
  }, [])

  return { focusMood, look, lastInput }
}
