const cloudinary = require('../config/cloudinary')
const ApiError = require('../utils/ApiError')

const POST_FOLDER = 'lostlink/posts'
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp']

const uploadOne = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: POST_FOLDER, resource_type: 'image', allowed_formats: ALLOWED_FORMATS },
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

// Tải song song, giữ đúng thứ tự người dùng chọn (ảnh đầu tiên là ảnh bìa).
// Một ảnh lỗi thì xoá các ảnh đã lên và báo lỗi cho cả lần đăng
const uploadPostImages = async (files) => {
  const results = await Promise.allSettled(files.map(uploadOne))
  const failed = results.find((result) => result.status === 'rejected')
  if (!failed) return results.map((result) => result.value)

  await deleteImages(
    results.filter((result) => result.status === 'fulfilled').map((result) => result.value.publicId)
  )
  const error = new ApiError(
    503,
    'Không tải được ảnh lên, vui lòng thử lại.',
    undefined,
    'IMAGE_UPLOAD_FAILED'
  )
  error.cause = failed.reason
  throw error
}

// Ảnh ngoài thư mục bài đăng (vd ảnh mẫu trên Wikimedia) trả null để không xoá nhầm
const POST_IMAGE_URL = new RegExp(
  `^https://res\\.cloudinary\\.com/[^/]+/image/upload/(?:v\\d+/)?(${POST_FOLDER}/[^/.]+)\\.[a-z]+$`
)
const publicIdFromUrl = (url) => POST_IMAGE_URL.exec(url)?.[1] ?? null

module.exports = { uploadPostImages, deleteImages, publicIdFromUrl }
