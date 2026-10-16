// Dữ liệu mẫu cho form Đăng bài, sau này lấy từ API danh mục do Admin quản lý

const COLORS = [
  'Đen',
  'Trắng',
  'Xám',
  'Bạc',
  'Nâu',
  'Đỏ',
  'Hồng',
  'Vàng',
  'Xanh lá',
  'Xanh dương',
  'Nhiều màu',
]

const color = { key: 'color', label: 'Màu chủ đạo', options: COLORS }

export const CATEGORY_ATTRIBUTES = {
  'Giấy tờ & thẻ': [
    {
      key: 'docType',
      label: 'Loại giấy tờ',
      options: [
        'CCCD/CMND',
        'Bằng lái xe',
        'Giấy tờ xe',
        'Thẻ sinh viên',
        'Thẻ ngân hàng',
        'Hộ chiếu',
        'Khác',
      ],
    },
  ],
  'Ví & tiền': [
    { key: 'material', label: 'Chất liệu', options: ['Da', 'Vải', 'Nhựa', 'Khác'] },
    color,
  ],
  'Túi & balo': [
    {
      key: 'bagType',
      label: 'Loại túi',
      options: ['Balo', 'Túi xách', 'Túi tote', 'Túi đeo chéo', 'Vali', 'Khác'],
    },
    color,
  ],
  'Thiết bị điện tử': [
    {
      key: 'deviceType',
      label: 'Loại thiết bị',
      options: [
        'Điện thoại',
        'Máy tính bảng',
        'Laptop',
        'Tai nghe',
        'Đồng hồ thông minh',
        'Máy ảnh',
        'Khác',
      ],
    },
    {
      key: 'brand',
      label: 'Hãng',
      options: ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Sony', 'Khác'],
    },
    color,
  ],
  'Chìa khóa & xe cộ': [
    {
      key: 'keyType',
      label: 'Loại',
      options: ['Chìa khóa nhà', 'Chìa khóa xe máy', 'Chìa khóa ô tô', 'Xe máy', 'Xe đạp'],
    },
  ],
  'Trang sức & phụ kiện': [
    {
      key: 'accessoryType',
      label: 'Loại',
      options: ['Nhẫn', 'Dây chuyền', 'Bông tai', 'Lắc tay', 'Đồng hồ', 'Kính', 'Khác'],
    },
    color,
  ],
  'Thú cưng': [
    { key: 'species', label: 'Loài', options: ['Chó', 'Mèo', 'Chim', 'Khác'], exclusion: true },
    color,
  ],
  Khác: [color],
}

// Danh mục vật chứa có thêm checklist "Bên trong có", ghép cặp theo phần giao nhau
export const CONTAINER_ITEMS = {
  'Ví & tiền': [
    'Tiền mặt',
    'CCCD/CMND',
    'Bằng lái xe',
    'Thẻ ngân hàng',
    'Thẻ sinh viên',
    'Ảnh',
    'Danh thiếp',
  ],
  'Túi & balo': [
    'Ví',
    'Điện thoại',
    'Laptop',
    'Giấy tờ tùy thân',
    'Chìa khóa',
    'Sách vở',
    'Mỹ phẩm',
    'Quần áo',
  ],
}

// Mốc thời gian gần đúng trong ngày, giờ dùng để tính khoảng timeFrom - timeTo
export const DAY_PARTS = [
  { value: 'morning', label: 'Buổi sáng', hint: '6:00 – 11:00' },
  { value: 'noon', label: 'Buổi trưa', hint: '11:00 – 14:00' },
  { value: 'afternoon', label: 'Buổi chiều', hint: '14:00 – 18:00' },
  { value: 'evening', label: 'Buổi tối', hint: '18:00 – 22:00' },
  { value: 'night', label: 'Ban đêm', hint: '22:00 – 6:00' },
]

