import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, createPost, tokenOf } from '../helpers/posts.js'

// Thích, lưu, theo dõi, bình luận, thông báo. Mỗi test tự tạo tài khoản và bài qua API

test.beforeEach(async ({ page }) => {
  // Chặn ảnh và bản đồ ngoài máy chạy test để không phụ thuộc mạng
  await page.route('**/*', (route) => {
    const request = route.request()
    const { hostname } = new URL(request.url())
    const external = hostname !== 'localhost' && hostname !== '127.0.0.1'
    return external && request.resourceType() !== 'document' ? route.abort() : route.continue()
  })
})

// Tạo bài của người khác, đăng nhập người xem rồi mở bài
async function openOthersPost(page, api, title) {
  const owner = await createAccount(api)
  const ownerToken = await tokenOf(api, owner)
  const post = await createPost(api, ownerToken, { title })
  const viewer = await createAccount(api)

  await page.goto('/login')
  await loginThroughUi(page, viewer)
  await expect(page).toHaveURL(/\/$/)
  await page.goto(`/mat-do/${post.slug}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  return { owner, ownerToken, viewer, post }
}

test.describe('UC31, UC32, UC34 - Thích, lưu, theo dõi bài', () => {
  test('thích, lưu, theo dõi được lưu trên server, tải lại trang vẫn giữ', async ({
    page,
    api,
  }) => {
    const title = 'Mất ví da nâu ở công viên Tao Đàn'
    await openOthersPost(page, api, title)
    const aside = page.getByRole('complementary', { name: 'Người đăng và hành động' })

    await page.getByRole('button', { name: /Thích/ }).first().click()
    await aside.getByRole('button', { name: 'Lưu bài' }).click()
    await expect(page.getByText('Đã lưu bài.')).toBeVisible()
    await aside.getByRole('button', { name: 'Theo dõi' }).click()
    await expect(page.getByText('Đã theo dõi bài đăng.')).toBeVisible()

    await page.reload()
    await expect(aside.getByRole('button', { name: 'Đã lưu' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(aside.getByRole('button', { name: 'Đang theo dõi' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByRole('button', { name: /Bỏ thích|Đã thích/ }).first()).toBeVisible()
  })
})

test.describe('UC33 - Bài đã lưu', () => {
  test('bài đã lưu hiện ở mục Đã lưu trong menu tài khoản, bỏ lưu thì mất khỏi danh sách', async ({
    page,
    api,
  }) => {
    const title = 'Mất ví vải xanh ở nhà sách Nguyễn Văn Cừ'
    await openOthersPost(page, api, title)
    const aside = page.getByRole('complementary', { name: 'Người đăng và hành động' })
    await aside.getByRole('button', { name: 'Lưu bài' }).click()
    await expect(page.getByText('Đã lưu bài.')).toBeVisible()

    await page.getByRole('button', { name: 'Menu tài khoản' }).click()
    await page.getByRole('menuitem', { name: 'Đã lưu' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Đã lưu' })).toBeVisible()
    await expect(page.getByRole('article').filter({ hasText: title })).toBeVisible()

    await page.getByRole('button', { name: `Bỏ lưu bài ${title}` }).click()
    await expect(page.getByText('Bạn chưa lưu bài nào')).toBeVisible()
  })
})

test.describe('UC28, UC29, UC30 - Bình luận', () => {
  test('gửi, sửa (có nhãn đã sửa) và xoá bình luận của mình; gửi nhanh bị chặn', async ({
    page,
    api,
  }) => {
    await openOthersPost(page, api, 'Mất ví da đen ở bến xe Miền Đông')
    const comments = page.getByRole('region', { name: /Bình luận/ })
    const box = page.getByLabel('Viết bình luận')

    await box.fill('Mình thấy ví này ở quầy bảo vệ')
    await page.getByRole('button', { name: 'Gửi bình luận' }).click()
    await expect(comments.getByText('Mình thấy ví này ở quầy bảo vệ')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bình luận · 1' })).toBeVisible()

    // Gửi tiếp ngay thì bị chặn 15 giây, nội dung vẫn giữ
    await box.fill('Bình luận thứ hai')
    await page.getByRole('button', { name: 'Gửi bình luận' }).click()
    await expect(
      page.getByText('Vui lòng chờ 15 giây trước khi gửi bình luận tiếp theo.')
    ).toBeVisible()
    await expect(box).toHaveValue('Bình luận thứ hai')

    await comments.getByRole('button', { name: 'Sửa' }).click()
    await page.getByLabel('Sửa bình luận').fill('Mình thấy ví ở quầy bảo vệ tầng 1')
    await comments.getByRole('button', { name: 'Lưu' }).click()
    await expect(comments.getByText('Mình thấy ví ở quầy bảo vệ tầng 1')).toBeVisible()
    await expect(comments.getByText(/đã sửa/)).toBeVisible()

    await page.reload()
    await expect(comments.getByText('Mình thấy ví ở quầy bảo vệ tầng 1')).toBeVisible()
    await comments.getByRole('button', { name: 'Xoá' }).click()
    await comments.getByRole('button', { name: 'Xoá' }).click()
    await expect(comments.getByText('Chưa có bình luận nào.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bình luận · 0' })).toBeVisible()
  })
})

test.describe('UC47 - Trung tâm thông báo', () => {
  test('người khác bình luận thì chủ bài thấy số trên chuông, mở thông báo tới đúng bài', async ({
    page,
    api,
  }) => {
    const owner = await createAccount(api)
    const ownerToken = await tokenOf(api, owner)
    const title = 'Mất ví da nâu ở chợ Tân Định'
    const post = await createPost(api, ownerToken, { title })
    // Người khác bình luận qua API
    const commenter = await createAccount(api)
    const commenterToken = await tokenOf(api, commenter)
    const commented = await api.post(`posts/${post.id}/comments`, {
      headers: bearer(commenterToken),
      data: { body: 'Mình nhặt được ví giống vậy' },
    })
    expect(commented.status()).toBe(201)

    await page.goto('/notifications')
    await loginThroughUi(page, owner)
    await expect(page.getByRole('heading', { level: 1, name: 'Thông báo' })).toBeVisible()
    // Duyệt bài và bình luận đều chưa đọc
    await expect(page.getByText('2 thông báo · 2 chưa đọc')).toBeVisible()
    await expect(page.getByRole('link', { name: /Thông báo.*2/ }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Bài đăng', exact: true }).click()
    const item = page.getByRole('button', {
      name: new RegExp(`${commenter.username} đã bình luận về bài`),
    })
    await expect(item).toBeVisible()
    await item.click()

    await expect(page).toHaveURL(new RegExp(`/mat-do/${post.slug}$`))
    await expect(page.getByText('Mình nhặt được ví giống vậy')).toBeVisible()

    await page.goto('/notifications')
    await expect(page.getByText('2 thông báo · 1 chưa đọc')).toBeVisible()
    await page.getByRole('button', { name: 'Đánh dấu đã đọc hết' }).click()
    await expect(page.getByText('2 thông báo · 0 chưa đọc')).toBeVisible()
  })
})
