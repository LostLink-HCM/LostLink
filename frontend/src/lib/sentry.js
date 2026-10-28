import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

// Chỉ bật khi có VITE_SENTRY_DSN, nên chạy local không gửi lỗi lên Sentry
if (dsn) {
  Sentry.init({ dsn, environment: import.meta.env.MODE, sendDefaultPii: false })
}
