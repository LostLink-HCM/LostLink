const { connectDatabase, disconnectDatabase } = require('../config/database')

// Register seeders here in dependency order, e.g. [seedCategories, seedUsers, seedPosts].
const seeders = []

async function run() {
  await connectDatabase()
  for (const seed of seeders) {
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
