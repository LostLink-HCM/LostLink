import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, createPost, tokenOf } from '../helpers/posts.js'
import { WEB_PORT } from '../setup/ports.js'

const MANAGERS = [
  { role: 'moderator', path: '/moderator', email: 'mod@lostlink.vn', password: 'Mod@1234' },
  { role: 'admin', path: '/admin/posts', email: 'admin@lostlink.vn', password: 'Admin@123' },
]
const CORS = {
  'Access-Control-Allow-Origin': `http://localhost:${WEB_PORT}`,
  'Access-Control-Allow-Credentials': 'true',
}
const table = (page) => page.getByRole('table', { name: 'Danh sách bài đăng của cộng đồng' })
const rowOf = (page, title) =>
  table(page)
    .getByRole('row')
    .filter({
      has: page.getByRole('button', { name: title, exact: true }),
    })
const searchFor = async (page, title) => {
  await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(title)
  await expect(rowOf(page, title)).toBeVisible()
}
const openWorkspace = async (page, manager) => {
  await page.goto(manager.path)
  await loginThroughUi(page, manager)
  await expect(table(page)).toBeVisible()
}
const preparePost = async (api, label, { approve = false } = {}) => {
  const account = await createAccount(api)
  const token = await tokenOf(api, account)
  const title = `${label} ${account.username}`
  const post = await createPost(api, token, { title, approve })
  return { ...post, title }
}

test('người dùng thường không được truy cập trang quản lý bài đăng của moderator và admin', async ({
  page,
  api,
}) => {
  const account = await createAccount(api)
  await page.goto(MANAGERS[0].path)
  await loginThroughUi(page, account)
  await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })).toBeVisible()
  await expect(table(page)).toHaveCount(0)
  await page.goto(MANAGERS[1].path)
  await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })).toBeVisible()
  await expect(table(page)).toHaveCount(0)
})

