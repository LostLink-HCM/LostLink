import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, createPost, tokenOf } from '../helpers/posts.js'
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

const mockJournal = async (page, extraEntries = []) => {
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
    ...extraEntries,
  ].map((log, index) => ({
    ...log,
    entityId: (index + 1).toString(16).padStart(24, '0'),
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
  test('mở đúng đối tượng/tab từ nhật ký và xử lý đối tượng đã xóa', async ({ page, api }) => {
    test.setTimeout(90_000)
    const account = await createAccount(api)
    const post = await createPost(api, await tokenOf(api, account), {
      title: 'Mất ví kiểm tra liên kết nhật ký',
    })
    await createPost(api, await tokenOf(api, account), { title: 'Mất đồ kiểm tra trang tiếp theo' })
    await createAccount(api)
    await page.route(/\/api\/backoffice\/settings$/, (route) =>
      route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { paginationPageSize: 1, quickReplies: { user: [], internal: [] } },
        }),
      })
    )
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
    await expect(row.getByText('Xem thay đổi', { exact: true })).toHaveCount(0)
    await expect(row.getByRole('link', { name: 'Xem tài khoản', exact: true })).toHaveAttribute(
      'href',
      `/admin/users?user=${id}`
    )
    await page.reload()
    await search(page).fill(account.username)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Cần xác minh thông tin tài khoản')
    await rows(page).first().getByRole('link', { name: 'Xem tài khoản', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/users\\?user=${id}$`))
    const accountRow = page
      .getByRole('region', { name: 'Bảng người dùng' })
      .getByRole('row')
      .filter({ has: page.getByRole('button', { name: account.username, exact: true }) })
    await expect(accountRow).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(accountRow).toHaveCSS('background-color', 'rgb(255, 249, 219)')
    await expect(accountRow).toHaveCSS('outline-style', 'none')
    await expect(page.getByRole('dialog', { name: 'Hồ sơ người dùng' })).toHaveCount(0)
    const pagination = page.getByRole('navigation', { name: 'Phân trang', exact: true })
    await expect(pagination.locator('[aria-current="page"]')).not.toHaveText('1')
    await expect(accountRow).toHaveCSS('background-color', 'rgb(255, 251, 252)', { timeout: 5000 })
    await expect(accountRow).toBeVisible()
    await page.reload()
    await expect(accountRow).toHaveCSS('background-color', 'rgb(255, 249, 219)')
    await expect(page.getByRole('dialog', { name: 'Hồ sơ người dùng' })).toHaveCount(0)
    await accountRow.getByRole('button', { name: account.username, exact: true }).click()
    const profile = page.getByRole('dialog', { name: 'Hồ sơ người dùng' })
    await expect(profile.getByText(account.username, { exact: true })).toBeVisible()
    await profile.getByText('Đóng', { exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/users\\?user=${id}$`))
    await page.goBack()
    await expect(table(page)).toBeVisible()
    await search(page).fill(post.code)
    await expect(rows(page)).toHaveCount(1)
    await rows(page).first().getByRole('link', { name: 'Xem bài đăng', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/posts\\?post=${post.id}$`))
    const postRow = page
      .getByRole('table', { name: 'Danh sách bài đăng của cộng đồng' })
      .getByRole('row')
      .filter({
        has: page.getByRole('link', { name: 'Mất ví kiểm tra liên kết nhật ký', exact: true }),
      })
    await expect(postRow).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(postRow).toHaveCSS('background-color', 'rgb(255, 249, 219)')
    await expect(postRow).toHaveCSS('outline-style', 'none')
    await expect(page.getByRole('dialog', { name: 'Chi tiết bài đăng' })).toHaveCount(0)
    await expect(pagination.locator('[aria-current="page"]')).not.toHaveText('1')
    await expect(postRow).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)', { timeout: 5000 })
    await expect(postRow).toBeVisible()
    await page.reload()
    await expect(postRow).toHaveCSS('background-color', 'rgb(255, 249, 219)')
    await expect(page.getByRole('dialog', { name: 'Chi tiết bài đăng' })).toHaveCount(0)
    const postPagePromise = page.waitForEvent('popup')
    await postRow
      .getByRole('link', { name: 'Mất ví kiểm tra liên kết nhật ký', exact: true })
      .click()
    const postPage = await postPagePromise
    await expect(postPage).toHaveURL(new RegExp(`/${post.slug}$`))
    await expect(postPage.getByRole('heading', { level: 1, name: post.title })).toBeVisible()
    await postPage.close()

    const savedSettings = await api.get('admin/settings', { headers: bearer(token) })
    expect(savedSettings.status()).toBe(200)
    const settingsData = (await savedSettings.json()).data
    const internalReply = settingsData.quickReplies.internal[0]
    for (const item of [
      {
        entityType: 'SystemConfig',
        detail: {
          section: 'matching',
          summary: 'Cập nhật cấu hình ghép cặp',
          before: {
            mTime: settingsData.values.mTime === 0.8 ? 0.9 : 0.8,
            sMin: settingsData.values.sMin === 0.1 ? 0.05 : 0.1,
            mCategory: settingsData.values.mCategory,
          },
          after: {
            mTime: settingsData.values.mTime,
            sMin: settingsData.values.sMin,
            mCategory: settingsData.values.mCategory,
          },
        },
        label: 'Xem cấu hình',
        tab: 'Ghép cặp',
        fields: ['mTime', 'sMin'],
        untouched: 'mCategory',
      },
      {
        entityType: 'SystemConfig',
        detail: {
          section: 'timeThresholds',
          summary: 'Cập nhật cấu hình thời hạn',
          before: {
            reportDays: settingsData.values.reportDays + 1,
            contactHours: settingsData.values.contactHours,
          },
          after: {
            reportDays: settingsData.values.reportDays,
            contactHours: settingsData.values.contactHours,
          },
        },
        label: 'Xem cấu hình',
        tab: 'Thời hạn',
        fields: ['reportDays'],
        untouched: 'contactHours',
      },
      {
        entityType: 'SystemConfig',
        detail: {
          section: 'pagination',
          summary: 'Cập nhật cấu hình phân trang',
          before: { paginationPageSize: settingsData.values.paginationPageSize + 1 },
          after: { paginationPageSize: settingsData.values.paginationPageSize },
        },
        label: 'Xem cấu hình',
        tab: 'Phân trang',
        fields: ['paginationPageSize'],
      },
      {
        entityType: 'QuickReply',
        detail: {
          summary: 'Cập nhật mẫu trả lời nhanh',
          before: {
            ...settingsData.quickReplies,
            user: [
              ...settingsData.quickReplies.user,
              { id: '507f1f77bcf86cd799439077', text: 'Mẫu người dùng đã bị xóa' },
            ],
            internal: settingsData.quickReplies.internal.map((reply, index) =>
              index === 0 ? { ...reply, text: 'Nội dung nội bộ trước khi sửa' } : reply
            ),
          },
          after: settingsData.quickReplies,
        },
        label: 'Xem mẫu trả lời nhanh',
        tab: 'Mẫu trả lời nhanh',
        reply: internalReply,
      },
      {
        entityType: 'Category',
        entityId: null,
        entityExists: false,
        detail: { displayCode: 'phu-kien-du-lich', summary: 'Xóa danh mục' },
        label: 'Xem danh mục',
        missing: true,
      },
      {
        entityType: 'Post',
        entityId: '507f1f77bcf86cd799439099',
        detail: { summary: 'Bài đăng đã bị xóa' },
        label: 'Xem bài đăng',
        missing: true,
      },
      {
        entityType: 'User',
        entityId: '507f1f77bcf86cd799439099',
        detail: { summary: 'Tài khoản đã bị xóa' },
        label: 'Xem tài khoản',
        missing: true,
      },
    ]) {
      await page.route(
        endpoint,
        (route) =>
          route.fulfill({
            status: 200,
            headers: CORS,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                items: [
                  {
                    ...item,
                    id: 'linked-log',
                    actor: { username: 'admin' },
                    actorRole: 'admin',
                    action: 'update',
                    createdAt: '2026-11-10T03:00:00Z',
                  },
                ],
                total: 1,
                page: 1,
                pageSize: 10,
                totalPages: 1,
              },
            }),
          }),
        { times: 1 }
      )
      await page.goto('/admin/audit-log')
      await rows(page).first().getByRole('link', { name: item.label, exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      if (item.missing)
        await expect(page.getByRole('alert')).toContainText('Đối tượng không còn tồn tại.')
      else {
        await expect(
          page
            .getByRole('tablist', { name: 'Nhóm cấu hình hệ thống' })
            .getByRole('tab', { name: item.tab, exact: true })
        ).toHaveAttribute('aria-selected', 'true')
        const card = page.getByRole('tabpanel').locator('section').first()
        await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)')
        await expect(card.locator('header').first()).not.toHaveCSS(
          'background-color',
          'rgb(255, 249, 219)'
        )
        const targets = item.reply
          ? [page.getByText(item.reply.text, { exact: true }).locator('..')]
          : item.fields.map((key) => page.locator(`#setting-${key}`).locator('..'))
        await page.mouse.move(0, 0)
        for (const target of targets)
          await expect(target).toHaveCSS('background-color', 'rgb(255, 249, 219)')
        if (item.untouched)
          await expect(page.locator(`#setting-${item.untouched}`).locator('..')).toHaveCSS(
            'background-color',
            'rgb(255, 255, 255)'
          )
        if (item.reply) {
          await expect(
            page
              .getByRole('tablist', { name: 'Nhóm mẫu trả lời nhanh' })
              .getByRole('tab', { name: /^Nội bộ/ })
          ).toHaveAttribute('aria-selected', 'true')
          const otherReply = settingsData.quickReplies.internal[1]
          if (otherReply)
            await expect(page.getByText(otherReply.text, { exact: true }).locator('..')).toHaveCSS(
              'background-color',
              'rgb(248, 251, 255)'
            )
        }
        for (const target of targets)
          await expect(target).toHaveCSS(
            'background-color',
            item.reply ? 'rgb(248, 251, 255)' : 'rgb(255, 255, 255)',
            { timeout: 5000 }
          )
        await page.reload()
        await expect(
          page
            .getByRole('tablist', { name: 'Nhóm cấu hình hệ thống' })
            .getByRole('tab', { name: item.tab, exact: true })
        ).toHaveAttribute('aria-selected', 'true')
        for (const target of targets)
          await expect(target).toHaveCSS('background-color', 'rgb(255, 249, 219)')
      }
    }
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
    await expect(page.getByText('Hiển thị 3–4 trong số 5 bản ghi', { exact: true })).toBeVisible()
    await expect(pagination).not.toContainText('Hiển thị')
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
      await filters(page).getByRole('textbox', { name: label, exact: true }).fill('2026-11-11')
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
    await expect(page.getByText('Hiển thị 1–2 trong số 5 bản ghi', { exact: true })).toBeVisible()
    await expect(
      rows(page).first().getByRole('link', { name: 'Xem bài đăng', exact: true })
    ).toHaveAttribute('href', '/admin/posts?post=000000000000000000000001')
    expect(requests.at(-1)).toEqual({ page: '1' })
    await expect(filters(page).getByRole('button', { name: 'Xuất CSV', exact: true })).toBeEnabled()

    const genericActions = [
      ['create', 'Category', 'Thêm danh mục'],
      ['update', 'Category', 'Cập nhật danh mục'],
      ['delete', 'Category', 'Xóa danh mục'],
      ['update', 'SystemConfig', 'Cập nhật cấu hình hệ thống'],
      ['update', 'QuickReply', 'Cập nhật mẫu trả lời nhanh'],
    ]
    const genericRequests = await mockJournal(
      page,
      genericActions.map(([action, entityType, label], index) => ({
        id: `generic-${index}`,
        actorRole: 'admin',
        action,
        entityType,
        createdAt: '2026-11-13T03:00:00Z',
        detail: { summary: label },
      }))
    )
    const actionSelect = filters(page).getByRole('combobox', { name: 'Hành động', exact: true })
    const entitySelect = filters(page).getByRole('combobox', { name: 'Đối tượng', exact: true })
    const updated = waitForAudit(page, { action: 'update', page: '1' })
    await actionSelect.selectOption({ label: 'Cập nhật' })
    expect((await updated).ok()).toBeTruthy()
    await expect(actionSelect.locator('option:checked')).toHaveText('Cập nhật')
    await expect(entitySelect).toHaveValue('')
    await expect(rows(page)).toHaveCount(2)
    await expect(rows(page).locator('td:nth-child(3)')).toHaveText(['Cập nhật', 'Cập nhật'])
    await expect(page.getByText('Hiển thị 1–2 trong số 3 bản ghi', { exact: true })).toBeVisible()
    expect(genericRequests.at(-1)).toEqual({ page: '1', action: 'update' })

    for (const entityType of ['SystemConfig', 'QuickReply', 'Category']) {
      const response = waitForAudit(page, { action: 'update', entityType, page: '1' })
      await entitySelect.selectOption(entityType)
      expect((await response).ok()).toBeTruthy()
      await expect(actionSelect).toHaveValue('update')
      await expect(entitySelect).toHaveValue(entityType)
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page).first().getByRole('cell').nth(2)).toHaveText('Cập nhật')
      expect(genericRequests.at(-1)).toEqual({ page: '1', action: 'update', entityType })
    }

    for (const [action, label] of [
      ['create', 'Thêm'],
      ['delete', 'Xóa'],
    ]) {
      const response = waitForAudit(page, { action, entityType: 'Category', page: '1' })
      await actionSelect.selectOption({ label })
      expect((await response).ok()).toBeTruthy()
      await expect(actionSelect.locator('option:checked')).toHaveText(label)
      await expect(entitySelect).toHaveValue('Category')
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page).first().getByRole('cell').nth(2)).toHaveText(label)
      expect(genericRequests.at(-1)).toEqual({ page: '1', action, entityType: 'Category' })
    }
    await entitySelect.selectOption('Post')
    await expect
      .poll(() => genericRequests.at(-1), { timeout: 5000 })
      .toEqual({ page: '1', action: 'delete', entityType: 'Post' })
    await expect(actionSelect).toHaveValue('delete')
    await expect(page.getByRole('heading', { name: 'Không có bản ghi phù hợp' })).toBeVisible()

    const paginationRequests = await mockJournal(
      page,
      Array.from({ length: 7 }, (_, index) => ({
        id: `pagination-${index}`,
        actorRole: 'admin',
        action: 'status',
        entityType: 'Post',
        createdAt: '2026-11-13T03:00:00Z',
        detail: { summary: 'Cập nhật trạng thái bài đăng' },
      }))
    )
    await reset(page).click()
    await expect(page.getByText('Hiển thị 1–2 trong số 12 bản ghi', { exact: true })).toBeVisible()
    const lastPage = waitForAudit(page, { page: '6' })
    await pagination.getByRole('button', { name: 'Trang 6', exact: true }).click()
    expect((await lastPage).ok()).toBeTruthy()
    await expect(pagination.getByRole('button', { name: 'Trang sau', exact: true })).toBeDisabled()

    const fifthPage = waitForAudit(page, { page: '5' })
    await pagination.getByRole('button', { name: 'Trang trước', exact: true }).click()
    expect((await fifthPage).ok()).toBeTruthy()
    await expect(page.getByText('Hiển thị 9–10 trong số 12 bản ghi', { exact: true })).toBeVisible()
    await expect(pagination.getByRole('button', { name: /^Trang \d+$/ })).toHaveText([
      '1',
      '4',
      '5',
      '6',
    ])
    await expect(pagination.getByText('…', { exact: true })).toBeVisible()
    await expect(pagination.locator('[aria-current="page"]')).toHaveText('5')
    expect(paginationRequests.at(-1)).toEqual({ page: '5' })

    const firstPage = waitForAudit(page, { page: '1' })
    await pagination.getByRole('button', { name: 'Trang 1', exact: true }).click()
    expect((await firstPage).ok()).toBeTruthy()
    await expect(
      pagination.getByRole('button', { name: 'Trang trước', exact: true })
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
    const from = filters(page).getByRole('textbox', { name: /^Từ ngày/ })
    const to = filters(page).getByRole('textbox', { name: /^Đến ngày/ })
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
