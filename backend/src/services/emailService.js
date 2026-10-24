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

// Gửi qua HTTPS
const sendViaBrevo = async ({ to, subject, text, html }) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.email.brevoApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'LostLink', email: env.email.from },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${await res.text()}`)
}

const sendMail = async ({ to, subject, text, html }) => {
  if (env.email.brevoApiKey) return sendViaBrevo({ to, subject, text, html })

  const tx = getTransporter()
  if (!tx) {
    if (env.nodeEnv === 'production') throw new Error('Email is not configured')
    console.log(`[email:dev] to=${to} subject="${subject}"\n${text}`)
    return
  }
  await tx.sendMail({ from: `LostLink <${env.email.from}>`, to, subject, text, html })
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

const sendResetLink = ({ to, resetUrl, minutes }) =>
  sendMail({
    to,
    subject: 'Đặt lại mật khẩu LostLink',
    text: `Mở liên kết sau để đặt lại mật khẩu: ${resetUrl} (hiệu lực ${minutes} phút).`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Đặt lại mật khẩu LostLink</h2>
        <p>Bấm vào nút bên dưới để chọn mật khẩu mới:</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#3B76D6;color:#fff;border-radius:8px;text-decoration:none">Đặt lại mật khẩu</a></p>
        <p style="color:#666">Liên kết có hiệu lực trong ${minutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      </div>`,
  })

module.exports = { sendVerificationCode, sendResetLink }
