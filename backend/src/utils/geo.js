const crypto = require('crypto')

const EARTH_RADIUS_M = 6371000
const toRad = (degrees) => (degrees * Math.PI) / 180

// Khoảng cách theo đường tròn lớn (haversine) giữa hai điểm { lat, lng }, đơn vị mét
const distanceMeters = (a, b) => {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

// Dời một điểm đi `meters` mét theo hướng `angle` (radian), đủ chính xác ở khoảng cách vài km
const offsetPoint = ({ lat, lng }, meters, angle) => ({
  lat: lat + (meters * Math.sin(angle)) / 111320,
  lng: lng + (meters * Math.cos(angle)) / (111320 * Math.cos(toRad(lat))),
})

// Vị trí công khai: lệch ngẫu nhiên 150-250 m theo hướng ngẫu nhiên để người khác chỉ biết
// vùng xung quanh, không suy ra được chỗ chính xác (nhà riêng, nơi làm việc)
const BLUR_MIN_M = 150
const BLUR_MAX_M = 250

const blurPoint = (point) => {
  const meters = BLUR_MIN_M + crypto.randomInt(0, BLUR_MAX_M - BLUR_MIN_M + 1)
  const angle = (crypto.randomInt(0, 360) * Math.PI) / 180
  return offsetPoint(point, meters, angle)
}

// GeoJSON dùng thứ tự [kinh độ, vĩ độ]
const toGeoPoint = ({ lat, lng }) => ({ type: 'Point', coordinates: [lng, lat] })
const toGeoLine = (points) => ({
  type: 'LineString',
  coordinates: points.map(({ lat, lng }) => [lng, lat]),
})

module.exports = {
  BLUR_MIN_M,
  BLUR_MAX_M,
  distanceMeters,
  offsetPoint,
  blurPoint,
  toGeoPoint,
  toGeoLine,
}
