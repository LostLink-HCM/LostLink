// Các mục của trang Cài đặt, dùng cho menu bên trái (desktop) và danh sách mục (mobile)
export const SETTINGS_SECTIONS = [
  {
    to: 'account',
    label: 'Tài khoản',
    icon: 'lock',
    description: 'Email, mật khẩu, xóa tài khoản',
  },
  {
    to: 'notifications',
    label: 'Thông báo',
    icon: 'bell',
    description: 'Kênh nhận và loại thông báo',
  },
  {
    to: 'areas',
    label: 'Khu vực để ý',
    icon: 'pin',
    description: 'Vùng muốn nhận tin bài mới',
  },
]

// Màn từ breakpoint lg trở lên có menu bên trái, nhỏ hơn thì dùng danh sách mục
export const DESKTOP_QUERY = '(min-width: 64rem)'
