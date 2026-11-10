import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Tải dữ liệu trang cá nhân (load giữ ổn định bằng useCallback), tải lại thì giữ dữ liệu cũ
export function useProfileData(load) {
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState({ retry: -1, data: null, error: null })

  useEffect(() => {
    let active = true
    load()
      .then((res) => active && setState({ retry, data: res.data, error: null }))
      .catch((error) => active && setState({ retry, data: null, error }))
    return () => {
      active = false
    }
  }, [load, retry])

  return {
    ...state,
    loading: state.retry === -1,
    reload: () => setRetry((count) => count + 1),
  }
}

// Quay lại trang trước, mở thẳng liên kết thì về Trang chủ
export function useBack() {
  const location = useLocation()
  const navigate = useNavigate()
  return location.key === 'default' ? () => navigate('/') : () => navigate(-1)
}
