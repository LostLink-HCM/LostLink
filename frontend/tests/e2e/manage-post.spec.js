import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, createPost, tokenOf } from '../helpers/posts.js'

// Hồ sơ cá nhân, sửa, xoá, đóng bài và hồ sơ người khác. Mỗi test tự tạo tài khoản và bài qua API

// Tài khoản mới có sẵn bài, đăng nhập trên trình duyệt rồi mở trang cá nhân
async function openMyProfile(page, account) {
  await page.goto(`/users/${account.username}`)
  await loginThroughUi(page, account)
  await expect(page.getByRole('heading', { level: 1, name: account.username })).toBeVisible()
}

const cardOf = (page, title) => page.getByRole('article').filter({ hasText: title })

// Mở menu ⋯ của một bài trên trang cá nhân, trả về menu để chọn mục
const openPostMenu = async (page, title) => {
  await page.getByRole('button', { name: `Tuỳ chọn bài ${title}` }).click()
  const menu = page.getByRole('menu', { name: `Thao tác với bài ${title}` })
  await expect(menu).toBeVisible()
  return menu
}

test.beforeEach(async ({ page }) => {
  // Chặn ảnh và bản đồ ngoài máy chạy test để không phụ thuộc mạng
  await page.route('**/*', (route) => {
    const request = route.request()
    const { hostname } = new URL(request.url())
    const external = hostname !== 'localhost' && hostname !== '127.0.0.1'
    return external && request.resourceType() !== 'document' ? route.abort() : route.continue()
  })
})

test.describe('UC13 - Xem hồ sơ cá nhân', () => {
  test('Tất cả xếp mới nhất trước, gồm cả bài chờ duyệt; tab Chờ duyệt chỉ có bài chờ duyệt', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, account)
    await createPost(api, token, { title: 'Mất ví da nâu ở chợ Bến Thành' })
    await createPost(api, token, { title: 'Mất ví vải xám ở căng tin', approve: false })

    await openMyProfile(page, account)

    const listed = page.getByRole('region', { name: 'Bài đăng' })
    const tabs = listed.getByRole('group', { name: 'Lọc bài đăng' })
    await expect(tabs.getByRole('button', { name: /^Tất cả/ })).toHaveText(/^Tất cả\s*2$/)
    await expect(tabs.getByRole('button', { name: /^Chờ duyệt/ })).toHaveText(/^Chờ duyệt\s*1$/)
    // Bài đăng sau đứng trước
    await expect(listed.getByRole('article').first()).toContainText('Mất ví vải xám ở căng tin')
    await expect(listed.getByRole('article').nth(1)).toContainText('Mất ví da nâu ở chợ Bến Thành')
    // Nút quản lý gom trong menu ⋯, không hiện thẳng trên thẻ
    await expect(listed.getByRole('button', { name: 'Đóng bài' })).toHaveCount(0)
    const searching = await openPostMenu(page, 'Mất ví da nâu ở chợ Bến Thành')
    await expect(searching.getByRole('menuitem')).toHaveText(['Sửa bài', 'Đóng bài', 'Xóa bài'])
    // Bàn phím: focus mục đầu, mũi tên chuyển mục, Esc đóng và trả focus về nút ⋯
    await expect(searching.getByRole('menuitem', { name: 'Sửa bài' })).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(searching.getByRole('menuitem', { name: 'Xóa bài' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(searching).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Tuỳ chọn bài Mất ví da nâu ở chợ Bến Thành' })
    ).toBeFocused()

    await tabs.getByRole('button', { name: /^Chờ duyệt/ }).click()
    await expect(listed.getByRole('article')).toHaveCount(1)
    const pending = cardOf(listed, 'Mất ví vải xám ở căng tin')
    await expect(pending.getByText('Chờ duyệt', { exact: true })).toBeVisible()
    // Bài chờ duyệt chưa công khai nên menu không có Đóng bài
    const pendingMenu = await openPostMenu(page, 'Mất ví vải xám ở căng tin')
    await expect(pendingMenu.getByRole('menuitem')).toHaveText(['Sửa bài', 'Xóa bài'])
    // Bấm ra ngoài thì menu đóng
    await page.getByRole('heading', { name: 'Bài đăng' }).click()
    await expect(pendingMenu).toBeHidden()
  })

  test('tài khoản chưa có bài thì gợi ý đăng bài', async ({ page, api }) => {
    const account = await createAccount(api)
    await openMyProfile(page, account)
    await expect(page.getByText('Bạn chưa có bài đăng nào')).toBeVisible()
    // Nút trong danh sách bài, không phải nút trên header
    const listed = page.getByRole('region', { name: 'Bài đăng' })
    await expect(listed.getByRole('link', { name: 'Đăng bài', exact: true })).toBeVisible()
  })
})

