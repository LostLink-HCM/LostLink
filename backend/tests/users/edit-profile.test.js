const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const { User } = require('../../src/models')
const imageService = require('../../src/services/imageService')
const ApiError = require('../../src/utils/ApiError')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, jpeg } = require('../helpers/posts')

useTestDb()

const CLOUDINARY = 'https://res.cloudinary.com/demo/image/upload/v1712/lostlink/avatars'

// Không gọi Cloudinary thật
const uploadAvatar = mock.method(imageService, 'uploadAvatar', async () => ({
  url: `${CLOUDINARY}/moi.jpg`,
  publicId: 'lostlink/avatars/moi',
}))
const deleteImages = mock.method(imageService, 'deleteImages', async () => {})

afterEach(() => {
  uploadAvatar.mock.resetCalls()
  deleteImages.mock.resetCalls()
  uploadAvatar.mock.mockImplementation(async () => ({
    url: `${CLOUDINARY}/moi.jpg`,
    publicId: 'lostlink/avatars/moi',
  }))
})

let me
let client
let accessToken
let api

beforeEach(async () => {
  me = await createUser({ bio: 'Giới thiệu cũ' })
  ;({ client, accessToken } = await loginAs())
  api = authed(client, accessToken)
})

const sendAvatar = (files = [jpeg('avatar.jpg')], field = 'avatar') => {
  let req = client.put('/api/users/me/avatar').set('Authorization', `Bearer ${accessToken}`)
  for (const file of files) {
    req = req.attach(field, file.buffer, { filename: file.name, contentType: file.type })
  }
  return req
}

const fieldError = (res, field, message) => {
  assert.equal(res.status, 422, JSON.stringify(res.body))
  assert.deepEqual(res.body.details, [{ field, message }])
}

describe('UC14 - Cập nhật hồ sơ cá nhân', () => {
  test('lưu giới thiệu mới, bỏ khoảng trắng thừa và hiện trên trang cá nhân', async () => {
    const res = await api.patch('/api/users/me', { bio: '  Sinh viên Bách Khoa  ' })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.message, 'Cập nhật hồ sơ thành công.')
    assert.deepEqual(res.body.data, { bio: 'Sinh viên Bách Khoa' })

    const profile = await api.get('/api/users/me')
    assert.equal(profile.body.data.profile.bio, 'Sinh viên Bách Khoa')
  })

  test('cho phép xoá trống phần giới thiệu', async () => {
    const res = await api.patch('/api/users/me', { bio: '' })

    assert.equal(res.status, 200)
    assert.equal((await User.findById(me._id)).bio, '')
  })

  test('giới thiệu vượt quá 500 ký tự thì báo lỗi và giữ thông tin cũ', async () => {
    fieldError(
      await api.patch('/api/users/me', { bio: 'a'.repeat(501) }),
      'bio',
      'Giới thiệu tối đa 500 ký tự.'
    )
    assert.equal((await User.findById(me._id)).bio, 'Giới thiệu cũ')

    const ok = await api.patch('/api/users/me', { bio: 'a'.repeat(500) })
    assert.equal(ok.status, 200)
  })

  test('chặn NoSQL injection và không cho sửa field ngoài giới thiệu', async () => {
    fieldError(
      await api.patch('/api/users/me', { bio: { $ne: null } }),
      'bio',
      'Giới thiệu không hợp lệ.'
    )

    const res = await api.patch('/api/users/me', {
      bio: 'Mới',
      role: 'admin',
      reputationScore: 999,
      username: 'doiten',
      email: 'khac@example.com',
    })
    assert.equal(res.status, 200)
    const saved = await User.findById(me._id)
    assert.equal(saved.bio, 'Mới')
    assert.equal(saved.role, 'user')
    assert.equal(saved.reputationScore, 0)
    assert.equal(saved.username, 'tranthib')
    assert.equal(saved.email, 'thib@example.com')
  })

  test('thiếu trường giới thiệu thì báo lỗi', async () => {
    fieldError(await api.patch('/api/users/me', {}), 'bio', 'Vui lòng nhập giới thiệu.')
  })

  test('chưa đăng nhập thì không sửa được', async () => {
    const res = await newClient().patch('/api/users/me').send({ bio: 'x' })
    assert.equal(res.status, 401)
  })
})

