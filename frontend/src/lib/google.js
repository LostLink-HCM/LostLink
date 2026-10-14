const GSI_SRC = 'https://accounts.google.com/gsi/client'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

let loading = null

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)

  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => resolve(window.google.accounts.id)
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Không tải được Đăng nhập Google, vui lòng thử lại sau.'))
    }
    document.head.appendChild(script)
  })
  return loading
}
