import { CATEGORY_ATTRIBUTES, DAY_PARTS } from '../data/composePost'

// Giới hạn tối đa 9 ảnh, mỗi ảnh không quá 5 MB
export const MAX_IMAGES = 9
export const MAX_IMAGE_MB = 5
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const TITLE_MAX = 120
export const DESCRIPTION_MAX = 1000

export const EMPTY_FORM = {
  type: '',
  category: '',
  attributes: {},
  contents: [],
  title: '',
  description: '',
  // Khối thuộc tính đã điền sẵn vào mô tả lần gần nhất, để biết còn thay được hay không
  attributeBlock: '',
  images: [],
  date: '',
  dayPart: '',
  // Tên mốc gần đúng đã bấm (Sáng hôm qua…), đổi ngày hoặc buổi bằng tay thì bỏ
  timePreset: '',
}

const STEPS = [
  { key: 'classify', label: 'Phân loại' },
  { key: 'content', label: 'Nội dung' },
  { key: 'time', label: 'Thời gian' },
]

export const getSteps = () => STEPS

export function toDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toDateInput(date)
}

// Buổi trong ngày ứng với giờ hiện tại
function currentDayPart(hour = new Date().getHours()) {
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

export const applyTimePreset = (preset) => ({
  date: daysAgo(preset.daysAgo),
  dayPart: preset.dayPart === 'now' ? currentDayPart() : preset.dayPart,
  timePreset: preset.label,
})

// Chỉ giữ các lỗi có nội dung
const onlyErrors = (entries) => Object.fromEntries(Object.entries(entries).filter(([, v]) => v))

// Kiểm tra từng bước: thiếu loại tin, danh mục, tiêu đề hoặc thời gian
const validators = {
  classify: (form) => ({
    type: !form.type && 'Chọn loại tin: Mất đồ hay Nhặt được.',
    category: !form.category && 'Chọn danh mục cho món đồ.',
  }),
  content: (form) => ({
    title: !form.title.trim()
      ? 'Nhập tiêu đề cho bài đăng.'
      : form.title.trim().length > TITLE_MAX && `Tiêu đề tối đa ${TITLE_MAX} ký tự.`,
    description:
      form.description.length > DESCRIPTION_MAX && `Mô tả tối đa ${DESCRIPTION_MAX} ký tự.`,
  }),
  time: (form) => ({
    date: !form.date
      ? 'Chọn ngày mất hoặc nhặt được đồ.'
      : form.date > toDateInput(new Date()) && 'Ngày không được ở tương lai.',
  }),
}

export const validateStep = (key, form) => onlyErrors(validators[key](form))

// Bước đầu tiên còn lỗi để đưa người dùng quay lại
export function findInvalidStep(form) {
  const steps = getSteps(form.type)
  for (let index = 0; index < steps.length; index += 1) {
    const errors = validateStep(steps[index].key, form)
    if (Object.keys(errors).length) return { index, errors }
  }
  return null
}

// Bỏ ảnh sai định dạng, quá 5 MB hoặc vượt số lượng
export function checkImages(files, currentCount) {
  const accepted = []
  const errors = []
  let overflow = false
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      errors.push(`"${file.name}" không phải ảnh JPG, PNG hoặc WEBP.`)
    } else if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`"${file.name}" lớn hơn ${MAX_IMAGE_MB} MB.`)
    } else if (currentCount + accepted.length >= MAX_IMAGES) {
      overflow = true
    } else {
      accepted.push(file)
    }
  }
  if (overflow) errors.push(`Chỉ đăng được tối đa ${MAX_IMAGES} ảnh, các ảnh thừa đã bị bỏ.`)
  return { accepted, errors }
}

// Thuộc tính đã chọn ở bước Phân loại, mỗi dòng "- Nhãn: giá trị" theo thứ tự của danh mục
export function describeAttributes({ category, attributes, contents }) {
  const lines = (CATEGORY_ATTRIBUTES[category] ?? [])
    .filter((attribute) => attributes[attribute.key])
    .map((attribute) => `- ${attribute.label}: ${attributes[attribute.key]}`)
  if (contents.length) lines.push(`- Bên trong có: ${contents.join(', ')}`)
  return lines.join('\n')
}

// Điền sẵn thuộc tính vào mô tả, dòng đầu để trống cho người dùng viết.
export function prefillDescription(form) {
  const block = describeAttributes(form)
  const { description, attributeBlock } = form
  if (block === attributeBlock) return null
  if (!description.trim()) return { description: block && `\n${block}`, attributeBlock: block }
  if (!attributeBlock) {
    return block
      ? { description: `${description.trimEnd()}\n${block}`, attributeBlock: block }
      : null
  }
  if (!description.endsWith(attributeBlock)) return null
  const head = description.slice(0, -attributeBlock.length)
  return { description: block ? head + block : head.trimEnd(), attributeBlock: block }
}

export function describeTime({ date, dayPart, timePreset }) {
  if (!date) return ''
  const day = new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  if (timePreset) return `${timePreset} (${day})`
  const part = DAY_PARTS.find((item) => item.value === dayPart)
  return part ? `${part.label}, ${day}` : day
}

const draftKey = (userId) => `lostlink:post-draft:${userId}`

export function loadDraft(userId) {
  try {
    const raw = localStorage.getItem(draftKey(userId))
    if (!raw) return null
    const draft = JSON.parse(raw)
    const form = {
      ...EMPTY_FORM,
      ...draft.form,
      images: [],
    }
    const step = Math.min(Number(draft.step) || 0, getSteps(form.type).length - 1)
    return { form, step, savedAt: draft.savedAt }
  } catch {
    return null
  }
}

export function saveDraft(userId, form, step) {
  try {
    const draft = { form: { ...form, images: [] }, step, savedAt: new Date().toISOString() }
    localStorage.setItem(draftKey(userId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function clearDraft(userId) {
  try {
    localStorage.removeItem(draftKey(userId))
  } catch {}
}
