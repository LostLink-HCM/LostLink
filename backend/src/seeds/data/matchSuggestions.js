// Các gợi ý ghép cặp minh họa giữa bài Mất đồ và Nhặt được trong posts.js.
// Điểm và breakdown là dữ liệu mẫu; liên kết bài được phân giải thành ObjectId khi chạy seed.
module.exports = [
  {
    lostTitle: 'Mất chùm chìa khóa có dao xếp Thụy Sĩ đỏ và remote ô tô',
    foundTitle: 'Nhặt được chìa khóa nhà có móc hình ngôi nhà',
    score: 0.55,
    breakdown: { location: 0.31, time: 0.42, category: 1, text: 0.71, image: 0.35 },
    state: 'pending',
  },
  {
    lostTitle: 'Túi tote vải xanh navy in vòng chữ cổ màu trắng',
    foundTitle: 'Nhặt được balo chống trộm màu xám trên tàu metro số 1',
    score: 0.57,
    breakdown: { location: 0.35, time: 0.91, category: 1, text: 0.62, image: 0.42 },
    state: 'pending',
  },
  {
    lostTitle: 'Rơi CCCD dọc đường Võ Văn Tần khi đi bộ ra trạm xe buýt',
    foundTitle: 'Nhặt được căn cước công dân ở ga quốc nội Tân Sơn Nhất',
    score: 0.68,
    breakdown: { location: 0.24, time: 0.8, category: 1, text: 0.82, image: 0.3 },
    state: 'pending',
  },
]
