// Khu vực để ý mẫu (GeofenceSubscription): tâm trên bản đồ minh hoạ (%), bán kính theo mét.
// name chỉ để hiển thị cho dễ nhận ra, model chưa có trường này
export const createWatchAreas = () => [
  {
    id: 'area-1',
    name: 'Phố đi bộ Nguyễn Huệ',
    point: { x: 54, y: 44 },
    radius: 3000,
    active: true,
  },
  {
    id: 'area-2',
    name: 'Đại học Bách Khoa, 268 Lý Thường Kiệt',
    point: { x: 28, y: 54 },
    radius: 1000,
    active: false,
  },
]

// Email đã có người dùng, để thử luồng đổi email bị trùng
export const TAKEN_EMAILS = ['admin@lostlink.vn', 'mod@lostlink.vn', 'user@lostlink.vn']
