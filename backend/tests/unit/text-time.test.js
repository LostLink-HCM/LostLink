const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { escapeRegex, hasDiacritics, lowercaseText, normalizeText } = require('../../src/utils/text')
const { endOfVnDay, isVnDate, startOfVnDay } = require('../../src/utils/vnTime')

describe('UC02 - Chuẩn hóa từ khóa tiếng Việt', () => {
  test('bỏ dấu, đổi đ thành d, viết thường và gộp khoảng trắng', () => {
    assert.equal(normalizeText('  Mất VÍ  da Đỏ ở Quận 1 '), 'mat vi da do o quan 1')
    assert.equal(normalizeText('Đường Điện Biên Phủ'), 'duong dien bien phu')
  })

  test('nhận biết từ có dấu, viết thường nhưng giữ dấu', () => {
    assert.equal(hasDiacritics('ví'), true)
    assert.equal(hasDiacritics('Đỏ'), true)
    assert.equal(hasDiacritics('vi'), false)
    assert.equal(lowercaseText('  Ví  DA Đỏ '), 'ví da đỏ')
  })

  test('thoát ký tự đặc biệt của biểu thức chính quy', () => {
    assert.equal(escapeRegex('(a.*)'), '\\(a\\.\\*\\)')
  })
})

describe('UC02 - Mốc ngày theo giờ Việt Nam', () => {
  test('đầu và cuối ngày tính theo UTC+7', () => {
    assert.equal(startOfVnDay('2026-11-03').toISOString(), '2026-11-02T17:00:00.000Z')
    assert.equal(endOfVnDay('2026-11-03').toISOString(), '2026-11-03T16:59:59.999Z')
  })

  test('chỉ nhận ngày có thật theo định dạng YYYY-MM-DD', () => {
    assert.equal(isVnDate('2028-02-29'), true)
    for (const value of ['2026-02-30', '2026-13-01', '03/11/2026', '2026-1-3', '', undefined]) {
      assert.equal(isVnDate(value), false, String(value))
    }
  })
})
