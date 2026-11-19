const { Message } = require('../models')
const imageService = require('./imageService')
const ApiError = require('../utils/ApiError')

// Shared persistence for user and backoffice chat, including the existing image upload policy.
const createMessage = async ({ conversationId, senderId, body = '', file }) => {
  const text = body.trim()
  if (!text && !file) {
    throw new ApiError(422, 'Dữ liệu không hợp lệ.', [
      { field: 'body', message: 'Vui lòng nhập nội dung tin nhắn.' },
    ])
  }

  const uploaded = file ? await imageService.uploadMessageImage(file) : null
  try {
    return await Message.create({
      conversation: conversationId,
      sender: senderId,
      body: uploaded ? '' : text,
      imageUrl: uploaded?.url ?? '',
    })
  } catch (error) {
    if (uploaded) await imageService.deleteImages([uploaded.publicId])
    throw error
  }
}

module.exports = { createMessage }
