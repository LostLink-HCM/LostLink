const Sentry = require('@sentry/node')
const env = require('./env')

function scrubRequest(event) {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
    if (event.request.headers) {
      delete event.request.headers.authorization
      delete event.request.headers.cookie
    }
  }
  return event
}

// Chỉ bật khi có SENTRY_DSN, nên chạy local không gửi lỗi lên Sentry
if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    sendDefaultPii: false,
    beforeSend: scrubRequest,
  })
}