test.describe('UC27 - Đóng bài / đánh dấu đã trao trả', () => {
  test('đánh dấu đã trao trả từ trang cá nhân: bài rời danh sách, số lần trao trả tăng', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, account)
    const title = 'Nhặt được ví da nâu ở chợ Bến Thành'
    await createPost(api, token, { title, type: 'found' })

    await openMyProfile(page, account)
    await (await openPostMenu(page, title)).getByRole('menuitem', { name: 'Đóng bài' }).click()

    const dialog = page.getByRole('dialog', { name: 'Cập nhật trạng thái bài' })
    await dialog.getByRole('radio', { name: /Đánh dấu đã trao trả/ }).check()
    await dialog.getByRole('button', { name: 'Xác nhận' }).click()

    await expect(page.getByText('Cập nhật trạng thái bài thành công.')).toBeVisible()
    await expect(cardOf(page, title)).toHaveCount(0)
    const me = await (await api.get('users/me', { headers: bearer(token) })).json()
    expect(me.data.profile.returnCount).toBe(1)
  })

  test('đóng bài từ trang chi tiết: bài hiện Đã đóng, không còn nút Đóng bài', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, account)
    const post = await createPost(api, token, { title: 'Mất ví da đen ở công viên' })

    // Đăng nhập qua trang cá nhân rồi mở bài
    await openMyProfile(page, account)
    await page.goto(`/mat-do/${post.slug}`)

    const manage = page.getByRole('region', { name: 'Quản lý bài đăng' })
    await manage.getByRole('button', { name: 'Đóng bài' }).click()
    const dialog = page.getByRole('dialog', { name: 'Cập nhật trạng thái bài' })
    await dialog.getByRole('button', { name: 'Xác nhận' }).click()

    await expect(page.getByText('Cập nhật trạng thái bài thành công.')).toBeVisible()
    await expect(page.getByText('Đã đóng', { exact: true })).toBeVisible()
    await expect(manage.getByRole('button', { name: 'Đóng bài' })).toHaveCount(0)
  })
})

