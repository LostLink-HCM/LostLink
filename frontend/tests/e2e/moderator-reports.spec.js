import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'

const MODERATOR = { email: 'mod@lostlink.vn', password: 'Mod@1234' }
const endpoint = /\/api\/moderator\/reports(?:\/[^?]+)?(?:\?.*)?$/
const table = (page) => page.getByRole('table', { name: 'Hàng đợi report cần xử lý' })
const filters = (page) => page.getByRole('region', { name: 'Bộ lọc hàng đợi' })

const postReport = (overrides = {}) => ({
  id: 'report-post-1',
  targetType: 'post',
  target: {
    id: 'post-1',
    code: 'F181126001',
    title: 'Nhặt được ví ở Quận 1',
    isHidden: false,
    owner: { id: 'owner-1', username: 'reportowner', role: 'user', status: 'active' },
  },
  reporter: { id: 'reporter-1', username: 'reporter' },
  reason: 'spam',
  description: 'Nội dung cần kiểm tra.',
  screenshots: [],
  severity: 'medium',
  status: 'pending',
  action: null,
  warningCount: 0,
  relatedHistory: [],
  createdAt: '2026-11-18T01:30:00.000Z',
  ...overrides,
})

const userReport = (overrides = {}) => ({
  ...postReport(),
  id: 'report-user-1',
  targetType: 'user',
  target: { id: 'owner-1', username: 'reportowner', role: 'user', status: 'active' },
  displayCode: undefined,
  targetTitle: undefined,
  ...overrides,
})

const listData = (items, page = 1, pageSize = 10, _total = items.length) => ({
  items,
  total: _total,
  page,
  pageSize,
  totalPages: Math.max(1, Math.ceil(_total / pageSize)),
})

const mockReports = async (page, { items = [], detail, pageSize = 10 } = {}) => {
  let currentItems = items
  let firstListFailure = false
  const requests = []
  await page.route(endpoint, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const id = path.split('/').at(-1)

    if (request.method() === 'PATCH' && path.endsWith('/resolve')) {
      const body = request.postDataJSON()
      requests.push({ method: 'PATCH', body })
      currentItems = []
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id,
            status: body.action === 'dismiss' ? 'dismissed' : 'resolved',
            action: body.action,
          },
        }),
      })
      return
    }
    if (request.method() !== 'GET') return route.continue()
    if (id && id !== 'reports') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: detail }),
      })
      return
    }

    const query = Object.fromEntries(url.searchParams)
    requests.push({ method: 'GET', query })
    if (firstListFailure) {
      firstListFailure = false
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Danh sách report tạm thời không khả dụng.',
        }),
      })
      return
    }
    const filtered = currentItems.filter((item) => {
      if (query.targetType && item.targetType !== query.targetType) return false
      if (query.severity && item.severity !== query.severity) return false
      return (
        !query.q ||
        `${item.target.title || item.target.username} ${item.reporter.username}`.includes(query.q)
      )
    })
    const currentPage = Number(query.page || 1)
    const responseItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: listData(responseItems, currentPage, pageSize, filtered.length),
      }),
    })
  })
  return { requests, failNextList: () => (firstListFailure = true) }
}

const openReports = async (page) => {
  await page.goto('/moderator/reports')
  await loginThroughUi(page, MODERATOR)
  await expect(table(page)).toBeVisible()
}

