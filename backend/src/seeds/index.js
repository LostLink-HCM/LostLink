const env = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { seedUsers } = require('./userSeed')

// Khai báo seeder theo thứ tự phụ thuộc, vd [seedCategories, seedUsers, seedPosts]
const seeders = [seedUsers]

async function run() {
  if (env.nodeEnv === 'production') {
    throw new Error('Không chạy seed trên production')
  }

  await connectDatabase()
  for (const seed of seeders) {
    console.log(`• ${seed.name}`)
    await seed()
  }
  console.log(`Seeding finished (${seeders.length} seeder(s) run)`)
}

run()
  .catch((err) => {
    console.error('Seeding failed:', err)
    process.exitCode = 1
  })
  .finally(() => disconnectDatabase())
