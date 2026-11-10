import { DAY_PARTS, TIME_PRESETS } from '../../data/composePost'
import { normalize } from './homeFeed'

// Giới hạn tối đa 9 ảnh, mỗi ảnh không quá 5 MB
export const MAX_IMAGES = 9
export const MAX_IMAGE_MB = 5
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const TITLE_MAX = 120
export const DESCRIPTION_MAX = 1000
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 5
// Khớp ROAD_MIN_M, ROAD_MAX_M ở backend
export const ROAD_MIN_M = 20
export const ROAD_MAX_M = 5000

// Ghim và đoạn đường lưu song song nên bật/tắt đoạn đường không mất cái còn lại.
// mode: gps, pin, address (một điểm) hoặc road
export const EMPTY_LOCATION = {
  mode: '',
  // Cách đặt ghim gần nhất, để tắt đoạn đường thì quay về ghim
  pointSource: '',
  // Chữ đang gõ ở ô tìm địa chỉ
  query: '',
  // place: địa chỉ đầy đủ người đăng thấy (tự điền, không nhập tay). placePublic: bản công khai
  // khi chọn từ kết quả tìm kiếm; các cách khác do server tạo từ toạ độ
  place: '',
  placePublic: '',
  area: '',
  // Khu vực tự nhận theo toạ độ (không cho đổi) hay người dùng chọn tay
  areaAuto: false,
  point: null,
  // Độ lệch GPS (mét)
  accuracy: null,
  // Hai đầu đoạn đường { lat, lng } và địa chỉ đầy đủ của từng đầu
  road: [],
  roadPlaces: [],
  // Ngoài TP.HCM (server đã báo OUTSIDE_HCM)
  pointOutside: false,
  roadOutside: false,
}

export const EMPTY_FORM = {
  type: '',
  // slug danh mục
  category: '',
  // { [id thuộc tính]: id giá trị }
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
  location: EMPTY_LOCATION,
  question: { skipped: false, text: '', options: ['', '', ''], correct: null },
}

const BASE_STEPS = [
  { key: 'classify', label: 'Phân loại' },
  { key: 'content', label: 'Nội dung' },
  { key: 'time', label: 'Thời gian' },
  { key: 'location', label: 'Vị trí' },
]

// Bước câu hỏi xác minh chỉ có ở tin Nhặt được
export const getSteps = (type) =>
  type === 'found' ? [...BASE_STEPS, { key: 'question', label: 'Câu hỏi' }] : BASE_STEPS

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
function currentDayPart(hour) {
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

// Ngày và buổi của bây giờ; 0:00-6:00 là Ban đêm của hôm trước (khớp backend)
function nowSlot(now = new Date()) {
  const hour = now.getHours()
  if (hour < 6) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return { date: toDateInput(yesterday), dayPart: 'night' }
  }
  return { date: toDateInput(now), dayPart: currentDayPart(hour) }
}

function presetSlot(preset, keepDayPart = '', now = new Date()) {
  if (preset.dayPart === 'now') return nowSlot(now)
  const date = new Date(now)
  date.setDate(date.getDate() - preset.daysAgo)
  return { date: toDateInput(date), dayPart: preset.dayPart || keepDayPart }
}

// Buổi chưa bắt đầu của hôm nay
export function isFutureDayPart(date, dayPart, now = new Date()) {
  const part = DAY_PARTS.find((item) => item.value === dayPart)
  return Boolean(part) && date === toDateInput(now) && now.getHours() < part.startHour
}

// Mốc chưa tới, vd Tối nay khi mới sáng sớm
export function isFuturePreset(preset, now = new Date()) {
  const { date, dayPart } = presetSlot(preset, '', now)
  return isFutureDayPart(date, dayPart, now)
}

// Ngày và buổi độc lập: mốc chỉ có ngày giữ buổi đang chọn, mốc có buổi thì đặt luôn buổi
export const applyTimePreset = (preset, keepDayPart = '') => ({
  ...presetSlot(preset, keepDayPart),
  timePreset: preset.label,
})

const presetMatches = (preset, date, dayPart) => {
  const slot = presetSlot(preset, dayPart)
  return slot.date === date && slot.dayPart === dayPart
}

