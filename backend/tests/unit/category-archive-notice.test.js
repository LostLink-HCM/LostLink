const assert = require('node:assert/strict')
const { describe, mock, test } = require('node:test')

const env = require('../../src/config/env')
const emailService = require('../../src/services/emailService')
const { categoryArchiveMessage } = require('../../src/utils/categoryArchiveNotice')

const post = {
  _id: '507f1f77bcf86cd799439011',
  title: 'Ví <script>alert("x")</script>',
  createdAt: new Date('2026-11-20T18:00:00Z'),
  status: 'searching',
  type: 'lost',
  slug: 'vi-da',
}

describe('Nội dung thông báo danh mục lưu trữ', () => {
  test('ghi đúng ngày Việt Nam và giải thích tác động của việc sửa bài', () => {
    const text = categoryArchiveMessage(post, 'Ví & tiền')
    assert.match(text, /21\/11\/2026/)
    assert.ok(text.includes(post.title))
    assert.match(text, /vẫn được giữ lại/)
    assert.match(text, /chờ duyệt lại/)
    assert.match(text, /gợi ý đang chờ sẽ được xét lại sau khi duyệt/)
    const contacted = categoryArchiveMessage({ ...post, status: 'contacted' }, 'Ví & tiền')
    assert.match(contacted, /chưa thể chỉnh sửa/)
    assert.doesNotMatch(contacted, /vui lòng chỉnh sửa/)
  })

  test('email gộp bài, escape nội dung người dùng và đặt đúng liên kết theo trạng thái', async (t) => {
    const originalKey = env.email.brevoApiKey
    env.email.brevoApiKey = 'test-category-notice'
    let payload
    const fetch = mock.method(globalThis, 'fetch', async (_url, options) => {
      payload = JSON.parse(options.body)
      return { ok: true }
    })
    t.after(() => {
      env.email.brevoApiKey = originalKey
      fetch.mock.restore()
    })
    await emailService.sendCategoryArchivedNotice({
      to: 'owner@example.com',
      categoryName: 'Ví & tiền',
      posts: [post, { ...post, status: 'contacted' }],
    })
    assert.equal(fetch.mock.callCount(), 1)
    assert.equal(payload.to[0].email, 'owner@example.com')
    assert.ok(payload.textContent.includes(post.title))
    assert.doesNotMatch(payload.htmlContent, /<script>/)
    assert.match(payload.htmlContent, /&lt;script&gt;/)
    assert.match(payload.htmlContent, /Ví &amp; tiền/)
    assert.ok(payload.htmlContent.includes(`${env.clientUrl}/posts/${post._id}/edit`))
    assert.ok(payload.htmlContent.includes(`${env.clientUrl}/mat-do/vi-da`))
    assert.match(payload.htmlContent, /Chỉnh sửa bài đăng/)
    assert.match(payload.htmlContent, /Xem bài đăng/)
  })
})
