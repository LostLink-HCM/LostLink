import { createAccount, expect, loginThroughUi, test } from '../helpers/auth.js'
import { bearer, createPost, tokenOf } from '../helpers/posts.js'

const INTRO = 'Chào bạn, mình nghĩ món này là của mình.'

// Chủ bài có một bài đã duyệt, một tài khoản khác gửi yêu cầu trò chuyện tới bài đó
async function incomingRequest(api) {
  const owner = await createAccount(api)
  const requester = await createAccount(api)
  const ownerToken = await tokenOf(api, owner)
  const title = `Bài nhận yêu cầu ${Date.now().toString(36)}`
  const post = await createPost(api, ownerToken, { title, type: 'found' })
  const sent = await api.post(`posts/${post.id}/claim/request`, {
    headers: bearer(await tokenOf(api, requester)),
    data: { message: INTRO },
  })
  expect(sent.status()).toBe(201)
  return { owner, ownerToken, requester, title }
}

test.describe('Trả lời yêu cầu trò chuyện', () => {
  test('bấm Từ chối phải xác nhận; huỷ thì giữ yêu cầu, xác nhận thì khoá hội thoại', async ({
    page,
    api,
  }) => {
    const { owner, ownerToken, requester, title } = await incomingRequest(api)

    await page.goto('/login')
    await loginThroughUi(page, owner)
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
    await page.goto('/messages')
    await page.getByRole('button', { name: new RegExp(requester.username) }).click()
    await expect(page.getByText(`${requester.username} muốn trò chuyện`)).toBeVisible()

    // Huỷ: chưa gửi gì lên server, yêu cầu vẫn chờ trả lời
    await page.getByRole('button', { name: 'Từ chối', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Từ chối yêu cầu trò chuyện?' })
    await expect(dialog).toContainText(title)
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Đồng ý', exact: true })).toBeVisible()

    // Xác nhận: gửi ngay, không còn bước chờ hoàn tác
    await page.getByRole('button', { name: 'Từ chối', exact: true }).click()
    const declined = page.waitForResponse(
      (response) =>
        /\/api\/claims\/[^/]+\/decline$/.test(response.url()) &&
        response.request().method() === 'POST'
    )
    await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click()
    expect((await declined).status()).toBe(200)
    await expect(page.getByText('Yêu cầu trò chuyện đã bị từ chối.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Hoàn tác/ })).toHaveCount(0)

    const claims = await api.get('claims', { headers: bearer(ownerToken) })
    const incoming = (await claims.json()).data.items.find((claim) => claim.post.title === title)
    expect(incoming.status).toBe('rejected')
  })
})
