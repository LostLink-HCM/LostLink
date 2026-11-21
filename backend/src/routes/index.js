const { Router } = require('express')
const mongoose = require('mongoose')
const env = require('../config/env')

const authRoutes = require('./authRoutes')
const postRoutes = require('./postRoutes')
const moderationRoutes = require('./moderationRoutes')
const moderatorReportRoutes = require('./moderatorReportRoutes')
const backofficePostRoutes = require('./backofficePostRoutes')
const geoRoutes = require('./geoRoutes')
const categoryRoutes = require('./categoryRoutes')
const userRoutes = require('./userRoutes')
const commentRoutes = require('./commentRoutes')
const notificationRoutes = require('./notificationRoutes')
const claimRoutes = require('./claimRoutes')
const conversationRoutes = require('./conversationRoutes')
const backofficeConversationRoutes = require('./backofficeConversationRoutes')
const adminUserRoutes = require('./adminUserRoutes')
const matchRoutes = require('./matchRoutes')
const statsRoutes = require('./statsRoutes')
const adminSettingsRoutes = require('./adminSettingsRoutes')
const backofficeSettingsRoutes = require('./backofficeSettingsRoutes')
const adminAuditLogRoutes = require('./adminAuditLogRoutes')
const adminCategoryRoutes = require('./adminCategoryRoutes')

const router = Router()

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
router.use('/moderator/reports', moderatorReportRoutes)
router.use('/backoffice/settings', backofficeSettingsRoutes)
router.use('/backoffice', backofficePostRoutes)
router.use('/geo', geoRoutes)
router.use('/categories', categoryRoutes)
router.use('/users', userRoutes)
router.use('/comments', commentRoutes)
router.use('/notifications', notificationRoutes)
router.use('/claims', claimRoutes)
router.use('/conversations', conversationRoutes)
router.use('/backoffice/conversations', backofficeConversationRoutes)
router.use('/admin/settings', adminSettingsRoutes)
router.use('/admin/audit-logs', adminAuditLogRoutes)
router.use('/admin/categories', adminCategoryRoutes)
router.use('/admin', adminUserRoutes)
router.use('/matches', matchRoutes)
router.use('/stats', statsRoutes)

module.exports = router
