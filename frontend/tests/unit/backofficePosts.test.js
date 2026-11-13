import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}))

import { api } from '../../src/lib/api'
import {
  hasInvalidRange,
  isWithinDateRange,
  validateHideReason,
} from '../../src/lib/backoffice/posts.js'
import {
  getBackofficePost,
  listBackofficePosts,
  toBackofficePost,
  updateBackofficePostStatus,
  updateBackofficePostVisibility,
} from '../../src/lib/backoffice/postsApi.js'

beforeEach(() => vi.resetAllMocks())

describe('Quản lý tất cả bài đăng - xử lý dữ liệu frontend', () => {
  it('ẩn bài bắt buộc lý do, kiểm tra giới hạn 500 ký tự sau khi bỏ khoảng trắng', () => {
    expect(validateHideReason()).toBe('Vui lòng nhập lý do ẩn bài đăng.')
    expect(validateHideReason('   ')).toBe('Vui lòng nhập lý do ẩn bài đăng.')
    expect(validateHideReason(`  ${'a'.repeat(500)}  `)).toBe('')
    expect(validateHideReason('a'.repeat(501))).toBe('Lý do không được vượt quá 500 ký tự.')
  })

  it('khoảng ngày bao gồm mốc biên, chấp nhận một đầu ngày, chặn ngày kết thúc trước ngày bắt đầu', () => {
    const range = { from: '2026-11-10', to: '2026-11-12' }
    expect(hasInvalidRange(range)).toBe(false)
    expect(isWithinDateRange('10/11/2026 00:00', range)).toBe(true)
    expect(isWithinDateRange('12/11/2026 23:59', range)).toBe(true)
    expect(isWithinDateRange('13/11/2026 00:00', range)).toBe(false)
    expect(isWithinDateRange('09/11/2026 23:59', range)).toBe(false)
    expect(isWithinDateRange('11/11/2026 12:00', { from: '2026-11-10' })).toBe(true)
    expect(isWithinDateRange('11/11/2026 12:00', { to: '2026-11-12' })).toBe(true)
    const invalid = { from: '2026-11-12', to: '2026-11-10' }
    expect(hasInvalidRange(invalid)).toBe(true)
    expect(isWithinDateRange('11/11/2026 12:00', invalid)).toBe(false)
  })

  it('danh sách giữ trạng thái xử lý độc lập với ẩn/hiện cho từng bài', async () => {
    api.get.mockResolvedValue({
      data: {
        items: [
          {
            id: 'post-1',
            code: 'L121126001',
            title: 'Ví nâu',
            status: 'searching',
            isHidden: true,
            hiddenReason: 'Cần kiểm tra',
          },
          {
            id: 'post-2',
            code: 'F121126001',
            title: 'Nhặt ví',
            status: 'pending',
            isHidden: false,
          },
        ],
      },
    })

    const posts = await listBackofficePosts()
    expect(
      posts.map(({ id, postCode, status, hidden, hiddenReason }) => ({
        id,
        postCode,
        status,
        hidden,
        hiddenReason,
      }))
    ).toEqual([
      {
        id: 'post-1',
        postCode: 'L121126001',
        status: 'searching',
        hidden: true,
        hiddenReason: 'Cần kiểm tra',
      },
      { id: 'post-2', postCode: 'F121126001', status: 'pending', hidden: false, hiddenReason: '' },
    ])
  })

  it('đổi dữ liệu chi tiết, lịch sử và bài matching sang định dạng hiển thị theo giờ Việt Nam', () => {
    const post = toBackofficePost({
      id: 'post-1',
      code: 'L121126001',
      title: 'Ví nâu',
      type: 'lost',
      status: 'searching',
      createdAt: '2026-11-12T02:30:00Z',
      category: { name: 'Ví & tiền', slug: 'vi-tien' },
      author: { username: 'nam', reputationScore: 0 },
      area: 'Quận 1',
      placeName: 'Chợ Bến Thành',
      placeNameTo: 'Nhà thờ Đức Bà',
      isHidden: true,
      hiddenReason: 'Cần kiểm tra',
      counts: { views: 7, comments: 2, matches: 1 },
      images: ['a.jpg', 'b.jpg'],
      description: 'Ví da màu nâu',
      statusHistory: [{ status: 'rejected', note: 'Thiếu ảnh', changedAt: '2026-11-11T17:00:00Z' }],
      matchingPosts: [
        {
          id: 'match-1',
          score: 0.9,
          post: { id: 'found-1', title: 'Nhặt ví', coverImage: 'found.jpg' },
        },
      ],
    })
    expect(post).toMatchObject({
      postCode: 'L121126001',
      category: 'Ví & tiền',
      categorySlug: 'vi-tien',
      dateTime: '12/11/2026 09:30',
      author: 'nam',
      reputation: 0,
      location: 'Chợ Bến Thành → Nhà thờ Đức Bà, Quận 1',
      hidden: true,
      hiddenReason: 'Cần kiểm tra',
      views: 7,
      comments: 2,
      matches: 1,
      desc: 'Ví da màu nâu',
      images: ['a.jpg', 'b.jpg'],
      statusHistory: [{ status: 'rejected', dateTime: '12/11/2026 00:00', reason: 'Thiếu ảnh' }],
      matchingPosts: [
        {
          id: 'match-1',
          score: 0.9,
          post: { id: 'found-1', title: 'Nhặt ví', images: ['found.jpg'] },
        },
      ],
    })
  })

  it('thiếu tác giả, danh mục, thống kê hoặc ảnh vẫn có dữ liệu hiển thị an toàn', () => {
    expect(
      toBackofficePost({ id: 'post-1', createdAt: 'invalid', author: null, category: null })
    ).toMatchObject({
      dateTime: '',
      author: '',
      category: '',
      reputation: null,
      images: [],
      views: 0,
      comments: 0,
      matches: 0,
      statusHistory: [],
      matchingPosts: [],
      hidden: false,
    })
    expect(toBackofficePost({ coverImage: 'cover.jpg' }).images).toEqual(['cover.jpg'])
    expect(toBackofficePost({ images: [], coverImage: 'old.jpg' }).images).toEqual([])
  })

  it('gửi bộ lọc lên server, đổi Đã ẩn thành isHidden và bỏ tham số trống khi đặt lại', async () => {
    api.get.mockResolvedValue({ data: { items: [] } })
    await listBackofficePosts({
      query: '  ví nâu  ',
      status: 'closed',
      category: 'vi-tien',
      type: 'lost',
      district: 'Quận 1',
      from: '2026-11-01',
      to: '2026-11-12',
    })
    const url = new URL(api.get.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toBe('/backoffice/posts')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ví nâu',
      status: 'closed',
      category: 'vi-tien',
      type: 'lost',
      area: 'Quận 1',
      from: '2026-11-01',
      to: '2026-11-12',
    })
    await listBackofficePosts({ status: 'hidden' })
    expect(api.get).toHaveBeenNthCalledWith(2, '/backoffice/posts?isHidden=true')
    expect(await listBackofficePosts({ query: '   ', status: '' })).toEqual([])
    expect(api.get).toHaveBeenNthCalledWith(3, '/backoffice/posts')
  })

  it('gửi đúng ID và quyết định, trả dữ liệu API và chuyển lỗi cho giao diện xử lý', async () => {
    api.get.mockResolvedValue({ data: { id: 'post/1', description: 'Ví nâu' } })
    expect(await getBackofficePost('post/1')).toMatchObject({ id: 'post/1', desc: 'Ví nâu' })
    expect(api.get).toHaveBeenCalledWith('/backoffice/posts/post%2F1')
    api.patch
      .mockResolvedValueOnce({ data: { status: 'rejected' } })
      .mockResolvedValueOnce({ data: { isHidden: true } })
    expect(await updateBackofficePostStatus('post/1', 'rejected', 'Thiếu ảnh')).toEqual({
      status: 'rejected',
    })
    expect(await updateBackofficePostVisibility('post/1', true, 'Spam')).toEqual({ isHidden: true })
    expect(api.patch).toHaveBeenNthCalledWith(1, '/backoffice/posts/post%2F1/status', {
      status: 'rejected',
      reason: 'Thiếu ảnh',
    })
    expect(api.patch).toHaveBeenNthCalledWith(2, '/backoffice/posts/post%2F1/visibility', {
      isHidden: true,
      reason: 'Spam',
    })

    const error = new Error('Không thể cập nhật, trạng thái bài đã thay đổi.')
    api.get.mockRejectedValue(error)
    api.patch.mockRejectedValue(error)
    await expect(listBackofficePosts()).rejects.toBe(error)
    await expect(getBackofficePost('post-1')).rejects.toBe(error)
    await expect(updateBackofficePostStatus('post-1', 'closed')).rejects.toBe(error)
    await expect(updateBackofficePostVisibility('post-1', false)).rejects.toBe(error)
  })
})