describe('UC15 - Đổi ảnh đại diện', () => {
  test('tải ảnh lên, lưu đường dẫn mới và hiện trên trang cá nhân', async () => {
    const res = await sendAvatar()

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.message, 'Đổi ảnh đại diện thành công.')
    assert.deepEqual(res.body.data, { avatarUrl: `${CLOUDINARY}/moi.jpg` })
    assert.equal(uploadAvatar.mock.callCount(), 1)
    assert.equal(deleteImages.mock.callCount(), 0)

    const profile = await api.get('/api/users/me')
    assert.equal(profile.body.data.profile.avatarUrl, `${CLOUDINARY}/moi.jpg`)
  })

  test('xoá ảnh cũ trên Cloudinary sau khi lưu ảnh mới', async () => {
    await User.updateOne({ _id: me._id }, { avatarUrl: `${CLOUDINARY}/cu.png` })

    const res = await sendAvatar()

    assert.equal(res.status, 200)
    assert.deepEqual(deleteImages.mock.calls[0].arguments[0], ['lostlink/avatars/cu'])
  })

  test('không xoá ảnh cũ nằm ngoài thư mục ảnh đại diện', async () => {
    await User.updateOne({ _id: me._id }, { avatarUrl: 'https://lh3.googleusercontent.com/a/x' })

    await sendAvatar()

    assert.equal(deleteImages.mock.callCount(), 0)
  })

  test('ảnh sai định dạng hoặc vượt 5 MB thì báo lỗi, giữ ảnh cũ', async () => {
    const message = 'Ảnh phải là JPG, PNG hoặc WEBP và không quá 5 MB.'
    const gif = { buffer: Buffer.alloc(10), name: 'a.gif', type: 'image/gif' }

    fieldError(await sendAvatar([gif]), 'avatar', message)
    fieldError(await sendAvatar([jpeg('to.jpg', 5 * 1024 * 1024 + 1)]), 'avatar', message)
    assert.equal(uploadAvatar.mock.callCount(), 0)
    assert.equal((await User.findById(me._id)).avatarUrl, '')
  })

  test('chưa chọn ảnh hoặc gửi nhiều ảnh thì báo lỗi', async () => {
    // Form multipart không có phần nào
    const empty = await client
      .put('/api/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Content-Type', 'multipart/form-data; boundary=x')
      .send('--x--\r\n')
    fieldError(empty, 'avatar', 'Vui lòng chọn ảnh.')
    fieldError(
      await sendAvatar([jpeg('1.jpg'), jpeg('2.jpg')]),
      'avatar',
      'Chỉ chọn một ảnh đại diện.'
    )
    fieldError(await sendAvatar([jpeg()], 'images'), 'avatar', 'Chỉ chọn một ảnh đại diện.')
  })

  test('không gửi dạng multipart thì báo lỗi', async () => {
    fieldError(
      await api.put('/api/users/me/avatar', { avatarUrl: 'https://evil.example/x.jpg' }),
      'avatar',
      'Dữ liệu phải gửi dạng multipart/form-data.'
    )
  })

  test('tải ảnh lên thất bại thì báo lỗi, giữ ảnh cũ', async (t) => {
    // Lỗi 5xx được errorHandler ghi log, tắt để output test gọn
    t.mock.method(console, 'error', () => {})
    await User.updateOne({ _id: me._id }, { avatarUrl: `${CLOUDINARY}/cu.png` })
    uploadAvatar.mock.mockImplementation(async () => {
      throw new ApiError(
        503,
        'Tải ảnh lên thất bại, vui lòng thử lại.',
        undefined,
        'IMAGE_UPLOAD_FAILED'
      )
    })

    const res = await sendAvatar()

    assert.equal(res.status, 503)
    assert.equal(res.body.message, 'Tải ảnh lên thất bại, vui lòng thử lại.')
    assert.equal((await User.findById(me._id)).avatarUrl, `${CLOUDINARY}/cu.png`)
    assert.equal(deleteImages.mock.callCount(), 0)
  })

  test('lưu dữ liệu thất bại thì xoá ảnh vừa tải, giữ ảnh cũ', async (t) => {
    t.mock.method(console, 'error', () => {})
    await User.updateOne({ _id: me._id }, { avatarUrl: `${CLOUDINARY}/cu.png` })
    const update = mock.method(User, 'findByIdAndUpdate', async () => {
      throw new Error('db down')
    })
    try {
      const res = await sendAvatar()
      assert.equal(res.status, 500)
    } finally {
      update.mock.restore()
    }

    assert.deepEqual(deleteImages.mock.calls[0].arguments[0], ['lostlink/avatars/moi'])
    assert.equal((await User.findById(me._id)).avatarUrl, `${CLOUDINARY}/cu.png`)
  })
})
