import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { WEB_PORT } from '../setup/ports.js'

// Giả lập API tìm địa chỉ (CI không có key VietMap). API đăng bài vẫn là backend thật
const BEN_THANH = {
  refId: 'geocode:ben-thanh',
  name: 'Chợ Bến Thành',
  address: 'Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh',
  display: 'Chợ Bến Thành, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh',
  place: 'Chợ Bến Thành, Phường Bến Thành, Quận 1',
  detail: 'Chợ Bến Thành, Phường Bến Thành, Quận 1',
  district: 'Quận 1',
  area: 'Quận 1',
}
const BEN_THANH_POINT = { lat: 10.7725, lng: 106.698 }

const CORS = {
  'Access-Control-Allow-Origin': `http://localhost:${WEB_PORT}`,
  'Access-Control-Allow-Credentials': 'true',
}

const stubGeo = async (page) => {
  const calls = { search: 0 }
  await page.route('**/api/geo/search?*', (route) => {
    calls.search += 1
    return route.fulfill({ headers: CORS, json: { success: true, data: [BEN_THANH] } })
  })
  await page.route('**/api/geo/place?*', (route) =>
    route.fulfill({
      headers: CORS,
      json: { success: true, data: { ...BEN_THANH_POINT, name: BEN_THANH.name, display: '' } },
    })
  )
  return calls
}

const next = (page) => page.getByRole('button', { name: 'Tiếp tục' }).click()

