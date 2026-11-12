import { describe, expect, it } from 'vitest'

import { PASSWORD_RULES } from '../../src/lib/passwordRules.js'

// Nhãn các quy tắc mật khẩu chưa đạt
const failed = (password) =>
  PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label)

describe('PASSWORD_RULES: quy tắc mật khẩu (khớp backend)', () => {
  it('mật khẩu đủ mạnh thì đạt mọi quy tắc', () => {
    expect(failed('LostLink@2026')).toEqual([])
  })

  it('độ dài từ 8 đến 72 ký tự', () => {
    expect(failed('Ab1@abc')).toEqual(['8–72 ký tự'])
    expect(failed(`Ab1@${'a'.repeat(68)}`)).toEqual([])
    expect(failed(`Ab1@${'a'.repeat(69)}`)).toEqual(['8–72 ký tự'])
  })

  it('chữ có dấu không được tính là chữ thường, khoảng trắng không hợp lệ', () => {
    expect(failed('Mậtkhẩu@2026')).toEqual(['Chữ thường (a-z)'])
    expect(failed('Lost Link@2026')).toEqual(['Không khoảng trắng'])
  })
})
