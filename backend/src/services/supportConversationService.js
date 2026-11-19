const { Conversation } = require('../models')

const userSupportKey = (userId) => `user:${userId}`
const internalSupportKey = (firstUserId, secondUserId) =>
  `internal:${[String(firstUserId), String(secondUserId)].sort().join(':')}`

const upsertSupportConversation = async (supportKey, insert) => {
  try {
    return await Conversation.findOneAndUpdate(
      { supportKey },
      { $setOnInsert: { ...insert, supportKey } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
  } catch (error) {
    if (error.code !== 11000) throw error
    return Conversation.findOne({ supportKey })
  }
}

const attachSupportKey = async (conversation, supportKey) => {
  if (conversation.supportKey === supportKey) return conversation
  try {
    await Conversation.updateOne(
      { _id: conversation._id, $or: [{ supportKey: null }, { supportKey: { $exists: false } }] },
      { $set: { supportKey } }
    )
  } catch (error) {
    if (error.code !== 11000) throw error
  }
  return (await Conversation.findOne({ supportKey })) ?? conversation
}

module.exports = {
  userSupportKey,
  internalSupportKey,
  upsertSupportConversation,
  attachSupportKey,
}
