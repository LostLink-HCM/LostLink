const accountService = require('../services/accountService')
const categoryFrequencyService = require('../services/categoryFrequencyService')
const tradeReminderService = require('../services/tradeReminderService')
const { onFrequencyInputsChanged, offFrequencyInputsChanged } = require('../utils/frequencyEvents')
const PURGE_INTERVAL_MS = 15 * 60 * 1000
const TRADE_REMINDER_INTERVAL_MS = 60 * 60 * 1000
const CATEGORY_FREQUENCY_INTERVAL_MS = 15 * 60 * 1000
const CATEGORY_FREQUENCY_DEBOUNCE_MS = 1000

let timer = null
let running = false
let frequencyTimer = null
let frequencyDebounceTimer = null
let frequencyRunning = false
let frequencyRequestedWhileRunning = false
let jobsStarted = false
let reminderTimer = null
let reminderRunning = false

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

const remindOpenTrades = async () => {
  if (reminderRunning) return
  reminderRunning = true
  try {
    const reminded = await tradeReminderService.remindOpenTrades()
    if (reminded) console.log(`Sent reminders for ${reminded} open conversation(s)`)
  } catch (err) {
    console.error('Trade reminder failed:', err)
  } finally {
    reminderRunning = false
  }
}

const recalculateCategoryFrequencies = async () => {
  if (frequencyRunning) {
    frequencyRequestedWhileRunning = true
    return
  }
  frequencyRunning = true
  try {
    const result = await categoryFrequencyService.recalculateFrequencies()
    if (result.categoriesUpdated || result.valuesUpdated) {
      console.log(
        `Recalculated category rarity from ${result.eligiblePosts} eligible post(s): ` +
          `${result.categoriesUpdated} categories, ${result.valuesUpdated} values`
      )
    }
  } catch (err) {
    console.error('Category rarity recalculation failed:', err)
  } finally {
    frequencyRunning = false
    if (frequencyRequestedWhileRunning && jobsStarted) {
      frequencyRequestedWhileRunning = false
      scheduleCategoryFrequencyRecalculation()
    }
  }
}

const scheduleCategoryFrequencyRecalculation = () => {
  if (!jobsStarted) return
  clearTimeout(frequencyDebounceTimer)
  frequencyDebounceTimer = setTimeout(
    recalculateCategoryFrequencies,
    CATEGORY_FREQUENCY_DEBOUNCE_MS
  )
  frequencyDebounceTimer.unref()
}

const startJobs = () => {
  if (timer) return
  jobsStarted = true
  purgeAccounts()
  timer = setInterval(purgeAccounts, PURGE_INTERVAL_MS)
  timer.unref()
  onFrequencyInputsChanged(scheduleCategoryFrequencyRecalculation)
  recalculateCategoryFrequencies()
  frequencyTimer = setInterval(recalculateCategoryFrequencies, CATEGORY_FREQUENCY_INTERVAL_MS)
  frequencyTimer.unref()
  remindOpenTrades()
  reminderTimer = setInterval(remindOpenTrades, TRADE_REMINDER_INTERVAL_MS)
  reminderTimer.unref()
}

const stopJobs = () => {
  jobsStarted = false
  frequencyRequestedWhileRunning = false
  clearInterval(timer)
  timer = null
  clearInterval(frequencyTimer)
  frequencyTimer = null
  clearInterval(reminderTimer)
  reminderTimer = null
  offFrequencyInputsChanged(scheduleCategoryFrequencyRecalculation)
  clearTimeout(frequencyDebounceTimer)
  frequencyDebounceTimer = null
}

module.exports = { startJobs, stopJobs }
