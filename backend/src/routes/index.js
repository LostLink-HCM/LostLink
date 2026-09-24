const { Router } = require('express')
const mongoose = require('mongoose')

const router = Router()

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  })
})

module.exports = router
