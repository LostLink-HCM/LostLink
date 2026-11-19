import { expect, loginThroughUi, test as base } from '../helpers/auth.js'
import { WEB_PORT } from '../setup/ports.js'
import { DEFAULT_SETTINGS, SETTINGS_KEYS_BY_TAB } from '../../src/lib/admin/settings.js'

const ADMIN = { email: 'admin@lostlink.vn', password: 'Admin@123' }
const CORS = {
  'Access-Control-Allow-Origin': `http://localhost:${WEB_PORT}`,
  'Access-Control-Allow-Credentials': 'true',
}
const tabs = (page) => page.getByRole('tablist', { name: 'Nhóm cấu hình hệ thống' })
const switchTab = (page, name) => tabs(page).getByRole('tab', { name, exact: true }).click()
const sidebar = (page, name) => page.locator('aside').getByRole('link', { name, exact: true })
const field = (page, key) => page.locator(`#setting-${key}`)
const saveButton = (page) => page.getByRole('button', { name: 'Lưu cấu hình', exact: true })
const unsavedDialog = (page) => page.getByRole('dialog', { name: 'Có thay đổi chưa lưu' })
const openSettings = async (page) => {
  await page.goto('/admin/settings')
  await loginThroughUi(page, ADMIN)
  await expect(tabs(page)).toBeVisible()
}
const confirmSave = async (page, suffix) => {
  await saveButton(page).click()
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/settings/${suffix}`) &&
      response.request().method() !== 'GET'
  )
  await page
    .getByRole('dialog', { name: 'Xác nhận' })
    .getByRole('button', { name: 'Lưu', exact: true })
    .click()
  expect((await response).ok()).toBeTruthy()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình.' })).toBeVisible()
}

const test = base.extend({
  settings: async ({ page }, provide) => {
    let nextId = 100
    const data = {
      values: { ...DEFAULT_SETTINGS, paginationPageSize: 4, reportDays: 9, mTime: 0.88 },
      quickReplies: {
        user: [
          { id: '507f1f77bcf86cd799439011', text: 'Mẫu trả lời đầu tiên' },
          { id: '507f1f77bcf86cd799439012', text: 'Mẫu trả lời thứ hai' },
        ],
        internal: [{ id: '507f1f77bcf86cd799439013', text: 'Mẫu trao đổi nội bộ' }],
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: { id: '507f1f77bcf86cd799439014', username: 'admin' },
      missing: { values: [], quickReplies: [] },
    }
    const requests = []
    await page.route(
      /\/api\/(?:admin\/settings|backoffice\/settings)(?:\/[^?]*)?(?:\?.*)?$/,
      async (route) => {
        const request = route.request()
        const path = new URL(request.url()).pathname
        const method = request.method()
        const body = request.postDataJSON()
        requests.push({ path, method, body })
        let result = data
        if (method === 'GET' && path.endsWith('/backoffice/settings')) {
          result = {
            paginationPageSize: data.values.paginationPageSize,
            quickReplies: data.quickReplies,
          }
        } else if (method === 'GET' && path.endsWith('/matching')) {
          result = {
            values: Object.fromEntries(
              SETTINGS_KEYS_BY_TAB.matching.map((key) => [key, data.values[key]])
            ),
          }
        } else if (method === 'PATCH') {
          Object.assign(data.values, body)
          data.updatedAt = new Date().toISOString()
        } else if (method === 'PUT') {
          data.quickReplies = Object.fromEntries(
            Object.entries(body).map(([group, replies]) => [
              group,
              replies.map(({ id, text }) => ({
                id: id || (++nextId).toString(16).padStart(24, '0'),
                text,
              })),
            ])
          )
          data.updatedAt = new Date().toISOString()
        }
        await route.fulfill({
          status: 200,
          headers: CORS,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: result }),
        })
      }
    )
    await provide({
      data,
      requests,
      writes: () => requests.filter(({ method }) => method !== 'GET'),
    })
  },
})

test.describe('Cấu hình hệ thống của admin', () => {
  test('tải các giá trị từ backend thật và hiển thị đầy đủ bốn tab', async ({ page, api }) => {
    await openSettings(page)
    const login = await api.post('auth/login', { data: ADMIN })
    expect(login.status()).toBe(200)
    const token = (await login.json()).data.accessToken
    const headers = { Authorization: `Bearer ${token}` }
    const beforeResponse = await api.get('admin/settings', {
      headers,
    })
    expect(beforeResponse.status()).toBe(200)
    const before = (await beforeResponse.json()).data
    expect([...before.missing.values].sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
    expect(before.missing.quickReplies).toEqual(['user', 'internal'])
    expect(before.updatedAt).toBeNull()
    await expect(
      page.getByRole('status').filter({ hasText: 'Cấu hình hệ thống chưa được khởi tạo đầy đủ.' })
    ).toBeVisible()
    await expect(field(page, 'mCategory')).toBeDisabled()

    const initializationResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/admin/settings/initialize') &&
        response.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Khởi tạo cấu hình mặc định' }).click()
    expect((await initializationResponse).ok()).toBeTruthy()
    await expect(
      page.getByRole('status').filter({ hasText: 'Cấu hình hệ thống chưa được khởi tạo đầy đủ.' })
    ).toHaveCount(0)

    const response = await api.get('admin/settings', {
      headers,
    })
    expect(response.status()).toBe(200)
    const { values, quickReplies, missing } = (await response.json()).data
    expect(missing).toEqual({ values: [], quickReplies: [] })
    await expect(tabs(page).getByRole('tab')).toHaveCount(4)
    for (const key of [
      'mCategory',
      'mTime',
      'mLocation',
      'mDescription',
      'mContents',
      'strongThreshold',
      'weakThreshold',
    ]) {
      await expect(field(page, key)).toHaveValue(String(values[key]))
    }
    await page.getByText('Nâng cao', { exact: true }).click()
    for (const key of ['priorOdds', 'timeTolerance', 'sMin'])
      await expect(field(page, key)).toHaveValue(String(values[key]))
    await switchTab(page, 'Thời hạn')
    for (const key of SETTINGS_KEYS_BY_TAB.timeThresholds)
      await expect(field(page, key)).toHaveValue(String(values[key]))
    await switchTab(page, 'Mẫu trả lời nhanh')
    for (const { text } of quickReplies.user)
      await expect(page.getByText(text, { exact: true })).toBeVisible()
    await switchTab(page, 'Phân trang')
    await expect(field(page, 'paginationPageSize')).toHaveValue(String(values.paginationPageSize))
    await expect(saveButton(page)).toBeDisabled()
  })

  test('tải đúng phạm vi cấu hình và áp dụng thời hạn/phân trang sau khi lưu', async ({
    page,
    settings,
  }) => {
    await page.goto('/admin/users')
    await loginThroughUi(page, ADMIN)
    await expect(page.getByRole('button', { name: 'Hồ sơ', exact: true })).toHaveCount(4)
    expect(settings.requests.filter(({ path }) => path === '/api/admin/settings')).toHaveLength(0)
    expect(
      settings.requests.filter(({ path }) => path === '/api/admin/settings/matching')
    ).toHaveLength(0)
    await sidebar(page, 'Danh mục').click()
    await expect(page.getByRole('tab', { name: 'Cấu hình thuật toán', exact: true })).toBeVisible()
    expect(
      settings.requests.filter(({ path }) => path === '/api/admin/settings/matching')
    ).toHaveLength(0)
    await page.getByRole('tab', { name: 'Cấu hình thuật toán', exact: true }).click()
    await expect
      .poll(
        () => settings.requests.filter(({ path }) => path === '/api/admin/settings/matching').length
      )
      .toBe(1)
    await sidebar(page, 'Cấu hình hệ thống').click()
    await expect(field(page, 'mTime')).toHaveValue('0.88')
    expect(settings.requests.filter(({ path }) => path === '/api/admin/settings')).toHaveLength(1)
    expect(settings.writes()).toHaveLength(0)
    await switchTab(page, 'Thời hạn')
    await field(page, 'reportDays').fill('12')
    await confirmSave(page, 'time-thresholds')
    expect(settings.writes()[0].body).toEqual({
      reportDays: 12,
      contactHours: 12,
      returnReminderDays: 7,
    })
    await switchTab(page, 'Phân trang')
    await field(page, 'paginationPageSize').fill('3')
    await confirmSave(page, 'pagination')
    expect(settings.writes()[1].body).toEqual({ paginationPageSize: 3 })
    await sidebar(page, 'Người dùng & quyền').click()
    await expect(page.getByRole('button', { name: 'Hồ sơ', exact: true })).toHaveCount(3)
    expect(settings.requests.filter(({ path }) => path === '/api/admin/settings')).toHaveLength(1)
  })

  test('chuẩn hóa .12, chờ xác nhận mới lưu đúng nhóm và giữ giá trị sau tải lại', async ({
    page,
    settings,
  }) => {
    await openSettings(page)
    await field(page, 'mTime').fill('.12')
    await field(page, 'mCategory').click()
    await expect(field(page, 'mTime')).toHaveValue('0.12')
    await saveButton(page).click()
    expect(settings.writes()).toHaveLength(0)
    await page
      .getByRole('dialog', { name: 'Xác nhận' })
      .getByRole('button', { name: 'Quay lại', exact: true })
      .click()
    await expect(field(page, 'mTime')).toHaveValue('0.12')
    await confirmSave(page, 'matching')
    expect(settings.writes()).toHaveLength(1)
    expect(settings.writes()[0].body).toEqual(
      Object.fromEntries(
        SETTINGS_KEYS_BY_TAB.matching.map((key) => [key, settings.data.values[key]])
      )
    )
    await expect(saveButton(page)).toBeDisabled()
    await page.reload()
    await expect(field(page, 'mTime')).toHaveValue('0.12')
  })

  test('thêm/sửa/xóa mẫu chỉ lưu xuống hệ thống sau xác nhận; nội dung trùng bị chặn', async ({
    page,
    settings,
  }) => {
    await openSettings(page)
    await switchTab(page, 'Mẫu trả lời nhanh')
    await page.getByLabel('Thêm mẫu trả lời', { exact: true }).fill('  Mẫu trả lời mới  ')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.getByText('Mẫu trả lời mới', { exact: true })).toBeVisible()
    await page.getByLabel('Thêm mẫu trả lời', { exact: true }).fill(' MẪU TRẢ LỜI MỚI ')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Mẫu trả lời đã tồn tại')
    await page.getByLabel('Thêm mẫu trả lời', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Chỉnh sửa mẫu trả lời', exact: true }).first().click()
    await page.locator('textarea:not(#new-quick-reply)').fill('Mẫu đầu tiên đã sửa')
    await page.getByRole('button', { name: 'Lưu', exact: true }).last().click()
    await page.getByRole('button', { name: 'Xóa mẫu trả lời', exact: true }).nth(1).click()
    await page
      .getByRole('dialog', { name: 'Xác nhận' })
      .getByRole('button', { name: 'Xóa', exact: true })
      .click()
    await page.getByRole('tab', { name: /^Nội bộ/ }).click()
    await page.getByRole('button', { name: 'Chỉnh sửa mẫu trả lời', exact: true }).click()
    await page.locator('textarea:not(#new-quick-reply)').fill('Mẫu nội bộ đã sửa')
    await page.getByRole('button', { name: 'Lưu', exact: true }).last().click()
    expect(settings.writes()).toHaveLength(0)
    await confirmSave(page, 'quick-replies')
    await page.route(/\/api\/backoffice\/conversations(?:\/[^?]*)?(?:\?.*)?$/, async (route) => {
      const path = new URL(route.request().url()).pathname
      const contact = {
        id: '507f1f77bcf86cd799439021',
        username: 'moderator.quick-replies',
        name: 'moderator.quick-replies',
        email: 'moderator.quick-replies@lostlink.vn',
        avatarUrl: '',
        role: 'moderator',
        description: 'Moderator',
      }
      const thread = {
        id: '671126000000000000000099',
        contactId: contact.id,
        unread: 0,
        priority: false,
        createdAt: '2026-11-19T08:00:00.000Z',
        lastMessage: {
          id: '671126000000000000000098',
          sender: 'peer',
          text: 'Open a conversation to check quick replies.',
          image: null,
          createdAt: '2026-11-19T08:10:00.000Z',
        },
        messages: [],
        context: null,
      }
      const data = path.endsWith('/' + thread.id)
        ? {
            thread: {
              ...thread,
              contact,
              kind: 'support',
              supportType: 'internal',
              status: 'open',
              messages: [],
              hasMore: false,
            },
          }
        : {
            contacts: [contact],
            threads: [thread],
            pagination: { page: 1, limit: 100, total: 1, pages: 1 },
          }
      await route.fulfill({ status: 200, headers: CORS, json: { success: true, data } })
    })
    const body = settings.writes()[0].body
    expect(body.user).toEqual([
      { id: '507f1f77bcf86cd799439011', text: 'Mẫu đầu tiên đã sửa' },
      { text: 'Mẫu trả lời mới' },
    ])
    expect(body.internal).toEqual([{ id: '507f1f77bcf86cd799439013', text: 'Mẫu nội bộ đã sửa' }])
    await sidebar(page, 'Tin nhắn').click()
    await page.getByRole('button', { name: /moderator\.quick-replies/ }).click()
    await page.getByRole('button', { name: 'Trả lời nhanh', exact: true }).click()
    await expect(
      page.locator('#quick-replies').getByRole('button', { name: 'Mẫu nội bộ đã sửa', exact: true })
    ).toBeVisible()
    await expect(
      page.locator('#quick-replies').getByText('Mẫu trả lời thứ hai', { exact: true })
    ).toHaveCount(0)
  })

  test('hủy thay đổi và cảnh báo chưa lưu khi chuyển tab hoặc rời trang', async ({
    page,
    settings,
  }) => {
    await openSettings(page)
    await field(page, 'mTime').fill('0.2')
    await page.getByRole('button', { name: 'Hủy thay đổi', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Xác nhận' })
      .getByRole('button', { name: 'Hủy', exact: true })
      .click()
    await expect(field(page, 'mTime')).toHaveValue('0.88')
    await expect(saveButton(page)).toBeDisabled()

    await page.getByText('Nâng cao', { exact: true }).click()
    await field(page, 'sMin').fill('0.12')
    await page.getByText('Nâng cao', { exact: true }).click()
    await switchTab(page, 'Thời hạn')
    await unsavedDialog(page).getByRole('button', { name: 'Ở lại', exact: true }).click()
    await expect(field(page, 'sMin')).toBeVisible()
    await expect(field(page, 'sMin')).toHaveValue('0.12')
    await switchTab(page, 'Thời hạn')
    await unsavedDialog(page).getByRole('button', { name: 'Chuyển tab', exact: true }).click()
    await expect(field(page, 'reportDays')).toHaveValue('9')
    await switchTab(page, 'Ghép cặp')
    await expect(field(page, 'sMin')).toHaveValue('0.05')

    await field(page, 'mTime').fill('0.2')
    await sidebar(page, 'Người dùng & quyền').click()
    await unsavedDialog(page).getByRole('button', { name: 'Ở lại', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/settings$/)
    await expect(field(page, 'mTime')).toHaveValue('0.2')
    await sidebar(page, 'Người dùng & quyền').click()
    await unsavedDialog(page).getByRole('button', { name: 'Rời trang', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/users$/)
    await sidebar(page, 'Cấu hình hệ thống').click()
    await expect(field(page, 'mTime')).toHaveValue('0.88')
    expect(settings.writes()).toHaveLength(0)
  })

  test('tải cấu hình lỗi có thể thử lại; lưu lỗi giữ dữ liệu nhập để lưu lại', async ({
    page,
    settings,
  }) => {
    await page.route(
      /\/api\/admin\/settings$/,
      (route) =>
        route.fulfill({
          status: 503,
          headers: CORS,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Tạm thời không tải được cấu hình.' }),
        }),
      { times: 1 }
    )
    await page.goto('/admin/settings')
    await loginThroughUi(page, ADMIN)
    await expect(page.getByRole('alert')).toContainText('Tạm thời không tải được cấu hình.')
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(field(page, 'mTime')).toHaveValue('0.88')
    await field(page, 'mTime').fill('0.2')
    await page.route(
      /\/api\/admin\/settings\/matching$/,
      (route) =>
        route.fulfill({
          status: 503,
          headers: CORS,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Tạm thời không lưu được cấu hình.' }),
        }),
      { times: 1 }
    )
    await saveButton(page).click()
    await page
      .getByRole('dialog', { name: 'Xác nhận' })
      .getByRole('button', { name: 'Lưu', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('Tạm thời không lưu được cấu hình.')
    await expect(field(page, 'mTime')).toHaveValue('0.2')
    await expect(saveButton(page)).toBeEnabled()
    expect(settings.data.values.mTime).toBe(0.88)
    await confirmSave(page, 'matching')
    expect(settings.data.values.mTime).toBe(0.2)
  })
})
