import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { getNotificationSettings, updateNotificationSettings } from '../../../api/notifications'
import Button from '../../../components/user/Button'
import Card from '../../../components/user/Card'
import EmptyState from '../../../components/user/EmptyState'
import NotificationSettings from '../../../components/user/notifications/NotificationSettings'
import { useProfileData } from '../../../hooks/useProfileData'

// Phần thay đổi giữa hai bộ thiết lập, chỉ gửi mục vừa bật/tắt
const diffOf = (prev, next) => {
  const patch = {}
  if (prev.email !== next.email) patch.email = next.email
  if (prev.push !== next.push) patch.push = next.push
  const groups = Object.fromEntries(
    Object.entries(next.groups).filter(([group, value]) => prev.groups[group] !== value)
  )
  if (Object.keys(groups).length) patch.groups = groups
  return patch
}

// Mục Thông báo trong Cài đặt: bật/tắt kênh nhận và loại thông báo, lưu ngay khi đổi
export default function NotificationSettingsPage() {
  const { notify } = useOutletContext()
  const { data, loading, reload } = useProfileData(getNotificationSettings)
  // Hiện ngay giá trị mới, lưu lỗi thì trả về giá trị server đã lưu
  const [prefs, setPrefs] = useState(null)
  const current = prefs ?? data
  // Bật/tắt nhanh nhiều lần: chỉ phản hồi của lần đổi mới nhất được ghi lên giao diện
  const latest = useRef(0)
  const saved = useRef({ seq: 0, prefs: null })

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Đang tải thiết lập"
        className="h-64 animate-pulse rounded-2xl bg-line-subtle"
      />
    )
  }
  if (!current) {
    return (
      <Card className="pb-8">
        <EmptyState icon="warning" title="Không thể tải thiết lập, vui lòng thử lại" />
        <div className="flex justify-center">
          <Button onClick={reload}>Thử lại</Button>
        </div>
      </Card>
    )
  }

  const change = async (next) => {
    const seq = ++latest.current
    const previous = current
    setPrefs(next)
    try {
      const { data: result } = await updateNotificationSettings(diffOf(previous, next))
      if (seq > saved.current.seq) saved.current = { seq, prefs: result }
      if (seq === latest.current) setPrefs(result)
    } catch {
      if (seq === latest.current) setPrefs(saved.current.prefs ?? data)
      notify('Đã có lỗi xảy ra, vui lòng thử lại.')
    }
  }

  return <NotificationSettings prefs={current} onChange={change} onError={notify} />
}
