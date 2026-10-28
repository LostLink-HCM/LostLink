const { Router } = require('express')
const mongoose = require('mongoose')

const authRoutes = require('./authRoutes')

const router = Router()

// Trả 503 khi mất kết nối CSDL để Render và dịch vụ uptime phát hiện sự cố
router.get('/health', (req, res) => {
  const databaseUp = mongoose.connection.readyState === 1
  res.status(databaseUp ? 200 : 503).json({
    success: databaseUp,
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  })
})

router.use('/auth', authRoutes)

module.exports = router
