import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, tokenOf } from '../helpers/posts.js'
import { WEB_PORT } from '../setup/ports.js'

const ADMIN = { email: 'admin@lostlink.vn', password: 'Admin@123' }
const CORS = {
  'Access-Control-Allow-Origin': `http://localhost:${WEB_PORT}`,
  'Access-Control-Allow-Credentials': 'true',
}
const endpoint = /\/api\/admin\/audit-logs(?:\?.*)?$/
const table = (page) => page.getByRole('table', { name: 'Nhật ký thao tác của Admin và Moderator' })
const rows = (page) => table(page).locator('tbody tr')
const filters = (page) => page.getByRole('region', { name: 'Bộ lọc nhật ký thao tác' })
const search = (page) => filters(page).getByRole('searchbox', { name: 'Tìm kiếm', exact: true })
const reset = (page) => filters(page).getByRole('button', { name: 'Đặt lại bộ lọc nhật ký' })
const waitForAudit = (page, params = {}) =>
  page.waitForResponse((response) => {
    if (!endpoint.test(response.url()) || response.request().method() !== 'GET') return false
    const query = new URL(response.url()).searchParams
    return Object.entries(params).every(([key, value]) => query.get(key) === value)
  })
const openAudit = async (page) => {
  await page.goto('/admin/audit-log')
  await loginThroughUi(page, ADMIN)
  await expect(table(page)).toBeVisible()
}

const mockJournal = async (page) => {
  const requests = []
  const entries = [
    {
      id: 'five',
      actorRole: 'admin',
      action: 'status',
      entityType: 'Post',
      createdAt: '2026-11-12T03:00:00Z',
      detail: { displayCode: 'L121126001', summary: 'Cập nhật trạng thái bài đăng' },
    },
    {
      id: 'four',
      actorRole: 'moderator',
      action: 'reject',
      entityType: 'Post',
      createdAt: '2026-11-11T03:00:00Z',
      detail: { displayCode: 'F111126001', summary: 'Từ chối bài đăng', reason: 'Ảnh bị mờ' },
    },
    {
      id: 'three',
      actorRole: 'moderator',
      action: 'hide',
      entityType: 'Post',
      createdAt: '2026-11-10T03:00:00Z',
      detail: { displayCode: 'F101126001', summary: 'Ẩn bài đăng' },
    },
    {
      id: 'two',
      actorRole: 'admin',
      action: 'lock',
      entityType: 'User',
      createdAt: '2026-11-09T03:00:00Z',
      detail: { displayCode: 'member', summary: 'Khóa tài khoản' },
    },
    {
      id: 'one',
      actorRole: 'system',
      action: 'restrict',
      entityType: 'User',
      createdAt: '2026-11-08T03:00:00Z',
      detail: { displayCode: 'member', summary: 'Hạn chế tài khoản' },
    },
  ].map((log) => ({
    ...log,
    actor: log.actorRole === 'system' ? null : { username: log.actorRole },
  }))
  await page.route(endpoint, async (route) => {
    const query = Object.fromEntries(new URL(route.request().url()).searchParams)
    requests.push(query)
    const matching = entries.filter((log) => {
      for (const key of ['actorRole', 'action', 'entityType'])
        if (query[key] && log[key] !== query[key]) return false
      const date = log.createdAt.slice(0, 10)
      if ((query.from && date < query.from) || (query.to && date > query.to)) return false
      return !query.q || `${log.detail.summary} ${log.detail.reason || ''}`.includes(query.q)
    })
    const pageSize = 2
    const totalPages = Math.max(1, Math.ceil(matching.length / pageSize))
    const currentPage = Math.min(Number(query.page || 1), totalPages)
    await route.fulfill({
      status: 200,
      headers: CORS,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: matching.slice((currentPage - 1) * pageSize, currentPage * pageSize),
          total: matching.length,
          page: currentPage,
          pageSize,
          totalPages,
        },
      }),
    })
  })
  return requests
}

