import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FILTERS,
  buildPostQuery,
  formatTimeWindow,
  isListed,
  normalize,
  validateFilters,
} from '../../src/lib/user/homeFeed.js'

const DAY = 24 * 60 * 60 * 1000

describe('normalize: so khớp từ khóa tiếng Việt', () => {
  it('bỏ dấu, đổi đ thành d và viết thường', () => {
    expect(normalize('  Ví Đựng Thẻ ')).toBe('vi dung the')
  })
})

describe('validateFilters: bộ lọc khoảng ngày tự chọn', () => {
  it('chỉ kiểm tra khi chọn khoảng tự chọn', () => {
    expect(validateFilters({ range: '7d', from: '', to: '' })).toBe('')
    expect(validateFilters({ range: 'custom', from: '', to: '' })).toBe(
      'Vui lòng chọn Từ ngày hoặc Đến ngày.'
    )
    expect(validateFilters({ range: 'custom', from: '2026-11-10', to: '2026-11-01' })).toBe(
      'Từ ngày phải trước hoặc bằng Đến ngày.'
    )
    expect(validateFilters({ range: 'custom', from: '2026-11-10', to: '2026-11-10' })).toBe('')
  })
})

describe('isListed: bài nào còn hiện trên bảng tin', () => {
  const now = Date.parse('2026-11-12T00:00:00Z')

  it('ẩn bài đã đóng; bài đã trao trả hiện thêm 7 ngày rồi ẩn', () => {
    expect(isListed({ status: 'open' }, now)).toBe(true)
    expect(isListed({ status: 'closed' }, now)).toBe(false)
    expect(isListed({ status: 'returned', returnedAt: now - 6 * DAY }, now)).toBe(true)
    expect(isListed({ status: 'returned', returnedAt: now - 8 * DAY }, now)).toBe(false)
  })
})

describe('buildPostQuery: tham số gửi API /api/posts', () => {
  it('đổi tên danh mục sang slug, cắt từ khóa, bỏ Từ/Đến ngày khi không phải khoảng tự chọn', () => {
    const filters = { ...DEFAULT_FILTERS, category: 'Ví & tiền', from: '2026-11-01' }

    expect(buildPostQuery(filters, '  ví da ', { hot: true, page: 2 })).toEqual({
      type: '',
      category: 'vi-tien',
      area: '',
      range: '7d',
      from: '',
      to: '',
      q: 'ví da',
      sort: 'hot',
      page: 2,
      limit: 12,
    })
  })
})

describe('formatTimeWindow: thời gian mất/nhặt theo giờ Việt Nam', () => {
  // 12:00Z là 19:00 ở TP.HCM, kết quả giống nhau dù máy chạy test ở múi giờ nào
  const now = Date.parse('2026-11-12T15:00:00Z')

  it('cùng ngày ghi một lần, khác ngày ghi cả hai đầu', () => {
    expect(formatTimeWindow('2026-11-12T12:00:00Z', '2026-11-12T13:00:00Z', now)).toBe(
      'Hôm nay, 19:00 – 20:00'
    )
    expect(formatTimeWindow('2026-11-11T14:00:00Z', '2026-11-12T01:00:00Z', now)).toBe(
      'Hôm qua 21:00 – Hôm nay 08:00'
    )
  })
})
