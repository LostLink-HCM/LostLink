const cloudinary = require('../config/cloudinary')
const ApiError = require('../utils/ApiError')

const POST_FOLDER = 'lostlink/posts'
const REPORT_FOLDER = 'lostlink/reports'
const MESSAGE_FOLDER = 'lostlink/messages'
const AVATAR_FOLDER = 'lostlink/avatars'
const CATEGORY_FOLDER = 'lostlink/categories'
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp']

const uploadOne = (file, folder, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', allowed_formats: ALLOWED_FORMATS, ...options },
      (error, result) =>
        error ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id })
    )
    stream.end(file.buffer)
  })

// Xoá ảnh đã tải lên khi việc lưu bài thất bại. Lỗi khi xoá chỉ ghi log, không làm hỏng phản hồi
const deleteImages = async (publicIds) => {
  const results = await Promise.allSettled(
    publicIds.map((publicId) => cloudinary.uploader.destroy(publicId))
  )
  results
    .filter((result) => result.status === 'rejected')
    .forEach((result) => console.error('Không xoá được ảnh trên Cloudinary', result.reason))
}

const uploadFailed = (message, cause) => {
  const error = new ApiError(503, message, undefined, 'IMAGE_UPLOAD_FAILED')
  error.cause = cause
  return error
}

// Tải song song, giữ đúng thứ tự người dùng chọn (ảnh đầu tiên là ảnh bìa)
const uploadImages = async (files, folder) => {
  const results = await Promise.allSettled(files.map((file) => uploadOne(file, folder)))
  const failed = results.find((result) => result.status === 'rejected')
  if (!failed) return results.map((result) => result.value)

  await deleteImages(
    results.filter((result) => result.status === 'fulfilled').map((result) => result.value.publicId)
  )
  throw uploadFailed('Không tải được ảnh lên, vui lòng thử lại.', failed.reason)
}

const uploadPostImages = (files) => uploadImages(files, POST_FOLDER)
const uploadReportImages = (files) => uploadImages(files, REPORT_FOLDER)
const uploadMessageImage = async (file) => (await uploadImages([file], MESSAGE_FOLDER))[0]
const uploadCategoryIcon = async (file) => (await uploadImages([file], CATEGORY_FOLDER))[0]

// Ảnh đại diện cắt vuông 512px ngay khi tải lên để không lưu ảnh gốc quá lớn
const uploadAvatar = async (file) => {
  try {
    return await uploadOne(file, AVATAR_FOLDER, {
      transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }],
    })
  } catch (err) {
    throw uploadFailed('Tải ảnh lên thất bại, vui lòng thử lại.', err)
  }
}
const folderImageUrl = (folder) =>
  new RegExp(
    `^https://res\\.cloudinary\\.com/[^/]+/image/upload/(?:v\\d+/)?(${folder}/[^/.]+)\\.[a-z]+$`
  )
const POST_IMAGE_URL = folderImageUrl(POST_FOLDER)
const AVATAR_URL = folderImageUrl(AVATAR_FOLDER)
const MESSAGE_URL = folderImageUrl(MESSAGE_FOLDER)
const CATEGORY_ICON_URL = folderImageUrl(CATEGORY_FOLDER)
const publicIdFromUrl = (url) => POST_IMAGE_URL.exec(url)?.[1] ?? null
const avatarPublicIdFromUrl = (url) => AVATAR_URL.exec(url)?.[1] ?? null
const messagePublicIdFromUrl = (url) => MESSAGE_URL.exec(url)?.[1] ?? null
const categoryIconPublicIdFromUrl = (url) => CATEGORY_ICON_URL.exec(url)?.[1] ?? null

module.exports = {
  uploadPostImages,
  uploadReportImages,
  uploadMessageImage,
  uploadCategoryIcon,
  uploadAvatar,
  deleteImages,
  publicIdFromUrl,
  avatarPublicIdFromUrl,
  messagePublicIdFromUrl,
  categoryIconPublicIdFromUrl,
}
