import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer } from '../helpers/posts.js'

const ADMIN = { email: 'admin@lostlink.vn', password: 'Admin@123' }
const uniqueName = (prefix) =>
  `${prefix} ${Date.now().toString(36)} ${Math.random().toString(36).slice(2, 6)}`
const categorySearch = (page) => page.getByPlaceholder('Tìm hoặc chọn danh mục')
const categoryTabs = (page) => page.getByRole('tablist', { name: 'Nhóm cấu hình danh mục' })

async function adminToken(api) {
  const response = await api.post('auth/login', { data: ADMIN })
  expect(response.status()).toBe(200)
  return (await response.json()).data.accessToken
}

async function createCategory(api, name) {
  const token = await adminToken(api)
  const response = await api.post('admin/categories', {
    headers: bearer(token),
    data: { name },
  })
  expect(response.status()).toBe(201)
  return { ...(await response.json()).data, token }
}

async function openCategories(page) {
  await page.goto('/admin/categories')
  await loginThroughUi(page, ADMIN)
  await expect(categoryTabs(page)).toBeVisible()
}

async function selectCategory(page, name) {
  const search = categorySearch(page)
  await search.fill(name)
  await page.getByRole('option', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
}

test('người dùng thường không được vào trang quản lý danh mục', async ({ page, api }) => {
  const account = await createAccount(api)
  await page.goto('/admin/categories')
  await loginThroughUi(page, account)
  await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })).toBeVisible()
  await expect(categoryTabs(page)).toHaveCount(0)
})

test('tải danh mục từ API, tìm trong dropdown và mở đúng nhóm thông tin', async ({ page, api }) => {
  const name = uniqueName('Danh mục kiểm tra')
  await createCategory(api, name)
  await openCategories(page)
  await selectCategory(page, name)
  await expect(categoryTabs(page).getByRole('tab', { name: 'Thông tin chung' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByLabel('Tên danh mục')).toHaveValue(name)
  await expect(page.getByText('Danh mục:', { exact: false }).first()).toBeVisible()
})

test('tạo danh mục từ giao diện và hiển thị ngay sau khi API xác nhận', async ({ page }) => {
  const name = uniqueName('Danh mục mới')
  await openCategories(page)
  await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Thêm danh mục' })
  await dialog.getByLabel('Tên danh mục').fill(name)
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/admin/categories') && response.request().method() === 'POST'
  )
  await dialog.getByRole('button', { name: 'Tạo danh mục', exact: true }).click()
  expect((await responsePromise).status()).toBe(201)
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
  await expect(categorySearch(page)).toHaveValue(name)
})

test('lưu trữ báo quan hệ bị ảnh hưởng và cập nhật nhóm còn lại trên giao diện', async ({
  page,
  api,
}) => {
  const target = await createCategory(api, uniqueName('Danh mục lưu trữ'))
  const mixedSource = await createCategory(api, uniqueName('Nguồn nhóm còn'))
  const emptySource = await createCategory(api, uniqueName('Nguồn nhóm rỗng'))
  const remaining = await createCategory(api, uniqueName('Thành viên giữ lại'))
  for (const [source, memberCategoryIds] of [
    [mixedSource, [target.id, remaining.id]],
    [emptySource, [target.id]],
  ]) {
    const response = await api.put(`admin/categories/${source.id}/relations`, {
      headers: bearer(source.token),
      data: { relations: [{ ratio: 0.6, memberCategoryIds }] },
    })
    expect(response.status()).toBe(200)
  }

  await openCategories(page)
  await selectCategory(page, target.name)
  await page.getByRole('button', { name: 'Xóa danh mục', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Xóa danh mục' })
  await expect(dialog.getByText('sẽ bị gỡ khỏi quan hệ của', { exact: false })).toBeVisible()
  await expect(dialog.getByText(mixedSource.name, { exact: false })).toBeVisible()
  await expect(dialog.getByText(emptySource.name, { exact: false })).toBeVisible()
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click()
  expect(
    (await api.get(`admin/categories/${target.id}`, { headers: bearer(target.token) })).status()
  ).toBe(200)

  await page.getByRole('button', { name: 'Xóa danh mục', exact: true }).click()
  const archivedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/categories/${target.id}`) &&
      response.request().method() === 'DELETE'
  )
  await dialog.getByRole('button', { name: 'Xóa danh mục', exact: true }).click()
  expect((await archivedResponse).status()).toBe(200)
  await expect(dialog).toHaveCount(0)

  await selectCategory(page, mixedSource.name)
  await categoryTabs(page).getByRole('tab', { name: 'Quan hệ', exact: true }).click()
  await expect(page.getByRole('button', { name: `Bỏ ${remaining.name} khỏi nhóm 1` })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeDisabled()
  await selectCategory(page, emptySource.name)
  await expect(page.getByText('Nhóm 1', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeDisabled()

  const saved = await api.get(`admin/categories/${mixedSource.id}`, {
    headers: bearer(mixedSource.token),
  })
  expect((await saved.json()).data.relations).toEqual([
    expect.objectContaining({ ratio: 0.6, memberCategoryIds: [remaining.id] }),
  ])
  const emptied = await api.get(`admin/categories/${emptySource.id}`, {
    headers: bearer(emptySource.token),
  })
  expect((await emptied.json()).data.relations).toEqual([])
})

test('lưu tên, thứ tự và alias; dữ liệu được ghi vào API', async ({ page, api }) => {
  const category = await createCategory(api, uniqueName('Danh mục chỉnh sửa'))
  await openCategories(page)
  await selectCategory(page, category.name)
  await page.getByLabel('Tên danh mục').fill(`${category.name} đã sửa`)
  await page.getByLabel('Thứ tự hiển thị').fill('42')
  await page.getByRole('button', { name: 'Thêm alias', exact: true }).click()
  await page.getByRole('textbox', { name: 'alias 1' }).fill('từ gọi thay thế')
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/admin/categories/${category.id}/general`)
  )
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  expect((await responsePromise).ok()).toBeTruthy()
  const saved = await api.get(`admin/categories/${category.id}`, {
    headers: bearer(category.token),
  })
  expect(saved.status()).toBe(200)
  expect((await saved.json()).data).toMatchObject({
    name: `${category.name} đã sửa`,
    order: 42,
    aliases: ['từ gọi thay thế'],
  })
})

test('thêm thuộc tính và mục bên trong rồi kiểm tra lại dữ liệu đã lưu', async ({ page, api }) => {
  const category = await createCategory(api, uniqueName('Danh mục thuộc tính'))
  await openCategories(page)
  await selectCategory(page, category.name)
  await categoryTabs(page).getByRole('tab', { name: 'Thuộc tính', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm thuộc tính', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Thêm thuộc tính' })
  await dialog.getByLabel('Tên thuộc tính').fill('Màu sắc')
  await dialog.getByRole('button', { name: 'Thêm giá trị', exact: true }).click()
  await dialog.locator('#attribute-value-input-0').fill('Đỏ')
  const attributeResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/admin/categories/${category.id}/attributes`)
  )
  await dialog.getByRole('button', { name: 'Lưu thuộc tính', exact: true }).click()
  expect((await attributeResponse).status()).toBe(201)

  await page.getByRole('switch', { name: 'Danh mục vật chứa' }).click()
  await page.getByRole('button', { name: 'Thêm mục', exact: true }).click()
  await page.getByRole('textbox', { name: 'mục 1' }).fill('Ví tiền mặt')
  const contentsResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/admin/categories/${category.id}/contents`)
  )
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  expect((await contentsResponse).ok()).toBeTruthy()

  const saved = await api.get(`admin/categories/${category.id}`, {
    headers: bearer(category.token),
  })
  const data = (await saved.json()).data
  expect(data.attributes[0]).toMatchObject({ name: 'Màu sắc', mProb: 0.9 })
  expect(data.attributes[0].values.map((item) => item.value)).toEqual(['Đỏ'])
  expect(data.contents.map((item) => item.label)).toEqual(['Ví tiền mặt'])
})

