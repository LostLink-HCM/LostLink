const { User } = require('../models')
const { initializeSettings } = require('../services/adminSettingsService')

const seedSystemSettings = async () => {
  const admin = await User.findOne({ role: 'admin' }).select('role').lean()
  if (!admin) throw new Error('Cần có tài khoản admin trước khi seed cấu hình hệ thống')

  await initializeSettings({}, admin)
}

module.exports = { seedSystemSettings }
