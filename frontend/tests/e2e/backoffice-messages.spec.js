import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, tokenOf } from '../helpers/posts.js'
import { WEB_PORT } from '../setup/ports.js'

const ADMIN = { email: 'admin@lostlink.vn', password: 'Admin@123' }
const MODERATOR = { email: 'mod@lostlink.vn', password: 'Mod@1234' }
const CORS = {
  'Access-Control-Allow-Origin': `http://localhost:${WEB_PORT}`,
  'Access-Control-Allow-Credentials': 'true',
}
const THREAD_ID = '671126000000000000000001'
const SECOND_THREAD_ID = '671126000000000000000002'
const USER_ID = '671126000000000000000011'
const MODERATOR_ID = '671126000000000000000012'
const ADMIN_ID = '671126000000000000000013'

const contact = (id, username, role) => ({
  id,
  username,
  name: username,
  email: `${username}@lostlink.vn`,
  avatarUrl: '',
  role,
  description:
    role === 'user' ? 'Thành viên cộng đồng' : role === 'admin' ? 'Quản trị viên' : 'Moderator',
})

const userContact = contact(USER_ID, 'user.support', 'user')
const moderatorContact = contact(MODERATOR_ID, 'moderator02', 'moderator')
const adminContact = contact(ADMIN_ID, 'admin', 'admin')

const thread = (id, peer, fields = {}) => ({
  id,
  contactId: peer.id,
  unread: 1,
  priority: false,
  createdAt: '2026-11-19T08:00:00.000Z',
  lastMessage: {
    id: `${id.slice(-1).repeat(24)}`,
    sender: 'peer',
    text: 'Mình cần hỗ trợ.',
    image: null,
    createdAt: '2026-11-19T08:10:00.000Z',
  },
  messages: [],
  context: null,
  ...fields,
})

const detail = (id, peer, fields = {}) => ({
  id,
  contactId: peer.id,
  contact: peer,
  kind: 'support',
  supportType: peer.role === 'user' ? 'user' : 'internal',
  unread: 0,
  priority: false,
  createdAt: '2026-11-19T08:00:00.000Z',
  context: null,
  messages: [
    {
      id: '671126000000000000000021',
      sender: 'peer',
      senderId: peer.id,
      senderName: peer.username,
      text: 'Mình cần hỗ trợ.',
      image: null,
      createdAt: '2026-11-19T08:10:00.000Z',
    },
  ],
  hasMore: false,
  ...fields,
})

