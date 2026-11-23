import { expect, loginThroughUi, test } from '../helpers/auth.js'

const ADMIN = { email: 'admin@lostlink.vn', password: 'Admin@123' }
const FILTERS = (page) => page.getByRole('region', { name: 'Bộ lọc Dashboard' })

const mockDashboardApi = async (page, requests) => {
  await page.route('**/api/admin/dashboard**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const area = url.searchParams.get('area') || ''
    const posts = area ? 3 : 12
    const lost = posts - 1
    const days =
      Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
    const daily = Array.from({ length: days }, (_, index) => ({
      date: new Date(Date.parse(`${from}T00:00:00Z`) + index * 86_400_000)
        .toISOString()
        .slice(0, 10),
      lost: index === 0 ? lost : 0,
      found: index === 0 ? 1 : 0,
      matches: index === 0 ? 4 : 0,
      successful: index === 0 ? 2 : 0,
      reports: index === 0 ? 1 : 0,
      locks: index === 0 ? 1 : 0,
    }))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          from,
          to,
          area,
          areaOptions: ['Quận 1', 'Quận Bình Thạnh'],
          totals: {
            lost,
            found: 1,
            posts,
            matches: 4,
            successful: 2,
            reports: 1,
            locks: 1,
            rate: 50,
          },
          previous: {
            lost: 4,
            found: 4,
            posts: 8,
            matches: 2,
            successful: 1,
            reports: 2,
            locks: 0,
            rate: 50,
          },
          daily,
          days,
          previousRange: {
            from: new Date(Date.parse(`${from}T00:00:00Z`) - days * 86_400_000)
              .toISOString()
              .slice(0, 10),
            to: new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10),
          },
          areas: [
            {
              name: area || 'Quận 1',
              rank: area === 'Quận Bình Thạnh' ? 3 : 1,
              posts,
              matches: 4,
              successful: 2,
              reports: 1,
              locks: 0,
              change: 50,
            },
          ],
          areaRanking: [
            { name: 'Quận 1', rank: 1, posts: 6 },
            { name: 'Quận 3', rank: 2, posts: 3 },
            { name: 'Quận Bình Thạnh', rank: 3, posts: 3 },
          ],
          areaMaxPosts: 12,
          categories: [{ name: 'Ví & tiền', posts, change: 50 }],
          average: posts / days,
          hasData: true,
          canCompare: true,
        },
      }),
    })
  })
}

const openDashboard = async (page) => {
  await page.goto('/admin/dashboard')
  await loginThroughUi(page, ADMIN)
  await expect(page.getByRole('region', { name: 'Chỉ số tổng quan' })).toBeVisible()
}

test.describe('Dashboard admin', () => {
  test('hiển thị số liệu lấy từ API', async ({ page }) => {
    const requests = []
    await mockDashboardApi(page, requests)
    await openDashboard(page)

    await expect(page.getByText('Tỷ lệ bài đăng có gợi ý ghép cặp')).toBeVisible()
    await expect(page.getByText('12', { exact: true }).first()).toBeVisible()
    expect(requests.length).toBeGreaterThan(0)
    expect(requests.at(-1).pathname).toBe('/api/admin/dashboard')
  })

  test('đổi khoảng ngày và khu vực thì gọi lại API với bộ lọc mới', async ({ page }) => {
    const requests = []
    await mockDashboardApi(page, requests)
    await openDashboard(page)

    const filters = FILTERS(page)
    await filters.getByLabel('Từ ngày').fill('2026-11-01')
    await filters.getByLabel('Đến ngày').fill('2026-11-10')
    await filters.getByRole('combobox', { name: 'Khu vực' }).selectOption('Quận Bình Thạnh')

    await expect.poll(() => requests.at(-1)?.searchParams.get('area')).toBe('Quận Bình Thạnh')
    expect(requests.at(-1).searchParams.get('from')).toBe('2026-11-01')
    expect(requests.at(-1).searchParams.get('to')).toBe('2026-11-10')
    await expect(page.getByText('3', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('03', { exact: true })).toBeVisible()
  })

  test('chọn một lát Doughnut sẽ lọc Dashboard theo khu vực đó', async ({ page }) => {
    const requests = []
    await mockDashboardApi(page, requests)
    await openDashboard(page)

    const donut = page.getByRole('group', { name: 'Tỷ lệ bài đăng theo khu vực' })
    await donut.getByRole('button', { name: /Quận Bình Thạnh/ }).click()

    await expect.poll(() => requests.at(-1)?.searchParams.get('area')).toBe('Quận Bình Thạnh')
    await expect(FILTERS(page).getByRole('combobox', { name: 'Khu vực' })).toHaveValue(
      'Quận Bình Thạnh'
    )
    const postsPanel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Số tin theo ngày' }) })
    await expect(postsPanel.locator('strong').first()).toHaveText('3')
  })
})
