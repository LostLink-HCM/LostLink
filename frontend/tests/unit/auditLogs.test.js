import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({ api: { get: vi.fn() } }))

import { api } from '../../src/lib/api'
import { listAuditLogs } from '../../src/api/auditLogs.js'
import {
  auditActorName,
  auditChanges,
  auditDestination,
  auditDetail,
  auditEntityLabel,
  auditObjectCode,
  auditReason,
  formatAuditDate,
} from '../../src/lib/admin/audit.js'

beforeEach(() => vi.resetAllMocks())

describe('Nhật ký thao tác - dữ liệu và API frontend', () => {
  it('gửi đúng endpoint, trang và các bộ lọc; bỏ giá trị trống và trả metadata backend', async () => {
    const data = { items: [], total: 0, page: 1, pageSize: 7, totalPages: 1 }
    api.get.mockResolvedValue({ data })
    await expect(listAuditLogs()).resolves.toBe(data)
    expect(api.get).toHaveBeenLastCalledWith('/admin/audit-logs?page=1')
    await listAuditLogs({
      query: '  Ẩn & hiện  ',
      actorRole: 'moderator',
      action: 'hide',
      entityType: 'Post',
      from: '2026-11-10',
      to: '2026-11-11',
      page: 2,
    })
    const url = new URL(api.get.mock.calls.at(-1)[0], 'http://test')
    expect(url.pathname).toBe('/admin/audit-logs')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'Ẩn & hiện',
      actorRole: 'moderator',
      action: 'hide',
      entityType: 'Post',
      from: '2026-11-10',
      to: '2026-11-11',
      page: '2',
    })
    await listAuditLogs({ query: '   ', actorRole: '', from: '' })
    expect(api.get).toHaveBeenLastCalledWith('/admin/audit-logs?page=1')
  })

  it('giữ lỗi API để giao diện hiển thị và cho phép thử lại', async () => {
    const failure = new Error('Tạm thời không tải được nhật ký')
    api.get.mockRejectedValue(failure)
    await expect(listAuditLogs()).rejects.toBe(failure)
  })

  it('hiển thị username/hệ thống/tài khoản đã xóa và không dùng Mongo ID làm mã đối tượng', () => {
    expect(auditActorName({ actor: { username: 'admin' }, actorRole: 'admin' })).toBe('admin')
    expect(auditActorName({ actor: null, actorRole: 'system' })).toBe('Hệ thống')
    expect(auditActorName({ actor: null, actorRole: 'moderator' })).toBe('Tài khoản đã xóa')
    expect(auditEntityLabel({ entityType: 'Post' })).toBe('Bài đăng')
    expect(auditObjectCode({ detail: { displayCode: 'F101126001' } })).toBe('F101126001')
    expect(auditObjectCode({ entityId: '507f1f77bcf86cd799439011' })).toBe('')
  })

  it('hiển thị thời gian theo múi giờ Việt Nam và xử lý ngày thiếu hoặc không hợp lệ', () => {
    expect(formatAuditDate('2026-11-10T17:30:00Z')).toBe('00:30 11/11/2026')
    expect(formatAuditDate(null)).toBe('—')
    expect(formatAuditDate('invalid-date')).toBe('—')
  })

  it('liên kết tới đúng đối tượng/tab, báo cáo tới đối tượng liên quan và nhận diện đối tượng đã xóa', () => {
    const id = '507f1f77bcf86cd799439011'
    for (const [log, to, label] of [
      [{ entityType: 'User', entityId: id }, `/admin/users?user=${id}`, 'Xem tài khoản'],
      [{ entityType: 'Post', entityId: id }, `/admin/posts?post=${id}`, 'Xem bài đăng'],
      [
        {
          entityType: 'Category',
          entityId: id,
          detail: { displayCode: 'vi-tien', section: 'contents' },
        },
        '/admin/categories?category=vi-tien&tab=attributes',
        'Xem danh mục',
      ],
      [
        { entityType: 'SystemConfig', detail: { section: 'matching' } },
        '/admin/settings?tab=matching&highlight=1',
        'Xem cấu hình',
      ],
      [
        { entityType: 'SystemConfig', detail: { section: 'timeThresholds' } },
        '/admin/settings?tab=timeThresholds&highlight=1',
        'Xem cấu hình',
      ],
      [
        { entityType: 'SystemConfig', detail: { displayCode: 'paginationPageSize' } },
        '/admin/settings?tab=pagination&highlight=1&fields=paginationPageSize',
        'Xem cấu hình',
      ],
      [
        { entityType: 'SystemConfig', detail: { displayCode: 'reportDays' } },
        '/admin/settings?tab=timeThresholds&highlight=1&fields=reportDays',
        'Xem cấu hình',
      ],
      [
        { entityType: 'QuickReply' },
        '/admin/settings?tab=quickReplies&highlight=1',
        'Xem mẫu trả lời nhanh',
      ],
    ])
      expect(auditDestination(log)).toEqual({ to, label })
    expect(
      auditDestination({
        entityType: 'SystemConfig',
        detail: {
          section: 'matching',
          before: { mTime: 0.8, mCategory: 0.95 },
          after: { mTime: 0.9, mCategory: 0.95 },
        },
      })?.to
    ).toBe('/admin/settings?tab=matching&highlight=1&fields=mTime')
    expect(
      auditDestination({
        entityType: 'QuickReply',
        detail: {
          before: {
            user: [
              { id: 'reply-one', text: 'Nội dung cũ' },
              { id: 'reply-two', text: 'Giữ nguyên' },
            ],
            internal: [],
          },
          after: { user: [{ text: 'Nội dung mới' }, { text: 'Giữ nguyên' }], internal: [] },
        },
      })?.state
    ).toEqual({ auditReplyTargets: [{ group: 'user', id: 'reply-one', text: 'Nội dung mới' }] })
    expect(auditDestination({ entityType: 'Report', detail: { targetPost: 'post-id' } })?.to).toBe(
      '/admin/posts?post=post-id'
    )
    expect(auditDestination({ entityType: 'Report', detail: { targetUser: 'user-id' } })?.to).toBe(
      '/admin/users?user=user-id'
    )
    expect(auditDestination({ entityType: 'User', entityId: null })?.to).toBe(
      '/admin/users?missing=1'
    )
    expect(
      auditDestination({ entityType: 'Category', entityId: id, entityExists: false })?.to
    ).toBe('/admin/categories?missing=1')
    expect(
      auditDestination({
        entityType: 'Category',
        entityId: null,
        detail: { displayCode: 'phu-kien-du-lich' },
      })?.to
    ).toBe('/admin/categories?missing=1')
    expect(auditDestination({ entityType: 'Report' })).toBeNull()
    expect(auditDestination({ entityType: 'Unknown' })).toBeNull()
  })

  it('bỏ qua ID mẫu trả lời, vẫn nhận diện thay đổi nội dung và giữ độ chính xác số thập phân', () => {
    const changes = auditChanges({
      detail: {
        before: {
          user: [{ id: 'one', text: 'Mẫu cũ' }],
          internal: [{ _id: 'two', text: 'Nội bộ' }],
          mTime: 0.123456,
        },
        after: { user: [{ text: 'Mẫu mới' }], internal: [{ text: 'Nội bộ' }], mTime: 0.123457 },
      },
    })
    expect(changes).toEqual([
      { key: 'user', label: 'Mẫu cho người dùng', before: 'Mẫu cũ', after: 'Mẫu mới' },
      { key: 'mTime', label: 'Độ tin cậy thời gian', before: '0,123456', after: '0,123457' },
    ])
  })

  it('dùng username snapshot khi không còn tham chiếu và để trống nội dung/lý do không được cung cấp', () => {
    const log = {
      actor: null,
      actorRole: 'moderator',
      detail: { actorUsername: 'former.mod', summary: 'Hiện lại bài đăng' },
    }
    expect(auditActorName(log)).toBe('former.mod')
    expect(auditDetail(log)).toBe('Hiện lại bài đăng')
    expect(auditReason(log)).toBe('')
    expect(auditDetail({ detail: null })).toBe('')
    expect(auditReason({})).toBe('')
  })

  it('field được thêm hoặc xóa hiển thị Chưa có ở phía tương ứng', () => {
    expect(
      auditChanges({
        detail: { before: { name: 'Phụ kiện' }, after: { hiddenReason: 'Thông tin cần xác minh' } },
      })
    ).toEqual([
      { key: 'name', label: 'Tên', before: 'Phụ kiện', after: 'Chưa có' },
      {
        key: 'hiddenReason',
        label: 'Lý do ẩn',
        before: 'Chưa có',
        after: 'Thông tin cần xác minh',
      },
    ])
  })

  it('hiển thị thuộc tính danh mục lồng nhau bằng nhãn dễ đọc, bỏ ID và giữ nguyên dữ liệu nguồn', () => {
    const log = {
      detail: {
        before: { attributes: [{ id: 'private-before', name: 'Màu sắc', values: ['Đen'] }] },
        after: {
          attributes: [{ _id: 'private-after', values: ['Đen', 'Trắng'], name: 'Màu sắc' }],
        },
      },
    }
    const original = structuredClone(log)
    expect(auditChanges(log)).toEqual([
      {
        key: 'attributes',
        label: 'Thuộc tính',
        before: 'Tên: Màu sắc\nGiá trị thuộc tính: Đen',
        after: 'Tên: Màu sắc\nGiá trị thuộc tính: Đen\nTrắng',
      },
    ])
    expect(log).toEqual(original)
  })

  it('đổi thứ tự mẫu trả lời là thay đổi nhưng đổi thứ tự các field trong object thì không', () => {
    const log = {
      detail: {
        before: {
          user: [
            { id: 'one', text: 'Mẫu đầu' },
            { id: 'two', text: 'Mẫu cuối' },
          ],
          attributes: [{ name: 'Màu sắc', values: ['Đen'] }],
        },
        after: {
          user: [{ text: 'Mẫu cuối' }, { text: 'Mẫu đầu' }],
          attributes: [{ values: ['Đen'], name: 'Màu sắc' }],
        },
      },
    }
    expect(auditChanges(log)).toEqual([
      {
        key: 'user',
        label: 'Mẫu cho người dùng',
        before: 'Mẫu đầu\nMẫu cuối',
        after: 'Mẫu cuối\nMẫu đầu',
      },
    ])
  })
})
