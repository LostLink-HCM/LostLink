import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FILTERS,
  buildPostQuery,
  formatTimeWindow,
  normalize,
  validateFilters,
} from '../../src/lib/user/homeFeed.js'

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

  it('không cho chọn ngày sau hôm nay theo giờ Việt Nam', () => {
    const now = Date.parse('2026-11-12T18:00:00Z')
    expect(validateFilters({ range: 'custom', from: '2026-11-13', to: '' }, now)).toBe('')
    expect(validateFilters({ range: 'custom', from: '', to: '2026-11-14' }, now)).toBe(
      'Không chọn ngày trong tương lai.'
    )
  })
})

describe('buildPostQuery: tham số gửi API /api/posts', () => {
  it('gửi slug danh mục, cắt từ khóa, bỏ Từ/Đến ngày khi không phải khoảng tự chọn', () => {
    const filters = { ...DEFAULT_FILTERS, category: 'vi-tien', from: '2026-11-01' }

    expect(buildPostQuery(filters, '  ví da ', { hot: true, page: 2 })).toEqual({
      type: '',
      category: 'vi-tien',
      area: '',
      range: 'all',
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
