const { Claim, User } = require('../models')
const env = require('../config/env')
const emailService = require('./emailService')

const HOUR = 60 * 60 * 1000

const clearReminder = (claim, now) =>
  Claim.updateOne(
    {
      _id: claim._id,
      status: 'linked',
      contactReminderDueAt: { $lte: now },
      contactReminderSentAt: null,
    },
    { $set: { contactReminderDueAt: null } }
  )

const remindInactiveOwners = async (now = new Date()) => {
  const claims = await Claim.find({
    status: 'linked',
    verificationAttempt: { $ne: null },
    contactReminderDueAt: { $lte: now },
    contactReminderSentAt: null,
  })
    .select('post claimant respondedAt contactReminderDueAt')
    .populate('post', 'title owner')
    .populate('claimant', 'username')
    .lean()

  let reminded = 0
  for (const claim of claims) {
    const ownerId = claim.post?.owner
    if (!ownerId || !claim.respondedAt) {
      await clearReminder(claim, now)
      continue
    }

    const owner = await User.findById(ownerId).select('lastActiveAt email emailOptIn').lean()
    if (!owner) {
      await clearReminder(claim, now)
      continue
    }

    // Any recorded visit after the correct answer means the owner has returned;
    // do not send a delayed reminder for this claim.
    if (owner.lastActiveAt && owner.lastActiveAt > claim.respondedAt) {
      await clearReminder(claim, now)
      continue
    }

    // Claim the reminder atomically so overlapping job runs cannot send twice.
    const { modifiedCount } = await Claim.updateOne(
      {
        _id: claim._id,
        status: 'linked',
        contactReminderDueAt: claim.contactReminderDueAt,
        contactReminderSentAt: null,
      },
      { $set: { contactReminderSentAt: now } }
    )
    if (!modifiedCount) continue

    const post = claim.post
    const postTitle = post.title
    const hours = Math.max(
      1,
      Math.round((claim.contactReminderDueAt.getTime() - claim.respondedAt.getTime()) / HOUR)
    )
    if (owner.emailOptIn && owner.email) {
      try {
        await emailService.sendContactReminder({
          to: owner.email,
          postTitle,
          messagesUrl: `${env.clientUrl}/messages`,
          reminderHours: hours,
        })
      } catch (error) {
        console.error('Không gửi được email nhắc liên hệ', error)
      }
    }
    reminded += 1
  }

  return reminded
}

module.exports = { remindInactiveOwners }