test.describe('Hàng đợi report của moderator', () => {
  test('người dùng thường không được truy cập hàng đợi report', async ({ page, api }) => {
    const account = await createAccount(api)
    await page.goto('/moderator/reports')
    await loginThroughUi(page, account)
    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })).toBeVisible()
    await expect(table(page)).toHaveCount(0)
  })

  test('tải danh sách, tìm kiếm, lọc và chuyển trang bằng API', async ({ page }) => {
    const first = userReport({
      id: 'report-first',
      target: { id: 'owner-1', username: 'reportfirst', role: 'user', status: 'active' },
    })
    const second = userReport({
      id: 'report-second',
      target: { id: 'owner-2', username: 'reportsecond', role: 'user', status: 'active' },
    })
    const mocked = await mockReports(page, { items: [first, second], pageSize: 1, total: 2 })
    await openReports(page)

    await expect(page.getByText('Hiển thị 1–1 trong số 2 report')).toBeVisible()
    await expect(filters(page).getByRole('combobox', { name: 'Loại Report' })).toHaveValue('user')
    await expect(
      table(page).getByRole('link', { name: first.target.username, exact: true })
    ).toBeVisible()
    await filters(page).getByRole('searchbox', { name: 'Tìm kiếm' }).fill('reportsecond')
    await expect(
      table(page).getByRole('link', { name: second.target.username, exact: true })
    ).toBeVisible()
    await filters(page).getByRole('combobox', { name: 'Loại Report' }).selectOption('user')
    await filters(page)
      .getByRole('combobox', { name: 'Mức độ nghiêm trọng' })
      .selectOption('medium')
    await expect(page.getByRole('button', { name: 'Trang 2' })).toHaveCount(0)
    await filters(page).getByRole('searchbox', { name: 'Tìm kiếm' }).fill('')
    await page.getByRole('button', { name: 'Trang 2' }).click()
    await expect(
      table(page).getByRole('link', { name: second.target.username, exact: true })
    ).toBeVisible()
    expect(mocked.requests.some(({ query }) => query?.page === '2')).toBeTruthy()
  })

  test('mở chi tiết và hiển thị nội dung, ảnh bằng chứng, lịch sử report', async ({ page }) => {
    const detail = postReport({
      description: 'Mô tả chi tiết bài đăng.',
      screenshots: ['https://example.com/evidence.jpg'],
      target: {
        ...postReport().target,
        description: 'Mô tả chi tiết bài đăng.',
      },
      relatedHistory: [
        {
          id: 'old-report',
          reason: 'spam',
          reporter: { username: 'oldreporter' },
          severity: 'low',
          createdAt: '2026-11-17T01:30:00.000Z',
        },
      ],
    })
    await mockReports(page, { items: [postReport()], detail })
    await openReports(page)
    await filters(page).getByRole('combobox', { name: 'Loại Report' }).selectOption('post')
    const row = table(page).getByRole('row').filter({ hasText: detail.target.title })
    await row.getByRole('button', { name: /Xem report/ }).click()

    const dialog = page.getByRole('dialog', { name: 'Chi tiết Report' })
    await expect(dialog).toContainText('Mô tả chi tiết bài đăng.')
    await expect(dialog.getByAltText('Bằng chứng report')).toBeVisible()
    await expect(dialog).toContainText('oldreporter')
  })

  test('cảnh cáo yêu cầu lý do, gọi API và xóa report khỏi hàng đợi', async ({ page }) => {
    const report = userReport()
    const mocked = await mockReports(page, { items: [report], detail: report })
    await openReports(page)
    const row = table(page)
      .getByRole('row')
      .filter({ hasText: report.displayCode || 'reportowner' })
    await row.getByRole('button', { name: /Cảnh cáo/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Gửi cảnh cáo' })
    await dialog.getByRole('button', { name: 'Gửi' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Vui lòng nhập lý do')
    await dialog.getByRole('textbox', { name: 'Nội dung' }).fill('Cần xác minh tài khoản')
    await dialog.getByRole('button', { name: 'Gửi' }).click()
    await expect(page.getByRole('status')).toContainText('Đã cảnh cáo')
    await expect(row).toHaveCount(0)
    expect(mocked.requests.findLast(({ method }) => method === 'PATCH').body).toEqual({
      action: 'warn',
      reason: 'Cần xác minh tài khoản',
    })
  })

  test('ẩn bài đăng yêu cầu lý do và gửi đúng thao tác hide', async ({ page }) => {
    const report = postReport()
    const mocked = await mockReports(page, { items: [report], detail: report })
    await openReports(page)
    await filters(page).getByRole('combobox', { name: 'Loại Report' }).selectOption('post')
    const row = table(page).getByRole('row').filter({ hasText: report.target.code })
    await row.getByRole('button', { name: /Ẩn bài/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Ẩn bài đăng' })
    await dialog.getByRole('textbox', { name: 'Lý do' }).fill('Thông tin cần xác minh')
    await dialog.getByRole('button', { name: 'Xác nhận' }).click()
    await expect(page.getByRole('status')).toContainText('Đã ẩn bài')
    await expect(row).toHaveCount(0)
    expect(mocked.requests.findLast(({ method }) => method === 'PATCH').body).toEqual({
      action: 'hide',
      reason: 'Thông tin cần xác minh',
    })
  })

  test('hiển thị lỗi tải, cho phép thử lại và đặt lại bộ lọc', async ({ page }) => {
    const report = userReport()
    const mocked = await mockReports(page, { items: [report], detail: report })
    mocked.failNextList()
    await page.goto('/moderator/reports')
    await loginThroughUi(page, MODERATOR)
    await expect(page.getByRole('alert')).toContainText('Danh sách report tạm thời không khả dụng.')
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(table(page)).toBeVisible()
    const search = filters(page).getByRole('searchbox', { name: 'Tìm kiếm' })
    await search.fill('không tồn tại')
    await expect(
      page.getByText('Không có report nào chưa xử lý trong danh sách này.')
    ).toBeVisible()
    await filters(page).getByRole('button', { name: 'Đặt lại bộ lọc' }).click()
    await expect(search).toHaveValue('')
    await expect(
      table(page).getByRole('link', { name: report.target.username, exact: true })
    ).toBeVisible()
  })
})
