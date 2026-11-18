// Dữ liệu cố định của form Đăng bài: các buổi trong ngày và mốc thời gian gợi ý

// Mốc thời gian gần đúng trong ngày, giờ dùng để tính khoảng timeFrom - timeTo
// startHour khớp DAY_PART_HOURS ở backend (Ban đêm kéo sang 6 giờ sáng hôm sau)
export const DAY_PARTS = [
  { value: 'morning', label: 'Buổi sáng', hint: '6:00 – 11:00', startHour: 6 },
  { value: 'noon', label: 'Buổi trưa', hint: '11:00 – 14:00', startHour: 11 },
  { value: 'afternoon', label: 'Buổi chiều', hint: '14:00 – 18:00', startHour: 14 },
  { value: 'evening', label: 'Buổi tối', hint: '18:00 – 22:00', startHour: 18 },
  { value: 'night', label: 'Ban đêm', hint: '22:00 – 6:00', startHour: 22 },
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
