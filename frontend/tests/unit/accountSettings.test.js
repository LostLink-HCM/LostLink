import { describe, expect, it } from 'vitest'

import {
  AVATAR_ERROR,
  validateAvatar,
  validateBio,
  validateNewEmail,
  validateOtp,
  validatePasswordChange,
} from '../../src/lib/user/settings.js'

const MB = 1024 * 1024
const file = (type, size = 1024) => ({ type, size })

describe('UC14 - validateBio', () => {
  it('cho phép để trống và tối đa 500 ký tự (không tính khoảng trắng hai đầu)', () => {
    expect(validateBio('')).toBe('')
    expect(validateBio('a'.repeat(500))).toBe('')
    expect(validateBio(`  ${'a'.repeat(500)}  `)).toBe('')
    expect(validateBio('a'.repeat(501))).toBe('Giới thiệu tối đa 500 ký tự.')
  })
})

describe('UC15 - validateAvatar', () => {
  it('nhận JPG, PNG, WEBP không quá 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateAvatar(file(type, 5 * MB))).toBe('')
    }
  })

  it('sai định dạng hoặc vượt 5 MB thì báo lỗi', () => {
    expect(validateAvatar(file('image/gif'))).toBe(AVATAR_ERROR)
    expect(validateAvatar(file('image/jpeg', 5 * MB + 1))).toBe(AVATAR_ERROR)
    expect(AVATAR_ERROR).toBe('Ảnh phải là JPG, PNG hoặc WEBP và không quá 5 MB.')
  })
})

describe('UC16 - validatePasswordChange', () => {
  const valid = { current: 'Secret@123', next: 'NewSecret@456', confirm: 'NewSecret@456' }

  it('hợp lệ thì không có lỗi', () => {
    expect(validatePasswordChange(valid)).toEqual({})
  })

  it('báo lỗi đúng ô nhập', () => {
    expect(validatePasswordChange({ ...valid, current: '' })).toEqual({
      current: 'Vui lòng nhập mật khẩu hiện tại.',
    })
    expect(validatePasswordChange({ ...valid, next: 'Ab@1', confirm: 'Ab@1' }).next).toBe(
      'Mật khẩu tối thiểu 8 ký tự.'
    )
    expect(
      validatePasswordChange({ ...valid, next: valid.current, confirm: valid.current }).next
    ).toBe('Mật khẩu mới phải khác mật khẩu hiện tại.')
    expect(validatePasswordChange({ ...valid, confirm: 'Other@4567' })).toEqual({
      confirm: 'Mật khẩu nhập lại không khớp.',
    })
  })
})

describe('UC17 - validateNewEmail', () => {
  it('bỏ trống, sai định dạng hoặc trùng email hiện tại', () => {
    expect(validateNewEmail('  ', 'me@example.com')).toBe('Vui lòng nhập email.')
    expect(validateNewEmail('khong-hop-le', 'me@example.com')).toBe('Email không hợp lệ.')
    expect(validateNewEmail(' ME@example.com ', 'me@example.com')).toBe(
      'Email mới phải khác email hiện tại.'
    )
    expect(validateNewEmail('moi@example.com', 'me@example.com')).toBe('')
  })
})

describe('UC18 - validateOtp', () => {
  it('phải đủ 6 chữ số', () => {
    expect(validateOtp('123456')).toBe('')
    for (const code of ['', '12345', '1234567', '12345a']) {
      expect(validateOtp(code)).toBe('Vui lòng nhập đủ 6 chữ số.')
    }
  })
})
