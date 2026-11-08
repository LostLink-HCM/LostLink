const mongoose = require('mongoose')

const { Schema } = mongoose

// UC24 Lưu nháp bài đăng: nội dung form Đăng bài đang soạn dở (không kèm ảnh), bước đang làm dở
// và thời điểm lưu (updatedAt). Mỗi người dùng chỉ có một bản nháp, lưu mới thì thay bản cũ.
// Bản nháp được phép thiếu hoặc chưa hợp lệ; kiểm tra đầy đủ chỉ làm khi đăng bài

const draftPointSchema = new Schema({ lat: Number, lng: Number }, { _id: false })

const draftFormSchema = new Schema(
  {
    type: { type: String, enum: ['', 'lost', 'found'], default: '' },
    category: { type: String, default: '' }, // slug danh mục
    attributes: [
      new Schema({ attribute: String, value: String }, { _id: false }), // id thuộc tính, id giá trị
    ],
    contents: [String],
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    // Khối thuộc tính đã điền sẵn vào mô tả, để form biết còn thay được khối đó hay không
    attributeBlock: { type: String, default: '' },
    date: { type: String, default: '' }, // YYYY-MM-DD
    dayPart: { type: String, default: '' },
    timePreset: { type: String, default: '' },
    location: {
      mode: { type: String, default: '' },
      pointSource: { type: String, default: '' },
      query: { type: String, default: '' },
      // Địa điểm tự điền theo vị trí đã chọn: place là địa chỉ đầy đủ người đăng thấy, placePublic
      // là bản công khai khi chọn từ kết quả tìm kiếm; roadPlaces: điểm đầu, điểm cuối đoạn đường
      place: { type: String, default: '' },
      placePublic: { type: String, default: '' },
      area: { type: String, default: '' },
      // Khu vực do hệ thống tự nhận theo toạ độ (không cho đổi) hay người dùng tự chọn
      areaAuto: { type: Boolean, default: false },
      point: { type: draftPointSchema, default: null },
      // Độ lệch GPS (mét), để nhắc người dùng kéo ghim lại khi lệch nhiều
      accuracy: { type: Number, default: null },
      road: [draftPointSchema],
      roadPlaces: [String],
      pointOutside: { type: Boolean, default: false },
      roadOutside: { type: Boolean, default: false },
    },
    question: {
      skipped: { type: Boolean, default: false },
      text: { type: String, default: '' },
      options: [String],
      correct: { type: Number, default: null },
    },
  },
  { _id: false }
)

const postDraftSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Chỉ số bước đang làm dở: 0 Phân loại, 1 Nội dung, 2 Thời gian, 3 Vị trí, 4 Câu hỏi
    step: { type: Number, min: 0, max: 4, default: 0 },
    form: { type: draftFormSchema, default: () => ({}) },
  },
  { timestamps: true, collection: 'post_drafts' }
)

module.exports = mongoose.model('PostDraft', postDraftSchema)
