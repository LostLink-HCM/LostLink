import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, tokenOf } from '../helpers/posts.js'

const ADMIN = { email: 'admin@lostlink.vn', password: 'Admin@123' }
const tableRegion = (page) =>
  page.getByRole('region', { name: 'Bảng người dùng, cuộn ngang để xem thêm' })
const userRow = (page, account) =>
  tableRegion(page)
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: account.username, exact: true }) })

const openAdminUsers = async (page) => {
  await page.goto('/admin/users')
  await loginThroughUi(page, ADMIN)
  await expect(tableRegion(page)).toBeVisible()
}

test.describe('Người dùng & quyền của admin', () => {
  test('người dùng thường không được truy cập trang quản lý', async ({ page, api }) => {
    const account = await createAccount(api)
    await page.goto('/admin/users')
    await loginThroughUi(page, account)

    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })).toBeVisible()
    await expect(tableRegion(page)).toHaveCount(0)
  })

  test('tìm kiếm, lọc theo vai trò/trạng thái và đặt lại bộ lọc', async ({ page, api }) => {
    const member = await createAccount(api)
    const moderator = await createAccount(api)
    const token = await tokenOf(api, ADMIN)
    const matchingUsers = await api.get(`admin/users?q=${encodeURIComponent(moderator.username)}`, {
      headers: bearer(token),
    })
    expect(matchingUsers.status()).toBe(200)
    const moderatorId = (await matchingUsers.json()).data.items[0].id
    const granted = await api.patch(`admin/users/${moderatorId}/grant-moderator`, {
      headers: bearer(token),
      data: { reason: 'Được phân công' },
    })
    expect(granted.status()).toBe(200)

    await openAdminUsers(page)
    const filters = page.getByRole('region', { name: 'Bộ lọc người dùng' })
    await filters.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(moderator.username)
    await expect(userRow(page, moderator)).toBeVisible()
    await filters.getByRole('combobox', { name: 'Vai trò' }).selectOption('moderator')
    await filters.getByRole('combobox', { name: 'Trạng thái' }).selectOption('active')
    await expect(userRow(page, moderator)).toBeVisible()
    await expect(userRow(page, member)).toHaveCount(0)

    await filters.getByRole('button', { name: 'Đặt lại bộ lọc người dùng' }).click()
    await expect(filters.getByRole('searchbox', { name: 'Tìm kiếm' })).toHaveValue('')
    await expect(filters.getByRole('combobox', { name: 'Vai trò' })).toHaveValue('')
    await expect(filters.getByRole('combobox', { name: 'Trạng thái' })).toHaveValue('')
    await expect(userRow(page, member)).toBeVisible()
  })

  test('xem hồ sơ và lịch sử thao tác của tài khoản', async ({ page, api }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, ADMIN)
    const list = await api.get(`admin/users?q=${encodeURIComponent(account.username)}`, {
      headers: bearer(token),
    })
    expect(list.status()).toBe(200)
    const id = (await list.json()).data.items[0].id
    const locked = await api.patch(`admin/users/${id}/lock`, {
      headers: bearer(token),
      data: { reason: 'Tài khoản cần xác minh' },
    })
    expect(locked.status()).toBe(200)

    await openAdminUsers(page)
    const filters = page.getByRole('region', { name: 'Bộ lọc người dùng' })
    await filters.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(account.username)
    const row = userRow(page, account)
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Hồ sơ', exact: true }).click()

    const profile = page.getByRole('dialog', { name: 'Hồ sơ người dùng' })
    await expect(profile.getByText(account.username, { exact: true })).toBeVisible()
    await expect(profile.getByText('Đã khóa', { exact: true })).toBeVisible()
    await expect(profile.getByRole('list', { name: 'Lịch sử tài khoản' })).toContainText(
      'Tài khoản cần xác minh'
    )
    await expect(
      profile.getByRole('button', { name: `Mở tài khoản · ${account.username}` })
    ).toBeEnabled()
  })

  test('khóa tài khoản sau khi nhập lý do hợp lệ rồi mở khóa lại', async ({ page, api }) => {
    const account = await createAccount(api)
    await openAdminUsers(page)
    const filters = page.getByRole('region', { name: 'Bộ lọc người dùng' })
    await filters.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(account.username)
    const row = userRow(page, account)
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: `Khóa tài khoản · ${account.username}` }).click()

    let dialog = page.getByRole('dialog', { name: 'Khóa tài khoản' })
    await dialog.getByRole('button', { name: 'Khóa', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('ít nhất 5 ký tự')
    await dialog.getByRole('textbox', { name: /Lý do/ }).fill('Vi phạm quy định')
    await dialog.getByRole('button', { name: 'Khóa', exact: true }).click()
    await expect(
      page.getByRole('status').filter({
        hasText: `Đã khóa tài khoản ${account.username}.`,
      })
    ).toBeVisible()
    await expect(userRow(page, account).getByText('Đã khóa', { exact: true })).toBeVisible()

    await userRow(page, account)
      .getByRole('button', { name: `Mở tài khoản · ${account.username}` })
      .click()
    dialog = page.getByRole('dialog', { name: 'Mở tài khoản' })
    await dialog.getByRole('button', { name: 'Mở khóa', exact: true }).click()
    await expect(
      page.getByRole('status').filter({
        hasText: `Đã mở khóa tài khoản ${account.username}.`,
      })
    ).toBeVisible()
    await expect(userRow(page, account).getByText('Hoạt động', { exact: true })).toBeVisible()
  })

  test('cấp và thu hồi quyền Moderator bằng lý do quản trị', async ({ page, api }) => {
    const account = await createAccount(api)
    await openAdminUsers(page)
    const filters = page.getByRole('region', { name: 'Bộ lọc người dùng' })
    await filters.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(account.username)
    const row = userRow(page, account)
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: `Cấp quyền Moderator · ${account.username}` }).click()
    let dialog = page.getByRole('dialog', { name: 'Cấp quyền Moderator' })
    await dialog.getByRole('button', { name: 'Cấp quyền Moderator', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('ít nhất 5 ký tự')
    await dialog.getByRole('textbox', { name: /Lý do/ }).fill('Được phân công')
    await dialog.getByRole('button', { name: 'Cấp quyền Moderator', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(
      `Đã cấp quyền Moderator cho ${account.username}.`
    )
    await expect(userRow(page, account).getByText('Moderator', { exact: true })).toBeVisible()

    await userRow(page, account)
      .getByRole('button', { name: `Thu hồi quyền Moderator · ${account.username}` })
      .click()
    dialog = page.getByRole('dialog', { name: 'Thu hồi quyền Moderator' })
    await dialog.getByRole('textbox', { name: /Lý do/ }).fill('Kết thúc nhiệm vụ')
    await dialog.getByRole('button', { name: 'Thu hồi quyền Moderator', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(
      `Đã thu hồi quyền Moderator của ${account.username}.`
    )
    await expect(userRow(page, account).getByText('Người dùng', { exact: true })).toBeVisible()
  })

  test('cho phép thử lại khi tải danh sách gặp lỗi tạm thời', async ({ page }) => {
    let failOnce = true
    await page.route(/\/api\/admin\/users(?:\?.*)?$/, async (route) => {
      if (failOnce) {
        failOnce = false
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Danh sách đang tạm thời không khả dụng.',
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/admin/users')
    await loginThroughUi(page, ADMIN)
    await expect(page.getByRole('alert')).toContainText('Danh sách đang tạm thời không khả dụng.')
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(tableRegion(page).getByRole('table').getByRole('row').first()).toBeVisible()
  })
})
