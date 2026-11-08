const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { isInHcmBounds } = require('../../src/config/hcm')
const { blurPoint, distanceMeters, toGeoLine, toGeoPoint } = require('../../src/utils/geo')

describe('Khung TP.HCM cũ', () => {
  test('các điểm cực của TP.HCM cũ nằm trong khung', () => {
    for (const [name, lat, lng] of [
      ['Chợ Bến Thành', 10.7725, 106.698],
      ['Củ Chi (cực bắc)', 11.16, 106.46],
      ['Củ Chi (cực tây)', 11.0, 106.36],
      ['Cần Giờ (cực nam)', 10.38, 106.92],
      ['Cần Giờ (cực đông)', 10.5, 107.02],
    ]) {
      assert.equal(isInHcmBounds(lat, lng), true, name)
    }
  })

  test('nơi ở xa nằm ngoài khung', () => {
    for (const [name, lat, lng] of [
      ['Hà Nội', 21.0287, 105.8523],
      ['Vũng Tàu', 10.346, 107.0843],
      ['Côn Đảo', 8.6833, 106.6083],
      ['Tây Ninh', 11.31, 106.1],
      ['Cần Thơ', 10.03, 105.78],
    ]) {
      assert.equal(isInHcmBounds(lat, lng), false, name)
    }
  })

  // Khung chữ nhật chỉ để loại nhanh: tỉnh giáp ranh vẫn lọt vào và phải kiểm tra bằng
  // city_id của VietMap (xem vietmapService.reverseGeocode)
  test('một số nơi giáp ranh vẫn nằm trong khung', () => {
    for (const [name, lat, lng] of [
      ['Dĩ An (Bình Dương cũ)', 10.9067, 106.7694],
      ['Biên Hoà (Đồng Nai)', 10.9574, 106.8427],
    ]) {
      assert.equal(isInHcmBounds(lat, lng), true, name)
    }
  })
})

describe('Toạ độ: khoảng cách và vị trí công khai', () => {
  test('khoảng cách giữa Chợ Bến Thành và Nhà thờ Đức Bà khoảng 1 km', () => {
    const meters = distanceMeters({ lat: 10.7725, lng: 106.698 }, { lat: 10.7798, lng: 106.699 })
    assert.ok(meters > 800 && meters < 850, `${meters} m`)
  })

  test('vị trí công khai luôn lệch 150-250 m so với vị trí thật', () => {
    const point = { lat: 10.7725, lng: 106.698 }
    for (let i = 0; i < 200; i += 1) {
      const meters = distanceMeters(point, blurPoint(point))
      assert.ok(meters >= 148 && meters <= 252, `${meters} m`)
    }
  })

  test('GeoJSON dùng thứ tự [kinh độ, vĩ độ]', () => {
    assert.deepEqual(toGeoPoint({ lat: 10.7, lng: 106.6 }), {
      type: 'Point',
      coordinates: [106.6, 10.7],
    })
    assert.deepEqual(
      toGeoLine([
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
      ]).coordinates,
      [
        [2, 1],
        [4, 3],
      ]
    )
  })
})
