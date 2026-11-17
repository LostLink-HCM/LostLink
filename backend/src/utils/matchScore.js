const { distanceMeters } = require('./geo')
const { normalizeText } = require('./text')

const DAY_MS = 24 * 60 * 60 * 1000
const METERS_PER_DEGREE = 111320
// Giữ u trong (0, 1) để log không ra vô cực
const PROB_MIN = 0.001
const PROB_MAX = 0.999

const clampProb = (p) => Math.min(PROB_MAX, Math.max(PROB_MIN, p))

// ----- Thời gian

// λ suy từ trung vị thời gian chờ admin nhập
const weibullScale = ({ timeMedianDays, timeShape }) => timeMedianDays / Math.LN2 ** (1 / timeShape)

// T_max: lúc điểm thời gian rơi xuống dưới sMin
const timeWindowDays = (category, sMin) =>
  weibullScale(category) * (-Math.log(sMin)) ** (1 / category.timeShape)

// Δt từ lúc mất muộn nhất tới lúc nhặt sớm nhất, chồng nhau thì 0
const timeGapDays = (lost, found) =>
  Math.max(0, (found.timeFrom - (lost.timeTo ?? lost.timeFrom)) / DAY_MS)

// Không thể nhặt trước khi mất, cho lệch tối đa toleranceDays
const isTimePlausible = (lost, found, toleranceDays) =>
  (found.timeTo ?? found.timeFrom) >= lost.timeFrom - toleranceDays * DAY_MS

const timeScore = (gapDays, category) =>
  Math.exp(-((gapDays / weibullScale(category)) ** category.timeShape))

// ----- Vị trí (mục 5.2)

// σ² = σ₀² + 2DΔt, σ₀ = matchRadius / 3
const locationSigma = (category, gapDays) =>
  Math.sqrt((category.matchRadius / 3) ** 2 + 2 * category.diffusion * gapDays)

// Bán kính lọc 3σ
const filterRadius = (category, gapDays) => 3 * locationSigma(category, gapDays)

const locationScore = (distance, sigma) => Math.exp(-(distance * distance) / (2 * sigma * sigma))

// Chiếu [lng, lat] lên mặt phẳng (mét) quanh vĩ độ lat0, đủ chính xác trong vài chục km
const toPlane = ([lng, lat], lat0) => [
  lng * METERS_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180),
  lat * METERS_PER_DEGREE,
]

const pointSegmentDistance = (p, a, b) => {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq))
    : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

const segmentsCross = ([a, b], [c, d]) =>
  cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0

const segmentDistance = (s1, s2) =>
  segmentsCross(s1, s2)
    ? 0
    : Math.min(
        pointSegmentDistance(s1[0], ...s2),
        pointSegmentDistance(s1[1], ...s2),
        pointSegmentDistance(s2[0], ...s1),
        pointSegmentDistance(s2[1], ...s1)
      )

// Điểm là đoạn suy biến, đoạn đường có thể gồm nhiều đoạn nối nhau
const segmentsOf = (geometry, lat0) => {
  if (geometry.type === 'Point') {
    const p = toPlane(geometry.coordinates, lat0)
    return [[p, p]]
  }
  const points = geometry.coordinates.map((coord) => toPlane(coord, lat0))
  return points.slice(1).map((point, index) => [points[index], point])
}

const firstCoordinate = (geometry) =>
  geometry.type === 'Point' ? geometry.coordinates : geometry.coordinates[0]

// Khoảng cách (mét) giữa hai vị trí GeoJSON: điểm–điểm, điểm–đoạn đường, đoạn–đoạn
const geometryDistance = (a, b) => {
  if (a.type === 'Point' && b.type === 'Point') {
    const [lng1, lat1] = a.coordinates
    const [lng2, lat2] = b.coordinates
    return distanceMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })
  }
  const lat0 = firstCoordinate(a)[1]
  const segmentsA = segmentsOf(a, lat0)
  const segmentsB = segmentsOf(b, lat0)
  return Math.min(...segmentsA.flatMap((s1) => segmentsB.map((s2) => segmentDistance(s1, s2))))
}

// Tâm và độ nới để truy vấn $near bằng một điểm: đoạn đường lấy trung điểm hai đầu
const searchCircle = (geometry) => {
  if (geometry.type === 'Point') return { center: geometry.coordinates, extra: 0 }
  const coords = geometry.coordinates
  const [first, last] = [coords[0], coords.at(-1)]
  const center = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2]
  const extra = Math.max(
    ...coords.map((coord) =>
      geometryDistance(
        { type: 'Point', coordinates: center },
        { type: 'Point', coordinates: coord }
      )
    )
  )
  return { center, extra }
}

// ----- Mô tả: TF-IDF và cosin

// Chưa có thư viện tách từ tiếng Việt cho Node nên dùng âm tiết kèm cặp âm tiết liền nhau
// để giữ được từ ghép như "dien_thoai"
const tokenize = (text) => {
  const syllables = normalizeText(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
  return [
    ...syllables,
    ...syllables.slice(1).map((syllable, index) => `${syllables[index]}_${syllable}`),
  ]
}

const documentFrequency = (documents) => {
  const df = new Map()
  for (const tokens of documents) {
    for (const token of new Set(tokens)) df.set(token, (df.get(token) ?? 0) + 1)
  }
  return df
}

// IDF = ln(N / (1 + n_t)), âm thì coi như 0 (từ có ở gần như mọi bài)
const tfidfVector = (tokens, df, totalDocs) => {
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  const vector = new Map()
  for (const [token, count] of counts) {
    const idf = Math.max(0, Math.log(totalDocs / (1 + (df.get(token) ?? 0))))
    if (idf > 0) vector.set(token, (count / tokens.length) * idf)
  }
  return vector
}

// null khi một bên không còn từ nào có trọng số, tiêu chí mô tả bị bỏ qua
const cosineSimilarity = (a, b) => {
  let dot = 0
  for (const [token, weight] of a) dot += weight * (b.get(token) ?? 0)
  const norm = (vector) => Math.sqrt([...vector.values()].reduce((sum, w) => sum + w * w, 0))
  const [normA, normB] = [norm(a), norm(b)]
  return normA && normB ? dot / (normA * normB) : null
}

// ----- Đồ bên trong

const contentsScore = (a = [], b = []) => {
  if (!a.length || !b.length) return null
  const setB = new Set(b)
  const shared = a.filter((item) => setB.has(item))
  return { s: shared.length / Math.min(a.length, b.length), shared }
}

// ----- Fellegi-Sunter

// w(s) = s·a + (1 − s)·b, a = log₂(m/u), b = log₂((1 − m)/(1 − u))
const evidenceWeight = (s, m, u) => {
  const p = clampProb(u)
  return s * Math.log2(m / p) + (1 - s) * Math.log2((1 - m) / (1 - p))
}

// P = σ(W·ln2 + logit p₀)
const matchProbability = (bits, prior) =>
  1 / (1 + Math.exp(-(bits * Math.LN2 + Math.log(prior / (1 - prior)))))

module.exports = {
  DAY_MS,
  weibullScale,
  timeWindowDays,
  timeGapDays,
  isTimePlausible,
  timeScore,
  locationSigma,
  filterRadius,
  locationScore,
  geometryDistance,
  searchCircle,
  tokenize,
  documentFrequency,
  tfidfVector,
  cosineSimilarity,
  contentsScore,
  evidenceWeight,
  matchProbability,
}