test.describe('UC U05 - Đăng bài', () => {
  test('đăng tin Nhặt được qua đủ các bước, địa chỉ chỉ tìm khi bấm Tìm', async ({ page, api }) => {
    // Đủ 5 bước và backend gọi VietMap thật nên chạy lâu hơn
    test.slow()
    const account = await createAccount(api)
    const geo = await stubGeo(page)

    await page.goto('/posts/new')
    await loginThroughUi(page, account)
    await expect(page.getByRole('heading', { name: 'Đăng bài mới' })).toBeVisible()

    // Phân loại: danh mục lấy từ API, thuộc tính bắt buộc phải chọn
    await page.getByRole('button', { name: 'Tôi nhặt được đồ' }).click()
    await page
      .getByRole('group', { name: 'Danh mục' })
      .getByRole('button', { name: 'Giấy tờ & thẻ' })
      .click()
    await next(page)
    await expect(page.getByText('Chọn loại giấy tờ.')).toBeVisible()
    await page.getByRole('button', { name: 'CCCD/CMND', exact: true }).click()
    await next(page)

    await page.getByLabel('Tiêu đề').fill('Nhặt được CCCD gần chợ Bến Thành')
    await next(page)

    await page.getByRole('button', { name: 'Sáng hôm qua' }).click()
    await next(page)

    // Vị trí: gõ địa chỉ không tự tìm, cũng không báo lỗi trong lúc gõ
    const address = page.getByRole('searchbox', { name: 'Tìm địa chỉ' })
    await address.fill('cho ben thanh')
    await expect(page.getByRole('list', { name: 'Kết quả tìm địa chỉ' })).toBeHidden()
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(geo.search).toBe(0)

    // Chưa đặt vị trí mà bấm Tiếp tục thì mới báo
    await next(page)
    await expect(
      page.getByText(
        'Chọn vị trí: tìm địa chỉ, dùng vị trí của bạn hoặc bấm lên bản đồ để đặt ghim.'
      )
    ).toBeVisible()

    await page.getByRole('button', { name: 'Tìm', exact: true }).click()
    const results = page.getByRole('list', { name: 'Kết quả tìm địa chỉ' })
    await results.getByRole('button', { name: /Chợ Bến Thành/ }).click()
    expect(geo.search).toBe(1)
    // Tự điền địa điểm, không có ô nhập tay hay đổi khu vực
    const place = page.getByText(BEN_THANH.detail, { exact: true })
    await expect(place).toBeVisible()
    await expect(page.getByRole('combobox', { name: /khu vực/i })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: /Địa điểm/ })).toHaveCount(0)

    // Bật rồi tắt "Đánh dấu đoạn đường" không làm mất ghim đã đặt
    const roadToggle = page.getByRole('button', { name: 'Đánh dấu đoạn đường' })
    await roadToggle.click()
    await expect(roadToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('chưa chọn điểm đầu')).toBeVisible()
    await roadToggle.click()
    await expect(place).toBeVisible()
    await next(page)

    // Câu hỏi xác minh: bấm câu hỏi gợi ý của danh mục để điền sẵn
    await page.getByRole('button', { name: 'Họ tên in trên giấy tờ là gì?' }).click()
    await page.getByLabel('Phương án 1', { exact: true }).fill('Nguyễn Văn An')
    await page.getByLabel('Phương án 2', { exact: true }).fill('Trần Thị Bình')
    await page.getByLabel('Phương án 3', { exact: true }).fill('Lê Văn Cường')
    await page.getByLabel('Chọn phương án 2 là đáp án đúng').check()
    await page.getByRole('button', { name: 'Xem lại & đăng bài' }).click()

    const dialog = page.getByRole('dialog', { name: 'Xem lại bài đăng' })
    await expect(dialog.getByText('Loại giấy tờ: CCCD/CMND', { exact: true })).toBeVisible()
    await expect(dialog.getByText(BEN_THANH.detail, { exact: true })).toBeVisible()

    const created = page.waitForResponse(
      (res) => res.url().endsWith('/api/posts') && res.request().method() === 'POST'
    )
    await dialog.getByRole('button', { name: 'Đăng bài' }).click()
    const response = await created

    expect(response.status()).toBe(201)
    expect((await response.json()).data).toMatchObject({ type: 'found', status: 'pending' })
    const sent = JSON.parse(/name="data"\r\n\r\n(.*)\r\n/.exec(response.request().postData())[1])
    expect(sent.location).toEqual({
      mode: 'address',
      area: 'Quận 1',
      point: BEN_THANH_POINT,
      placeName: BEN_THANH.place,
    })
    expect(sent.question).toEqual({
      text: 'Họ tên in trên giấy tờ là gì?',
      options: ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Văn Cường'],
      correct: 1,
    })

    await expect(page.getByText('Đăng bài thành công! Bài đang chờ LostLink duyệt.')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })

  test('đổi qua lại giữa ngày và buổi trong ngày không làm mất lựa chọn trước', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    await page.goto('/posts/new')
    await loginThroughUi(page, account)

    await page.getByRole('button', { name: 'Tôi bị mất đồ' }).click()
    await page
      .getByRole('group', { name: 'Danh mục' })
      .getByRole('button', { name: 'Khác' })
      .click()
    await next(page)
    await page.getByLabel('Tiêu đề').fill('Mất ô màu đen')
    await next(page)

    const presets = page.getByRole('group', { name: 'Mốc thời gian gần đúng' })
    const evening = page.getByRole('button', { name: /^Buổi tối/ })
    const afternoon = page.getByRole('button', { name: /^Buổi chiều/ })

    // Chọn buổi trước rồi chọn mốc chỉ có ngày: buổi vẫn giữ
    await evening.click()
    await presets.getByRole('button', { name: 'Hôm kia', exact: true }).click()
    await expect(evening).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/Hôm kia, buổi tối/)).toBeVisible()

    // Đổi ngày bằng tay: buổi vẫn giữ
    await page.getByLabel('Ngày mất đồ').fill('2026-01-15')
    await expect(evening).toHaveAttribute('aria-pressed', 'true')

    // Đổi buổi thì chuyển sang mốc tương ứng thay vì mất mốc
    await presets.getByRole('button', { name: 'Sáng hôm qua', exact: true }).click()
    await afternoon.click()
    await expect(afternoon).toHaveAttribute('aria-pressed', 'true')
    await expect(
      presets.getByRole('button', { name: 'Chiều hôm qua', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('lưu nháp rồi mở lại đăng tiếp đúng bước, bỏ bản nháp thì xoá hẳn', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    await page.goto('/posts/new')
    await loginThroughUi(page, account)
    await expect(page.getByRole('heading', { name: 'Đăng bài mới' })).toBeVisible()

    // Form trống thì không lưu
    await page.getByRole('button', { name: 'Lưu nháp' }).click()
    await expect(page.getByText('Chưa có nội dung để lưu nháp.')).toBeVisible()

    await page.getByRole('button', { name: 'Tôi bị mất đồ' }).click()
    await page
      .getByRole('group', { name: 'Danh mục' })
      .getByRole('button', { name: 'Khác' })
      .click()
    await next(page)
    await page.getByLabel('Tiêu đề').fill('Mất ô màu đen ở trạm xe buýt')
    await next(page)
    await page.getByRole('button', { name: /^Buổi tối/ }).click()

    // Lưu ở bước Thời gian rồi về Trang chủ
    await page.getByRole('button', { name: 'Lưu nháp' }).click()
    await expect(page.getByText('Đã lưu nháp.')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)

    // Mở lại đúng bước Thời gian, còn nguyên nội dung các bước trước
    await page.goto('/posts/new')
    await expect(page.getByText(/Đang tiếp tục bản nháp lưu lúc/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bạn mất đồ khi nào?' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Buổi tối/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.getByRole('button', { name: 'Quay lại' }).click()
    await expect(page.getByLabel('Tiêu đề')).toHaveValue('Mất ô màu đen ở trạm xe buýt')

    // Bỏ bản nháp: form về trống, mở lại không còn bản nháp
    await page.getByRole('button', { name: 'Bỏ bản nháp' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Bỏ bản nháp' }).click()
    await expect(page.getByRole('heading', { name: 'Bạn muốn đăng loại tin nào?' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Bạn muốn đăng loại tin nào?' })).toBeVisible()
    await expect(page.getByText(/Đang tiếp tục bản nháp/)).toHaveCount(0)
  })
})

test.describe('UC U05 - Đăng bài: không chọn được thời điểm chưa tới', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })

  test('5:30 sáng thì chưa chọn được Sáng nay, Tối nay hay buổi chưa tới của hôm nay', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date()
    )
    await page.clock.install({ time: new Date(`${today}T05:30:00+07:00`) })

    await page.goto('/posts/new')
    await loginThroughUi(page, account)
    await page.getByRole('button', { name: 'Tôi bị mất đồ' }).click()
    await page
      .getByRole('group', { name: 'Danh mục' })
      .getByRole('button', { name: 'Khác' })
      .click()
    await next(page)
    await page.getByLabel('Tiêu đề').fill('Mất ô màu đen')
    await next(page)

    const presets = page.getByRole('group', { name: 'Mốc thời gian gần đúng' })
    for (const label of ['Sáng nay', 'Chiều nay', 'Tối nay']) {
      await expect(presets.getByRole('button', { name: label, exact: true })).toBeDisabled()
    }
    await expect(presets.getByRole('button', { name: 'Tối hôm qua', exact: true })).toBeEnabled()

    // 5:30 sáng "Vừa mới đây" là Ban đêm của hôm qua
    const night = page.getByRole('button', { name: /^Ban đêm/ })
    await presets.getByRole('button', { name: 'Vừa mới đây', exact: true }).click()
    await expect(night).toHaveAttribute('aria-pressed', 'true')

    // Sang hôm nay: Ban đêm (22:00) chưa tới nên bị bỏ chọn và khoá
    await page.getByLabel('Ngày mất đồ').fill(today)
    await expect(night).toHaveAttribute('aria-pressed', 'false')
    await expect(night).toBeDisabled()
    await expect(page.getByRole('button', { name: /^Buổi sáng/ })).toBeDisabled()
  })
})
