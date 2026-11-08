// Phạm vi hoạt động của LostLink: TP.HCM theo địa giới trước sáp nhập 01/07/2025
// (16 quận nội thành, TP Thủ Đức và 5 huyện Bình Chánh, Cần Giờ, Củ Chi, Hóc Môn, Nhà Bè).

// Mã TP.HCM trong hệ hành chính cũ của VietMap (trường city_id, boundaries type 0)
const HCM_CITY_ID = 12

// Khung chữ nhật bao TP.HCM cũ, nới thêm khoảng 2-3 km mỗi phía. Khung này còn lấn sang
// Long An, Bình Dương, Đồng Nai, Tây Ninh nên chỉ dùng để loại nhanh toạ độ ở xa (không tốn
// lượt gọi VietMap). Kết luận cuối cùng dựa vào city_id do VietMap trả về
const HCM_BOUNDS = { south: 10.33, west: 106.33, north: 11.19, east: 107.05 }

// Chợ Bến Thành, dùng làm điểm ưu tiên khi gợi ý địa chỉ
const HCM_CENTER = { lat: 10.7725, lng: 106.698 }

const isInHcmBounds = (lat, lng) =>
  lat >= HCM_BOUNDS.south &&
  lat <= HCM_BOUNDS.north &&
  lng >= HCM_BOUNDS.west &&
  lng <= HCM_BOUNDS.east

module.exports = { HCM_CITY_ID, HCM_BOUNDS, HCM_CENTER, isInHcmBounds }
