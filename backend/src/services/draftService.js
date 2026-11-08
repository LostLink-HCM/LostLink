const { PostDraft } = require('../models')
const ApiError = require('../utils/ApiError')

// UC24 Lưu nháp bài đăng. Mỗi người dùng một bản nháp, lưu mới thì thay bản cũ

const DRAFT_EMPTY_MESSAGE = 'Chưa có nội dung để lưu nháp.'

const isPoint = (value) => Number.isFinite(value?.lat) && Number.isFinite(value?.lng)
const toPoint = ({ lat, lng }) => ({ lat, lng })

// Đưa về đúng cấu trúc bản nháp, chỉ lấy các field đã khai báo, thiếu thì để giá trị trống.
// Dùng cả khi lưu (dữ liệu đã qua draftRules) lẫn khi trả về (bỏ _id, user, field nội bộ)
const toDraftForm = (form = {}) => {
  const location = form.location ?? {}
  const question = form.question ?? {}
  return {
    type: form.type ?? '',
    category: form.category ?? '',
    attributes: (form.attributes ?? []).map(({ attribute, value }) => ({ attribute, value })),
    contents: form.contents ?? [],
    title: form.title ?? '',
    description: form.description ?? '',
    attributeBlock: form.attributeBlock ?? '',
    date: form.date ?? '',
    dayPart: form.dayPart ?? '',
    timePreset: form.timePreset ?? '',
    location: {
      mode: location.mode ?? '',
      pointSource: location.pointSource ?? '',
      query: location.query ?? '',
      place: location.place ?? '',
      placePublic: location.placePublic ?? '',
      area: location.area ?? '',
      areaAuto: Boolean(location.areaAuto),
      point: isPoint(location.point) ? toPoint(location.point) : null,
      accuracy: location.accuracy ?? null,
      road: (location.road ?? []).filter(isPoint).map(toPoint),
      roadPlaces: location.roadPlaces ?? [],
      pointOutside: Boolean(location.pointOutside),
      roadOutside: Boolean(location.roadOutside),
    },
    question: {
      skipped: Boolean(question.skipped),
      text: question.text ?? '',
      options: question.options ?? [],
      correct: question.correct ?? null,
    },
  }
}

// Form đã có nội dung người dùng tự nhập hay chọn hay chưa
const hasContent = (form) => {
  const { location, question } = form
  return Boolean(
    form.type ||
    form.category ||
    form.attributes.length ||
    form.contents.length ||
    form.title.trim() ||
    form.description.trim() ||
    form.date ||
    form.dayPart ||
    location.point ||
    location.road.length ||
    location.query.trim() ||
    location.place.trim() ||
    location.area ||
    question.text.trim() ||
    question.options.some((option) => option.trim())
  )
}

const toDraft = (draft) => ({
  step: draft.step,
  form: toDraftForm(draft.form),
  savedAt: draft.updatedAt,
})

// Bản nháp của người dùng, chưa có thì null
const getDraft = async (user) => {
  const draft = await PostDraft.findOne({ user: user._id }).lean()
  return draft ? toDraft(draft) : null
}

const upsertDraft = (userId, step, form) =>
  PostDraft.findOneAndUpdate(
    { user: userId },
    { $set: { step, form } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean()

// input là dữ liệu đã qua draftRules (matchedData). Trả về thời điểm lưu để hiển thị
const saveDraft = async (user, { step, form }) => {
  const draftForm = toDraftForm(form)
  if (!hasContent(draftForm)) {
    throw new ApiError(
      422,
      DRAFT_EMPTY_MESSAGE,
      [{ field: 'form', message: DRAFT_EMPTY_MESSAGE }],
      'DRAFT_EMPTY'
    )
  }

  let draft
  try {
    draft = await upsertDraft(user._id, step, draftForm)
  } catch (error) {
    // Hai lần lưu cùng lúc của một người: lần sau đụng unique index thì cập nhật lại bản vừa tạo
    if (error.code !== 11000) throw error
    draft = await upsertDraft(user._id, step, draftForm)
  }
  return { step: draft.step, savedAt: draft.updatedAt }
}

const deleteDraft = async (user) => {
  await PostDraft.deleteOne({ user: user._id })
}

module.exports = { getDraft, saveDraft, deleteDraft }
