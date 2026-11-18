const accountService = require('../services/accountService')
const PURGE_INTERVAL_MS = 15 * 60 * 1000

let timer = null
let running = false

const purgeAccounts = async () => {
  if (running) return
  running = true
  try {
    const purged = await accountService.purgeDueAccounts()
    if (purged) console.log(`Purged ${purged} deleted account(s)`)
  } catch (err) {
    console.error('Account purge failed:', err)
  } finally {
    running = false
  }
}

const startJobs = () => {
  if (timer) return
  purgeAccounts()
  timer = setInterval(purgeAccounts, PURGE_INTERVAL_MS)
  timer.unref()
}

const stopJobs = () => {
  clearInterval(timer)
  timer = null
}

module.exports = { startJobs, stopJobs }