// Giữ mốc cũ nếu còn khớp, không thì tìm mốc khớp (Sáng hôm qua + Buổi chiều → Chiều hôm qua)
export function resolveTimePreset(date, dayPart, current = '') {
  const kept = TIME_PRESETS.find((preset) => preset.label === current)
  if (kept && presetMatches(kept, date, dayPart)) return current
  const match = TIME_PRESETS.find(
    (preset) => preset.dayPart !== 'now' && presetMatches(preset, date, dayPart)
  )
  return match?.label ?? ''
}

// Khoảng cách gần đúng giữa hai điểm { lat, lng }, đơn vị mét
export function distanceMeters(a, b) {
  const rad = Math.PI / 180
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad)
  const y = (b.lat - a.lat) * rad
  return Math.sqrt(x * x + y * y) * 6371000
}

export const formatDistance = (meters) =>
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`

// Chỉ giữ các lỗi có nội dung
const onlyErrors = (entries) => Object.fromEntries(Object.entries(entries).filter(([, v]) => v))

const OUTSIDE_MESSAGE = 'Vị trí nằm ngoài TP.HCM, hãy chọn lại một điểm trong TP.HCM.'

function roadError({ road, roadOutside }) {
  if (road.length < 2) return 'Bấm lên bản đồ để chọn điểm đầu và điểm cuối của đoạn đường.'
  if (roadOutside) return OUTSIDE_MESSAGE
  const length = distanceMeters(road[0], road[1])
  if (length < ROAD_MIN_M || length > ROAD_MAX_M) {
    return `Đoạn đường phải dài từ ${ROAD_MIN_M} m đến ${ROAD_MAX_M / 1000} km.`
  }
  return ''
}

function locationError(location) {
  if (location.mode === 'road') return roadError(location)
  if (!location.point) {
    return 'Chọn vị trí: tìm địa chỉ, dùng vị trí của bạn hoặc bấm lên bản đồ để đặt ghim.'
  }
  return location.pointOutside ? OUTSIDE_MESSAGE : ''
}

function questionErrors({ question }) {
  if (question.skipped) return {}
  const options = question.options.map((option) => option.trim())
  const filled = options.filter(Boolean)
  const duplicated = new Set(filled.map(normalize)).size !== filled.length
  return {
    question: !question.text.trim() && 'Nhập câu hỏi xác minh.',
    options:
      filled.length < MIN_OPTIONS
        ? `Cần ít nhất ${MIN_OPTIONS} phương án.`
        : duplicated && 'Các phương án không được trùng nhau.',
    correct: (question.correct === null || !options[question.correct]) && 'Chọn đáp án đúng.',
  }
}

// Thuộc tính bắt buộc của danh mục (vd Loại giấy tờ) chưa chọn
function attributeError(form, category) {
  const missing = category?.attributes.find(
    (attribute) => attribute.isRequired && !form.attributes[attribute.id]
  )
  return missing ? `Chọn ${missing.name.toLocaleLowerCase('vi')}.` : ''
}

// Kiểm tra khi bấm Tiếp tục, không kiểm tra lúc gõ. category dùng cho thuộc tính bắt buộc
const validators = {
  classify: (form, category) => ({
    type: !form.type && 'Chọn loại tin: Mất đồ hay Nhặt được.',
    category: !form.category && 'Chọn danh mục cho món đồ.',
    attributes: form.category && attributeError(form, category),
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
    dayPart: isFutureDayPart(form.date, form.dayPart) && 'Khoảng thời gian này chưa tới.',
  }),
  location: ({ location }) => ({
    location: locationError(location),
    area: !location.area && 'Chọn khu vực.',
  }),
  question: questionErrors,
}

export const validateStep = (key, form, category) => onlyErrors(validators[key](form, category))

// Bước đầu tiên còn lỗi để đưa người dùng quay lại
export function findInvalidStep(form, category) {
  const steps = getSteps(form.type)
  for (let index = 0; index < steps.length; index += 1) {
    const errors = validateStep(steps[index].key, form, category)
    if (Object.keys(errors).length) return { index, errors }
  }
  return null
}

// Đổi field lỗi của backend về bước và khoá lỗi của form
const API_FIELD_ERRORS = [
  [/^type$/, 'classify', 'type'],
  [/^category$/, 'classify', 'category'],
  [/^(attributes|contents)/, 'classify', 'attributes'],
  [/^title$/, 'content', 'title'],
  [/^description$/, 'content', 'description'],
  [/^images$/, 'content', 'images'],
  [/^date$/, 'time', 'date'],
  [/^dayPart$/, 'time', 'dayPart'],
  [/^location\.area$/, 'location', 'area'],
  [/^location/, 'location', 'location'],
  [/^question\.text$/, 'question', 'question'],
  [/^question\.options/, 'question', 'options'],
  [/^question\.correct$/, 'question', 'correct'],
]

export function mapApiErrors(details) {
  let stepKey = null
  const errors = {}
  for (const { field, message } of details) {
    const match = API_FIELD_ERRORS.find(([pattern]) => pattern.test(field))
    if (!match) continue
    stepKey ??= match[1]
    errors[match[2]] ??= message
  }
  return stepKey ? { stepKey, errors } : null
}

// Bỏ ảnh sai định dạng, quá 5 MB hoặc vượt số lượng
export function checkImages(files, currentCount, max = MAX_IMAGES) {
  const accepted = []
  const errors = []
  let overflow = false
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      errors.push(`"${file.name}" không phải ảnh JPG, PNG hoặc WEBP.`)
    } else if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`"${file.name}" lớn hơn ${MAX_IMAGE_MB} MB.`)
    } else if (currentCount + accepted.length >= max) {
      overflow = true
    } else {
      accepted.push(file)
    }
  }
  if (overflow) errors.push(`Chỉ được tối đa ${max} ảnh, các ảnh thừa đã bị bỏ.`)
  return { accepted, errors }
}

// Thuộc tính đã chọn: [{ name, value }] theo thứ tự của danh mục
export function selectedAttributes(form, category) {
  return (category?.attributes ?? [])
    .map((attribute) => ({
      name: attribute.name,
      value: attribute.values.find((value) => value.id === form.attributes[attribute.id])?.value,
    }))
    .filter((item) => item.value)
}

// Mỗi thuộc tính một dòng "- Tên: giá trị"
export function describeAttributes(form, category) {
  const lines = selectedAttributes(form, category).map((item) => `- ${item.name}: ${item.value}`)
  if (form.contents.length) lines.push(`- Bên trong có: ${form.contents.join(', ')}`)
  return lines.join('\n')
}

// Điền sẵn thuộc tính vào mô tả, dòng đầu để trống cho người dùng viết.
export function prefillDescription(form, category) {
  const block = describeAttributes(form, category)
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
  const part = DAY_PARTS.find((item) => item.value === dayPart)
  if (timePreset) {
    // Vd "Hôm kia, buổi tối (06/11/2026)"
    const dateOnly = TIME_PRESETS.find((preset) => preset.label === timePreset)?.dayPart === ''
    const extra = dateOnly && part ? `, ${part.label.toLocaleLowerCase('vi')}` : ''
    return `${timePreset}${extra} (${day})`
  }
  return part ? `${part.label}, ${day}` : day
}

// Ghim một dòng, đoạn đường hai dòng Từ / Đến; không có địa chỉ thì ghi khu vực
export function describeLocation(location) {
  if (location.mode === 'road') {
    const [from, to] = location.roadPlaces
    return `Từ: ${from || location.area}
