import {
  createAccount,
  expect,
  latestMail,
  loginThroughUi,
  mailCount,
  newAccount,
  test,
} from '../helpers/auth.js'

const accountMenu = (page) => page.getByRole('button', { name: 'Menu tài khoản' })

test.describe('UC06, UC07 - Đăng ký và xác thực email', () => {
  const fillRegisterForm = async (page, account) => {
    await page.goto('/register')
    await page.getByLabel('TÊN NGƯỜI DÙNG').fill(account.username)
    await page.getByLabel('EMAIL', { exact: true }).fill(account.email)
    await page.getByLabel('MẬT KHẨU', { exact: true }).fill(account.password)
  }

  test('đăng ký, nhập mã nhận qua email rồi vào LostLink với tài khoản vừa tạo', async ({
    page,
  }) => {
    const account = newAccount()
    await fillRegisterForm(page, account)
    await page.getByLabel('Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật').check()
    await page.getByRole('button', { name: 'Gửi mã xác thực' }).click()

    await expect(page).toHaveURL(/\/verify-email$/)
    await expect(page.getByText(account.email)).toBeVisible()

    const { code } = await latestMail(account.email, 'verify')
    await page.getByLabel('Chữ số thứ 1').fill(code)
    await page.getByRole('button', { name: 'Xác nhận' }).click()

    await expect(page.getByRole('heading', { name: 'Tài khoản đã kích hoạt' })).toBeVisible()
    await page.getByRole('button', { name: 'Vào LostLink' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(accountMenu(page)).toBeVisible()
  })

  test('chưa tích đồng ý điều khoản thì không gửi mã', async ({ page }) => {
    const account = newAccount()
    await fillRegisterForm(page, account)
    await page.getByRole('button', { name: 'Gửi mã xác thực' }).click()

    await expect(
      page.getByText('Vui lòng đồng ý với điều khoản sử dụng và chính sách quyền riêng tư.')
    ).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
    expect(await mailCount(account.email)).toBe(0)
  })

  test('nhập sai mã thì báo lỗi và xoá các ô để nhập lại', async ({ page, api }) => {
    const account = await createAccount(api, { verified: false })
    const { code } = await latestMail(account.email, 'verify')
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')

    await page.goto('/verify-email')
    await page.getByLabel('EMAIL', { exact: true }).fill(account.email)
    await page.getByLabel('Chữ số thứ 1').fill(wrong)
    await page.getByRole('button', { name: 'Xác nhận' }).click()

    await expect(page.getByText('Mã xác thực không đúng hoặc đã hết hạn.')).toBeVisible()
    await expect(page.getByLabel('Chữ số thứ 1')).toHaveValue('')
  })
})

test.describe('UC08 - Đăng nhập', () => {
  test('sai mật khẩu báo lỗi chung, đúng mật khẩu thì vào trang chủ', async ({ page, api }) => {
    const account = await createAccount(api)

    await page.goto('/login')
    await loginThroughUi(page, { email: account.email, password: 'Wrong@1234' })
    await expect(page.getByText('Email hoặc mật khẩu không đúng.')).toBeVisible()

    await loginThroughUi(page, account)
    await expect(page).toHaveURL(/\/$/)
    await expect(accountMenu(page)).toBeVisible()
  })

  test('tài khoản chưa xác thực email được chuyển sang màn hình nhập mã', async ({ page, api }) => {
    const account = await createAccount(api, { verified: false })

    await page.goto('/login')
    await loginThroughUi(page, account)

    await expect(page).toHaveURL(/\/verify-email$/)
    await expect(page.getByText('Email chưa được xác thực.')).toBeVisible()
  })

  test('mở trang cần đăng nhập thì chuyển sang Đăng nhập, xong quay lại đúng trang đó', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)

    await page.goto('/notifications')
    await expect(page).toHaveURL(/\/login$/)

    await loginThroughUi(page, account)
    await expect(page).toHaveURL(/\/notifications$/)
  })
})

test.describe('UC12 - Đăng xuất (NF03 - giữ phiên khi tải lại trang)', () => {
  test('tải lại trang vẫn đăng nhập; đăng xuất thì trở về chế độ khách', async ({ page, api }) => {
    const account = await createAccount(api)
    await page.goto('/login')
    await loginThroughUi(page, account)
    await expect(accountMenu(page)).toBeVisible()

    // Access token chỉ nằm trong bộ nhớ, tải lại trang thì khôi phục bằng refresh token trong cookie
    await page.reload()
    await expect(accountMenu(page)).toBeVisible()

    await accountMenu(page).click()
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click()
    await expect(accountMenu(page)).toBeHidden()

    await page.reload()
    await expect(accountMenu(page)).toBeHidden()
    await page.goto('/notifications')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('UC10, UC11 - Quên và đặt lại mật khẩu', () => {
  test('nhận liên kết qua email, đặt mật khẩu mới rồi đăng nhập bằng mật khẩu mới', async ({
    page,
    api,
  }) => {
    const account = await createAccount(api)
    const newPassword = 'NewSecret@456'

    await page.goto('/login')
    await page.getByRole('link', { name: 'Quên mật khẩu?' }).click()
    // Đợi sang hẳn trang mới rồi mới điền, tránh điền nhầm vào ô email của trang Đăng nhập
    await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible()
    await page.getByLabel('EMAIL', { exact: true }).fill(account.email)
    await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click()
    await expect(
      page.getByText('liên kết đặt lại mật khẩu đã được gửi tới email này')
    ).toBeVisible()

    const { resetUrl } = await latestMail(account.email, 'reset')
    await page.goto(resetUrl)
    await page.getByLabel('MẬT KHẨU MỚI').fill(newPassword)
    await page.getByLabel('NHẬP LẠI MẬT KHẨU').fill('Khac@12345')
    await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(page.getByText('Mật khẩu nhập lại không khớp.')).toBeVisible()

    await page.getByLabel('NHẬP LẠI MẬT KHẨU').fill(newPassword)
    await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByText('Đặt mật khẩu mới thành công. Vui lòng đăng nhập lại.')
    ).toBeVisible()

    await loginThroughUi(page, { email: account.email, password: account.password })
    await expect(page.getByText('Email hoặc mật khẩu không đúng.')).toBeVisible()
    await loginThroughUi(page, { email: account.email, password: newPassword })
    await expect(accountMenu(page)).toBeVisible()
  })
})
