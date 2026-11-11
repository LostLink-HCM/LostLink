import { useEffect, useState } from 'react'

// Chia ngày thành sáng, chiều, đêm theo giờ máy người dùng
export function timeOfDay(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60
  if (hour >= 5.5 && hour < 16.5) return 'day'
  if (hour >= 16.5 && hour < 18.5) return 'dusk'
  return 'night'
}

// Kiểm tra lại mỗi phút để trang đang mở cũng chuyển cảnh khi tới giờ
export default function useTimeOfDay() {
  const [time, setTime] = useState(() => timeOfDay())

  useEffect(() => {
    const id = setInterval(() => setTime(timeOfDay()), 60_000)
    return () => clearInterval(id)
  }, [])

  return time
}
