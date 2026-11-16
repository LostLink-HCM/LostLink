import { describe, expect, it } from 'vitest'

import {
  compareRows,
  evidenceLabel,
  findGroup,
  sortGroups,
  sortedEvidence,
  splitEvidence,
} from '../../src/lib/user/matches.js'
import { describeNotification } from '../../src/lib/user/notifications.js'
import { communityStatItems } from '../../src/lib/user/reputation.js'

describe('UC36 - Lý do gợi ý ghép cặp', () => {
  it('diễn giải từng tiêu chí theo dữ liệu server trả về', () => {
    expect(evidenceLabel({ key: 'location', w: 3, detail: { within: 500 } })).toBe(
      'Cách dưới 500 m'
    )
    expect(evidenceLabel({ key: 'location', w: 1, detail: { within: 2000 } })).toBe(
      'Cách dưới 2 km'
    )
    expect(evidenceLabel({ key: 'location', w: -1, detail: { within: null } })).toBe('Cách khá xa')
    expect(evidenceLabel({ key: 'time', w: 1, detail: { gapDays: 0 } })).toBe(
      'Cùng khoảng thời gian'
    )
    expect(evidenceLabel({ key: 'time', w: -1, detail: { gapDays: 1.4 } })).toBe('Lệch 1 ngày')
    expect(evidenceLabel({ key: 'category', w: 2, detail: { name: 'Ví', related: false } })).toBe(
      'Cùng danh mục Ví'
    )
    expect(evidenceLabel({ key: 'attribute', w: 2, detail: { name: 'Màu', value: 'Nâu' } })).toBe(
      'Cùng màu Nâu'
    )
    expect(
      evidenceLabel({
        key: 'attribute',
        w: -3,
        detail: { name: 'Giống', value: 'Poodle', other: 'Corgi' },
      })
    ).toBe('Giống khác nhau (Poodle / Corgi)')
    // Không hiện tên món bên trong, chỉ số món trùng
    expect(evidenceLabel({ key: 'contents', w: 1, detail: { sharedCount: 2 } })).toBe(
      'Trùng 2 món bên trong'
    )
  })

  it('tiêu chí ủng hộ mạnh nhất lên trước, tiêu chí lạ bị bỏ', () => {
    const items = sortedEvidence([
      { key: 'text', w: -0.5, detail: {} },
      { key: 'location', w: 4, detail: { within: 200 } },
      { key: 'image', w: 9, detail: {} },
    ])
    expect(items.map((item) => item.key)).toEqual(['location', 'text'])
  })

  it('hiện 3 lý do mạnh nhất cùng mọi khác biệt; trùng giá trị phổ biến không bị coi là khác', () => {
    const { shown, hidden } = splitEvidence([
      { key: 'location', w: 4, detail: { within: 200 } },
      { key: 'category', w: 3, detail: { name: 'Ví', related: false } },
      { key: 'time', w: 1.5, detail: { gapDays: 0 } },
      { key: 'text', w: 0.5, detail: {} },
      { key: 'attribute', w: -0.1, detail: { name: 'Chất liệu', value: 'Da' } },
      { key: 'attribute', w: -3, detail: { name: 'Màu', value: 'Bạc', other: 'Xám' } },
    ])
    expect(shown.map((item) => item.key)).toEqual(['location', 'category', 'time', 'attribute'])
    expect(shown.at(-1).conflict).toBe(true)
    expect(hidden.map((item) => item.label)).toEqual([
      'Mô tả có nhiều điểm giống',
      'Cùng chất liệu Da',
    ])
    expect(hidden.every((item) => !item.conflict)).toBe(true)
  })

  it('bảng so sánh gộp đặc điểm của hai bài, chỉ đánh dấu khi cả hai điền mà khác nhau', () => {
    const post = (traits) => ({
      timeWindow: 'Tối 13/11',
      category: 'Thiết bị điện tử',
      address: 'Sân bay',
      traits,
    })
    const rows = compareRows(
      post([
        { name: 'Hãng', value: 'Apple' },
        { name: 'Màu', value: 'Bạc' },
      ]),
      post([
        { name: 'Màu', value: 'Xám' },
        { name: 'Loại', value: 'Laptop' },
      ]),
      (item) => item.address
    )
    expect(rows.map((row) => [row.label, row.mine, row.other, Boolean(row.differs)])).toEqual([
      ['Thời điểm', 'Tối 13/11', 'Tối 13/11', false],
      ['Địa điểm', 'Sân bay', 'Sân bay', false],
      ['Danh mục', 'Thiết bị điện tử', 'Thiết bị điện tử', false],
      ['Hãng', 'Apple', '', false],
      ['Màu', 'Bạc', 'Xám', true],
      ['Loại', '', 'Laptop', false],
    ])
  })

  it('mở đúng bài theo id hoặc slug trên URL, không có thì bài đầu tiên có gợi ý', () => {
    const groups = [
      { post: { id: 'a', slug: 'vi-da' }, items: [] },
      { post: { id: 'b', slug: 'the-xe' }, items: [{}] },
    ]
    expect(findGroup(groups, 'vi-da')).toBe(groups[0])
    expect(findGroup(groups, 'b')).toBe(groups[1])
    expect(findGroup(groups, null)).toBe(groups[1])
    // Chưa bài nào có gợi ý thì mở bài đầu tiên
    expect(findGroup([groups[0]], null)).toBe(groups[0])
    expect(findGroup([], 'x')).toBeUndefined()
  })

  it('bài nhiều gợi ý chưa phản hồi lên trước, rồi theo tổng số gợi ý, bằng nhau giữ thứ tự', () => {
    const item = (confirmed) => ({ match: { confirmed } })
    const groups = [
      { post: { id: 'moi-nhat' }, items: [] },
      { post: { id: 'da-xem-het' }, items: [item(true), item(true)] },
      { post: { id: 'hai-chua-xem' }, items: [item(false), item(false)] },
      { post: { id: 'mot-chua-xem' }, items: [item(false), item(true), item(true)] },
      { post: { id: 'cu-hon' }, items: [] },
    ]
    const sorted = sortGroups(groups)
    expect(sorted.map((group) => group.post.id)).toEqual([
      'hai-chua-xem',
      'mot-chua-xem',
      'da-xem-het',
      'moi-nhat',
      'cu-hon',
    ])
    expect(sorted.map((group) => group.pending)).toEqual([2, 1, 0, 0, 0])
  })

  it('thông báo gợi ý ghép cặp mở danh sách gợi ý của bài đó', () => {
    const item = describeNotification({
      id: 'n2',
      type: 'match',
      text: 'Nhặt được ví da',
      post: { available: true, title: 'Mất ví da', type: 'lost', slug: 'mat-vi-da' },
      isRead: false,
      createdAt: '2026-11-15T08:00:00Z',
    })
    expect(item.link).toEqual({ to: '/matches?post=mat-vi-da' })
    expect(item.action).toBe('Xem manh mối')
  })
})

describe('UC05 - Thống kê cộng đồng', () => {
  it('định dạng số theo kiểu Việt Nam, chưa có lượt trao trả thì hiện gạch ngang', () => {
    expect(
      communityStatItems({
        posted: 12480,
        returned: 4037,
        matchRate: 0.3233,
        avgReturnDays: 2.1,
      }).map((item) => item.value)
    ).toEqual(['12.480', '4.037', '32,3%', '2,1 ngày'])
    expect(
      communityStatItems({ posted: 0, returned: 0, matchRate: 0, avgReturnDays: null })[3].value
    ).toBe('–')
  })
})
