// Bài đăng cộng đồng: tỉ lệ danh mục gần với bộ khảo sát bài Facebook (Ví & tiền nhiều nhất, rồi tới
// Giấy tờ & thẻ, Túi, Thiết bị...), có vài cặp mất/nhặt cùng một món để thử ghép cặp
module.exports = [
  ...require('./wallets'),
  ...require('./documents'),
  ...require('./devices'),
  ...require('./others'),
]