test.describe('UC25 - Sửa bài', () => {
  test('sửa từ trang chi tiết: form có dữ liệu cũ, lưu xong bài về Chờ duyệt', async ({
    page,
    api,
  }) => {
    test.slow()
    const account = await createAccount(api)
    const token = await tokenOf(api, account)
    const post = await createPost(api, token, { title: 'Mất ví da nâu gần Hồ Con Rùa' })

    await openMyProfile(page, account)
    await page.getByRole('link', { name: 'Mất ví da nâu gần Hồ Con Rùa' }).click()
    await page
      .getByRole('region', { name: 'Quản lý bài đăng' })
      .getByRole('button', { name: 'Sửa bài' })
      .click()

    await expect(page).toHaveURL(new RegExp(`/posts/${post.id}/edit$`))
    await expect(page.getByRole('heading', { name: 'Sửa bài đăng' })).toBeVisible()
    // Loại tin đã đăng không đổi được
    await expect(page.getByRole('button', { name: /Tôi nhặt được đồ/ })).toBeDisabled()

    const next = () => page.getByRole('button', { name: 'Tiếp tục' }).click()
    await next()
    const titleBox = page.getByLabel(/Tiêu đề/)
    await expect(titleBox).toHaveValue('Mất ví da nâu gần Hồ Con Rùa')
    await titleBox.fill('Mất ví da nâu sẫm gần Hồ Con Rùa')
    await next()
    await next()
    await page.getByRole('button', { name: 'Xem lại & lưu' }).click()

    const review = page.getByRole('dialog', { name: 'Xem lại bài đăng' })
    await review.getByRole('button', { name: 'Lưu thay đổi' }).click()

    await expect(page.getByText('Đã lưu thay đổi, bài đang chờ LostLink duyệt lại.')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/mat-do/${post.slug}$`))
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mất ví da nâu sẫm gần Hồ Con Rùa' })
    ).toBeVisible()
    await expect(
      page.getByText('Bài đang chờ LostLink duyệt, chưa hiển thị công khai.')
    ).toBeVisible()
  })
})

test.describe('UC26 - Xóa bài', () => {
  test('xoá từ trang cá nhân sau khi xác nhận; bấm Hủy thì không xoá', async ({ page, api }) => {
    const account = await createAccount(api)
    const token = await tokenOf(api, account)
    const title = 'Mất ví da xanh ở bến xe'
    const post = await createPost(api, token, { title })

    await openMyProfile(page, account)
    await (await openPostMenu(page, title)).getByRole('menuitem', { name: 'Xóa bài' }).click()
    const dialog = page.getByRole('dialog', { name: 'Xóa bài đăng?' })
    await expect(dialog.getByText('Bạn có chắc muốn xóa bài đăng')).toBeVisible()
    await dialog.getByRole('button', { name: 'Hủy' }).click()
    await expect(cardOf(page, title)).toBeVisible()

    await (await openPostMenu(page, title)).getByRole('menuitem', { name: 'Xóa bài' }).click()
    await dialog.getByRole('button', { name: 'Xóa', exact: true }).click()

    await expect(page.getByText('Đã xóa bài đăng.')).toBeVisible()
    await expect(cardOf(page, title)).toHaveCount(0)
    expect((await api.get(`posts/lost/${post.slug}`)).status()).toBe(404)
  })
})

test.describe('UC20 - Xem hồ sơ người dùng khác', () => {
  test('chỉ thấy bài công khai, không có Chờ duyệt; menu ⋯ có liên hệ, lưu, theo dõi, báo cáo', async ({
    page,
    api,
  }) => {
    const owner = await createAccount(api)
    const ownerToken = await tokenOf(api, owner)
    const title = 'Mất ví da nâu ở bến Bạch Đằng'
    await createPost(api, ownerToken, { title })
    await createPost(api, ownerToken, { title: 'Bài chưa duyệt của người khác', approve: false })
    const viewer = await createAccount(api)

    await page.goto(`/users/${owner.username}`)
    await loginThroughUi(page, viewer)
    await expect(page.getByRole('heading', { level: 1, name: owner.username })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Theo dõi', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Chặn', exact: true })).toBeVisible()

    const listed = page.getByRole('region', { name: 'Bài đăng' })
    const tabs = listed.getByRole('group', { name: 'Lọc bài đăng' })
    await expect(tabs.getByRole('button')).toHaveText([
      /^Tất cả\s*1$/,
      /^Mất đồ\s*1$/,
      /^Nhặt được\s*0$/,
    ])
    await expect(listed.getByRole('article')).toHaveCount(1)
    await expect(listed.getByText('Bài chưa duyệt của người khác')).toHaveCount(0)

    const menu = await openPostMenu(page, title)
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Tôi đang giữ món này',
      'Lưu bài',
      'Theo dõi bài',
      'Báo cáo bài đăng',
    ])
    await menu.getByRole('menuitem', { name: 'Lưu bài' }).click()
    await expect(page.getByText('Đã lưu bài.')).toBeVisible()
    await expect(
      (await openPostMenu(page, title)).getByRole('menuitem', { name: 'Bỏ lưu bài' })
    ).toBeVisible()

    // Báo cáo mở đúng bài vừa chọn
    await page.getByRole('menuitem', { name: 'Báo cáo bài đăng' }).click()
    await expect(page).toHaveURL(/\/posts\/[0-9a-f]{24}\/report$/)
    await expect(page.getByText(title)).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Kể cho LostLink chuyện gì đang xảy ra' })
    ).toBeVisible()
  })

  test('tài khoản không tồn tại thì báo không tìm thấy người dùng', async ({ page, api }) => {
    const viewer = await createAccount(api)
    await page.goto('/users/khong.co.ai.ten.nay')
    await loginThroughUi(page, viewer)
    await expect(page.getByText('Không tìm thấy người dùng')).toBeVisible()
  })
})