test.describe('Nhật ký thao tác của admin', () => {
  test('đọc nhật ký thật sau thao tác khóa tài khoản, xem lý do và thay đổi trước/sau', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, ADMIN)
    const response = await api.get(`admin/users?q=${encodeURIComponent(account.username)}`, {
      headers: bearer(token),
    })
    expect(response.status()).toBe(200)
    const id = (await response.json()).data.items[0].id
    const locked = await api.patch(`admin/users/${id}/lock`, {
      headers: bearer(token),
      data: { reason: 'Cần xác minh thông tin tài khoản' },
    })
    expect(locked.status()).toBe(200)

    await openAudit(page)
    await search(page).fill(account.username)
    await expect(rows(page)).toHaveCount(1)
    const row = rows(page).first()
    await expect(row).toContainText(account.username)
    await expect(row).toContainText('Khóa tài khoản')
    await expect(row).toContainText('Lý do: Cần xác minh thông tin tài khoản')
    await row.getByText('Xem thay đổi', { exact: true }).click()
    await expect(row).toContainText('Trước: Hoạt động')
    await expect(row).toContainText('Sau: Đã khóa')
    await page.reload()
    await search(page).fill(account.username)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Cần xác minh thông tin tài khoản')
  })

  test('gọi API khi chuyển trang, kết hợp bộ lọc/tìm kiếm và đặt lại về trang đầu', async ({
    page,
  }) => {
    const requests = await mockJournal(page)
    await openAudit(page)
    await expect(rows(page)).toHaveCount(2)
    const pagination = page.getByRole('navigation', { name: 'Phân trang', exact: true })
    const secondPage = waitForAudit(page, { page: '2' })
    await pagination.getByRole('button', { name: 'Trang 2', exact: true }).click()
    expect((await secondPage).ok()).toBeTruthy()
    await expect(pagination).toContainText('Hiển thị 3–4 trong số 5 bản ghi')
    await expect(rows(page).first()).toContainText('F101126001')

    for (const [label, value, key] of [
      ['Vai trò', 'moderator', 'actorRole'],
      ['Hành động', 'reject', 'action'],
      ['Đối tượng', 'Post', 'entityType'],
    ]) {
      const response = waitForAudit(page, { [key]: value, page: '1' })
      await filters(page).getByRole('combobox', { name: label, exact: true }).selectOption(value)
      expect((await response).ok()).toBeTruthy()
    }
    for (const [label, key] of [
      ['Từ ngày', 'from'],
      ['Đến ngày', 'to'],
    ]) {
      const response = waitForAudit(page, { [key]: '2026-11-11' })
      await filters(page).getByLabel(label, { exact: true }).fill('2026-11-11')
      expect((await response).ok()).toBeTruthy()
    }
    const queried = waitForAudit(page, { q: 'Ảnh' })
    await search(page).fill('Ảnh')
    expect((await queried).ok()).toBeTruthy()
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('F111126001')
    expect(requests.at(-1)).toEqual({
      page: '1',
      q: 'Ảnh',
      actorRole: 'moderator',
      action: 'reject',
      entityType: 'Post',
      from: '2026-11-11',
      to: '2026-11-11',
    })

    await reset(page).click()
    await expect(search(page)).toHaveValue('')
    await expect(rows(page)).toHaveCount(2)
    await expect(pagination).toContainText('Hiển thị 1–2 trong số 5 bản ghi')
    expect(requests.at(-1)).toEqual({ page: '1' })
    await expect(
      filters(page).getByRole('button', { name: 'Xuất CSV', exact: true })
    ).toBeDisabled()
  })

  test('tải lỗi có thể thử lại; tìm không thấy hiển thị trạng thái rỗng và xóa bộ lọc được', async ({
    page,
  }) => {
    await mockJournal(page)
    await page.route(
      endpoint,
      (route) =>
        route.fulfill({
          status: 503,
          headers: CORS,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Nhật ký đang tạm thời không khả dụng.',
          }),
        }),
      { times: 1 }
    )
    await openAudit(page)
    await expect(page.getByRole('alert')).toContainText('Nhật ký đang tạm thời không khả dụng.')
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(rows(page)).toHaveCount(2)
    await search(page).fill('khong-co-nhat-ky')
    await expect(page.getByRole('heading', { name: 'Không có bản ghi phù hợp' })).toBeVisible()
    await expect(rows(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
    await expect(rows(page)).toHaveCount(2)
  })

  test('khoảng ngày sai hiển thị lỗi và chỉ gọi API lại sau khi sửa hợp lệ', async ({ page }) => {
    const requests = await mockJournal(page)
    await openAudit(page)
    await expect(rows(page)).toHaveCount(2)
    const from = filters(page).getByLabel('Từ ngày', { exact: true })
    const to = filters(page).getByLabel('Đến ngày', { exact: true })
    const first = waitForAudit(page, { from: '2026-11-12' })
    await from.fill('2026-11-12')
    expect((await first).ok()).toBeTruthy()
    await expect(rows(page)).toHaveCount(1)

    await to.fill('2026-11-10')
    await expect(page.getByRole('alert')).toContainText(
      'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'
    )
    await expect(to).toHaveAttribute('aria-invalid', 'true')
    await expect(rows(page)).toHaveCount(0)
    const corrected = waitForAudit(page, { from: '2026-11-12', to: '2026-11-12' })
    await to.fill('2026-11-12')
    expect((await corrected).ok()).toBeTruthy()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(rows(page)).toHaveCount(1)
    expect(
      requests.every((query) => !query.from || !query.to || query.from <= query.to)
    ).toBeTruthy()
  })

  test('phản hồi tìm kiếm cũ về chậm không ghi đè kết quả tìm kiếm mới', async ({ page }) => {
    await mockJournal(page)
    await openAudit(page)
    await expect(rows(page)).toHaveCount(2)
    let releaseSlow
    const gate = new Promise((resolve) => {
      releaseSlow = resolve
    })
    await page.route(endpoint, async (route) => {
      if (new URL(route.request().url()).searchParams.get('q') !== 'old-query') {
        await route.fallback()
        return
      }
      await gate
      await route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [], total: 0, page: 1, pageSize: 2, totalPages: 1 },
        }),
      })
    })
    try {
      const started = page.waitForRequest(
        (request) =>
          endpoint.test(request.url()) &&
          new URL(request.url()).searchParams.get('q') === 'old-query'
      )
      await search(page).fill('old-query')
      await started
      const latest = waitForAudit(page, { q: 'Ảnh' })
      await search(page).fill('Ảnh')
      expect((await latest).ok()).toBeTruthy()
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page).first()).toContainText('F111126001')

      const outdated = waitForAudit(page, { q: 'old-query' })
      releaseSlow()
      expect((await outdated).ok()).toBeTruthy()
      await page.waitForLoadState('networkidle')
      await expect(search(page)).toHaveValue('Ảnh')
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page).first()).toContainText('F111126001')
      await expect(
        page.getByRole('status').filter({ hasText: 'Đang tải nhật ký thao tác' })
      ).toHaveCount(0)
    } finally {
      releaseSlow()
    }
  })

  test('người dùng thường không được truy cập trang Nhật ký thao tác', async ({ page, api }) => {
    const account = await createAccount(api)
    await page.goto('/admin/audit-log')
    await loginThroughUi(page, account)
    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })).toBeVisible()
    await expect(table(page)).toHaveCount(0)
  })
})
