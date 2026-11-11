import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EMPTY_FORM,
  buildPostPayload,
  checkImages,
  mapApiErrors,
  validateStep,
} from '../../src/lib/user/composePost.js'

const MB = 1024 * 1024
const file = (name, type, size = MB) => ({ name, type, size })

describe('validateStep: kiểm tra từng bước đăng bài', () => {
  afterEach(() => vi.useRealTimers())

  it('bắt buộc tiêu đề và chặn tiêu đề quá 120 ký tự', () => {
    expect(validateStep('content', { ...EMPTY_FORM, title: '   ' })).toEqual({
      title: 'Nhập tiêu đề cho bài đăng.',
    })
    expect(validateStep('content', { ...EMPTY_FORM, title: 'a'.repeat(121) }).title).toBe(
      'Tiêu đề tối đa 120 ký tự.'
    )
    expect(validateStep('content', { ...EMPTY_FORM, title: 'a'.repeat(120) })).toEqual({})
  })

  // Tạo ngày bằng giờ máy nên kết quả không phụ thuộc múi giờ của máy chạy test
  it('không cho chọn ngày hoặc buổi chưa tới', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 12, 9, 0))

    expect(validateStep('time', { ...EMPTY_FORM, date: '2026-11-13' }).date).toBe(
      'Ngày không được ở tương lai.'
    )
    expect(validateStep('time', { ...EMPTY_FORM, date: '2026-11-12', dayPart: 'evening' })).toEqual(
      { dayPart: 'Khoảng thời gian này chưa tới.' }
    )
    expect(validateStep('time', { ...EMPTY_FORM, date: '2026-11-12', dayPart: 'morning' })).toEqual(
      {}
    )
  })

  it('câu hỏi xác minh: phương án trùng nhau khi bỏ dấu thì không hợp lệ', () => {
    const question = { skipped: false, text: 'Ví màu gì?', options: ['Đỏ', 'do', ''], correct: 0 }
    expect(validateStep('question', { ...EMPTY_FORM, question })).toEqual({
      options: 'Các phương án không được trùng nhau.',
    })
  })
})

describe('checkImages: lọc ảnh trước khi tải lên', () => {
  it('bỏ ảnh sai định dạng, quá 5 MB và ảnh vượt số lượng', () => {
    const files = [
      file('a.jpg', 'image/jpeg'),
      file('b.gif', 'image/gif'),
      file('c.png', 'image/png', 6 * MB),
      file('d.webp', 'image/webp'),
    ]
    const { accepted, errors } = checkImages(files, 8)

    expect(accepted.map((item) => item.name)).toEqual(['a.jpg'])
    expect(errors).toEqual([
      '"b.gif" không phải ảnh JPG, PNG hoặc WEBP.',
      '"c.png" lớn hơn 5 MB.',
      'Chỉ được tối đa 9 ảnh, các ảnh thừa đã bị bỏ.',
    ])
  })
})

describe('buildPostPayload: dữ liệu gửi API đăng bài', () => {
  const base = {
    ...EMPTY_FORM,
    category: 'vi-tien',
    attributes: { color: 'red' },
    title: '  Mất ví da  ',
    date: '2026-11-10',
    dayPart: 'evening',
    location: {
      ...EMPTY_FORM.location,
      mode: 'pin',
      area: 'Quận 1',
      point: { lat: 10.77, lng: 106.7 },
      placePublic: 'Chợ Bến Thành',
    },
  }

  it('tin Mất đồ: cắt khoảng trắng, đổi thuộc tính sang mảng, không gửi câu hỏi', () => {
    const payload = buildPostPayload({ ...base, type: 'lost' })

    expect(payload.title).toBe('Mất ví da')
    expect(payload.attributes).toEqual([{ attribute: 'color', value: 'red' }])
    expect(payload.location).toEqual({
      mode: 'pin',
      area: 'Quận 1',
      point: { lat: 10.77, lng: 106.7 },
      placeName: 'Chợ Bến Thành',
    })
    expect(payload).not.toHaveProperty('question')
  })

  it('tin Nhặt được: bỏ phương án trống mà vẫn giữ đúng đáp án', () => {
    const question = { skipped: false, text: 'Màu ví?', options: ['Đen', '', 'Nâu'], correct: 2 }
    const payload = buildPostPayload({ ...base, type: 'found', question })

    expect(payload.question).toEqual({ text: 'Màu ví?', options: ['Đen', 'Nâu'], correct: 1 })
  })
})

describe('mapApiErrors: lỗi từ backend về đúng bước của form', () => {
  it('đưa người dùng về bước của lỗi đầu tiên, giữ lỗi của từng ô', () => {
    const result = mapApiErrors([
      { field: 'location.area', message: 'Khu vực không hợp lệ' },
      { field: 'title', message: 'Tiêu đề quá dài' },
      { field: 'unknown', message: 'bỏ qua' },
    ])

    expect(result).toEqual({
      stepKey: 'location',
      errors: { area: 'Khu vực không hợp lệ', title: 'Tiêu đề quá dài' },
    })
    expect(mapApiErrors([{ field: 'unknown', message: 'x' }])).toBeNull()
  })
})
