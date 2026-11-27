import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, createPost, tokenOf } from '../helpers/posts.js'

// Bài mẫu trong dữ liệu seed của backend E2E. Mỗi test mở một bài riêng vì các test chạy
// song song, mở chung một bài sẽ làm lệch số lượt xem mà test kia đang kiểm tra
const TITLE = 'Mất ví Louis Vuitton Monogram cỡ nhỏ gần Takashimaya'
const FOUND_TITLE = 'Nhặt được chìa khóa nhà có móc hình ngôi nhà'
// Bài của tài khoản seed user01 (mật khẩu cố định trong backend/src/seeds/userSeed.js)
const OWN_TITLE = 'Mất thẻ sinh viên trong bao nhựa trắng, dây đeo họa tiết lá'
const SEED_USER = { email: 'user@lostlink.vn', password: 'User@1234' }
const BACKOFFICE = [
  { role: 'admin', email: 'admin@lostlink.vn', password: 'Admin@123' },
  { role: 'moderator', email: 'mod@lostlink.vn', password: 'Mod@1234' },
]

const findCard = async (api, title) => {
  const res = await api.get(`posts?${new URLSearchParams({ q: title, range: '30d' })}`)
  expect(res.status()).toBe(200)
  const card = (await res.json()).data.items.find((item) => item.title === title)
  expect(card).toBeTruthy()
  return card
}

test.beforeEach(async ({ page }) => {
  // Chặn mọi ảnh không đến từ máy chạy test để không phụ thuộc mạng ngoài
  await page.route('**/*', (route) => {
    const request = route.request()
    const { hostname } = new URL(request.url())
    const external = hostname !== 'localhost' && hostname !== '127.0.0.1'
    return request.resourceType() === 'image' && external ? route.abort() : route.fallback()
  })
})

