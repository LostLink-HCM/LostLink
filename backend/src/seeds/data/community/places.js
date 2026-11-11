// Địa điểm dùng chung cho bài đăng cộng đồng: khu vực, tên chỗ và tọa độ thật (lat, lng) ở TP.HCM.
// Bài dùng ...at('ben-thanh') thay vì gõ lại tọa độ, để các cặp mất/nhặt ở gần nhau cho đúng
const PLACES = {
  'ben-thanh': ['Quận 1', 'Chợ Bến Thành, Phường Bến Thành, Quận 1', 10.7725, 106.698],
  'ben-thanh-cua-tay': [
    'Quận 1',
    'Cửa Tây chợ Bến Thành, đường Phan Chu Trinh, Quận 1',
    10.7723,
    106.6966,
  ],
  'nguyen-hue': ['Quận 1', 'Phố đi bộ Nguyễn Huệ, Phường Bến Nghé, Quận 1', 10.7743, 106.7038],
  'bui-vien': ['Quận 1', 'Phố Tây Bùi Viện, Phường Phạm Ngũ Lão, Quận 1', 10.7676, 106.6932],
  'tao-dan': ['Quận 1', 'Công viên Tao Đàn, Phường Bến Thành, Quận 1', 10.7745, 106.692],
  'duc-ba': ['Quận 1', 'Nhà thờ Đức Bà, Phường Bến Nghé, Quận 1', 10.7798, 106.699],
  'bach-dang': ['Quận 1', 'Công viên Bến Bạch Đằng, Phường Bến Nghé, Quận 1', 10.7744, 106.7069],
  'tan-dinh': ['Quận 1', 'Chợ Tân Định, Phường Tân Định, Quận 1', 10.7895, 106.6907],
  'thao-cam-vien': ['Quận 1', 'Thảo Cầm Viên, 2 Nguyễn Bỉnh Khiêm, Quận 1', 10.7875, 106.7053],
  'ga-ba-son': ['Quận 1', 'Ga metro Ba Son, Phường Bến Nghé, Quận 1', 10.7814, 106.7076],
  'ho-con-rua': ['Quận 3', 'Hồ Con Rùa, Phường Võ Thị Sáu, Quận 3', 10.7826, 106.6959],
  'le-van-tam': ['Quận 3', 'Công viên Lê Văn Tám, Phường Võ Thị Sáu, Quận 3', 10.788, 106.696],
  'ga-sai-gon': ['Quận 3', 'Ga Sài Gòn, 1 Nguyễn Thông, Quận 3', 10.7822, 106.6772],
  'ky-dong': ['Quận 3', 'Nhà thờ Kỳ Đồng, Phường 9, Quận 3', 10.7838, 106.6837],
  'xom-chieu': ['Quận 4', 'Chợ Xóm Chiếu, Phường 14, Quận 4', 10.759, 106.7046],
  'an-dong': ['Quận 5', 'Chợ An Đông, Phường 9, Quận 5', 10.7583, 106.674],
  'cho-ray': ['Quận 5', 'Bệnh viện Chợ Rẫy, 201B Nguyễn Chí Thanh, Quận 5', 10.7577, 106.6593],
  'y-duoc': ['Quận 5', 'Đại học Y Dược, 217 Hồng Bàng, Quận 5', 10.7555, 106.664],
  'binh-tay': ['Quận 6', 'Chợ Bình Tây, Phường 2, Quận 6', 10.7499, 106.651],
  'lotte-q7': ['Quận 7', 'Lotte Mart Quận 7, 469 Nguyễn Hữu Thọ, Quận 7', 10.7406, 106.7016],
  crescent: ['Quận 7', 'Crescent Mall, Phường Tân Phú, Quận 7', 10.729, 106.7189],
  'ho-ban-nguyet': ['Quận 7', 'Hồ Bán Nguyệt, Phú Mỹ Hưng, Quận 7', 10.7302, 106.7215],
  tdtu: ['Quận 7', 'Đại học Tôn Đức Thắng, 19 Nguyễn Hữu Thọ, Quận 7', 10.7326, 106.6992],
  'sky-garden': ['Quận 7', 'Khu Sky Garden, Phú Mỹ Hưng, Quận 7', 10.7356, 106.7128],
  'kcx-tan-thuan': [
    'Quận 7',
    'Khu chế xuất Tân Thuận, Phường Tân Thuận Đông, Quận 7',
    10.759,
    106.729,
  ],
  'van-hanh': ['Quận 10', 'Vạn Hạnh Mall, 11 Sư Vạn Hạnh, Quận 10', 10.777, 106.6696],
  'bach-khoa': ['Quận 10', 'Đại học Bách Khoa, 268 Lý Thường Kiệt, Quận 10', 10.7724, 106.6579],
  'bach-khoa-cong-sau': [
    'Quận 10',
    'Cổng sau Đại học Bách Khoa, đường Tô Hiến Thành, Quận 10',
    10.7746,
    106.6593,
  ],
  'ho-thi-ky': ['Quận 10', 'Chợ hoa Hồ Thị Kỷ, Phường 1, Quận 10', 10.7656, 106.6787],
  'le-thi-rieng': ['Quận 10', 'Công viên Lê Thị Riêng, Phường 15, Quận 10', 10.786, 106.6643],
  'dam-sen': ['Quận 11', 'Công viên Đầm Sen, 3 Hòa Bình, Quận 11', 10.7676, 106.6413],
  'cong-vien-phan-mem': ['Quận 12', 'Công viên phần mềm Quang Trung, Quận 12', 10.853, 106.628],
  'ba-chieu': ['Quận Bình Thạnh', 'Chợ Bà Chiểu, Phường 1, Quận Bình Thạnh', 10.801, 106.699],
  landmark: [
    'Quận Bình Thạnh',
    'Công viên Vinhomes Central Park, Quận Bình Thạnh',
    10.795,
    106.7218,
  ],
  'hang-xanh': ['Quận Bình Thạnh', 'Ngã tư Hàng Xanh, Quận Bình Thạnh', 10.801, 106.711],
  hutech: [
    'Quận Bình Thạnh',
    'Đại học HUTECH, 475A Điện Biên Phủ, Quận Bình Thạnh',
    10.8016,
    106.7148,
  ],
  'van-thanh': [
    'Quận Bình Thạnh',
    'Khu du lịch Văn Thánh, Phường 22, Quận Bình Thạnh',
    10.7996,
    106.7176,
  ],
  'gia-dinh': [
    'Quận Gò Vấp',
    'Công viên Gia Định, đường Hoàng Minh Giám, Quận Gò Vấp',
    10.813,
    106.677,
  ],
  'emart-go-vap': ['Quận Gò Vấp', 'Emart Phan Văn Trị, Phường 10, Quận Gò Vấp', 10.8264, 106.6913],
  'cho-go-vap': [
    'Quận Gò Vấp',
    'Chợ Gò Vấp, đường Nguyễn Văn Nghi, Quận Gò Vấp',
    10.8247,
    106.6873,
  ],
  'hanh-thong-tay': ['Quận Gò Vấp', 'Chợ Hạnh Thông Tây, Quận Gò Vấp', 10.837, 106.658],
  iuh: ['Quận Gò Vấp', 'Đại học Công nghiệp, 12 Nguyễn Văn Bảo, Quận Gò Vấp', 10.8221, 106.6875],
  'cho-phu-nhuan': [
    'Quận Phú Nhuận',
    'Chợ Phú Nhuận, đường Nguyễn Kiệm, Quận Phú Nhuận',
    10.799,
    106.683,
  ],
  'phan-xich-long': [
    'Quận Phú Nhuận',
    'Phố ẩm thực Phan Xích Long, Quận Phú Nhuận',
    10.8005,
    106.6886,
  ],
  'san-bay': ['Quận Tân Bình', 'Sân bay Tân Sơn Nhất, ga quốc nội, Quận Tân Bình', 10.816, 106.664],
  'cho-tan-binh': [
    'Quận Tân Bình',
    'Chợ Tân Bình, đường Lý Thường Kiệt, Quận Tân Bình',
    10.7953,
    106.6528,
  ],
  etown: ['Quận Tân Bình', 'Tòa nhà Etown, 364 Cộng Hòa, Quận Tân Bình', 10.8017, 106.6417],
  'hoang-van-thu': ['Quận Tân Bình', 'Công viên Hoàng Văn Thụ, Quận Tân Bình', 10.8, 106.664],
  'pham-van-hai': ['Quận Tân Bình', 'Chợ Phạm Văn Hai, Phường 3, Quận Tân Bình', 10.79, 106.666],
  'aeon-tan-phu': [
    'Quận Tân Phú',
    'Aeon Mall Tân Phú, 30 Bờ Bao Tân Thắng, Quận Tân Phú',
    10.8016,
    106.6177,
  ],
  'aeon-binh-tan': [
    'Quận Bình Tân',
    'Aeon Mall Bình Tân, đường số 17A, Quận Bình Tân',
    10.7425,
    106.612,
  ],
  'ben-xe-mien-tay': [
    'Quận Bình Tân',
    'Bến xe Miền Tây, 395 Kinh Dương Vương, Quận Bình Tân',
    10.7404,
    106.6195,
  ],
  'ben-xe-mien-dong': [
    'Thành phố Thủ Đức',
    'Bến xe Miền Đông mới, Quốc lộ 1A, TP Thủ Đức',
    10.879,
    106.8155,
  ],
  'ktx-khu-a': [
    'Thành phố Thủ Đức',
    'Ký túc xá khu A, Đại học Quốc gia, TP Thủ Đức',
    10.8783,
    106.806,
  ],
  'ktx-khu-b': [
    'Thành phố Thủ Đức',
    'Ký túc xá khu B, Đại học Quốc gia, TP Thủ Đức',
    10.8822,
    106.7826,
  ],
  'ga-suoi-tien': [
    'Thành phố Thủ Đức',
    'Ga metro Suối Tiên, Xa lộ Hà Nội, TP Thủ Đức',
    10.8665,
    106.8013,
  ],
  gigamall: ['Thành phố Thủ Đức', 'Gigamall, 240 Phạm Văn Đồng, TP Thủ Đức', 10.8273, 106.7213],
  'thao-dien': [
    'Thành phố Thủ Đức',
    'Khu Thảo Điền, đường Quốc Hương, TP Thủ Đức',
    10.803,
    106.735,
  ],
  'cho-thu-duc': [
    'Thành phố Thủ Đức',
    'Chợ Thủ Đức, đường Võ Văn Ngân, TP Thủ Đức',
    10.851,
    106.757,
  ],
  spkt: [
    'Thành phố Thủ Đức',
    'Đại học Sư phạm Kỹ thuật, 1 Võ Văn Ngân, TP Thủ Đức',
    10.8507,
    106.7719,
  ],
  'hoc-mon': ['Huyện Hóc Môn', 'Chợ Hóc Môn, Thị trấn Hóc Môn', 10.888, 106.594],
}

