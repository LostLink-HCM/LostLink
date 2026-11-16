const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const scoring = require('../../src/utils/matchScore')

const DAY = scoring.DAY_MS
const close = (actual, expected, tolerance = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} không gần ${expected}`)

// Thú cưng ở ví dụ tính tay (docs/design/matching-algorithm.md mục 7): λ = 20 ngày, k = 0.7
const PET = {
  timeShape: 0.7,
  timeMedianDays: 20 * Math.LN2 ** (1 / 0.7),
  matchRadius: 2400,
  diffusion: 150000,
}
const WALLET = {
  timeShape: 1.5,
  timeMedianDays: 2 * Math.LN2 ** (1 / 1.5),
  matchRadius: 400,
  diffusion: 0,
}

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] })

describe('UC36 - Thời gian (Weibull)', () => {
  test('đổi trung vị sang λ và tính cửa sổ T_max như bảng mục 5.1', () => {
    close(scoring.weibullScale(PET), 20)
    close(scoring.timeWindowDays(WALLET, 0.05), 4.16, 0.05)
    close(scoring.timeWindowDays(PET, 0.05), 96, 1)
  })

  test('khoảng chờ 11.5 ngày của thú cưng cho điểm ≈ 0.51; hai khoảng chồng nhau thì Δt = 0', () => {
    const lost = {
      timeFrom: new Date('2026-10-10T11:00:00Z'),
      timeTo: new Date('2026-10-10T13:00:00Z'),
    }
    const found = { timeFrom: new Date('2026-10-22T01:00:00Z') }
    close(scoring.timeGapDays(lost, found), 11.5)
    close(scoring.timeScore(11.5, PET), 0.51)

    const overlap = { timeFrom: new Date('2026-10-10T12:00:00Z') }
    assert.equal(scoring.timeGapDays(lost, overlap), 0)
  })

  test('không thể nhặt trước khi mất, cho lệch tối đa ε ngày', () => {
    const lost = { timeFrom: new Date(10 * DAY) }
    assert.equal(scoring.isTimePlausible(lost, { timeFrom: new Date(9.5 * DAY) }, 1), true)
    assert.equal(scoring.isTimePlausible(lost, { timeFrom: new Date(8 * DAY) }, 1), false)
  })
})

describe('UC36 - Vị trí (nhân Gauss, khuếch tán)', () => {
  test('σ của thú cưng sau 11.5 ngày ≈ 2 022 m, cách 1.2 km được ≈ 0.84', () => {
    const sigma = scoring.locationSigma(PET, 11.5)
    close(sigma, 2022, 2)
    close(scoring.locationScore(1200, sigma), 0.84)
    close(scoring.filterRadius(PET, 0), 2400)
    // Đồ vật nằm yên: bán kính lọc giữ nguyên
    assert.equal(scoring.filterRadius(WALLET, 30), 400)
  })

  test('khoảng cách điểm–điểm, điểm–đoạn đường và hai đoạn cắt nhau', () => {
    const a = point(106.698, 10.7725)
    const b = point(106.699, 10.7725)
    close(scoring.geometryDistance(a, b), 109, 2)

    const road = {
      type: 'LineString',
      coordinates: [
        [106.697, 10.773],
        [106.699, 10.773],
      ],
    }
    // Điểm nằm ngay dưới giữa đoạn đường, cách khoảng 55 m
    close(scoring.geometryDistance(a, road), 55, 3)

    const crossing = {
      type: 'LineString',
      coordinates: [
        [106.698, 10.772],
        [106.698, 10.774],
      ],
    }
    assert.equal(scoring.geometryDistance(road, crossing), 0)
  })

  test('đoạn đường được truy vấn bằng trung điểm và nới thêm nửa chiều dài', () => {
    const road = {
      type: 'LineString',
      coordinates: [
        [106.697, 10.773],
        [106.699, 10.773],
      ],
    }
    const { center, extra } = scoring.searchCircle(road)
    close(center[0], 106.698, 1e-9)
    close(center[1], 10.773, 1e-9)
    close(extra, 109, 2)
    assert.deepEqual(scoring.searchCircle(point(1, 2)), { center: [1, 2], extra: 0 })
  })
})

describe('UC36 - Mô tả (TF-IDF) và đồ bên trong', () => {
  test('tách âm tiết không dấu kèm cặp âm tiết liền nhau', () => {
    assert.deepEqual(scoring.tokenize('Điện thoại đen!'), [
      'dien',
      'thoai',
      'den',
      'dien_thoai',
      'thoai_den',
    ])
  })

  test('từ hiếm trùng nhau cho cosin cao, không còn từ có trọng số thì bỏ qua tiêu chí', () => {
    const docs = [
      'mat vi da nau',
      'nhat duoc vi da nau',
      'mat dien thoai',
      'mat chia khoa',
      'nhat duoc the sinh vien',
    ].map(scoring.tokenize)
    const df = scoring.documentFrequency(docs)
    const vec = (i) => scoring.tfidfVector(docs[i], df, docs.length)
    assert.ok(scoring.cosineSimilarity(vec(0), vec(1)) > scoring.cosineSimilarity(vec(0), vec(2)))
    assert.equal(scoring.cosineSimilarity(new Map(), vec(1)), null)
  })

  test('đồ bên trong tính theo danh sách ngắn hơn, một bên trống thì bỏ qua', () => {
    assert.deepEqual(scoring.contentsScore(['Tiền mặt', 'CCCD', 'Thẻ'], ['CCCD']), {
      s: 1,
      shared: ['CCCD'],
    })
    assert.equal(scoring.contentsScore([], ['CCCD']), null)
  })
})

describe('UC36 - Kết hợp Fellegi-Sunter', () => {
  test('trọng số đồng ý, không đồng ý và xác suất khớp như ví dụ mục 7.1', () => {
    close(scoring.evidenceWeight(1, 0.95, 0.03), 4.98)
    close(scoring.evidenceWeight(0, 0.9, 0.2), -3.0)
    close(scoring.evidenceWeight(0.84, 0.9, 0.05), 2.98, 0.02)
    close(scoring.matchProbability(12.1, 1 / 200), 0.96)
    close(scoring.matchProbability(3.6, 1 / 200), 0.06)
  })
})