test('lưu cấu hình thuật toán, thêm rồi gỡ danh mục quan hệ và quản lý câu hỏi xác minh', async ({
  page,
  api,
}) => {
  const category = await createCategory(api, uniqueName('Danh mục thuật toán'))
  const related = await createCategory(api, uniqueName('Danh mục liên quan'))
  await openCategories(page)
  await selectCategory(page, category.name)

  await categoryTabs(page).getByRole('tab', { name: 'Cấu hình thuật toán', exact: true }).click()
  await page.getByLabel('Bán kính ban đầu').fill('900')
  const algorithmResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/admin/categories/${category.id}/algorithm`)
  )
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  expect((await algorithmResponse).ok()).toBeTruthy()

  await categoryTabs(page).getByRole('tab', { name: 'Quan hệ', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm nhóm', exact: true }).click()
  await page.locator('summary').filter({ hasText: 'Chọn danh mục' }).last().click()
  await page.getByRole('checkbox', { name: related.name, exact: true }).check()
  const relationResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/admin/categories/${category.id}/relations`)
  )
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  expect((await relationResponse).ok()).toBeTruthy()
  await expect(page.getByRole('button', { name: `Bỏ ${related.name} khỏi nhóm 1` })).toBeVisible()
  await page.getByRole('button', { name: `Bỏ ${related.name} khỏi nhóm 1` }).click()
  const removeRelationResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/admin/categories/${category.id}/relations`)
  )
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  expect((await removeRelationResponse).ok()).toBeTruthy()

  await categoryTabs(page).getByRole('tab', { name: 'Câu hỏi xác minh', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm câu hỏi', exact: true }).click()
  const questionDialog = page.getByRole('dialog', { name: 'Thêm câu hỏi xác minh' })
  await questionDialog.getByLabel('Nội dung câu hỏi').fill('Ví có màu gì?')
  const questionResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/admin/categories/${category.id}/verification-questions`)
  )
  await questionDialog.getByRole('button', { name: 'Lưu câu hỏi', exact: true }).click()
  expect((await questionResponse).status()).toBe(201)
  await expect(page.getByText('Ví có màu gì?', { exact: true })).toBeVisible()

  const saved = await api.get(`admin/categories/${category.id}`, {
    headers: bearer(category.token),
  })
  expect((await saved.json()).data).toMatchObject({
    matchRadius: 900,
    relations: [],
    questions: [{ text: 'Ví có màu gì?' }],
  })
})