Đến: ${to || location.area}`
  }
  return location.place || location.area
}

// Dữ liệu gửi lên API đăng bài. Ảnh gửi kèm trong FormData, không nằm trong JSON
export function buildPostPayload(form) {
  const { location, question } = form
  const payload = {
    type: form.type,
    category: form.category,
    attributes: Object.entries(form.attributes).map(([attribute, value]) => ({
      attribute,
      value,
    })),
    contents: form.contents,
    title: form.title.trim(),
    description: form.description.trim(),
    date: form.date,
    dayPart: form.dayPart,
    location: {
      mode: location.mode,
      area: location.area,
      ...(location.mode === 'road'
        ? { road: location.road }
        : { point: location.point, placeName: location.placePublic }),
    },
  }

  if (form.type === 'found' && !question.skipped) {
    // Bỏ phương án trống, giữ đúng vị trí đáp án đúng
    const options = question.options.map((text, index) => ({ text: text.trim(), index }))
    const filled = options.filter((option) => option.text)
    payload.question = {
      text: question.text.trim(),
      options: filled.map((option) => option.text),
      correct: filled.findIndex((option) => option.index === question.correct),
    }
  }
  return payload
}

// Ảnh mới gửi kèm FormData. Sửa bài thì data có thêm images: { url } ảnh cũ, { upload } ảnh mới
export function buildPostForm(form, { edit = false } = {}) {
  const data = new FormData()
  const payload = buildPostPayload(form)
  const uploads = form.images.filter((image) => image.file)
  if (edit) {
    payload.images = form.images.map((image) =>
      image.file ? { upload: uploads.indexOf(image) } : { url: image.url }
    )
  }
  data.append('data', JSON.stringify(payload))
  uploads.forEach((image) => data.append('images', image.file, image.name))
  return data
}

// Đưa một ảnh lên đầu danh sách để làm ảnh bìa
export const moveToCover = (images, id) => {
  const image = images.find((item) => item.id === id)
  return image ? [image, ...images.filter((item) => item.id !== id)] : images
}

// Bài từ API Sửa bài → dữ liệu form. Đặt sẵn attributeBlock để bước Nội dung không điền lại
export function formFromPost(post, categories) {
  const { location: saved } = post
  const area = saved.area ?? ''
  const located = { ...EMPTY_LOCATION, area, areaAuto: Boolean(area) }
  let location = EMPTY_LOCATION
  if (saved.mode === 'road' && saved.road?.length === 2) {
    location = {
      ...located,
      mode: 'road',
      road: saved.road,
      roadPlaces: [saved.placeName ?? '', saved.placeNameTo ?? ''],
    }
  } else if (saved.point) {
    location = {
      ...located,
      mode: 'pin',
      pointSource: 'pin',
      point: saved.point,
      place: saved.placeName ?? '',
    }
  }

  const question = post.question
    ? {
        skipped: false,
        text: post.question.text,
        options: post.question.options,
        correct: post.question.correct,
      }
    : { ...EMPTY_FORM.question, skipped: post.type === 'found' }

  const form = {
    ...EMPTY_FORM,
    type: post.type,
    category: post.category,
    attributes: toAttributeMap(post.attributes),
    contents: post.contents ?? [],
    title: post.title,
    description: post.description ?? '',
    images: post.images.map((url, index) => ({
      id: `saved-${index}`,
      url,
      name: `ảnh ${index + 1}`,
    })),
    date: post.date,
    dayPart: post.dayPart ?? '',
    timePreset: resolveTimePreset(post.date, post.dayPart ?? ''),
    location,
    question,
  }
  const patch = reconcileClassification(form, categories)
  const next = patch ? { ...form, ...patch } : form
  const category = categories.find((item) => item.slug === next.category)
  return { ...next, attributeBlock: describeAttributes(next, category) }
}

// Bỏ phân loại, thuộc tính, đồ bên trong của bản nháp không còn khớp danh mục hiện có
export function reconcileClassification(form, categories) {
  const category = categories.find((item) => item.slug === form.category)
  if (!category) {
    return form.category ? { category: '', attributes: {}, contents: [] } : null
  }
  const attributes = Object.fromEntries(
    Object.entries(form.attributes).filter(([attributeId, valueId]) =>
      category.attributes.some(
        (attribute) =>
          attribute.id === attributeId && attribute.values.some((value) => value.id === valueId)
      )
    )
  )
  const contents = form.contents.filter((item) => category.contentItems.includes(item))
  const changed =
    Object.keys(attributes).length !== Object.keys(form.attributes).length ||
    contents.length !== form.contents.length
  return changed ? { attributes, contents } : null
}

const isPoint = (value) => value != null && Number.isFinite(value.lat) && Number.isFinite(value.lng)

const text = (value) => (typeof value === 'string' ? value : '')
const POINT_SOURCES = ['gps', 'pin', 'address']

// Bản nháp rất cũ lưu vị trí theo % trên bản đồ minh hoạ thì bỏ
function restoreLocation(saved = {}) {
  const location = { ...EMPTY_LOCATION, ...saved }
  const point = isPoint(location.point) ? location.point : null
  const road = Array.isArray(location.road) ? location.road.filter(isPoint).slice(0, 2) : []
  const pointSource = POINT_SOURCES.includes(location.pointSource)
    ? location.pointSource
    : POINT_SOURCES.includes(location.mode) && point
      ? location.mode
      : ''
  return {
    mode: location.mode === 'road' ? 'road' : point ? pointSource || 'pin' : '',
    pointSource,
    query: text(location.query),
    place: text(location.place),
    placePublic: text(location.placePublic),
    area: text(location.area),
    areaAuto: Boolean(location.areaAuto) && Boolean(text(location.area)),
    point,
    accuracy: Number.isFinite(location.accuracy) ? location.accuracy : null,
    road,
    roadPlaces: Array.isArray(location.roadPlaces)
      ? location.roadPlaces.slice(0, road.length).map(text)
      : [],
    pointOutside: Boolean(location.pointOutside),
    roadOutside: Boolean(location.roadOutside),
  }
}

// ----- Lưu nháp: bản nháp lưu trên server, không kèm ảnh

// Khớp hasContent ở backend; ảnh không lưu trong bản nháp nên không tính
export function isFormEmpty(form) {
  const { location, question } = form
  return !(
    form.type ||
    form.category ||
    Object.keys(form.attributes).length ||
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

// Toàn bộ form trừ ảnh, thuộc tính đổi sang mảng
export function serializeDraft(form) {
  const draft = {
    ...form,
    attributes: Object.entries(form.attributes).map(([attribute, value]) => ({ attribute, value })),
  }
  delete draft.images
  return draft
}

const toAttributeMap = (attributes) => {
  if (Array.isArray(attributes)) {
    return Object.fromEntries(attributes.map((item) => [item.attribute, item.value]))
  }
  return attributes && typeof attributes === 'object' ? attributes : {}
}

function restoreQuestion(saved = {}) {
  const options = Array.isArray(saved.options)
    ? saved.options.filter((o) => typeof o === 'string')
    : []
  return {
    skipped: Boolean(saved.skipped),
    text: text(saved.text),
    // Ít nhất MIN_OPTIONS ô, chưa có phương án thì như form mới
    options: options.length
      ? [...options, ...Array(Math.max(0, MIN_OPTIONS - options.length)).fill('')]
      : EMPTY_FORM.question.options,
    correct:
      Number.isInteger(saved.correct) && saved.correct < options.length ? saved.correct : null,
  }
}

// Bản nháp thành dữ liệu form, mở đúng bước đang làm dở
export function restoreDraft(draft) {
  const saved = draft.form ?? {}
  const form = {
    ...EMPTY_FORM,
    type: text(saved.type),
    category: text(saved.category),
    attributes: toAttributeMap(saved.attributes),
    contents: Array.isArray(saved.contents) ? saved.contents : [],
    title: text(saved.title),
    description: text(saved.description),
    attributeBlock: text(saved.attributeBlock),
    date: text(saved.date),
    dayPart: text(saved.dayPart),
    timePreset: text(saved.timePreset),
    images: [],
    location: restoreLocation(saved.location),
    question: restoreQuestion(saved.question),
  }
  const step = Math.min(Math.max(Number(draft.step) || 0, 0), getSteps(form.type).length - 1)
  return { form, step, savedAt: draft.savedAt }
}

// Bản nháp cũ ở trình duyệt (trước khi có API): chỉ đọc để chuyển lên server
const localDraftKey = (userId) => `lostlink:post-draft:${userId}`

export function loadLocalDraft(userId) {
  try {
    const raw = localStorage.getItem(localDraftKey(userId))
    return raw ? restoreDraft(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function clearLocalDraft(userId) {
  try {
    localStorage.removeItem(localDraftKey(userId))
  } catch {}
}