async function mockMessagesApi(page, { contacts = [], threads = [] } = {}) {
  const requests = []
  const inbox = [...threads]
  const knownContacts = [...contacts]
  const routeHandler = async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    requests.push({ path, search: url.search, method, request })
    const send = (data, status = 200) =>
      route.fulfill({ status, headers: CORS, json: { success: true, data } })

    if (path === '/api/backoffice/conversations' && method === 'GET') {
      return send({
        contacts: knownContacts,
        threads: inbox,
        pagination: { page: 1, limit: 100, total: inbox.length, pages: inbox.length ? 1 : 0 },
      })
    }
    if (path === '/api/backoffice/conversations/unread-count' && method === 'GET') {
      return send({ unreadCount: inbox.reduce((total, item) => total + item.unread, 0) })
    }
    if (path === '/api/backoffice/conversations/contacts' && method === 'GET') {
      const role = url.searchParams.get('peerRole')
      const q = (url.searchParams.get('q') || '').toLocaleLowerCase('vi')
      return send({
        items: knownContacts.filter(
          (item) =>
            (!role || item.role === role) &&
            `${item.username} ${item.email}`.toLocaleLowerCase('vi').includes(q)
        ),
      })
    }
    if (path === '/api/backoffice/conversations' && method === 'POST') {
      const targetId = request.postDataJSON().targetUserId
      const peer = knownContacts.find((item) => item.id === targetId)
      const created = detail(SECOND_THREAD_ID, peer, { messages: [] })
      const createdThread = thread(SECOND_THREAD_ID, peer, { unread: 0, messages: [] })
      inbox.unshift(createdThread)
      return send({ thread: created }, 200)
    }
    if (path.endsWith('/messages') && method === 'POST') {
      const body = request.postDataBuffer().toString('utf8')
      const text = body.match(/\{"body":"([^"]*)"\}/)?.[1] || ''
      const image = body.includes('image.png') || body.includes('image/jpeg')
      const conversationId = path.split('/')[4]
      const message = {
        id: '671126000000000000000031',
        conversationId,
        sender: 'me',
        senderId: ADMIN_ID,
        senderName: 'admin',
        text,
        image: image ? 'https://images.example.test/message.png' : null,
        createdAt: '2026-11-19T08:20:00.000Z',
      }
      const existing = inbox.find((item) => item.id === conversationId)
      if (existing) {
        existing.unread = 0
        existing.lastMessage = { ...message, sender: 'me' }
      }
      return send(message, 201)
    }
    const id = path.split('/')[4]
    if (path.endsWith('/read') || path.endsWith('/unread'))
      return send({ read: path.endsWith('/read') })
    if (path.endsWith('/priority')) {
      const selected = inbox.find((item) => item.id === id)
      if (selected) selected.priority = request.postDataJSON().value
      return send({ priority: request.postDataJSON().value })
    }
    if (method === 'GET' && id) {
      const selected = inbox.find((item) => item.id === id)
      if (selected) selected.unread = 0
      const peer = knownContacts.find((item) => item.id === selected?.contactId)
      return send({ thread: detail(id, peer) })
    }
    return route.fallback()
  }
  await page.route(/\/api\/backoffice\/conversations(?:\/[^?]*)?(?:\?.*)?$/, routeHandler)
  await page.route(/\/api\/backoffice\/action-locks(?:\/[^?]*)?$/, async (route) => {
    const request = route.request()
    const data =
      request.method() === 'POST'
        ? { acquired: true, changed: true, token: request.postDataJSON().token }
        : { released: true }
    await route.fulfill({
      status: 200,
      headers: CORS,
      json: { success: true, data },
    })
  })
  return { requests }
}

const openPage = async (page, path, account) => {
  await page.goto(path)
  await loginThroughUi(page, account)
  await expect(page.getByRole('region', { name: 'Danh sách hội thoại' })).toBeVisible()
}

const inbox = (page) => page.getByRole('region', { name: 'Danh sách hội thoại' })
const openThreadButton = (page, name) => inbox(page).getByRole('button', { name: new RegExp(name) })

