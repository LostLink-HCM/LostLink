const { MongoMemoryServer } = require('mongodb-memory-server')

let mongod

exports.globalSetup = async () => {
  mongod = await MongoMemoryServer.create()
  // Mỗi file test chạy trong một tiến trình con, được tạo sau bước này nên kế thừa biến môi trường
  process.env.MONGO_TEST_URI = mongod.getUri()
}

exports.globalTeardown = async () => {
  await mongod?.stop()
}