// Hai trang dùng chung workspace. Mỗi kịch bản đều chạy với cả hai tài khoản và dữ liệu riêng.
for (const manager of MANAGERS) {
  test.describe(`Quản lý tất cả bài đăng - ${manager.role}`, () => {
    test('tìm kiếm, lọc trạng thái và Đã ẩn, danh mục, loại tin, khu vực; báo rỗng và đặt lại', async ({
      page,
      api,
    }) => {
      const account = await createAccount(api)
      const ownerToken = await tokenOf(api, account)
      const prefix = `Lọc quản lý ${account.username}`
      await createPost(api, ownerToken, { title: `${prefix} mất ví`, approve: true })
      const foundTitle = `${prefix} nhặt ví`
      const found = await createPost(api, ownerToken, {
        title: foundTitle,
        type: 'found',
        approve: false,
      })
      const managerToken = await tokenOf(api, manager)
      const hidden = await api.patch(`backoffice/posts/${found.id}/visibility`, {
        headers: bearer(managerToken),
        data: { isHidden: true, reason: 'Cần kiểm tra' },
      })
      expect(hidden.status()).toBe(200)

      await openWorkspace(page, manager)
      const filters = page.getByRole('region', { name: 'Bộ lọc bài đăng' })
      await filters.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(prefix)
      await expect(table(page).getByRole('row')).toHaveCount(3)
      await filters.getByRole('combobox', { name: 'Trạng thái' }).selectOption('hidden')
      await filters.getByRole('combobox', { name: 'Danh mục' }).selectOption('vi-tien')
      await filters.getByRole('combobox', { name: 'Loại bài đăng' }).selectOption('found')
      await filters.getByRole('combobox', { name: 'Khu vực' }).selectOption('Quận 1')
      await expect(table(page).getByRole('row')).toHaveCount(2)
      await expect(rowOf(page, foundTitle).getByText('Đã ẩn', { exact: true })).toBeVisible()
      await filters.getByRole('combobox', { name: 'Trạng thái' }).selectOption('pending')
      await expect(rowOf(page, foundTitle)).toBeVisible()

      await filters.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(`${prefix} không tồn tại`)
      await expect(page.getByText('Không tìm thấy bài đăng phù hợp', { exact: true })).toBeVisible()
      await filters.getByLabel('Từ ngày').fill('2026-11-12')
      await filters.getByLabel('Đến ngày').fill('2026-11-10')
      await expect(page.getByText('Khoảng thời gian chưa hợp lệ', { exact: true })).toBeVisible()

      await filters.getByRole('button', { name: 'Đặt lại bộ lọc', exact: true }).click()
      await expect(filters.getByRole('searchbox', { name: 'Tìm kiếm' })).toHaveValue('')
      for (const label of ['Trạng thái', 'Danh mục', 'Loại bài đăng', 'Khu vực']) {
        await expect(filters.getByRole('combobox', { name: label })).toHaveValue('')
      }
      await expect(filters.getByLabel('Từ ngày')).toHaveValue('')
      await expect(filters.getByLabel('Đến ngày')).toHaveValue('')
      await expect(table(page).getByRole('row').nth(1)).toBeVisible()
    })

    test('cập nhật sang Đã từ chối bắt buộc lý do, lưu trạng thái và lịch sử sau khi tải lại', async ({
      page,
      api,
    }) => {
      const post = await preparePost(api, 'Ví cập nhật trạng thái')
      await openWorkspace(page, manager)
      await searchFor(page, post.title)
      await rowOf(page, post.title)
        .getByRole('button', { name: 'Cập nhật trạng thái bài đăng' })
        .click()
      const edit = page.getByRole('dialog', { name: 'Cập nhật trạng thái', exact: true })
      await expect(edit.getByRole('button', { name: 'Cập nhật', exact: true })).toBeDisabled()
      await edit.getByRole('radio', { name: 'Đã từ chối', exact: true }).check()
      await edit.getByRole('button', { name: 'Cập nhật', exact: true }).click()
      await expect(edit.getByText('Vui lòng nhập lý do từ chối.', { exact: true })).toBeVisible()
      await edit.getByRole('textbox', { name: 'Lý do từ chối' }).fill('  Ảnh không rõ món đồ  ')
      await edit.getByRole('button', { name: 'Cập nhật', exact: true }).click()
      await expect(page.getByText(`Đã cập nhật trạng thái bài ${post.code}.`)).toBeVisible()
      await expect(rowOf(page, post.title).getByText('Đã từ chối', { exact: true })).toBeVisible()

      await page.reload()
      await searchFor(page, post.title)
      await rowOf(page, post.title).getByRole('button', { name: 'Xem chi tiết bài đăng' }).click()
      const detail = page.getByRole('dialog', { name: 'Chi tiết bài đăng' })
      await expect(detail.getByText('Ví da màu nâu, bên trong có thẻ sinh viên.')).toBeVisible()
      await detail.getByRole('button', { name: 'Xem lịch sử trạng thái' }).click()
      const history = detail.getByRole('region', { name: 'Lịch sử trạng thái' })
      await expect(history.getByText('Đã từ chối', { exact: true })).toBeVisible()
      await expect(history.getByText('Lý do: Ảnh không rõ món đồ', { exact: true })).toBeVisible()
    })

    test('hủy ẩn không đổi bài, ẩn bắt buộc lý do và hiện lại giữ nguyên trạng thái', async ({
      page,
      api,
    }) => {
      const post = await preparePost(api, 'Ví ẩn hiện', { approve: true })
      await openWorkspace(page, manager)
      await searchFor(page, post.title)
      await rowOf(page, post.title)
        .getByRole('button', { name: 'Ẩn bài đăng', exact: true })
        .click()
      const hide = page.getByRole('dialog', { name: 'Ẩn bài đăng', exact: true })
      await hide.getByRole('button', { name: 'Hủy', exact: true }).click()
      await expect(rowOf(page, post.title).getByText('Đã ẩn', { exact: true })).toHaveCount(0)

      await rowOf(page, post.title)
        .getByRole('button', { name: 'Ẩn bài đăng', exact: true })
        .click()
      await hide.getByRole('button', { name: 'Ẩn bài đăng', exact: true }).click()
      await expect(
        hide.getByText('Vui lòng nhập lý do ẩn bài đăng.', { exact: true })
      ).toBeVisible()
      await hide.getByRole('textbox', { name: 'Lý do ẩn bài đăng' }).fill('Chứa thông tin cá nhân')
      await hide.getByRole('button', { name: 'Ẩn bài đăng', exact: true }).click()
      await expect(page.getByText(`Đã ẩn bài đăng ${post.code}.`)).toBeVisible()
      await expect(rowOf(page, post.title).getByText('Đã ẩn', { exact: true })).toBeVisible()
      await expect(rowOf(page, post.title).getByText('Đang tìm', { exact: true })).toBeVisible()

      await page.reload()
      await searchFor(page, post.title)
      await rowOf(page, post.title).getByRole('button', { name: 'Xem chi tiết bài đăng' }).click()
      const detail = page.getByRole('dialog', { name: 'Chi tiết bài đăng' })
      await expect(
        detail
          .getByRole('region', { name: 'Lý do ẩn bài đăng' })
          .getByText('Chứa thông tin cá nhân')
      ).toBeVisible()
      await detail.getByRole('button', { name: 'Đóng', exact: true }).last().click()
      await rowOf(page, post.title)
        .getByRole('button', { name: 'Hiện lại bài đăng', exact: true })
        .click()
      const show = page.getByRole('dialog', { name: 'Hiện lại bài đăng', exact: true })
      await expect(show.getByRole('textbox')).toHaveCount(0)
      await show.getByRole('button', { name: 'Hiện lại bài đăng', exact: true }).click()
      await expect(page.getByText(`Đã hiện lại bài đăng ${post.code}.`)).toBeVisible()
      await expect(rowOf(page, post.title).getByText('Đã ẩn', { exact: true })).toHaveCount(0)
      await expect(rowOf(page, post.title).getByText('Đang tìm', { exact: true })).toBeVisible()
    })

    test('lỗi danh sách cho thử lại, lỗi cập nhật giữ hộp thoại và dữ liệu cũ cho đến khi lưu thành công', async ({
      page,
      api,
    }) => {
      const post = await preparePost(api, 'Ví xử lý lỗi quản lý')
      const listUrl = /\/api\/backoffice\/posts$/
      const statusUrl = `**/api/backoffice/posts/${post.id}/status`
      const fail = (message) => (route) =>
        route.fulfill({
          status: 503,
          headers: CORS,
          json: { success: false, message },
        })
      await page.route(listUrl, fail('Danh sách tạm thời không khả dụng.'))
      await openWorkspace(page, manager)
      const alert = page
        .getByRole('alert')
        .filter({ hasText: 'Danh sách tạm thời không khả dụng.' })
      await expect(alert).toBeVisible()
      await page.unroute(listUrl)
      await alert.getByRole('button', { name: 'Thử lại', exact: true }).click()
      await searchFor(page, post.title)

      await page.route(statusUrl, fail('Chưa cập nhật được trạng thái.'))
      await rowOf(page, post.title)
        .getByRole('button', { name: 'Cập nhật trạng thái bài đăng' })
        .click()
      const edit = page.getByRole('dialog', { name: 'Cập nhật trạng thái', exact: true })
      await edit.getByRole('radio', { name: 'Đã đóng', exact: true }).check()
      await edit.getByRole('button', { name: 'Cập nhật', exact: true }).click()
      await expect(edit.getByRole('alert')).toHaveText('Chưa cập nhật được trạng thái.')
      const token = await tokenOf(api, manager)
      const unchanged = await api.get(`backoffice/posts/${post.id}`, { headers: bearer(token) })
      expect(unchanged.status()).toBe(200)
      expect((await unchanged.json()).data.status).toBe('pending')

      await page.unroute(statusUrl)
      await edit.getByRole('button', { name: 'Cập nhật', exact: true }).click()
      await expect(page.getByText(`Đã cập nhật trạng thái bài ${post.code}.`)).toBeVisible()
      await expect(rowOf(page, post.title).getByText('Đã đóng', { exact: true })).toBeVisible()
    })

    test('hủy cập nhật giữ trạng thái; lưu trạng thái mới làm bài rời bộ lọc cũ và xuất hiện trong bộ lọc mới', async ({
      page,
      api,
    }) => {
      const post = await preparePost(api, 'Ví đổi trạng thái trong bộ lọc')
      await openWorkspace(page, manager)
      await searchFor(page, post.title)
      const statusFilter = page
        .getByRole('region', { name: 'Bộ lọc bài đăng' })
        .getByRole('combobox', { name: 'Trạng thái' })
      await statusFilter.selectOption('pending')
      await expect(rowOf(page, post.title)).toBeVisible()
      await rowOf(page, post.title)
        .getByRole('button', { name: 'Cập nhật trạng thái bài đăng' })
        .click()
      const edit = page.getByRole('dialog', { name: 'Cập nhật trạng thái', exact: true })
      await edit.getByRole('radio', { name: 'Đã đóng', exact: true }).check()
      await edit.getByRole('button', { name: 'Hủy', exact: true }).click()
      await expect(
        rowOf(page, post.title).getByText('Chờ xét duyệt', { exact: true })
      ).toBeVisible()
      const token = await tokenOf(api, manager)
      const unchanged = await api.get(`backoffice/posts/${post.id}`, { headers: bearer(token) })
      expect(unchanged.status()).toBe(200)
      expect((await unchanged.json()).data.status).toBe('pending')

      await rowOf(page, post.title)
        .getByRole('button', { name: 'Cập nhật trạng thái bài đăng' })
        .click()
      await edit.getByRole('radio', { name: 'Đã đóng', exact: true }).check()
      await edit.getByRole('button', { name: 'Cập nhật', exact: true }).click()
      await expect(page.getByText(`Đã cập nhật trạng thái bài ${post.code}.`)).toBeVisible()
      await expect(rowOf(page, post.title)).toHaveCount(0)
      await expect(page.getByText('Không tìm thấy bài đăng phù hợp', { exact: true })).toBeVisible()
      await statusFilter.selectOption('closed')
      await expect(rowOf(page, post.title).getByText('Đã đóng', { exact: true })).toBeVisible()
    })
  })
}
