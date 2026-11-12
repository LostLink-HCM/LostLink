import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

import { api } from '../../src/lib/api'
import {
  approveModeratorPendingPost,
  getModeratorPendingPost,
  listModeratorPendingPosts,
  rejectModeratorPendingPost,
} from '../../src/lib/moderator/reviewPosts.js'

beforeEach(() => vi.resetAllMocks())

describe('Dữ liệu trang kiểm duyệt bài đăng', () => {
  it('gửi bộ lọc lên API và đổi bài chờ duyệt sang dữ liệu hiển thị', async () => {
    api.get.mockResolvedValue({
      data: {
        items: [
          {
            id: 'post-1',
            code: 'LL-001',
            title: 'Mất ví',
            type: 'lost',
            status: 'pending',
            createdAt: '2026-11-12T02:30:00.000Z',
            area: 'Quận 1',
            placeName: 'Chợ Bến Thành',
            category: { slug: 'vi-tien', name: 'Ví & tiền' },
            author: { username: 'nguoidang', reputationScore: 42 },
            coverImage: 'cover.jpg',
          },
        ],
      },
    })

    const posts = await listModeratorPendingPosts({
      query: '  ví da  ',
      category: 'vi-tien',
      type: 'lost',
      district: 'Quận 1',
      from: '2026-11-01',
      to: '2026-11-12',
    })

    const url = new URL(api.get.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toBe('/moderator/posts')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ví da',
      category: 'vi-tien',
      type: 'lost',
      area: 'Quận 1',
      from: '2026-11-01',
      to: '2026-11-12',
    })
    expect(posts).toMatchObject([
      {
        id: 'post-1',
        postCode: 'LL-001',
        category: 'Ví & tiền',
        categorySlug: 'vi-tien',
        dateTime: '12/11/2026 09:30',
        location: 'Chợ Bến Thành, Quận 1',
        author: 'nguoidang',
        reputation: 42,
        images: ['cover.jpg'],
      },
    ])
  })

  it('lấy đủ nội dung chi tiết và gửi quyết định kèm lý do từ chối', async () => {
    api.get.mockResolvedValue({
      data: {
        id: 'post/1',
        title: 'Mất ví',
        description: 'Ví da màu nâu',
        images: ['a.jpg', 'b.jpg'],
        status: 'pending',
      },
    })
    api.post.mockResolvedValue({ data: { status: 'searching' } })

    expect(await getModeratorPendingPost('post/1')).toMatchObject({
      id: 'post/1',
      desc: 'Ví da màu nâu',
      images: ['a.jpg', 'b.jpg'],
    })
    expect(api.get).toHaveBeenCalledWith('/moderator/posts/post%2F1')
    await approveModeratorPendingPost('post/1')
    await rejectModeratorPendingPost('post/1', 'Thiếu ảnh')
    expect(api.post).toHaveBeenNthCalledWith(1, '/moderator/posts/post%2F1/approve', {})
    expect(api.post).toHaveBeenNthCalledWith(2, '/moderator/posts/post%2F1/reject', {
      reason: 'Thiếu ảnh',
    })
  })

  it('bỏ bộ lọc trống, không thêm dấu hỏi khi tải lại toàn bộ hàng chờ', async () => {
    api.get.mockResolvedValue({ data: { items: [] } })

    expect(await listModeratorPendingPosts()).toEqual([])
    expect(
      await listModeratorPendingPosts({
        query: '   ',
        category: '',
        type: '',
        district: '',
        from: '',
        to: '',
      })
    ).toEqual([])
    expect(api.get).toHaveBeenNthCalledWith(1, '/moderator/posts')
    expect(api.get).toHaveBeenNthCalledWith(2, '/moderator/posts')
  })

  it('hiển thị hai đầu đoạn đường, xử lý tác giả/danh mục đã xoá và bài không ảnh', async () => {
    api.get.mockResolvedValue({
      data: {
        id: 'post-2',
        createdAt: 'invalid',
        category: null,
        author: null,
        locType: 'road_segment',
        placeName: 'Chợ Bến Thành',
        placeNameTo: 'Nhà thờ Đức Bà',
        area: 'Quận 1',
        images: [],
        coverImage: 'old-cover.jpg',
      },
    })

    expect(await getModeratorPendingPost('post-2')).toMatchObject({
      category: '',
      categorySlug: '',
      author: '',
      reputation: null,
      dateTime: '',
      desc: '',
      location: 'Chợ Bến Thành → Nhà thờ Đức Bà, Quận 1',
      locType: 'road_segment',
      images: [],
    })
  })

  it('chuyển nguyên lỗi API cho trang xử lý, không biến lỗi thành danh sách rỗng hay quyết định thành công', async () => {
    const error = Object.assign(new Error('Bài đăng đã được xử lý.'), {
      status: 409,
      code: 'POST_NOT_PENDING',
    })
    api.get.mockRejectedValue(error)
    api.post.mockRejectedValue(error)

    await expect(listModeratorPendingPosts()).rejects.toBe(error)
    await expect(getModeratorPendingPost('post-1')).rejects.toBe(error)
    await expect(approveModeratorPendingPost('post-1')).rejects.toBe(error)
    await expect(rejectModeratorPendingPost('post-1', 'Ảnh không rõ')).rejects.toBe(error)
  })
})
