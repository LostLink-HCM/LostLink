const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const {
  buildMatchers,
  cleanPosts,
  estimate,
  isUnknownItem,
  smoothed,
} = require('../../src/scripts/estimateFrequencies')
const DEFINITIONS = require('../../src/seeds/data/categoryDefinitions')
const CATEGORIES = require('../../src/seeds/data/categories')
const FREQUENCIES = require('../../src/seeds/data/categoryFrequencies.json')

const matchers = buildMatchers()
const post = (description) => ({ post_title: '', post_description: description })
const categoryOf = (description) => {
  const { byCategory } = estimate(cleanPosts([post(description)]), matchers)
  return Object.keys(byCategory).find((name) => byCategory[name].length)
}
const valuesOf = (description) => estimate(cleanPosts([post(description)]), matchers).result.values

describe('Ước lượng độ hiếm u: gán danh mục theo món nhắc đến đầu tiên', () => {
  test('ví có CCCD bên trong là Ví, chỉ nhặt được CCCD là Giấy tờ', () => {
    assert.equal(categoryOf('Em làm rơi ví màu đen trong có CCCD và thẻ ATM'), 'Ví & tiền')
    assert.equal(categoryOf('Mình nhặt được CCCD ở cổng trường, ai mất ib'), 'Giấy tờ & thẻ')
    assert.equal(categoryOf('Rơi túi xách, bên trong có ví và điện thoại'), 'Túi & balo')
  })

  test('cách gọi đời thường và từ dễ nhầm', () => {
    assert.equal(categoryOf('e bị rớt bóp ở chợ, ai lượm đc cho e xin'), 'Ví & tiền')
    assert.equal(categoryOf('mình rớt chùm chìa khoá xe ở quán cà phê'), 'Chìa khóa & xe cộ')
    // "vẹt" trong "cà vẹt" không phải con vẹt; "xe máy" chỉ là phương tiện đang đi
    assert.equal(categoryOf('rơi cà vẹt xe trên đường về, ai thấy cho xin'), 'Giấy tờ & thẻ')
    assert.equal(categoryOf('đang đi xe máy thì làm rơi ví ở ngã tư'), 'Ví & tiền')
    assert.equal(categoryOf('Kính mong mọi người giúp, em làm rơi ví da'), 'Ví & tiền')
  })

  test('số điện thoại liên hệ không bị hiểu là mất điện thoại', () => {
    assert.equal(
      categoryOf('Ai nhặt được liên hệ điện thoại 0901 234 567, em rơi bóp'),
      'Ví & tiền'
    )
    assert.equal(categoryOf('lh đt 0901234567 em có rơi cái bóp đen'), 'Ví & tiền')
    assert.equal(categoryOf('Mình làm rơi điện thoại iPhone ở công viên'), 'Thiết bị điện tử')
  })

  test('màu chỉ tính khi đi sau "màu" hoặc ngay sau tên món, không lấy tên người', () => {
    const values = valuesOf('Chị Hồng làm rơi ví đen ở chợ, trong có thẻ ngân hàng')
    assert.equal(values['Ví & tiền']['Màu chủ đạo']['Đen'].posts, 1)
    assert.equal(values['Ví & tiền']['Màu chủ đạo']['Hồng'].posts, 0)
  })
})

describe('Ước lượng độ hiếm u: lọc bài', () => {
  test('bỏ bài trùng, quảng cáo, tìm người và bài không nói mất hay nhặt', () => {
    const posts = cleanPosts([
      post('Em làm rơi ví đen ở chợ'),
      post('Em làm rơi ví đen ở chợ'),
      post('Đăng tin tìm đồ tại website https://example.vn nhanh chóng'),
      post('Tìm người thân mất tích từ năm 2010'),
      post('Chúc mọi người buổi tối vui vẻ'),
      post('Tìm người đánh rơi bóp ở trạm xe buýt'),
    ])
    assert.equal(posts.length, 2)
  })

  test('caption ngắn không nhắc món nào (món đồ chỉ có trong ảnh) thì không đếm', () => {
    assert.equal(isUnknownItem('tìm chủ nhân đồ rơi', matchers), true)
    assert.equal(isUnknownItem('nhặt được ví ở chợ', matchers), false)
  })
})

describe('Ước lượng độ hiếm u: làm trơn Laplace và sàn 1%', () => {
  test('theo docs/design/category-management.md mục 2.4', () => {
    // Màu lông (K = 6), Nâu 90/300 bài: 91/306 ≈ 29,7%
    assert.equal(smoothed(90, 300, 6), 0.2974)
    // Danh mục mới 5 bài, Giống (K = 9), Corgi 0 bài: 1/14 ≈ 7%
    assert.equal(smoothed(0, 5, 9), 0.0714)
    // Nhiều dữ liệu, giá trị hiếm: chặn dưới ở 1%
    assert.equal(smoothed(0, 5000, 8), 0.01)
  })
})

describe('Số liệu u đã ghi khớp định nghĩa danh mục', () => {
  test('mọi danh mục và giá trị đều có u trong [1%, 100%]', () => {
    for (const definition of DEFINITIONS) {
      const u = FREQUENCIES.categories[definition.name]?.u
      assert.ok(u >= 0.01 && u <= 1, definition.name)
      for (const [name, , , , values] of definition.attributes) {
        for (const [value] of values) {
          const valueU = FREQUENCIES.values[definition.name][name][value]?.u
          assert.ok(valueU >= 0.01 && valueU <= 1, `${definition.name} › ${name} › ${value}`)
        }
      }
    }
  })

  test('categories.js ghép đúng u vào từng giá trị cho seed', () => {
    const wallet = CATEGORIES.find((category) => category.name === 'Ví & tiền')
    assert.equal(wallet.frequency, FREQUENCIES.categories['Ví & tiền'].u)
    const [, , , , colors] = wallet.attributes.find(([name]) => name === 'Màu chủ đạo')
    const black = colors.find(([value]) => value === 'Đen')
    assert.equal(black[1], FREQUENCIES.values['Ví & tiền']['Màu chủ đạo']['Đen'].u)
  })
})
