// Đồng bộ index trong CSDL với khai báo trong các model: xoá index cũ không còn khai báo,
// tạo index mới hoặc index đổi tuỳ chọn
// Chạy một lần sau khi đổi index: npm run db:sync-indexes
const { connectDatabase, disconnectDatabase } = require('../config/database')
const models = require('../models')

async function run() {
  await connectDatabase()
  for (const [name, model] of Object.entries(models)) {
    const dropped = await model.syncIndexes()
    console.log(`  ✓ ${name}${dropped.length ? ` (đã xoá: ${dropped.join(', ')})` : ''}`)
  }
}

run()
  .catch((err) => {
    console.error('Sync indexes failed:', err)
    process.exitCode = 1
  })
  .finally(() => disconnectDatabase())
