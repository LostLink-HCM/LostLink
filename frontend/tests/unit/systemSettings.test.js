import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}))

import { api } from '../../src/lib/api'
import {
  getAdminSettings,
  getBackofficeSettings,
  getMatchingSettings,
  initializeSystemSettings,
  saveSystemSettings,
} from '../../src/api/systemSettings.js'
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS_BY_TAB,
  normalizeSettings,
  validateSettings,
} from '../../src/lib/admin/settings.js'
import { cloneQuickReplies, validateQuickReplies } from '../../src/lib/backoffice/quickReplies.js'

beforeEach(() => vi.resetAllMocks())

describe('Cấu hình hệ thống - dữ liệu và API frontend', () => {
  it('mặc định hợp lệ, chuẩn hóa chuỗi số và bỏ field lạ', () => {
    const draft = Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => [key, String(value)])
    )
    expect(validateSettings(draft)).toEqual({})
    expect(normalizeSettings({ ...draft, mTime: '.12', extra: true })).toEqual({
      ...DEFAULT_SETTINGS,
      mTime: 0.12,
    })
  })

  it('báo lỗi số trống/sai giới hạn và ngưỡng yếu không nhỏ hơn ngưỡng mạnh', () => {
    for (const [field, value] of [
      ['mTime', ''],
      ['mTime', 1],
      ['reportDays', 0],
      ['paginationPageSize', 1.5],
      ['weakThreshold', 90],
    ]) {
      expect(validateSettings({ ...DEFAULT_SETTINGS, [field]: value })).toHaveProperty(field)
    }
  })

  it('clone mẫu giữ ID và nhóm trống, không làm thay đổi dữ liệu gốc', () => {
    const source = { user: [{ id: 'one', text: 'Nội dung' }], internal: [] }
    const copy = cloneQuickReplies(source)
    expect(copy).toEqual(source)
    copy.user[0].text = 'Đã sửa'
    expect(source.user[0].text).toBe('Nội dung')
  })

  it('mẫu phải có nội dung, tối đa 500 ký tự và không trùng trong cùng nhóm', () => {
    expect(
      validateQuickReplies({
        user: [
          { text: '   ' },
          { text: 'a'.repeat(501) },
          { text: 'Xin Chào' },
          { text: ' xin chào ' },
        ],
        internal: [],
      })
    ).toEqual({
      'user.0': 'Nội dung không được để trống.',
      'user.1': 'Nội dung không được vượt quá 500 ký tự.',
      'user.3': 'Không được trùng nội dung trong cùng một nhóm.',
    })
    expect(validateQuickReplies({ user: [{ text: 'Mẫu' }], internal: [{ text: 'Mẫu' }] })).toEqual(
      {}
    )
    expect(validateQuickReplies({ user: [], internal: [] })).toEqual({})
  })

  it('đọc đúng ba endpoint và trả dữ liệu trong envelope', async () => {
    const data = { values: { mTime: 0.12 } }
    api.get.mockResolvedValue({ data })
    for (const [path, load] of [
      ['/admin/settings', getAdminSettings],
      ['/backoffice/settings', getBackofficeSettings],
      ['/admin/settings/matching', getMatchingSettings],
    ]) {
      await expect(load()).resolves.toBe(data)
      expect(api.get).toHaveBeenLastCalledWith(path)
    }
    expect(api.get).toHaveBeenCalledTimes(3)
  })

  it('khởi tạo bằng payload rỗng', async () => {
    const data = { values: DEFAULT_SETTINGS }
    api.post.mockResolvedValue({ data })
    await expect(initializeSystemSettings({})).resolves.toBe(data)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/admin/settings/initialize', {})
  })

  it('lưu từng nhóm chỉ gửi field của nhóm và chuyển chuỗi thành số', async () => {
    const data = { values: DEFAULT_SETTINGS }
    api.patch.mockResolvedValue({ data })
    const draft = Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => [key, String(value)])
    )
    for (const [tab, path] of [
      ['matching', 'matching'],
      ['timeThresholds', 'time-thresholds'],
      ['pagination', 'pagination'],
    ]) {
      await expect(
        saveSystemSettings(tab, { ...draft, updatedBy: 'forged', extra: true })
      ).resolves.toBe(data)
      expect(api.patch).toHaveBeenLastCalledWith(
        '/admin/settings/' + path,
        Object.fromEntries(SETTINGS_KEYS_BY_TAB[tab].map((key) => [key, DEFAULT_SETTINGS[key]]))
      )
    }
    expect(api.patch).toHaveBeenCalledTimes(3)
  })

  it('lưu mẫu bằng PUT: trim nội dung, giữ ID database và bỏ ID tạm/metadata', async () => {
    api.put.mockResolvedValue({ data: { quickReplies: { user: [], internal: [] } } })
    await saveSystemSettings('quickReplies', {
      user: [
        { id: '507f1f77bcf86cd799439011', text: '  Mẫu cũ  ', updatedBy: 'forged' },
        { id: 'temporary-id', text: ' Mẫu mới ' },
      ],
      internal: [],
    })
    expect(api.put).toHaveBeenCalledExactlyOnceWith('/admin/settings/quick-replies', {
      user: [{ id: '507f1f77bcf86cd799439011', text: 'Mẫu cũ' }, { text: 'Mẫu mới' }],
      internal: [],
    })
  })

  it('nhóm lạ không gửi request', async () => {
    await expect(saveSystemSettings('unknown', {})).rejects.toThrow('Nhóm cấu hình không hợp lệ.')
    expect(api.patch).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('giữ lỗi API để giao diện hiển thị và cho phép thử lại', async () => {
    const failure = new Error('Không thể lưu cấu hình')
    api.patch.mockRejectedValue(failure)
    await expect(saveSystemSettings('pagination', DEFAULT_SETTINGS)).rejects.toBe(failure)
  })
})
