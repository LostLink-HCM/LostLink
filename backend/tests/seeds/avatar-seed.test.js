const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { User } = require('../../src/models')
const { seedAvatars } = require('../../src/seeds/avatarSeed')
const { AVATARS } = require('../../src/seeds/data/avatars')
const { createUser } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const UPLOADED = 'https://res.cloudinary.com/demo/image/upload/v1/lostlink/avatars/me.jpg'
const avatarOf = async (username) => (await User.findOne({ username })).avatarUrl

describe('seedAvatars: ảnh đại diện mẫu', () => {
  test('gán ảnh cho tài khoản seed, chạy lại thay ảnh seed cũ, không đè ảnh tự tải lên', async () => {
    await createUser({ username: 'minhkhoi.td', email: 'a@example.com' })
    await createUser({ username: 'user01', email: 'b@example.com', avatarUrl: UPLOADED })
    await createUser({
      username: 'baotran.sg',
      email: 'c@example.com',
      avatarUrl: 'https://api.dicebear.com/9.x/lorelei/svg?seed=cu',
    })
    await createUser({ username: 'ducanh.bk', email: 'd@example.com' })

    await seedAvatars()

    assert.equal(await avatarOf('minhkhoi.td'), AVATARS['minhkhoi.td'].url)
    assert.equal(await avatarOf('baotran.sg'), AVATARS['baotran.sg'].url)
    assert.equal(await avatarOf('user01'), UPLOADED)
    // null = để trống, hiện chữ viết tắt
    assert.equal(await avatarOf('ducanh.bk'), '')
  })

  test('mọi ảnh mẫu đều có nguồn ghi rõ', () => {
    for (const avatar of Object.values(AVATARS).filter(Boolean)) {
      assert.match(avatar.url, /^https:\/\//)
      assert.ok(avatar.source)
    }
  })
})
