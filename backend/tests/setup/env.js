// Nạp bằng --require trước mọi file test, vì config/env.js đọc biến môi trường lúc require
process.env.NODE_ENV = 'test'
process.env.MONGO_URI = process.env.MONGO_TEST_URI
process.env.JWT_SECRET = 'test-access-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
process.env.JWT_EXPIRE = '15m'
process.env.JWT_REFRESH_EXPIRE = '7d'
process.env.ANSWER_HASH_SECRET = 'test-answer-secret'
process.env.GOOGLE_CLIENT_ID = 'test-google-client'
process.env.CLIENT_URL = 'http://localhost:8080'
// Giả lập mã commit mà CI gắn vào image, /api/health trả lại giá trị này
process.env.APP_VERSION = 'test-commit-sha'
// Tin 1 proxy để test giả lập IP khác nhau qua X-Forwarded-For, mỗi test có hạn mức riêng
process.env.TRUST_PROXY = '1'
// Không gửi email hay báo lỗi ra ngoài khi chạy test. Đặt chuỗi rỗng chứ không xoá,
// vì dotenv chỉ bỏ qua biến đã tồn tại, xoá đi thì nó lại nạp giá trị thật từ backend/.env
process.env.BREVO_API_KEY = ''
process.env.EMAIL_HOST = ''
process.env.SENTRY_DSN = ''