test.describe('UC04 - Xem chi tiết bài đăng', () => {
  test('bấm vào card mở bài theo slug, hiện đủ thông tin và tính một lượt xem', async ({
    page,
    api,
  }) => {
    // Danh sách không tính lượt xem nên lấy số lượt xem hiện tại từ card
    const card = await findCard(api, TITLE)

    await page.goto('/')
    const search = page.getByRole('searchbox', { name: 'Tìm bài đăng' }).filter({ visible: true })
    await search.fill(TITLE)
    await search.press('Enter')
    await page.getByRole('link', { name: TITLE }).click()

    await expect(page).toHaveURL(new RegExp(`/mat-do/${card.slug}$`))
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()

    const author = page.getByRole('complementary', { name: 'Người đăng và hành động' })
    await expect(author.getByRole('heading', { name: card.author.username })).toBeVisible()
    await expect(author.getByText('Điểm uy tín')).toBeVisible()
    await expect(author.getByText('Đã trao trả')).toBeVisible()

    await expect(page.getByText(`${card.counts.views + 1} lượt xem`)).toBeVisible()
    await expect(
      page.getByRole('heading', { name: `Bình luận · ${card.counts.comments}` })
    ).toBeVisible()

    // Guest bấm Thích thì được đưa sang Đăng nhập
    await page.getByRole('button', { name: /Thích/ }).first().click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('mở thẳng liên kết bài không tồn tại thì báo bài không tồn tại hoặc đã bị ẩn', async ({
    page,
  }) => {
    await page.goto('/nhat-duoc/bai-nay-khong-ton-tai')

    await expect(page.getByText('Không tìm thấy bài đăng')).toBeVisible()
    await expect(page.getByText('Bài đăng không tồn tại hoặc đã bị ẩn.')).toBeVisible()
  })

  test('không tải được bài thì báo lỗi và cho thử lại', async ({ page, api }) => {
    const card = await findCard(api, FOUND_TITLE)
    let failed = false
    // Lần gọi đầu giả lập lỗi server, lần thử lại thì cho qua
    await page.route(/\/api\/posts\/found\//, (route) => {
      if (failed) return route.fallback()
      failed = true
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal server error' }),
      })
    })

    await page.goto(`/nhat-duoc/${card.slug}`)
    await expect(page.getByText('Không thể tải bài đăng, vui lòng thử lại.')).toBeVisible()
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.getByRole('heading', { level: 1, name: FOUND_TITLE })).toBeVisible()
  })

  test('chủ bài xem bài của mình: không có nút nhận đồ, báo cáo và không tính lượt xem', async ({
    page,
    api,
  }) => {
    const card = await findCard(api, OWN_TITLE)

    await page.goto('/login')
    await loginThroughUi(page, SEED_USER)
    await expect(page.getByRole('button', { name: 'Menu tài khoản' })).toBeVisible()

    await page.goto(`/mat-do/${card.slug}`)
    await expect(page.getByRole('heading', { level: 1, name: OWN_TITLE })).toBeVisible()
    await expect(page.getByText(`${card.counts.views} lượt xem`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tôi đang giữ món này' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Báo cáo bài đăng này/ })).toHaveCount(0)
    // Khối manh mối (gợi ý ghép cặp) chỉ hiện với bài của chính mình
    await expect(page.getByRole('heading', { name: 'Manh mối' })).toBeVisible()
  })

  for (const [index, manager] of BACKOFFICE.entries()) {
    test(`${manager.role} xem bài chờ duyệt, lịch sử và thao tác kiểm duyệt trên trang chi tiết`, async ({
      page,
      api,
    }) => {
      const owner = await createAccount(api)
      const ownerToken = await tokenOf(api, owner)
      const title = `Bài chờ duyệt ${manager.role} ${Date.now().toString(36)}`
      const post = await createPost(api, ownerToken, { title, approve: false })

      await page.goto('/login')
      await loginThroughUi(page, manager)
      const navigationName = manager.role === 'admin' ? 'Điều hướng admin' : 'Điều hướng moderator'
      await expect(page.getByRole('navigation', { name: navigationName })).toBeVisible()
      await page.goto(`/mat-do/${post.slug}`)

      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
      const actions = page.getByRole('region', { name: 'Thao tác kiểm duyệt' })
      await expect(actions.getByRole('button', { name: 'Duyệt', exact: true })).toBeVisible()
      await expect(actions.getByRole('button', { name: 'Từ chối', exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Lịch sử trạng thái' })).toContainText(
        'Chờ xét duyệt'
      )

      const isApprove = index === 0
      const endpoint = `/api/backoffice/posts/${post.id}/${isApprove ? 'approve' : 'reject'}`
      const responsePromise = page.waitForResponse(
        (response) => response.url().endsWith(endpoint) && response.request().method() === 'POST'
      )
      await actions
        .getByRole('button', { name: isApprove ? 'Duyệt' : 'Từ chối', exact: true })
        .click()
      const dialog = page.getByRole('dialog', { name: 'Xác nhận' })
      if (isApprove) {
        await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click()
      } else {
        await dialog.getByRole('combobox', { name: 'Lý do từ chối' }).selectOption('other')
        await dialog
          .getByRole('textbox', { name: 'Lý do từ chối' })
          .fill('Ảnh chưa thể hiện rõ món đồ')
        await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click()
      }
      const response = await responsePromise
      expect(response.status()).toBe(200)
      if (!isApprove) {
        expect(response.request().postDataJSON()).toEqual({ reason: 'Ảnh chưa thể hiện rõ món đồ' })
      }

      const managerToken = await tokenOf(api, manager)
      const saved = await api.get(`backoffice/posts/${post.id}`, {
        headers: bearer(managerToken),
      })
      expect(saved.status()).toBe(200)
      expect((await saved.json()).data.status).toBe(isApprove ? 'searching' : 'rejected')
      await expect(page.getByRole('region', { name: 'Lịch sử trạng thái' })).toContainText(
        isApprove ? 'Đang tìm' : 'Đã từ chối'
      )
      if (!isApprove) {
        await expect(page.getByRole('region', { name: 'Lịch sử trạng thái' })).toContainText(
          'Lý do: Ảnh chưa thể hiện rõ món đồ'
        )
      }
    })
  }
})
