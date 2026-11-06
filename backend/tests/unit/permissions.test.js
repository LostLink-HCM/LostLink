const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { canActOn, hasPermission } = require('../../src/config/permissions')
const { can } = require('../../src/middleware/authMiddleware')

// Chạy middleware can() với req.user giả, trả về lỗi truyền cho next (nếu có)
const runCan = (permission, user) => {
  let error = 'not-called'
  can(permission)({ user }, {}, (err) => (error = err))
  return error
}

describe('NF04 - Phân quyền theo vai trò và quyền sở hữu', () => {
  test('người dùng thường hoặc vai trò lạ không có quyền của Moderator/Admin', () => {
    assert.equal(hasPermission('user', 'post:create'), true)
    assert.equal(hasPermission('user', 'report:review'), false)
    assert.equal(hasPermission('user', 'role:manage'), false)
    assert.equal(hasPermission('superuser', 'post:create'), false)
    assert.equal(hasPermission(undefined, 'post:create'), false)
  })

  test('quyền :own chỉ áp dụng cho chủ sở hữu, quyền :any áp dụng cho mọi đối tượng', () => {
    const owner = { _id: 'u1', role: 'user' }
    const moderator = { _id: 'm1', role: 'moderator' }

    assert.equal(canActOn(owner, 'post:update', 'u1'), true)
    assert.equal(canActOn(owner, 'post:update', 'u2'), false)
    assert.equal(canActOn(moderator, 'post:update', 'u2'), true)
  })

  test('middleware can() chặn khi thiếu quyền hoặc chưa đăng nhập', () => {
    assert.equal(runCan('report:review', { role: 'moderator' }), undefined)
    assert.equal(runCan('report:review', { role: 'user' }).statusCode, 403)
    assert.equal(runCan('report:review', undefined).statusCode, 403)
  })
})
