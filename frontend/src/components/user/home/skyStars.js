// Lớp sao dùng chung cho header và thẻ nền trời, độ đậm lấy từ --au-star-opacity theo data-auth-time
export const SKY_STARS = [
  [8, 28],
  [21, 66],
  [34, 18],
  [47, 52],
  [58, 24],
  [69, 70],
  [81, 30],
  [92, 58],
]
  .map(([x, y]) => `radial-gradient(1.2px 1.2px at ${x}% ${y}%, #fff 50%, transparent 51%)`)
  .join(', ')