const at = (key) => {
  const place = PLACES[key]
  if (!place) throw new Error(`Không có địa điểm ${key}`)
  const [area, placeName, lat, lng] = place
  return { area, placeName, lat, lng }
}

// Đoạn đường: [khu vực, điểm đầu, điểm cuối, [lat, lng] đầu, [lat, lng] cuối]
const ROADS = {
  'dien-bien-phu': [
    'Quận Bình Thạnh',
    'Ngã tư Hàng Xanh, Quận Bình Thạnh',
    'Cầu Điện Biên Phủ, Quận 1',
    [10.801, 106.711],
    [10.7935, 106.7005],
  ],
  'vo-van-kiet': [
    'Quận 1',
    'Cầu Ông Lãnh, đại lộ Võ Văn Kiệt, Quận 1',
    'Cầu Chữ Y, đại lộ Võ Văn Kiệt, Quận 5',
    [10.7652, 106.6975],
    [10.7531, 106.6829],
  ],
  cmt8: [
    'Quận 3',
    'Ngã sáu Dân Chủ, Cách Mạng Tháng Tám, Quận 3',
    'Ngã tư Bảy Hiền, Quận Tân Bình',
    [10.7785, 106.6825],
    [10.7932, 106.6532],
  ],
  'nguyen-van-linh': [
    'Quận 7',
    'Cầu Ông Lớn, Nguyễn Văn Linh, Quận 7',
    'Cầu Phú Mỹ, Nguyễn Văn Linh, Quận 7',
    [10.7376, 106.6902],
    [10.7393, 106.7372],
  ],
  'xa-lo-ha-noi': [
    'Thành phố Thủ Đức',
    'Cầu Sài Gòn, Xa lộ Hà Nội, TP Thủ Đức',
    'Ngã tư Thủ Đức, TP Thủ Đức',
    [10.7983, 106.7298],
    [10.8497, 106.7735],
  ],
  'phan-van-tri': [
    'Quận Gò Vấp',
    'Ngã năm Nguyễn Kiệm, Phan Văn Trị, Quận Gò Vấp',
    'Cầu Rạch Lăng, Phan Văn Trị, Quận Bình Thạnh',
    [10.8169, 106.6789],
    [10.8202, 106.7006],
  ],
  'cong-hoa': [
    'Quận Tân Bình',
    'Ngã tư Lăng Cha Cả, Cộng Hòa, Quận Tân Bình',
    'Ngã ba Cộng Hòa - Trường Chinh, Quận Tân Bình',
    [10.7986, 106.6596],
    [10.8045, 106.6355],
  ],
  'nguyen-thi-minh-khai': [
    'Quận 3',
    'Ngã tư Nguyễn Thị Minh Khai - Hai Bà Trưng, Quận 1',
    'Ngã sáu Cộng Hòa, Quận 3',
    [10.7829, 106.6974],
    [10.7653, 106.6812],
  ],
}

const along = (key) => {
  const road = ROADS[key]
  if (!road) throw new Error(`Không có đoạn đường ${key}`)
  const [area, placeName, placeNameTo, from, to] = road
  return { area, placeName, placeNameTo, road: [from, to] }
}

module.exports = { at, along }
