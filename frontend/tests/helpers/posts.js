import { expect } from './auth.js'

// Tạo dữ liệu E2E qua API: lấy token, đăng bài, Moderator duyệt
const MODERATOR = { email: 'mod@lostlink.vn', password: 'Mod@1234' }
const BEN_THANH = { lat: 10.7725, lng: 106.698 }

const yesterday = () => {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}

export const tokenOf = async (api, { email, password }) => {
  const res = await api.post('auth/login', { data: { email, password } })
  expect(res.status()).toBe(200)
  return (await res.json()).data.accessToken
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` })

// Bài Ví & tiền, chọn sẵn giá trị đầu tiên cho thuộc tính bắt buộc
export async function createPost(api, token, { title, type = 'lost', approve = true }) {
  const categories = (await (await api.get('categories')).json()).data
  const wallet = categories.find((category) => category.slug === 'vi-tien')
  const attributes = wallet.attributes
    .filter((attribute) => attribute.isRequired)
    .map((attribute) => ({ attribute: attribute.id, value: attribute.values[0].id }))
  const payload = {
    type,
    category: wallet.slug,
    attributes,
    title,
    description: 'Ví da màu nâu, bên trong có thẻ sinh viên.',
    date: yesterday(),
    dayPart: 'morning',
    location: { mode: 'pin', area: 'Quận 1', point: BEN_THANH },
  }
  const res = await api.post('posts', {
    headers: bearer(token),
    multipart: { data: JSON.stringify(payload) },
  })
  expect(res.status()).toBe(201)
  const post = (await res.json()).data

  if (approve) {
    const modToken = await tokenOf(api, MODERATOR)
    const approved = await api.post(`moderator/posts/${post.id}/approve`, {
      headers: bearer(modToken),
    })
    expect(approved.status()).toBe(200)
  }
  return post
}
