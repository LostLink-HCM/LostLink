import { expect, loginThroughUi, test } from '../helpers/auth.js'
import { WEB_PORT } from '../setup/ports.js'

const ADMIN = { email: 'admin@lostlink.vn', password: 'Admin@123' }
const MODERATOR = { email: 'mod@lostlink.vn', password: 'Mod@1234' }
const CORS = {
  'Access-Control-Allow-Origin': `http://localhost:${WEB_PORT}`,
  'Access-Control-Allow-Credentials': 'true',
}

const notification = (overrides = {}) => ({
  id: 'notification-1',
  type: 'system',
  eventType: 'backoffice_message',
  title: 'Tin nhắn mới từ Moderator moderator02',
  body: 'Bạn có tin nhắn mới cần xem.',
  createdAt: '2026-11-21T10:00:00.000Z',
  unread: true,
  pinned: false,
  actionLabel: 'Mở tin nhắn',
  href: '/admin/messages',
  ...overrides,
})

async function mockBackofficeNotifications(page, initialItems, { failListCount = 0 } = {}) {
  const items = initialItems.map((item) => ({ ...item }))
  const requests = []
  let listFailuresRemaining = failListCount

  await page.route('**/api/backoffice/notifications**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname.replace(/\/$/, '')
    const method = request.method()
    const json = (data) =>
      route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      })

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...CORS,
          'Access-Control-Allow-Headers': 'authorization,content-type',
          'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
        },
      })
    }

    requests.push({ method, pathname, query: Object.fromEntries(url.searchParams) })

    if (method === 'GET' && pathname.endsWith('/unread-count')) {
      return json({ unreadCount: items.filter((item) => item.unread).length })
    }

    if (method === 'GET') {
      if (listFailuresRemaining > 0) {
        listFailuresRemaining -= 1
        return route.fulfill({
          status: 503,
          headers: CORS,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Máy chủ thông báo tạm thời không khả dụng.',
          }),
        })
      }
      const status = url.searchParams.get('status') || 'all'
      const type = url.searchParams.get('type') || 'all'
      const query = (url.searchParams.get('q') || '').toLocaleLowerCase('vi')
      const from = url.searchParams.get('from') || ''
      const to = url.searchParams.get('to') || ''
      const matching = items
        .filter((item) => status !== 'unread' || item.unread)
        .filter((item) => status !== 'pinned' || item.pinned)
        .filter((item) => type === 'all' || item.type === type)
        .filter(
          (item) => !query || `${item.title} ${item.body}`.toLocaleLowerCase('vi').includes(query)
        )
        .filter((item) => {
          const date = item.createdAt.slice(0, 10)
          return (!from || date >= from) && (!to || date <= to)
        })
        .sort(
          (left, right) =>
            Number(right.pinned) - Number(left.pinned) ||
            new Date(right.createdAt) - new Date(left.createdAt)
        )
      const pageNumber = Number(url.searchParams.get('page') || 1)
      const limit = Number(url.searchParams.get('limit') || 5)
      const pages = Math.ceil(matching.length / limit)

      return json({
        items: matching.slice((pageNumber - 1) * limit, pageNumber * limit),
        page: pageNumber,
        limit,
        total: matching.length,
        pages,
        hasMore: pageNumber < pages,
        unreadCount: items.filter((item) => item.unread).length,
      })
    }

    if (method === 'PATCH' && pathname.endsWith('/read-all')) {
      items.forEach((item) => {
        item.unread = false
      })
      return json({ unreadCount: 0 })
    }

    const match = pathname.match(/\/([^/]+)\/(read|pin)$/)
    if (method === 'PATCH' && match) {
      const [, id, operation] = match
      const item = items.find((entry) => entry.id === id)
      if (!item) return route.fulfill({ status: 404 })
      const value = request.postDataJSON().value
      if (operation === 'read') {
        item.unread = !value
        return json({
          id,
          isRead: value,
          unreadCount: items.filter((entry) => entry.unread).length,
        })
      }
      item.pinned = value
      return json({ id, isPinned: value })
    }

    return route.fulfill({ status: 404 })
  })

  return { items, requests }
}

async function mockModeratorReportQueue(page, groups, pageSize) {
  const requests = []
  await page.route('**/api/moderator/reports**', async (route) => {
    const url = new URL(route.request().url())
    const query = Object.fromEntries(url.searchParams)
    requests.push(query)

    const matching = groups.filter(
      (group) => !query.targetType || group.targetType === query.targetType
    )
    let pageNumber = Number(query.page || 1)
    if (query.targetId) {
      const targetIndex = matching.findIndex((group) => group.target.id === query.targetId)
      if (targetIndex >= 0) pageNumber = Math.floor(targetIndex / pageSize) + 1
    }

    const totalPages = Math.max(1, Math.ceil(matching.length / pageSize))
    pageNumber = Math.min(pageNumber, totalPages)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: matching.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
          total: matching.length,
          page: pageNumber,
          pageSize,
          totalPages,
        },
      }),
    })
  })
  return requests
}

