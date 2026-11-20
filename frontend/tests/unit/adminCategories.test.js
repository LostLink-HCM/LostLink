import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { api } from '../../src/lib/api'
import {
  EMPTY_ATTRIBUTE,
  aliasKeyOf,
  cleanList,
  duplicateAliasErrors,
  duplicateTermErrors,
  validateAlgorithm,
  validateAttribute,
  validateGeneral,
  validateRelations,
} from '../../src/lib/admin/categories.js'
import {
  archiveAdminCategory,
  createAdminCategory,
  deleteAdminCategoryAttribute,
  deleteAdminCategoryQuestion,
  listAdminCategories,
  saveAdminCategoryAttribute,
  saveAdminCategoryQuestion,
  updateAdminCategoryAlgorithm,
  updateAdminCategoryContents,
  updateAdminCategoryGeneral,
  updateAdminCategoryRelations,
} from '../../src/lib/admin/categoriesApi.js'

beforeEach(() => vi.resetAllMocks())

describe('Quản lý danh mục - xử lý dữ liệu frontend', () => {
  it('so sánh alias không phân biệt chữ hoa thường nhưng vẫn phân biệt dấu tiếng Việt', () => {
    expect(aliasKeyOf('  GIẤY   TỜ ')).toBe('giấy tờ')
    expect(duplicateAliasErrors([['Giấy tờ', ' GIẤY TỜ ']])).toEqual([
      [
        'Alias đã tồn tại, vui lòng nhập alias khác.',
        'Alias đã tồn tại, vui lòng nhập alias khác.',
      ],
    ])
    expect(duplicateAliasErrors([['mới', 'moi']])).toEqual([['', '']])
  })

  it('không báo trùng các alias đã lưu, chỉ đánh dấu giá trị mới bị trùng', () => {
    expect(duplicateAliasErrors([['ví', 'Ví', 'bóp']], [], [['ví']])).toEqual([
      ['', 'Alias đã tồn tại, vui lòng nhập alias khác.', ''],
    ])
    expect(duplicateAliasErrors([['ví', 'giấy tờ']], ['VÍ'], [['ví', 'giấy tờ']])).toEqual([
      ['', ''],
    ])
  })

  it('đánh dấu mục bên trong và giá trị thuộc tính trùng nhưng giữ các mục đã lưu', () => {
    const message = 'Giá trị đã tồn tại, vui lòng nhập giá trị khác.'
    expect(duplicateTermErrors(['Balo', ' balo ', 'Ví'], ['Balo', 'Ví', ''], message)).toEqual([
      '',
      message,
      '',
    ])
    expect(duplicateTermErrors(['Da', ' da '], [], message)).toEqual([message, message])
  })

  it('chuẩn hóa danh sách khi lưu, bỏ trống và trùng nhưng không gộp chữ có dấu với không dấu', () => {
    expect(cleanList(['  Mới ', '', 'mới', 'moi', 'Giấy tờ'])).toEqual(['Mới', 'moi', 'Giấy tờ'])
  })

  it('kiểm tra tên/thứ tự danh mục và biên cấu hình thuật toán', () => {
    const categories = [{ id: 'a', name: 'Ví & tiền' }]
    expect(validateGeneral({ name: ' ví & TIỀN ', order: 2 }, categories, 'b').name).toBe(
      'Đã có danh mục cùng tên.'
    )
    expect(validateGeneral({ name: 'Túi', order: '' }, categories)).toMatchObject({
      order: 'Thứ tự là số nguyên từ 1 đến 999.',
    })
    expect(validateGeneral({ name: ' ví & tiền ', order: 1 }, categories, 'a')).toEqual({})
    expect(
      validateAlgorithm({ matchRadius: 100, timeShape: 0.3, timeMedianDays: 0.1, diffusion: 0 })
    ).toEqual({})
    expect(
      validateAlgorithm({ matchRadius: 99, timeShape: 5.1, timeMedianDays: '', diffusion: -1 })
    ).toMatchObject({
      matchRadius: expect.any(String),
      timeShape: expect.any(String),
      timeMedianDays: expect.any(String),
      diffusion: expect.any(String),
    })
  })

  it('kiểm tra nhóm quan hệ và thuộc tính trước khi gửi API', () => {
    expect(validateRelations([{ ratioPercent: 60, memberCategoryIds: ['a'] }])).toBe('')
    expect(
      validateRelations([
        { ratioPercent: 60, memberCategoryIds: ['a'] },
        { ratioPercent: 40, memberCategoryIds: ['a'] },
      ])
    ).toBe('Một danh mục không được nằm ở hai nhóm quan hệ.')
    expect(validateRelations([{ ratioPercent: 0, memberCategoryIds: [] }])).toBe(
      'Tỷ lệ r từ 1% đến 100%.'
    )
    expect(validateAttribute(EMPTY_ATTRIBUTE, [], null)).toBe('Nhập tên thuộc tính.')
    const valid = {
      ...EMPTY_ATTRIBUTE,
      name: 'Màu sắc',
      mProb: 0.9,
      values: [{ value: 'Đỏ' }],
    }
    expect(validateAttribute(valid, [], null)).toBe('')
    expect(
      validateAttribute({ ...valid, values: [{ value: 'Đỏ' }, { value: ' đỏ ' }] }, [], null)
    ).toBe('Các giá trị trong một thuộc tính không được trùng.')
  })

  it('gọi đúng các endpoint quản lý danh mục, mã hóa ID và chuẩn hóa payload thuộc tính', async () => {
    api.get.mockResolvedValue({ data: { items: [] } })
    api.post.mockResolvedValue({ data: { id: 'cat-1' } })
    api.patch.mockResolvedValue({ data: { id: 'cat-1' } })
    api.put.mockResolvedValue({ data: { id: 'cat-1' } })
    api.delete.mockResolvedValue({ data: { id: 'cat-1' } })

    await listAdminCategories()
    await createAdminCategory({ name: 'Túi' })
    await updateAdminCategoryGeneral('cat/1', { name: 'Túi', aliases: [] })
    await updateAdminCategoryAlgorithm('cat/1', { matchRadius: 400 })
    await updateAdminCategoryContents('cat/1', [{ label: 'Ví' }])
    await saveAdminCategoryAttribute('cat/1', {
      ...EMPTY_ATTRIBUTE,
      name: 'Loại',
      values: [{ id: '507f1f77bcf86cd799439011', value: 'Balo', aliases: [] }],
    })
    await saveAdminCategoryQuestion('cat/1', 'temp-id', 'Câu hỏi?')
    await updateAdminCategoryRelations('cat/1', [
      { id: 'temp-id', ratio: 0.6, memberCategoryIds: [] },
    ])
    await deleteAdminCategoryAttribute('cat/1', 'attribute/1')
    await deleteAdminCategoryQuestion('cat/1', '507f1f77bcf86cd799439012')
    await archiveAdminCategory('cat/1')

    expect(api.get).toHaveBeenCalledWith('/admin/categories')
    expect(api.post).toHaveBeenNthCalledWith(1, '/admin/categories', { name: 'Túi' })
    expect(api.patch).toHaveBeenNthCalledWith(1, '/admin/categories/cat%2F1/general', {
      name: 'Túi',
      aliases: [],
    })
    expect(api.patch).toHaveBeenNthCalledWith(2, '/admin/categories/cat%2F1/algorithm', {
      matchRadius: 400,
    })
    expect(api.put).toHaveBeenNthCalledWith(1, '/admin/categories/cat%2F1/contents', {
      contentItems: ['Ví'],
    })
    expect(api.post).toHaveBeenNthCalledWith(2, '/admin/categories/cat%2F1/attributes', {
      name: 'Loại',
      aliases: [],
      matchRole: 'score',
      mProb: 0.9,
      isRequired: false,
      values: [{ id: '507f1f77bcf86cd799439011', value: 'Balo', aliases: [] }],
    })
    expect(api.post).toHaveBeenNthCalledWith(
      3,
      '/admin/categories/cat%2F1/verification-questions',
      {
        text: 'Câu hỏi?',
      }
    )
    expect(api.put).toHaveBeenNthCalledWith(2, '/admin/categories/cat%2F1/relations', {
      relations: [{ ratio: 0.6, memberCategoryIds: [] }],
    })
    expect(api.delete).toHaveBeenNthCalledWith(
      1,
      '/admin/categories/cat%2F1/attributes/attribute%2F1'
    )
    expect(api.delete).toHaveBeenNthCalledWith(
      2,
      '/admin/categories/cat%2F1/verification-questions/507f1f77bcf86cd799439012'
    )
    expect(api.delete).toHaveBeenNthCalledWith(3, '/admin/categories/cat%2F1')
  })
})
