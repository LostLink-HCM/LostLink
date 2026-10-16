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
