// Các gợi ý ghép cặp minh họa giữa bài Mất đồ và Nhặt được trong posts.js.
// Điểm và breakdown là dữ liệu mẫu; liên kết bài được phân giải thành ObjectId khi chạy seed.
module.exports = [
  {
    lostTitle: 'Mất chìa khóa nhà có móc hình ngôi nhà ở Quận Gò Vấp',
    foundTitle: 'Nhặt được chìa khóa nhà có móc hình ngôi nhà',
    score: 0.78,
    breakdown: { location: 0.42, time: 0.52, category: 1, text: 0.96, image: 0.35 },
    state: 'pending',
  },
  {
    lostTitle: 'Túi tote vải xanh navy in vòng chữ cổ màu trắng',
    foundTitle: 'Nhặt được túi tote xanh ở sân bay Tân Sơn Nhất',
    score: 0.72,
    breakdown: { location: 0.28, time: 0.84, category: 1, text: 0.86, image: 0.42 },
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
