const http = require('node:http')
const { MongoMemoryServer } = require('mongodb-memory-server')

const API_PORT = Number(process.env.PORT) || 5100
const MAILBOX_PORT = Number(process.env.E2E_MAILBOX_PORT) || 5101

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: String(API_PORT),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:8100',
  JWT_SECRET: 'e2e-access-secret',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret',
  ANSWER_HASH_SECRET: 'e2e-answer-secret',
  // Playwright gửi X-Forwarded-For khác nhau cho mỗi test để không dùng chung hạn mức rate limit
  TRUST_PROXY: '1',
  GOOGLE_CLIENT_ID: '',
  BREVO_API_KEY: '',
  EMAIL_HOST: '',
  SENTRY_DSN: '',
})

const outbox = []

const startMailbox = () =>
  http
    .createServer((req, res) => {
      const { searchParams } = new URL(req.url, 'http://localhost')
      const to = searchParams.get('to')?.toLowerCase()
      const mails = outbox.filter((mail) => !to || mail.to === to)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(mails))
    })
    .listen(MAILBOX_PORT)

async function main() {
  const mongod = await MongoMemoryServer.create()
  process.env.MONGO_URI = mongod.getUri('lostlink-e2e')

  // Thay hàm gửi email bằng hàm ghi vào outbox, authService gọi qua object nên nhận hàm mới
  const emailService = require('../../src/services/emailService')
  emailService.sendVerificationCode = async ({ to, code }) => {
    outbox.push({ type: 'verify', to, code })
  }
  emailService.sendResetLink = async ({ to, resetUrl }) => {
    outbox.push({ type: 'reset', to, resetUrl })
  }

  const { connectDatabase } = require('../../src/config/database')
  const app = require('../../src/app')
  await connectDatabase()

  // Dữ liệu mẫu giống môi trường local (tài khoản, 8 danh mục, 47 bài) cho các test trang chủ
  const { seedUsers } = require('../../src/seeds/userSeed')
  const { seedCategories } = require('../../src/seeds/categorySeed')
  const { seedPosts } = require('../../src/seeds/postSeed')
  for (const seed of [seedUsers, seedCategories, seedPosts]) await seed()

  startMailbox()
  app.listen(API_PORT, () => console.log(`E2E API on http://localhost:${API_PORT}`))

  const shutdown = async () => {
    await mongod.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('E2E server failed to start:', err)
  process.exit(1)
})
