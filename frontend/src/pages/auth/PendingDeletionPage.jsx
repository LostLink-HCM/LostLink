import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cancelAccountDeletion } from '../../api/auth'
import { useAuth } from '../../auth/AuthContext'
import {
  Alert,
  AuthHeading,
  Note,
  PrimaryButton,
  TextLink,
} from '../../components/auth/AuthControls'
import AuthLayout from '../../components/auth/AuthLayout'
import { homePathFor } from '../../lib/session'

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

// Tài khoản đang chờ xóa chỉ được hủy yêu cầu hoặc đăng xuất
export default function PendingDeletionPage() {
  const { user, updateUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const cancel = async () => {
    setBusy(true)
    setError('')
    try {
      const { data } = await cancelAccountDeletion()
      updateUser(data.user)
      navigate(homePathFor(data.user), { replace: true })
    } catch (failure) {
      setError(failure.status >= 500 ? 'Đã có lỗi xảy ra, vui lòng thử lại.' : failure.message)
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout>
      <AuthHeading className="mb-2">Tài khoản đang chờ xóa</AuthHeading>
      <p className="mb-4 text-au-body text-au-ink/70">
        Tài khoản <strong>{user.username}</strong> sẽ bị xóa vĩnh viễn lúc{' '}
        <strong>{formatDateTime(user.deletion.deleteAt)}</strong>, cùng mọi bài đăng và tin nhắn.
      </p>

      {error && <Alert>{error}</Alert>}

      <PrimaryButton type="button" onClick={cancel} disabled={busy}>
        {busy ? 'Đang hủy…' : 'Hủy yêu cầu xóa'}
      </PrimaryButton>
      <Note className="mt-3">
        Bài đăng của bạn đang tạm ẩn và sẽ hiện lại ngay khi hủy yêu cầu.
      </Note>

      <p className="mb-0 mt-3.5 text-center text-caption">
        <TextLink type="button" onClick={logout}>
          Đăng xuất
        </TextLink>
      </p>
    </AuthLayout>
  )
}
