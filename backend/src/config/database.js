const mongoose = require('mongoose')
const env = require('./env')

async function connectDatabase() {
  await mongoose.connect(env.mongoUri)
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
}

async function disconnectDatabase() {
  await mongoose.disconnect()
}

module.exports = { connectDatabase, disconnectDatabase }
