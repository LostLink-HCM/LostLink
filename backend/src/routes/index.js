const { Router } = require('express')
const mongoose = require('mongoose')
const env = require('../config/env')

const authRoutes = require('./authRoutes')
const postRoutes = require('./postRoutes')
const moderationRoutes = require('./moderationRoutes')
const backofficePostRoutes = require('./backofficePostRoutes')
const geoRoutes = require('./geoRoutes')
const categoryRoutes = require('./categoryRoutes')
const userRoutes = require('./userRoutes')
const commentRoutes = require('./commentRoutes')
const notificationRoutes = require('./notificationRoutes')
const claimRoutes = require('./claimRoutes')
const adminUserRoutes = require('./adminUserRoutes')

const router = Router()

// Trả 503 khi mất kết nối CSDL để Render và dịch vụ uptime phát hiện sự cố.
// version cho CI biết Render đã chạy đúng bản vừa deploy chưa
router.get('/health', (req, res) => {
  const databaseUp = mongoose.connection.readyState === 1
  res.status(databaseUp ? 200 : 503).json({
    success: databaseUp,
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'connected' : 'disconnected',
    version: env.appVersion,
    uptime: process.uptime(),
  })
})

router.use('/auth', authRoutes)
router.use('/posts', postRoutes)
router.use('/moderator', moderationRoutes)
router.use('/backoffice', backofficePostRoutes)
router.use('/geo', geoRoutes)
router.use('/categories', categoryRoutes)
router.use('/users', userRoutes)
router.use('/comments', commentRoutes)
router.use('/notifications', notificationRoutes)
router.use('/claims', claimRoutes)
router.use('/admin', adminUserRoutes)

module.exports = router