// Mốc gần đúng như bản cũ: lùi bao nhiêu ngày và buổi nào ('now' = buổi hiện tại)
export const TIME_PRESETS = [
  { label: 'Vừa mới đây', daysAgo: 0, dayPart: 'now' },
  { label: 'Sáng nay', daysAgo: 0, dayPart: 'morning' },
  { label: 'Chiều nay', daysAgo: 0, dayPart: 'afternoon' },
  { label: 'Tối nay', daysAgo: 0, dayPart: 'evening' },
  { label: 'Sáng hôm qua', daysAgo: 1, dayPart: 'morning' },
  { label: 'Chiều hôm qua', daysAgo: 1, dayPart: 'afternoon' },
  { label: 'Tối hôm qua', daysAgo: 1, dayPart: 'evening' },
  { label: 'Hôm kia', daysAgo: 2, dayPart: '' },
  { label: 'Khoảng 3 ngày trước', daysAgo: 3, dayPart: '' },
  { label: 'Khoảng một tuần trước', daysAgo: 7, dayPart: '' },
  { label: 'Hai tuần trước', daysAgo: 14, dayPart: '' },
  { label: 'Một tháng trước', daysAgo: 30, dayPart: '' },
]

export const LOCATION_MODES = [
  { value: 'gps', label: 'Dùng vị trí hiện tại' },
  { value: 'pin', label: 'Kéo ghim trên bản đồ' },
  { value: 'address', label: 'Gõ địa chỉ' },
  { value: 'road', label: 'Chọn đoạn đường' },
]

// Kết quả tìm địa chỉ mẫu; x, y là vị trí (%) trên bản đồ minh họa
export const PLACES = [
  { label: 'Phố đi bộ Nguyễn Huệ', area: 'Quận 1', x: 54, y: 44 },
  { label: 'Chợ Bến Thành', area: 'Quận 1', x: 46, y: 52 },
  { label: 'Hồ Con Rùa', area: 'Quận 3', x: 40, y: 36 },
  { label: 'Trạm xe buýt Nguyễn Thị Minh Khai', area: 'Quận 3', x: 36, y: 46 },
  { label: 'Crescent Mall', area: 'Quận 7', x: 62, y: 72 },
  { label: 'Đại học Bách Khoa, 268 Lý Thường Kiệt', area: 'Quận 10', x: 28, y: 54 },
  { label: 'Landmark 81', area: 'Bình Thạnh', x: 68, y: 30 },
  { label: 'Công viên Gia Định', area: 'Gò Vấp', x: 44, y: 18 },
  { label: 'Sân bay Tân Sơn Nhất', area: 'Tân Bình', x: 30, y: 22 },
  { label: 'Đại học Sư phạm Kỹ thuật, 1 Võ Văn Ngân', area: 'TP. Thủ Đức', x: 80, y: 20 },
]

// line: hai đầu đoạn đường (%) trên bản đồ minh họa
export const ROAD_SEGMENTS = [
  {
    id: 'nguyen-hue',
    road: 'Nguyễn Huệ',
    from: 'Lê Lợi',
    to: 'Tôn Đức Thắng',
    area: 'Quận 1',
    line: [50, 36, 58, 56],
  },
  {
    id: 'le-loi',
    road: 'Lê Lợi',
    from: 'Pasteur',
    to: 'Nam Kỳ Khởi Nghĩa',
    area: 'Quận 1',
    line: [38, 50, 56, 44],
  },
  {
    id: 'nguyen-thi-minh-khai',
    road: 'Nguyễn Thị Minh Khai',
    from: 'Hai Bà Trưng',
    to: 'Cách Mạng Tháng 8',
    area: 'Quận 3',
    line: [24, 52, 46, 38],
  },
  {
    id: 'nguyen-van-linh',
    road: 'Nguyễn Văn Linh',
    from: 'Nguyễn Hữu Thọ',
    to: 'Huỳnh Tấn Phát',
    area: 'Quận 7',
    line: [44, 78, 76, 70],
  },
  {
    id: 'xo-viet-nghe-tinh',
    road: 'Xô Viết Nghệ Tĩnh',
    from: 'Điện Biên Phủ',
    to: 'Ung Văn Khiêm',
    area: 'Bình Thạnh',
    line: [58, 40, 64, 18],
  },
  {
    id: 'vo-van-ngan',
    road: 'Võ Văn Ngân',
    from: 'Đặng Văn Bi',
    to: 'Kha Vạn Cân',
    area: 'TP. Thủ Đức',
    line: [70, 26, 92, 16],
  },
]
