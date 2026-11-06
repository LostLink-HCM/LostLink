const assert = require('node:assert/strict')
const { describe, mock, test } = require('node:test')
const { OAuth2Client } = require('google-auth-library')

const { verifyGoogleIdToken } = require('../../src/services/googleService')

// Giả lập kết quả Google trả về khi kiểm tra ID token
const googleReturns = (payload) =>
  mock.method(OAuth2Client.prototype, 'verifyIdToken', async (options) => {
    assert.equal(options.audience, process.env.GOOGLE_CLIENT_ID)
    return { getPayload: () => payload }
  })

describe('UC09 - Xác minh ID token Google', () => {
  test('lấy googleId và email (chuyển chữ thường) từ token hợp lệ', async () => {
    googleReturns({ sub: 'g-123', email: 'Alice@Gmail.com', email_verified: true })

    assert.deepEqual(await verifyGoogleIdToken('token'), {
      googleId: 'g-123',
      email: 'alice@gmail.com',
    })
  })

  test('email chưa được Google xác thực', async () => {
    googleReturns({ sub: 'g-123', email: 'alice@gmail.com', email_verified: false })

    await assert.rejects(verifyGoogleIdToken('token'), {
      statusCode: 401,
      message: 'Email của tài khoản Google chưa được xác thực.',
    })
  })

  test('token sai chữ ký, hết hạn hoặc sai audience', async () => {
    mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => {
      throw new Error('Wrong recipient, payload audience != requiredAudience')
    })

    await assert.rejects(verifyGoogleIdToken('token'), {
      statusCode: 401,
      message: 'Phiên đăng nhập Google không hợp lệ, vui lòng thử lại.',
    })
  })
})
