import { createAccount, expect, latestMail, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, tokenOf } from '../helpers/posts.js'

test('chủ bài nhận thông báo và email danh mục lưu trữ, mở form chọn lại danh mục', async ({
  page,
  api,
}) => {
  const adminToken = await tokenOf(api, { email: 'admin@lostlink.vn', password: 'Admin@123' })
  const categoryName = `Danh mục ngừng sử dụng ${Date.now().toString(36)}`
  const categoryResponse = await api.post('admin/categories', {
    headers: bearer(adminToken),
    data: { name: categoryName },
  })
  expect(categoryResponse.status()).toBe(201)
  const category = (await categoryResponse.json()).data
  const account = await createAccount(api)
  const ownerToken = await tokenOf(api, account)
  const title = `Bài cần đổi danh mục ${Date.now().toString(36)}`
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const created = await api.post('posts', {
    headers: bearer(ownerToken),
    multipart: {
      data: JSON.stringify({
        type: 'lost',
        category: category.slug,
        attributes: [],
        contents: [],
        title,
        description: 'Món đồ cần tìm và cập nhật danh mục.',
        date,
        dayPart: 'morning',
        location: { mode: 'pin', area: 'Quận 1', point: { lat: 10.7725, lng: 106.698 } },
      }),
    },
  })
  expect(created.status()).toBe(201)
  const post = (await created.json()).data
  const archived = await api.delete(`admin/categories/${category.id}`, {
    headers: bearer(adminToken),
  })
  expect(archived.status()).toBe(200)

  const email = await latestMail(account.email, 'category_archived')
  expect(email.categoryName).toBe(categoryName)
  expect(email.posts).toHaveLength(1)
  expect(email.posts[0]).toMatchObject({ title, status: 'pending' })
  await page.goto('/notifications')
  await loginThroughUi(page, account)
  await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible()
  const notice = page.getByRole('button').filter({ hasText: 'Danh mục bài đăng đã ngừng sử dụng' })
  await expect(notice).toContainText(title)
  await expect(notice).toContainText(categoryName)
  await expect(notice).toContainText('các gợi ý đang chờ sẽ được xét lại sau khi duyệt')
  await expect(notice).toContainText('Chỉnh sửa bài đăng')
  await notice.click()
  await expect(page).toHaveURL(new RegExp(`/posts/${post.id}/edit$`))
  await expect(page.getByRole('heading', { name: 'Sửa bài đăng', exact: true })).toBeVisible()
})
