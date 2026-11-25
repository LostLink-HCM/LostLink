const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const { Conversation, Notification, SystemConfig } = require('../../src/models')
const emailService = require('../../src/services/emailService')
const { remindOpenTrades } = require('../../src/services/tradeReminderService')
const { createUser } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { DAY, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const sendTradeReminder = mock.method(emailService, 'sendTradeReminder', async () => {})
afterEach(() => sendTradeReminder.mock.resetCalls())

let finder
let loser
let post

const openTrade = async (days, fields = {}) => {
  const conversation = await Conversation.create({
    kind: 'trade',
    post: post._id,
    participants: [{ user: finder._id }, { user: loser._id }],
    ...fields,
  })
  const createdAt = new Date(Date.now() - days * DAY)
  await Conversation.collection.updateOne({ _id: conversation._id }, { $set: { createdAt } })
  return conversation
}

const reminders = () => Notification.find({ type: 'trade_reminder' }).lean()

beforeEach(async () => {
  const { category } = await createWalletCategory()
  loser = await createUser()
  finder = await createUser({ username: 'nguoinhat', email: 'finder@example.com' })
  post = await makePost(finder, category, {
    type: 'found',
    title: 'Nhặt được ví',
    status: 'contacted',
  })
})

describe('HT05 - Nhắc hội thoại vẫn mở', () => {
  test('mở quá số ngày mặc định thì nhắc cả hai bên một lần, qua thông báo và email', async () => {
    const conversation = await openTrade(8)

    assert.equal(await remindOpenTrades(), 1)
    const sent = await reminders()
    assert.deepEqual(
      sent.map((item) => String(item.user)).sort(),
      [String(finder._id), String(loser._id)].sort()
    )
    assert.ok(sent.every((item) => String(item.refId) === String(post._id)))
    assert.equal(sendTradeReminder.mock.callCount(), 2)
    assert.ok((await Conversation.findById(conversation._id)).reminderSentAt)

    assert.equal(await remindOpenTrades(), 0)
    assert.equal((await reminders()).length, 2)
  })

  test('chưa tới số ngày Admin cấu hình thì chưa nhắc', async () => {
    await SystemConfig.create({ key: 'returnReminderDays', value: '10' })
    await openTrade(8)
    assert.equal(await remindOpenTrades(), 0)
    assert.equal((await reminders()).length, 0)
  })

  test('không nhắc hội thoại đã đóng, đã trao trả, bị khoá hoặc bài không còn Đã liên hệ', async () => {
    await openTrade(9, {
      participants: [{ user: finder._id, closedAt: new Date() }, { user: loser._id }],
    })
    await openTrade(9, { confirmedLost: true, confirmedFound: true })
    await openTrade(9, { status: 'locked' })
    assert.equal(await remindOpenTrades(), 0)

    await openTrade(9)
    await post.updateOne({ status: 'returned' })
    assert.equal(await remindOpenTrades(), 0)
    assert.equal((await reminders()).length, 0)
  })

  test('người tắt nhận email chỉ nhận thông báo trong ứng dụng', async () => {
    await loser.updateOne({ emailOptIn: false })
    await openTrade(8)

    assert.equal(await remindOpenTrades(), 1)
    assert.equal((await reminders()).length, 2)
    assert.equal(sendTradeReminder.mock.callCount(), 1)
    assert.equal(sendTradeReminder.mock.calls[0].arguments[0].to, 'finder@example.com')
  })
})
