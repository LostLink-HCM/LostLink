const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const {
  generateOtp,
  generateResetToken,
  hashAnswer,
  hashToken,
  matchesAnswer,
  matchesHash,
} = require('../../src/utils/crypto')

describe('NF02 - Sinh và băm mã bí mật', () => {
  test('OTP luôn đủ 6 chữ số; token đặt lại dài 64 ký tự hex và không lặp lại', () => {
    for (let i = 0; i < 200; i += 1) assert.match(generateOtp(), /^\d{6}$/)

    const token = generateResetToken()
    assert.match(token, /^[a-f0-9]{64}$/)
    assert.notEqual(token, generateResetToken())
  })

  test('so khớp mã băm: đúng, sai và chuỗi băm hỏng', () => {
    const hash = hashToken('123456')

    assert.equal(matchesHash('123456', hash), true)
    assert.equal(matchesHash('654321', hash), false)
    assert.equal(matchesHash('123456', 'abc'), false)
  })

  test('đáp án câu hỏi xác minh chỉ khớp với đúng phương án của đúng câu hỏi', () => {
    const hash = hashAnswer('challenge-1', 'option-b')

    assert.equal(matchesAnswer('challenge-1', 'option-b', hash), true)
    assert.equal(matchesAnswer('challenge-1', 'option-a', hash), false)
    assert.equal(matchesAnswer('challenge-2', 'option-b', hash), false)
  })
})