test.describe('Thông báo backoffice của admin và moderator', () => {
  test('admin tải thông báo từ API, đồng bộ số chưa đọc và đánh dấu một mục đã đọc', async ({
    page,
  }) => {
    const { requests } = await mockBackofficeNotifications(page, [notification()])

    await page.goto('/admin/notifications')
    await loginThroughUi(page, ADMIN)

    await expect(page.getByRole('heading', { level: 1, name: 'Thông báo' })).toBeVisible()
    await expect(page.getByRole('heading', { name: notification().title })).toBeVisible()
    const sidebarLink = page.getByRole('link', { name: /Thông báo/ })
    await expect(sidebarLink.locator('span').filter({ hasText: /^1$/ })).toHaveCount(1)

    await page.getByRole('button', { name: 'Đánh dấu đã đọc' }).click()
    await expect(page.getByRole('button', { name: 'Đánh dấu chưa đọc' })).toBeVisible()
    await expect(sidebarLink.locator('span').filter({ hasText: /^1$/ })).toHaveCount(0)
    expect(requests.some((request) => request.pathname.endsWith('/unread-count'))).toBe(true)
    expect(
      requests.some(
        (request) => request.method === 'GET' && request.pathname.endsWith('/notifications')
      )
    ).toBe(true)
    expect(
      requests.some((request) => request.method === 'PATCH' && request.pathname.endsWith('/read'))
    ).toBe(true)
  })

  test('moderator lọc danh sách qua API, ghim thông báo và đánh dấu tất cả đã đọc', async ({
    page,
  }) => {
    const { requests } = await mockBackofficeNotifications(page, [
      notification({
        id: 'review-1',
        type: 'review',
        eventType: 'post_pending',
        title: 'Bài đăng chờ duyệt',
        body: 'Có bài mới cần kiểm tra.',
        actionLabel: 'Mở hàng đợi kiểm duyệt',
        href: '/moderator/review',
      }),
      notification({
        id: 'report-1',
        type: 'report',
        eventType: 'report_queue',
        title: 'Report cần xử lý',
        body: 'Có report về ví màu nâu.',
        actionLabel: 'Mở hàng đợi report',
        href: '/moderator/reports',
      }),
    ])

    await page.goto('/moderator/notifications')
    await loginThroughUi(page, MODERATOR)

    await expect(page.getByRole('heading', { level: 1, name: 'Thông báo' })).toBeVisible()
    await page.getByRole('tab', { name: /Chưa đọc/ }).click()
    await page.getByLabel('Lọc theo loại thông báo').selectOption('report')
    await page.getByPlaceholder('Tìm trong thông báo').fill('ví màu nâu')
    await page.getByLabel('Từ ngày').fill('2026-11-21')
    await page.getByLabel('Đến ngày').fill('2026-11-21')

    await expect(page.getByRole('heading', { name: 'Report cần xử lý' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bài đăng chờ duyệt' })).toHaveCount(0)
    await expect
      .poll(() =>
        requests.some(
          (request) =>
            request.method === 'GET' &&
            request.pathname.endsWith('/notifications') &&
            request.query.status === 'unread' &&
            request.query.type === 'report' &&
            request.query.q === 'ví màu nâu' &&
            request.query.from === '2026-11-21' &&
            request.query.to === '2026-11-21'
        )
      )
      .toBe(true)

    await page.getByRole('button', { name: 'Ghim thông báo' }).click()
    await expect(page.getByRole('button', { name: 'Bỏ ghim thông báo' })).toBeVisible()
    await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click()
    await expect(page.getByText('Không có thông báo phù hợp')).toBeVisible()
    expect(requests.some((request) => request.pathname.endsWith('/read-all'))).toBe(true)
    expect(requests.some((request) => request.pathname.endsWith('/pin'))).toBe(true)
  })

  test('mở report từ thông báo, chuyển đúng trang và tô sáng nhóm đối tượng', async ({ page }) => {
    const targetId = '000000000000000000000003'
    const targetTitle = 'Bài đăng được mở từ thông báo report'
    const groups = Array.from({ length: 5 }, (_, index) => {
      const id = String(index + 1).padStart(24, '0')
      return {
        id: `report-group-${index + 1}`,
        targetType: 'post',
        target: {
          id,
          code: `F21112600${index + 1}`,
          title: id === targetId ? targetTitle : `Bài đăng report ${index + 1}`,
          isHidden: false,
          owner: { id: `owner-${index + 1}`, username: `owner${index + 1}`, role: 'user' },
        },
        reporter: { id: `reporter-${index + 1}`, username: `reporter${index + 1}` },
        reason: 'spam',
        description: 'Nội dung cần kiểm tra.',
        screenshots: [],
        severity: 'medium',
        status: 'pending',
        action: null,
        warningCount: 0,
        reportCount: 1,
        relatedHistory: [],
        createdAt: '2026-11-21T10:00:00.000Z',
      }
    })
    const notificationHref = `/moderator/reports?targetType=post&targetId=${targetId}`
    await mockBackofficeNotifications(page, [
      notification({
        id: 'report-target-notification',
        type: 'report',
        eventType: 'report_queue',
        title: 'Report cần xử lý',
        body: 'Có report về một bài đăng.',
        actionLabel: 'Mở hàng đợi report',
        href: notificationHref,
      }),
    ])
    const reportRequests = await mockModeratorReportQueue(page, groups, 2)

    await page.goto('/moderator/notifications')
    await loginThroughUi(page, MODERATOR)
    await page.getByRole('link', { name: 'Mở hàng đợi report' }).click()

    await expect(page).toHaveURL(
      new RegExp(`/moderator/reports\\?targetType=post&targetId=${targetId}`)
    )
    await expect(page.getByText('Hiển thị 3–4 trong số 5 report')).toBeVisible()
    const row = page
      .getByRole('table', { name: 'Hàng đợi report cần xử lý' })
      .getByRole('row')
      .filter({ hasText: targetTitle })
    await expect(row).toBeVisible()
    await expect(row).toBeInViewport()
    await expect(row).toHaveClass(/bg-\[#fff9db\]/)
    await expect
      .poll(() => reportRequests.some((query) => query.targetId === targetId && query.page === '1'))
      .toBe(true)
    await expect
      .poll(() => reportRequests.some((query) => !query.targetId && query.page === '2'))
      .toBe(true)
  })

  test('hiển thị lỗi tải, cho thử lại rồi báo danh sách rỗng', async ({ page }) => {
    const mocked = await mockBackofficeNotifications(page, [], { failListCount: 2 })

    await page.goto('/moderator/notifications')
    await loginThroughUi(page, MODERATOR)

    await expect(page.getByText('Không tải được thông báo')).toBeVisible()
    await expect(page.getByText('Máy chủ thông báo tạm thời không khả dụng.')).toBeVisible()
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.getByText('Không có thông báo phù hợp')).toBeVisible()
    expect(
      mocked.requests.filter(
        (request) => request.method === 'GET' && request.pathname.endsWith('/notifications')
      ).length
    ).toBeGreaterThanOrEqual(2)
  })

  test('mở đúng bài chờ kiểm duyệt và tô sáng bài từ thông báo', async ({ page }) => {
    const postId = '000000000000000000000091'
    const postTitle = 'Bài kiểm duyệt mở từ thông báo'
    await mockBackofficeNotifications(page, [
      notification({
        id: 'pending-post-notification',
        type: 'review',
        eventType: 'post_pending',
        title: 'Bài đăng đang chờ kiểm duyệt',
        body: 'Có bài mới cần kiểm tra.',
        actionLabel: 'Mở hàng đợi kiểm duyệt',
        href: `/moderator/review?post=${postId}`,
      }),
    ])
    await page.route('**/api/moderator/posts', async (route) =>
      route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: postId,
                code: 'F211126091',
                title: postTitle,
                category: { name: 'Ví & tiền', slug: 'vi-tien' },
                type: 'lost',
                status: 'pending',
                createdAt: '2026-11-21T10:00:00.000Z',
                placeName: 'Chợ Bến Thành',
                area: 'Quận 1',
                locType: 'point',
                description: 'Ví màu nâu.',
                images: [],
                author: { username: 'postowner', reputationScore: 0 },
              },
            ],
          },
        }),
      })
    )

    await page.goto('/moderator/notifications')
    await loginThroughUi(page, MODERATOR)
    await page.getByRole('link', { name: 'Mở hàng đợi kiểm duyệt' }).click()

    await expect(page).toHaveURL(new RegExp(`/moderator/review\\?post=${postId}`))
    const row = page
      .getByRole('table', { name: 'Bài đăng chờ kiểm duyệt' })
      .getByRole('row')
      .filter({ hasText: postTitle })
    await expect(row).toBeVisible()
    await expect(row).toBeInViewport()
    await expect(row).toHaveClass(/bg-\[#fff9db\]/)
  })

  test('Admin mở trang quản lý tài khoản từ cảnh báo tài khoản bị hạn chế', async ({ page }) => {
    const userId = '000000000000000000000092'
    await mockBackofficeNotifications(page, [
      notification({
        id: 'restricted-account-notification',
        type: 'warning',
        eventType: 'account_restricted',
        title: 'Tài khoản tự động bị hạn chế',
        body: 'Một tài khoản cần được kiểm tra.',
        actionLabel: 'Mở hồ sơ tài khoản',
        href: `/admin/users?user=${userId}`,
      }),
    ])

    await page.goto('/admin/notifications')
    await loginThroughUi(page, ADMIN)
    await page.getByRole('link', { name: 'Mở hồ sơ tài khoản' }).click()

    await expect(page).toHaveURL(new RegExp(`/admin/users\\?user=${userId}`))
    await expect(
      page.getByRole('region', { name: 'Bảng người dùng, cuộn ngang để xem thêm' })
    ).toBeVisible()
  })
})
