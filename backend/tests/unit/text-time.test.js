const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const {
  escapeRegex,
  hasDiacritics,
  lowercaseText,
  normalizeText,
  slugify,
} = require('../../src/utils/text')
const {
  endOfVnDay,
  isVnDate,
  startOfVnDay,
  todayVn,
  vnDayPartOf,
  vnTimeRange,
} = require('../../src/utils/vnTime')
const { publicIdFromUrl } = require('../../src/services/imageService')
const { formatPostCode, postCodePrefix } = require('../../src/utils/postCode')

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

describe('UC04 - Tạo slug cho URL bài đăng', () => {
  test('bỏ dấu, chỉ giữ chữ thường, số và gạch ngang', () => {
    assert.equal(
      slugify('Mất ví Louis Vuitton (màu nâu) ở Q.1!'),
      'mat-vi-louis-vuitton-mau-nau-o-q-1'
    )
    assert.equal(slugify('  Đường Điện Biên Phủ  '), 'duong-dien-bien-phu')
    assert.equal(slugify('!!! ???'), '')
  })

  test('slug dài thì cắt ở ranh giới từ, không để gạch ngang ở cuối', () => {
    assert.equal(slugify('mot hai ba bon', 9), 'mot-hai')
    assert.equal(slugify('abcdefghijkl', 5), 'abcde')
    assert.ok(slugify('chữ '.repeat(60)).length <= 80)
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

describe('Mã bài đăng', () => {
  test('L cho Mất đồ, F cho Nhặt được, ngày đăng DDMMYY theo giờ Việt Nam', () => {
    assert.equal(postCodePrefix('lost', '2026-11-07T03:00:00Z'), 'L071126')
    assert.equal(postCodePrefix('found', '2026-11-07T03:00:00Z'), 'F071126')
    // 23:30 ngày 06/11 giờ UTC đã là 06:30 ngày 07/11 giờ Việt Nam
    assert.equal(postCodePrefix('lost', '2026-11-06T23:30:00Z'), 'L071126')
    assert.equal(postCodePrefix('lost', '2026-11-06T16:59:59Z'), 'L061126')
  })

  test('số thứ tự 3 chữ số, quá 999 bài trong ngày thì báo lỗi', () => {
    assert.equal(formatPostCode('L071126', 1), 'L071126001')
    assert.equal(formatPostCode('F071126', 42), 'F071126042')
    assert.throws(() => formatPostCode('L071126', 1000))
  })
})

describe('UC U05 - Khoảng thời gian mất/nhặt theo giờ Việt Nam', () => {
  const iso = (value) => new Date(value).toISOString()

  test('không chọn buổi thì là cả ngày', () => {
    const { from, to } = vnTimeRange('2026-11-05')
    assert.equal(from.toISOString(), iso('2026-11-05T00:00:00+07:00'))
    assert.equal(to.toISOString(), iso('2026-11-05T23:59:59.999+07:00'))
  })

  test('mỗi buổi là một khung giờ, Ban đêm kéo sang 6 giờ sáng hôm sau', () => {
    const range = (dayPart) => {
      const { from, to } = vnTimeRange('2026-11-05', dayPart)
      return [from.toISOString(), to.toISOString()]
    }
    assert.deepEqual(range('morning'), [
      iso('2026-11-05T06:00:00+07:00'),
      iso('2026-11-05T10:59:59.999+07:00'),
    ])
    assert.deepEqual(range('night'), [
      iso('2026-11-05T22:00:00+07:00'),
      iso('2026-11-06T05:59:59.999+07:00'),
    ])
  })

  test('hôm nay theo giờ Việt Nam: 23 giờ UTC đã là ngày hôm sau', () => {
    assert.equal(todayVn(Date.parse('2026-11-05T16:59:59Z')), '2026-11-05')
    assert.equal(todayVn(Date.parse('2026-11-05T17:00:00Z')), '2026-11-06')
  })
})

describe('UC25 - Nạp lại ngày và buổi khi sửa bài', () => {
  test('timeFrom đã lưu đổi ngược về đúng ngày và buổi đã chọn khi đăng', () => {
    for (const dayPart of ['', 'morning', 'noon', 'afternoon', 'evening', 'night']) {
      const { from } = vnTimeRange('2026-11-05', dayPart)
      assert.deepEqual(vnDayPartOf(from), { date: '2026-11-05', dayPart })
    }
  })

  test('bài cũ có giờ lệch khung thì lấy buổi chứa giờ đó, rạng sáng là Ban đêm hôm trước', () => {
    assert.deepEqual(vnDayPartOf(new Date('2026-11-05T19:30:00+07:00')), {
      date: '2026-11-05',
      dayPart: 'evening',
    })
    assert.deepEqual(vnDayPartOf(new Date('2026-11-05T03:15:00+07:00')), {
      date: '2026-11-04',
      dayPart: 'night',
    })
  })
})

describe('UC26 - Xoá ảnh của bài trên Cloudinary', () => {
  test('chỉ nhận ảnh trong thư mục bài đăng của LostLink', () => {
    assert.equal(
      publicIdFromUrl(
        'https://res.cloudinary.com/demo/image/upload/v1712/lostlink/posts/abc123.jpg'
      ),
      'lostlink/posts/abc123'
    )
    assert.equal(
      publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/lostlink/posts/abc.webp'),
      'lostlink/posts/abc'
    )
    for (const url of [
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/Wallet.jpg',
      'https://res.cloudinary.com/demo/image/upload/v1/lostlink/avatars/a.jpg',
      'https://evil.example/res.cloudinary.com/demo/image/upload/lostlink/posts/a.jpg',
    ]) {
      assert.equal(publicIdFromUrl(url), null, url)
    }
  })
})
