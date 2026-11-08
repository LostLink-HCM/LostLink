import { expect, test } from '../helpers/auth.js'

// Bài seed dạng đoạn đường: hai đầu có số nhà
test('bài đoạn đường hiện hai dòng Từ / Đến trên card và trang chi tiết', async ({ page }) => {
  await page.goto('/')
  const search = page.getByRole('searchbox', { name: 'Tìm bài đăng' }).filter({ visible: true })
  await search.fill('Võ Văn Tần')
  await search.press('Enter')
  const card = page.getByRole('article').filter({ hasText: 'Rơi CCCD dọc đường Võ Văn Tần' })
  await expect(card.getByText('Từ: 89 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3')).toBeVisible()
  await expect(card.getByText('Đến: 230 Võ Văn Tần, Phường 5, Quận 3')).toBeVisible()
  await page
    .getByRole('link', { name: 'Rơi CCCD dọc đường Võ Văn Tần khi đi bộ ra trạm xe buýt' })
    .click()
  await expect(page.getByText('Đến: 230 Võ Văn Tần, Phường 5, Quận 3')).toBeVisible()
})
