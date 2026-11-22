import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }))

import { api } from '../../src/lib/api'
import {
  getModeratorReport,
  listModeratorReports,
  REPORT_REASON_LABELS,
  resolveModeratorReport,
} from '../../src/lib/moderator/reportQueue.js'

beforeEach(() => vi.resetAllMocks())

const postReport = (overrides = {}) => ({
  id: 'report-1',
  targetType: 'post',
  target: {
    id: 'post-1',
    code: 'F181126001',
    title: 'Nhặt được ví',
    owner: { id: 'user-1', username: 'nguyenvana' },
  },
  reporter: { id: 'reporter-1', username: 'baocao' },
  reason: 'spam',
  description: 'Nội dung quảng cáo.',
  severity: 'medium',
  createdAt: '2026-11-18T01:30:00.000Z',
  ...overrides,
})

describe('Hàng đợi report - adapter API frontend', () => {
  it('gửi đúng endpoint mặc định và chuẩn hóa danh sách report', async () => {
    api.get.mockResolvedValue({
      data: { items: [postReport()], total: 1, page: 1, pageSize: 10, totalPages: 1 },
    })

    const result = await listModeratorReports()

    expect(api.get).toHaveBeenCalledWith('/moderator/reports?page=1')
    expect(result).toMatchObject({
      total: 1,
      items: [
        expect.objectContaining({
          id: 'report-1',
          displayCode: 'F181126001',
          targetTitle: 'Nhặt được ví',
          reportedUser: 'nguyenvana',
          reporter: 'baocao',
        }),
      ],
    })
  })

  it('gửi tìm kiếm, bộ lọc và trang; loại bỏ giá trị trống', async () => {
    api.get.mockResolvedValue({
      data: { items: [], total: 0, page: 2, pageSize: 10, totalPages: 1 },
    })

    await listModeratorReports({
      query: '  ví mất  ',
      targetType: 'post',
      severity: 'high',
      from: '2026-11-10',
      to: '2026-11-18',
      page: 2,
    })

    const url = new URL(api.get.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toBe('/moderator/reports')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ví mất',
      targetType: 'post',
      severity: 'high',
      from: '2026-11-10',
      to: '2026-11-18',
      page: '2',
    })
  })

  it('gửi loại đối tượng và ID khi mở nhóm report từ thông báo', async () => {
    api.get.mockResolvedValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
    })

    await listModeratorReports({ targetType: 'post', targetId: '65f000000000000000000003' })

    const url = new URL(api.get.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toBe('/moderator/reports')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      targetType: 'post',
      targetId: '65f000000000000000000003',
      page: '1',
    })
  })

  it('đọc chi tiết report bằng ID đã mã hóa URL', async () => {
    api.get.mockResolvedValue({ data: postReport() })

    await getModeratorReport('report/one')

    expect(api.get).toHaveBeenCalledWith('/moderator/reports/report%2Fone')
  })

  it('chuẩn hóa report tài khoản và dùng username làm mã đối tượng', async () => {
    api.get.mockResolvedValue({
      data: {
        id: 'report-user',
        targetType: 'user',
        target: { id: 'user-2', username: 'tranthib' },
        reporter: null,
        reason: 'harassment',
        createdAt: '2026-11-18T01:30:00.000Z',
      },
    })

    const result = await getModeratorReport('report-user')

    expect(result).toMatchObject({
      displayCode: 'tranthib',
      targetTitle: 'tranthib',
      reportedUser: 'tranthib',
      reporter: 'Tài khoản đã xóa',
    })
  })

  it('hiển thị fallback khi đối tượng hoặc người gửi report đã bị xóa', async () => {
    api.get.mockResolvedValue({
      data: {
        id: 'missing',
        targetType: 'post',
        target: null,
        reporter: null,
        reason: 'other',
        createdAt: 'invalid',
      },
    })

    const result = await getModeratorReport('missing')

    expect(result).toMatchObject({
      displayCode: 'missing',
      targetTitle: 'Bài đăng không còn tồn tại',
      reportedUser: '',
      reporter: 'Tài khoản đã xóa',
      time: '',
    })
  })

  it('chuẩn hóa thời gian theo múi giờ Việt Nam', async () => {
    api.get.mockResolvedValue({ data: postReport({ createdAt: '2026-11-17T17:30:00.000Z' }) })

    const result = await getModeratorReport('report-1')

    expect(result.time).toBe('00:30 18/11/2026')
  })

  it('ánh xạ nhãn lý do và giữ nguyên lý do chưa khai báo', async () => {
    api.get.mockResolvedValue({ data: postReport({ reason: 'spam' }) })
    const known = await getModeratorReport('report-1')
    expect(known.reasonLabel).toBe(REPORT_REASON_LABELS.spam)

    api.get.mockResolvedValue({
      data: postReport({ reason: 'other', description: 'Nội dung không thuộc các nhóm có sẵn' }),
    })
    const other = await getModeratorReport('report-1')
    expect(other.reasonLabel).toBe('Nội dung không thuộc các nhóm có sẵn')

    api.get.mockResolvedValue({ data: postReport({ reason: 'custom_reason' }) })
    const unknown = await getModeratorReport('report-1')
    expect(unknown.reasonLabel).toBe('custom_reason')
  })

  it('chuẩn hóa lịch sử liên quan và đếm cảnh cáo cũ', async () => {
    api.get.mockResolvedValue({
      data: postReport({
        warningCount: 2,
        relatedHistory: [
          {
            id: 'history-1',
            reason: 'other',
            description: 'Lý do lịch sử do người dùng nhập',
            reporter: { username: 'other' },
            handledAt: '2026-11-17T17:00:00.000Z',
          },
        ],
      }),
    })

    const result = await getModeratorReport('report-1')

    expect(result.warningCount).toBe(2)
    expect(result.history[0]).toMatchObject({
      id: 'history-1',
      reporter: 'other',
      reasonLabel: 'Lý do lịch sử do người dùng nhập',
      time: '00:00 18/11/2026',
    })
  })

  it('gửi thao tác xử lý, trim lý do và mã hóa ID', async () => {
    api.patch.mockResolvedValue({ data: { id: 'report-1', action: 'warn', status: 'resolved' } })

    await expect(resolveModeratorReport('report/one', 'warn', '  Cần xác minh  ')).resolves.toEqual(
      {
        id: 'report-1',
        action: 'warn',
        status: 'resolved',
      }
    )
    expect(api.patch).toHaveBeenCalledWith('/moderator/reports/report%2Fone/resolve', {
      action: 'warn',
      reason: 'Cần xác minh',
    })
  })

  it('gửi lý do rỗng khi bỏ qua report và giữ nguyên lỗi API', async () => {
    api.patch.mockResolvedValue({
      data: { id: 'report-1', action: 'dismiss', status: 'dismissed' },
    })
    await resolveModeratorReport('report-1', 'dismiss')
    expect(api.patch).toHaveBeenCalledWith('/moderator/reports/report-1/resolve', {
      action: 'dismiss',
      reason: '',
    })

    const failure = new Error('Không thể xử lý report')
    api.patch.mockRejectedValue(failure)
    await expect(resolveModeratorReport('report-1', 'hide', 'Lý do')).rejects.toBe(failure)
  })
})
