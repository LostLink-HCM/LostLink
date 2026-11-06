import { createHash } from 'node:crypto'
import { test as base, expect } from '@playwright/test'
import { API_PORT, MAILBOX_PORT } from '../setup/ports.js'

export { expect }

export const PASSWORD = 'Secret@123'

// Mỗi test giả một IP riêng (backend tin X-Forwarded-For khi chạy E2E)
// để các test chạy song song không dùng chung hạn mức 20 yêu cầu/15 phút
const ipFor = (testInfo) => {
  const [a, b, c] = createHash('sha256').update(testInfo.testId).digest()
  return `10.${a}.${b}.${c}`
}

export const test = base.extend({
  context: async ({ context }, provide, testInfo) => {
    await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ipFor(testInfo) })
    await provide(context)
  },
  // Gọi thẳng API để chuẩn bị dữ liệu nhanh, không phải đi qua giao diện
  api: async ({ playwright }, provide, testInfo) => {
    const api = await playwright.request.newContext({
      baseURL: `http://localhost:${API_PORT}/api/`,
      extraHTTPHeaders: { 'X-Forwarded-For': ipFor(testInfo) },
    })
    await provide(api)
    await api.dispose()
  },
})

const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const newAccount = () => {
  const id = randomId()
  return { username: `e2e.${id}`, email: `e2e.${id}@example.com`, password: PASSWORD }
}

// Email mới nhất đã "gửi" tới địa chỉ này, đợi tối đa vài giây vì email được gửi bất đồng bộ
export async function latestMail(to, type) {
  const url = `http://localhost:${MAILBOX_PORT}/?to=${encodeURIComponent(to)}`
  for (let i = 0; i < 25; i += 1) {
    const mails = await (await fetch(url)).json()
    const mail = mails.filter((m) => m.type === type).at(-1)
    if (mail) return mail
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Không thấy email ${type} gửi tới ${to}`)
}

export async function mailCount(to) {
  const res = await fetch(`http://localhost:${MAILBOX_PORT}/?to=${encodeURIComponent(to)}`)
  return (await res.json()).length
}

// Tạo tài khoản qua API, mặc định đã xác thực email
export async function createAccount(api, { verified = true } = {}) {
  const account = newAccount()
  const res = await api.post('auth/register', { data: { ...account, acceptTerms: true } })
  expect(res.status()).toBe(201)
  if (verified) {
    const { code } = await latestMail(account.email, 'verify')
    const verify = await api.post('auth/verify-email', { data: { email: account.email, code } })
    expect(verify.status()).toBe(200)
  }
  return account
}

export async function loginThroughUi(page, { email, password }) {
  await page.getByLabel('EMAIL', { exact: true }).fill(email)
  await page.getByLabel('MẬT KHẨU', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
}
