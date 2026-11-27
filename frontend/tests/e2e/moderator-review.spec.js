import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, createPost, tokenOf } from '../helpers/posts.js'
import { WEB_PORT } from '../setup/ports.js'

const MODERATOR = { email: 'mod@lostlink.vn', password: 'Mod@1234' }
const CORS = {
  'Access-Control-Allow-Origin': `http://localhost:${WEB_PORT}`,
  'Access-Control-Allow-Credentials': 'true',
}
const queueTable = (page) => page.getByRole('table', { name: 'Bài đăng chờ kiểm duyệt' })
const titleLink = (page, title) => page.getByRole('link', { name: title, exact: true })

test.describe('Kiểm duyệt bài đăng của moderator', () => {
  test('người dùng thường không được mở trang kiểm duyệt', async ({ page, api }) => {
    const account = await createAccount(api)
    await page.goto('/moderator/review')
    await loginThroughUi(page, account)
    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Bài đăng chờ kiểm duyệt' })).toHaveCount(0)
  })

  test('lọc, mở bài trong tab mới để duyệt và từ chối bài với lý do cụ thể', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const ownerToken = await tokenOf(api, account)
    const suffix = Date.now().toString(36)
    const approvedTitle = `Ví cần duyệt ${suffix}`
    const rejectedTitle = `Ví cần từ chối ${suffix}`
    const approved = await createPost(api, ownerToken, {
      title: approvedTitle,
      approve: false,
    })
    const rejected = await createPost(api, ownerToken, {
      title: rejectedTitle,
      approve: false,
    })

    await page.goto('/moderator/review')
    await loginThroughUi(page, MODERATOR)
    await expect(page.getByRole('table', { name: 'Bài đăng chờ kiểm duyệt' })).toBeVisible()

    const search = page.getByRole('searchbox', { name: 'Tìm kiếm' })
    await search.fill(approvedTitle)
    await expect(titleLink(page, approvedTitle)).toBeVisible()
    await expect(page.getByRole('button', { name: `Đọc bài ${approved.code}` })).toHaveCount(0)
    await expect(titleLink(page, rejectedTitle)).toHaveCount(0)

    const detailPromise = page.waitForEvent('popup')
    await titleLink(page, approvedTitle).click()
    const detail = await detailPromise
    await expect(detail).toHaveURL(new RegExp(`/mat-do/${approved.slug}$`))
    await expect(detail.getByRole('heading', { level: 1, name: approvedTitle })).toBeVisible()
    await expect(detail.getByRole('region', { name: 'Thao tác kiểm duyệt' })).toBeVisible()
    await expect(detail.getByRole('button', { name: 'Duyệt', exact: true })).toBeVisible()
    await expect(detail.getByRole('button', { name: 'Từ chối', exact: true })).toBeVisible()
    await detail.getByRole('button', { name: 'Duyệt', exact: true }).click()
    const approval = detail.getByRole('dialog', { name: 'Xác nhận' })
    const approveResponse = detail.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/backoffice/posts/${approved.id}/approve`) &&
        response.request().method() === 'POST'
    )
    await approval.getByRole('button', { name: 'Duyệt', exact: true }).click()
    expect((await approveResponse).status()).toBe(200)
    await expect(
      detail.getByRole('heading', { name: 'Lịch sử trạng thái', exact: true })
    ).toBeVisible()
    await expect(detail.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0)
    const approvedFromApi = await api.get(`backoffice/posts/${approved.id}`, {
      headers: bearer(await tokenOf(api, MODERATOR)),
    })
    expect((await approvedFromApi.json()).data.status).toBe('searching')
    await detail.close()

    await search.fill(rejectedTitle)
    await expect(titleLink(page, rejectedTitle)).toBeVisible()
    await page.getByRole('button', { name: `Từ chối bài ${rejected.code}` }).click()
    const denial = page.getByRole('dialog', { name: 'Xác nhận' })
    await denial.getByRole('combobox', { name: 'Lý do từ chối' }).selectOption('other')
    await denial.getByRole('button', { name: 'Từ chối', exact: true }).click()
    await expect(denial.getByText('Vui lòng nhập lý do từ chối cụ thể.')).toBeVisible()
    await denial.getByRole('textbox', { name: 'Lý do từ chối' }).fill('Ảnh không rõ món đồ')
    await denial.getByRole('button', { name: 'Từ chối', exact: true }).click()
    await expect(page.getByText(`Đã từ chối bài đăng ${rejected.code}.`)).toBeVisible()
    await expect(titleLink(page, rejectedTitle)).toHaveCount(0)

    const modToken = await tokenOf(api, MODERATOR)
    const queue = await api.get('moderator/posts', { headers: bearer(modToken) })
    expect(queue.status()).toBe(200)
    const ids = (await queue.json()).data.items.map((post) => post.id)
    expect(ids).not.toContain(approved.id)
    expect(ids).not.toContain(rejected.id)
  })

  test('lọc theo loại tin, danh mục, khu vực; báo danh sách rỗng và đặt lại bộ lọc', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, account)
    const prefix = `Lọc kiểm duyệt ${Date.now().toString(36)}`
    const lostTitle = `${prefix} mất ví`
    const foundTitle = `${prefix} nhặt ví`
    await createPost(api, token, { title: lostTitle, approve: false })
    await createPost(api, token, { title: foundTitle, type: 'found', approve: false })

    await page.goto('/moderator/review')
    await loginThroughUi(page, MODERATOR)
    const filters = page.getByRole('region', { name: 'Bộ lọc hàng đợi' })
    const search = filters.getByRole('searchbox', { name: 'Tìm kiếm' })
    await search.fill(prefix)
    await expect(queueTable(page).getByRole('row')).toHaveCount(3)
    await filters.getByRole('combobox', { name: 'Loại bài đăng' }).selectOption('found')
    await filters.getByRole('combobox', { name: 'Danh mục' }).selectOption('vi-tien')
    await filters.getByRole('combobox', { name: 'Khu vực' }).selectOption('Quận 1')
    await expect(titleLink(page, foundTitle)).toBeVisible()
    await expect(titleLink(page, lostTitle)).toHaveCount(0)

    await search.fill(`${prefix} không tồn tại`)
    await expect(
      page.getByText('Không có bài đăng nào cần duyệt trong danh sách này.')
    ).toBeVisible()

    const reloaded = page.waitForResponse(
      (res) => res.url().endsWith('/api/moderator/posts') && res.request().method() === 'GET'
    )
    await filters.getByRole('button', { name: 'Đặt lại bộ lọc và tải lại danh sách' }).click()
    expect((await reloaded).status()).toBe(200)
    await expect(search).toHaveValue('')
    for (const label of ['Loại bài đăng', 'Danh mục', 'Khu vực']) {
      await expect(filters.getByRole('combobox', { name: label })).toHaveValue('')
    }
    await expect(queueTable(page).getByRole('row').nth(1)).toBeVisible()
  })

  test('lỗi API cho phép tải lại và thử duyệt lại; hủy xác nhận quay về chi tiết mà không duyệt bài', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, account)
    const title = `Ví kiểm tra lỗi ${Date.now().toString(36)}`
    const post = await createPost(api, token, { title, approve: false })
    const listUrl = /\/api\/moderator\/posts$/
    const approveUrl = `**/api/moderator/posts/${post.id}/approve`
    const fail = (message) => (route) =>
      route.fulfill({
        status: 503,
        headers: CORS,
        json: { success: false, message },
      })
    await page.route(listUrl, fail('Không tải được hàng chờ.'))

    await page.goto('/moderator/review')
    await loginThroughUi(page, MODERATOR)
    await expect(page.getByText('Không tải được hàng chờ.')).toBeVisible()
    await page.unroute(listUrl)
    await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(title)
    await expect(titleLink(page, title)).toBeVisible()

    let decisions = 0
    page.on('request', (request) => {
      if (request.url().endsWith(`/${post.id}/approve`) && request.method() === 'POST')
        decisions += 1
    })
    await page.getByRole('button', { name: `Duyệt bài ${post.code}` }).click()
    const approval = page.getByRole('dialog', { name: 'Xác nhận' })
    await approval.getByRole('button', { name: 'Hủy', exact: true }).click()
    await expect(approval).toHaveCount(0)
    expect(decisions).toBe(0)

    await page.route(approveUrl, fail('Chưa duyệt được bài, vui lòng thử lại.'))
    await page.getByRole('button', { name: `Duyệt bài ${post.code}` }).click()
    await approval.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await expect(approval.getByRole('alert')).toHaveText('Chưa duyệt được bài, vui lòng thử lại.')
    await expect(approval).toBeVisible()
    const modToken = await tokenOf(api, MODERATOR)
    const pending = await api.get(`moderator/posts/${post.id}`, { headers: bearer(modToken) })
    expect(pending.status()).toBe(200)
    expect((await pending.json()).data.status).toBe('pending')

    await page.unroute(approveUrl)
    await approval.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await expect(page.getByText(`Đã duyệt bài đăng ${post.code}.`)).toBeVisible()
    await expect(titleLink(page, title)).toHaveCount(0)
    expect(decisions).toBe(2)
  })

  test('hủy từ chối giữ bài trong hàng chờ; từ chối với lý do có sẵn gửi đúng thông báo cho chủ bài', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const ownerToken = await tokenOf(api, account)
    const title = `Ví kiểm tra từ chối ${account.username}`
    const post = await createPost(api, ownerToken, { title, approve: false })
    const reason = 'Nội dung Spam / Quảng cáo'
    await page.goto('/moderator/review')
    await loginThroughUi(page, MODERATOR)
    await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(title)
    await expect(titleLink(page, title)).toBeVisible()
    await page.getByRole('button', { name: `Từ chối bài ${post.code}` }).click()
    const denial = page.getByRole('dialog', { name: 'Xác nhận' })
    await denial.getByRole('combobox', { name: 'Lý do từ chối' }).selectOption({ label: reason })
    await denial.getByRole('button', { name: 'Hủy', exact: true }).click()
    await expect(denial).toHaveCount(0)
    await expect(titleLink(page, title)).toBeVisible()
    const modToken = await tokenOf(api, MODERATOR)
    const pending = await api.get(`moderator/posts/${post.id}`, { headers: bearer(modToken) })
    expect(pending.status()).toBe(200)
    expect((await pending.json()).data.status).toBe('pending')

    await page.getByRole('button', { name: `Từ chối bài ${post.code}` }).click()
    await denial.getByRole('combobox', { name: 'Lý do từ chối' }).selectOption({ label: reason })
    const rejected = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/moderator/posts/${post.id}/reject`) &&
        res.request().method() === 'POST'
    )
    await denial.getByRole('button', { name: 'Từ chối', exact: true }).click()
    const response = await rejected
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toEqual({ reason })
    await expect(page.getByText(`Đã từ chối bài đăng ${post.code}.`)).toBeVisible()
    await expect(titleLink(page, title)).toHaveCount(0)

    const notices = await api.get('notifications', { headers: bearer(ownerToken) })
    expect(notices.status()).toBe(200)
    expect((await notices.json()).data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'post_rejected',
          text: reason,
          post: expect.objectContaining({ title }),
        }),
      ])
    )
  })
})
