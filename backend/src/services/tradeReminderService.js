const { Conversation, SystemConfig } = require('../models')
const env = require('../config/env')
const { DEFAULT_SETTINGS } = require('../config/systemSettings')
const emailService = require('./emailService')
const { notify } = require('./notificationService')

const DAY = 24 * 60 * 60 * 1000

const reminderDays = async () => {
  const config = await SystemConfig.findOne({ key: 'returnReminderDays' }).lean()
  const days = Number(config?.value)
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_SETTINGS.returnReminderDays
}

const emailParticipants = async (users, post, days) => {
  const messagesUrl = `${env.clientUrl}/messages`
  await Promise.all(
    users
      .filter((user) => user?.email && user.emailOptIn !== false)
      .map((user) =>
        emailService
          .sendTradeReminder({ to: user.email, postTitle: post.title, days, messagesUrl })
          .catch((error) => console.error('Không gửi được email nhắc trao trả', error))
      )
  )
}

const remindOpenTrades = async (now = new Date()) => {
  const days = await reminderDays()
  const candidates = await Conversation.find({
    kind: 'trade',
    status: 'open',
    reminderSentAt: null,
    createdAt: { $lte: new Date(now.getTime() - days * DAY) },
    participants: { $not: { $elemMatch: { closedAt: { $ne: null } } } },
    $nor: [{ confirmedLost: true, confirmedFound: true }],
  })
    .populate('post', 'title status')
    .populate('participants.user', 'email emailOptIn')
    .lean()

  let reminded = 0
  for (const conversation of candidates) {
    const { post } = conversation
    if (post?.status !== 'contacted') continue

    const { modifiedCount } = await Conversation.updateOne(
      { _id: conversation._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } }
    )
    if (!modifiedCount) continue

    const users = conversation.participants.map((item) => item.user).filter(Boolean)
    await notify(
      users.map((user) => user._id),
      {
        type: 'trade_reminder',
        refType: 'Post',
        refId: post._id,
        text: `Hội thoại về bài "${post.title}" đã mở hơn ${days} ngày, hai bạn xác nhận trao trả hoặc đóng hội thoại nhé.`,
      }
    )
    await emailParticipants(users, post, days)
    reminded += 1
  }
  return reminded
}

module.exports = { remindOpenTrades }