test.describe('Tin nhắn của Admin và Moderator', () => {
  test('từ chối tài khoản thường ở cả trang và API', async ({ page, api }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, account)
    const response = await api.get('backoffice/conversations', { headers: bearer(token) })
    expect(response.status()).toBe(403)

    await page.goto('/admin/messages')
    await loginThroughUi(page, account)
    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Danh sách hội thoại' })).toHaveCount(0)
  })

  test('Admin xem hội thoại Moderator và bắt đầu trao đổi nội bộ', async ({ page }) => {
    const { requests } = await mockMessagesApi(page, { contacts: [moderatorContact] })
    await openPage(page, '/admin/messages', ADMIN)
    await page.getByRole('button', { name: 'Soạn tin mới' }).click()
    const dialog = page.getByRole('dialog', { name: 'Cuộc trò chuyện mới' })
    await expect(dialog.getByRole('button', { name: 'Moderator', exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: /moderator02/ }).click()
    await expect(page.getByRole('region', { name: /Trò chuyện với moderator02/ })).toBeVisible()
    expect(
      requests.some(({ path, method }) => path.endsWith('/contacts') && method === 'GET')
    ).toBe(true)
    expect(
      requests.some(({ path, method }) => path.endsWith('/conversations') && method === 'POST')
    ).toBe(true)
  })

  test('Moderator thấy hội thoại hỗ trợ của người dùng và hội thoại với Admin', async ({
    page,
  }) => {
    const { requests } = await mockMessagesApi(page, {
      contacts: [userContact, adminContact],
      threads: [thread(THREAD_ID, userContact), thread(SECOND_THREAD_ID, adminContact)],
    })
    await openPage(page, '/moderator/messages', MODERATOR)
    await expect(openThreadButton(page, 'user.support')).toBeVisible()
    await expect(inbox(page).getByRole('button', { name: /Admin .*Mình cần hỗ trợ/ })).toBeVisible()
    const searchRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/backoffice/conversations?') &&
        request.url().includes('q=user.support')
    )
    await page.getByRole('textbox', { name: 'Tìm hội thoại' }).fill('user.support')
    await searchRequest
    await expect(openThreadButton(page, 'user.support')).toBeVisible()
    await expect(inbox(page).getByRole('button', { name: /Admin .*Mình cần hỗ trợ/ })).toHaveCount(
      0
    )
    expect(
      requests.some(
        ({ path, method }) => path === '/api/backoffice/conversations' && method === 'GET'
      )
    ).toBe(true)
  })

  test('Moderator tìm người dùng và mở hội thoại hỗ trợ qua API', async ({ page }) => {
    const { requests } = await mockMessagesApi(page, { contacts: [userContact] })
    await openPage(page, '/moderator/messages', MODERATOR)
    await page.getByRole('button', { name: 'Soạn tin mới' }).click()
    const dialog = page.getByRole('dialog', { name: 'Cuộc trò chuyện mới' })
    await dialog.getByRole('button', { name: 'Người dùng', exact: true }).click()
    const contactsResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/backoffice/conversations/contacts?') &&
        response.url().includes('peerRole=user') &&
        response.url().includes('q=user.support') &&
        response.request().method() === 'GET'
    )
    await dialog.getByRole('textbox', { name: 'Tìm người nhận' }).fill('user.support')
    await contactsResponse
    await expect(dialog.getByRole('button', { name: /user\.support/ })).toBeVisible()
    await dialog.getByRole('button', { name: /user.support/ }).click()
    await expect(page.getByRole('region', { name: /Trò chuyện với user.support/ })).toBeVisible()
    expect(
      requests.some(
        ({ path, search }) => path.endsWith('/contacts') && search.includes('peerRole=user')
      )
    ).toBe(true)
    expect(
      requests.some(({ path, method }) => path.endsWith('/conversations') && method === 'POST')
    ).toBe(true)
  })

  test('sends messages and updates read and priority state', async ({ page }) => {
    const { requests } = await mockMessagesApi(page, {
      contacts: [moderatorContact],
      threads: [thread(THREAD_ID, moderatorContact)],
    })
    await openPage(page, '/admin/messages', ADMIN)
    await openThreadButton(page, 'moderator02').click()
    const composer = page.getByRole('textbox', { name: 'Tin nhắn cho moderator02' })
    await composer.fill('Mình đã kiểm tra hồ sơ.')
    await page.getByRole('button', { name: 'Gửi', exact: true }).click()
    await expect(
      page
        .getByRole('region', { name: 'Trò chuyện với moderator02' })
        .getByText('Mình đã kiểm tra hồ sơ.', { exact: true })
    ).toBeVisible()
    expect(
      requests.some(({ path, method }) => path.endsWith('/messages') && method === 'POST')
    ).toBe(true)

    await page.getByRole('button', { name: 'Đánh dấu ưu tiên' }).click()
    await expect(page.getByRole('button', { name: 'Bỏ ưu tiên' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.getByRole('button', { name: 'Đánh dấu chưa đọc' }).click()
    expect(
      requests.some(({ path, method }) => path.endsWith('/priority') && method === 'PATCH')
    ).toBe(true)
    expect(
      requests.some(({ path, method }) => path.endsWith('/unread') && method === 'PATCH')
    ).toBe(true)
  })

  test('gửi và xem ảnh đính kèm trong hội thoại', async ({ page }) => {
    const { requests } = await mockMessagesApi(page, {
      contacts: [userContact],
      threads: [thread(THREAD_ID, userContact)],
    })
    await openPage(page, '/moderator/messages', MODERATOR)
    await openThreadButton(page, 'user.support').click()
    await page.locator('input[aria-label="Chọn ảnh đính kèm"]').setInputFiles({
      name: 'image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test image bytes'),
    })
    await page.getByRole('button', { name: 'Gửi', exact: true }).click()
    const attached = page.getByRole('button', { name: 'Xem ảnh tin nhắn' })
    await expect(attached).toBeVisible()
    await attached.click()
    await expect(page.getByRole('dialog', { name: 'Ảnh trong tin nhắn' })).toBeVisible()
    expect(
      requests.some(({ path, method }) => path.endsWith('/messages') && method === 'POST')
    ).toBe(true)
  })
})
