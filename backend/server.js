// Sentry phải khởi tạo trước khi nạp Express để theo dõi được request
require('./src/config/sentry')
const env = require('./src/config/env')
const app = require('./src/app')
const { connectDatabase, disconnectDatabase } = require('./src/config/database')
const { attachSocket, closeSocket } = require('./src/socket')

async function start() {
  await connectDatabase()

  const server = app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port} (${env.nodeEnv})`)
  })
  attachSocket(server)

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`)
    await closeSocket()
    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
