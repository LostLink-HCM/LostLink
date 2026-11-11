import { expect, test } from '../helpers/auth.js'

const feed = (page) => page.getByRole('region', { name: 'Danh sách bài đăng' })
const cards = (page) => feed(page).getByRole('article')
const cardTitles = (page) => cards(page).getByRole('heading', { level: 3 }).allTextContents()
const filters = (page) => page.getByRole('complementary', { name: 'Bộ lọc bài đăng' })

const listFromApi = async (api, params = {}) => {
  const res = await api.get(`posts?${new URLSearchParams({ limit: '50', ...params })}`)
  expect(res.status()).toBe(200)
  return (await res.json()).data
}

const PAGE_SIZE = 12

const END_OF_FEED = /Đã hiển thị hết (\d+) bài đăng/

// Cuộn tới khi trang báo đã tải hết, trả về số bài trang báo. Thời gian chờ theo số trang
// vì dữ liệu seed thay đổi. Test song song có thể đăng thêm bài nên chỉ đòi tối thiểu atLeast
const scrollToEnd = async (page, atLeast) => {
  const pages = Math.ceil(atLeast / PAGE_SIZE)
  const wait = Math.max(20_000, pages * 3_000)
  test.info().setTimeout(test.info().timeout + wait)
  const end = page.getByText(END_OF_FEED)
  await expect(async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(end).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: wait })
  const shown = Number((await end.textContent()).match(END_OF_FEED)[1])
  expect(shown).toBeGreaterThanOrEqual(atLeast)
  return shown
}

test.beforeEach(async ({ page }) => {
  // Chặn mọi ảnh không đến từ máy chạy test (Wikimedia, Cloudinary...) để test không phụ thuộc
  // mạng ngoài, đổi nguồn ảnh cũng không phải sửa test
  await page.route('**/*', (route) => {
    const request = route.request()
    const { hostname } = new URL(request.url())
    const external = hostname !== 'localhost' && hostname !== '127.0.0.1'
    return request.resourceType() === 'image' && external ? route.abort() : route.continue()
  })
})

test.describe('UC01 - Xem danh sách tin mới', () => {
  test('hiện trang đầu, cuộn gần cuối thì tự tải tiếp tới khi hết bài', async ({ page, api }) => {
    const { total } = await listFromApi(api)
    expect(total).toBeGreaterThan(12)

    await page.goto('/')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await expect(page.getByRole('button', { name: /Xóa lọc/ })).toHaveCount(0)

    const shown = await scrollToEnd(page, total)
    await expect(cards(page)).toHaveCount(shown)
  })
})

test.describe('UC02 - Lọc và tìm kiếm bài đăng', () => {
  test('lọc theo khu vực rồi xóa lọc để quay về danh sách mặc định', async ({ page, api }) => {
    const expected = await listFromApi(api, { area: 'Quận Bình Thạnh', range: '30d' })
    expect(expected.total).toBeGreaterThan(0)

    await page.goto('/')
    await expect(cards(page)).toHaveCount(12)

    const panel = filters(page)
    await panel.getByRole('button', { name: 'Xem tất cả 22 khu vực' }).click()
    await panel.getByRole('button', { name: 'Quận Bình Thạnh', exact: true }).click()
    // Chọn xong danh sách khu vực tự thu gọn, chỉ còn khu vực vừa chọn
    await expect(
      panel.getByRole('button', { name: 'Quận Bình Thạnh', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('button', { name: 'Quận 1', exact: true })).toHaveCount(0)
    await panel.getByRole('button', { name: '30 ngày qua' }).click()
    await panel.getByRole('button', { name: 'Áp dụng bộ lọc' }).click()

    // Kết quả lọc có thể dài hơn một trang, cuộn hết rồi mới so với API
    await expect(page.getByRole('button', { name: /Xóa lọc/ })).toBeVisible()
    if (expected.total > PAGE_SIZE) await scrollToEnd(page, expected.total)
    await expect(cards(page)).toHaveCount(expected.total)
    expect((await cardTitles(page)).sort()).toEqual(expected.items.map((p) => p.title).sort())

    const reset = panel.getByRole('button', { name: 'Xóa lọc, đang chọn 2 tiêu chí' })
    await reset.click()
    await expect(reset).toHaveCount(0)
    await expect(cards(page)).toHaveCount(12)
  })

  test('tìm từ khóa không dấu vẫn ra bài có dấu, không có kết quả thì báo rõ', async ({
    page,
    api,
  }) => {
    const expected = await listFromApi(api, { q: 'cho poodle' })
    expect(expected.total).toBeGreaterThan(0)

    await page.goto('/')
    const search = page.getByRole('searchbox', { name: 'Tìm bài đăng' }).filter({ visible: true })
    await search.fill('cho poodle')
    await search.press('Enter')

    await expect(cards(page)).toHaveCount(expected.total)
    await expect(feed(page).getByRole('heading', { name: /Chó Poodle/ })).toBeVisible()

    await search.fill('khongcobaidangnaonhuthe')
    await search.press('Enter')
    await expect(feed(page).getByText('Không tìm thấy bài đăng phù hợp')).toBeVisible()
  })

  test('danh mục đang lọc bị xoá thì báo và gợi ý xem tất cả danh mục', async ({ page }) => {
    // Giả lập Admin vừa xoá danh mục Thú cưng trong lúc người dùng đang lọc theo nó
    await page.route(/\/api\/posts\?.*category=thu-cung/, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Danh mục này không còn tồn tại.',
          code: 'CATEGORY_NOT_FOUND',
        }),
      })
    )

    await page.goto('/')
    const panel = filters(page)
    await panel.getByRole('button', { name: 'Xem tất cả 8 danh mục' }).click()
    await panel.getByRole('button', { name: 'Thú cưng', exact: true }).click()
    await panel.getByRole('button', { name: 'Áp dụng bộ lọc' }).click()

    await expect(feed(page).getByText('Danh mục này không còn tồn tại.')).toBeVisible()
    await feed(page).getByRole('button', { name: 'Xem tất cả danh mục' }).click()

    await expect(cards(page)).toHaveCount(12)
    await expect(panel.getByRole('button', { name: 'Tất cả danh mục' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})

test.describe('UC03 - Xem tin hot', () => {
  test('bài nổi bật nhất đứng đầu trang Tin hot', async ({ page, api }) => {
    const hot = await listFromApi(api, { sort: 'hot' })
    const latest = await listFromApi(api)
    // Dữ liệu mẫu phải có thứ tự khác nhau giữa hai trang thì test mới có ý nghĩa
    expect(hot.items[0].title).not.toBe(latest.items[0].title)

    await page.goto('/trending')
    await expect(cards(page).first().getByRole('heading', { level: 3 })).toHaveText(
      hot.items[0].title
    )
  })
})
