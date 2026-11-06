const { after, afterEach, before } = require('node:test')
const mongoose = require('mongoose')

const models = require('../../src/models')

// Mỗi file test dùng một database riêng để các file chạy song song không giẫm lên nhau
const connectTestDb = async () => {
  const dbName = `test_${new mongoose.Types.ObjectId()}`
  await mongoose.connect(process.env.MONGO_URI, { dbName })
  // Tạo đủ index (unique, TTL, collation) trước khi test các ràng buộc
  await Promise.all(Object.values(models).map((model) => model.syncIndexes()))
}

const clearTestDb = async () => {
  const collections = Object.values(mongoose.connection.collections)
  await Promise.all(collections.map((collection) => collection.deleteMany({})))
}

const closeTestDb = async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
}

// Gọi ở đầu file test: kết nối trước, dọn dữ liệu sau mỗi test, đóng kết nối khi xong
const useTestDb = () => {
  before(connectTestDb)
  afterEach(clearTestDb)
  after(closeTestDb)
}

module.exports = { useTestDb }
