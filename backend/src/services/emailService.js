const nodemailer = require('nodemailer')
const env = require('../config/env')

let transporter

const getTransporter = () => {
  if (transporter !== undefined) return transporter

  const { host, port, user, pass } = env.email
  transporter =
    host && user && pass
      ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
      : null
  return transporter
}

// Thiếu cấu hình SMTP thì in email ra console để vẫn chạy được khi dev,
// còn production thì báo lỗi vì in ra sẽ làm lộ mã vào log
const sendMail = async ({ to, subject, text, html }) => {
  const tx = getTransporter()
  if (!tx) {
    if (env.nodeEnv === 'production') throw new Error('SMTP is not configured')
    console.log(`[email:dev] to=${to} subject="${subject}"\n${text}`)
    return
  }
  await tx.sendMail({ from: `LostLink <${env.email.user}>`, to, subject, text, html })
}

const sendVerificationCode = ({ to, code, minutes }) =>
  sendMail({
    to,
    subject: 'Mã xác thực LostLink',
    text: `Mã xác thực của bạn là ${code}. Mã có hiệu lực trong ${minutes} phút.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Xác thực email LostLink</h2>
        <p>Nhập mã sau để kích hoạt tài khoản của bạn:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p>
        <p style="color:#666">Mã có hiệu lực trong ${minutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      </div>`,
  })

module.exports = { sendVerificationCode }
