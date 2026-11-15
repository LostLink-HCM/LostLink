import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}))

import { api } from '../../src/lib/api'
import {
  applyUserAction,
  filterAdminUsers,
  isCurrentUser,
  userActionUnavailable,
} from '../../src/lib/admin/users.js'
import { applyAdminUserAction, getAdminUser, listAdminUsers } from '../../src/lib/admin/usersApi.js'

const admin = { id: 'admin-1', username: 'root', email: 'root@example.com', role: 'admin' }

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  username: 'nguyenvana',
  name: 'Nguyễn Văn An',
  email: 'an@example.com',
  role: 'user',
  status: 'active',
  reputationScore: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

beforeEach(() => vi.resetAllMocks())

describe('Người dùng & quyền - xử lý dữ liệu frontend', () => {
  it('nhận diện tài khoản hiện tại bằng ID hoặc email không phân biệt dấu và hoa thường', () => {
    expect(isCurrentUser(makeUser({ id: '42' }), { id: 42 })).toBe(true)
    expect(
      isCurrentUser(makeUser({ email: 'NGUYỄN.AN@example.com' }), {
        email: 'nguyen.an@example.com',
      })
    ).toBe(true)
    expect(isCurrentUser(makeUser(), null)).toBe(false)
    expect(isCurrentUser(null, admin)).toBe(false)
  })

  it('tìm theo nhiều từ khóa đã chuẩn hóa rồi kết hợp bộ lọc vai trò và trạng thái', () => {
    const users = [
      makeUser(),
      makeUser({
        id: 'user-2',
        username: 'nguyenvanb',
        name: 'Nguyễn Văn Bình',
        role: 'moderator',
      }),
      makeUser({ id: 'user-3', username: 'tranthic', name: 'Trần Thị Chi', status: 'locked' }),
    ]

    expect(filterAdminUsers(users, { query: '  NGUYEN   binh ', role: 'moderator' })).toEqual([
      users[1],
    ])
    expect(filterAdminUsers(users, { query: 'user-3', status: 'locked' })).toEqual([users[2]])
    expect(filterAdminUsers(users, { query: 'khong ton tai' })).toEqual([])
  })

  it('sắp xếp theo ngày tham gia, điểm uy tín tăng/giảm dần và tên', () => {
    const users = [
      makeUser({
        id: '3',
        username: 'charlie',
        name: 'Charlie',
        reputationScore: 5,
        createdAt: '2026-03-01',
      }),
      makeUser({
        id: '2',
        username: 'bravo',
        name: 'Bravo',
        reputationScore: 25,
        createdAt: '2026-02-01',
      }),
      makeUser({
        id: '1',
        username: 'alpha',
        name: 'Alpha',
        reputationScore: 15,
        createdAt: '2026-01-01',
      }),
    ]

    expect(filterAdminUsers(users).map(({ id }) => id)).toEqual(['3', '2', '1'])
    expect(filterAdminUsers(users, { sort: 'reputation-desc' }).map(({ id }) => id)).toEqual([
      '2',
      '1',
      '3',
    ])
    expect(filterAdminUsers(users, { sort: 'reputation-asc' }).map(({ id }) => id)).toEqual([
      '3',
      '1',
      '2',
    ])
    expect(filterAdminUsers(users, { sort: 'name' }).map(({ id }) => id)).toEqual(['1', '2', '3'])
  })

  it('chặn thao tác với người không phải admin, tài khoản hiện tại, admin và trạng thái không hợp lệ', () => {
    expect(userActionUnavailable(makeUser(), { role: 'moderator' }, 'lock')).toMatch(
      /quản trị viên/
    )
    expect(userActionUnavailable(null, admin, 'lock')).toMatch(/Không tìm thấy/)
    expect(userActionUnavailable(makeUser(), admin, 'unknown')).toMatch(/không hợp lệ/)
    expect(userActionUnavailable(makeUser({ id: 'admin-1' }), admin, 'lock')).toMatch(/chính bạn/)
    expect(userActionUnavailable(makeUser({ role: 'admin' }), admin, 'grant')).toMatch(/Admin/)
    expect(userActionUnavailable(makeUser({ status: 'locked' }), admin, 'lock')).toMatch(
      /đã bị khóa/
    )
    expect(userActionUnavailable(makeUser(), admin, 'unlock')).toMatch(/chưa bị khóa/)
    expect(
      userActionUnavailable(makeUser({ status: 'locked', unlockStatus: null }), admin, 'unlock')
    ).toMatch(/lịch sử/)
    expect(userActionUnavailable(makeUser({ role: 'moderator' }), admin, 'grant')).toMatch(
      /đã có quyền/
    )
    expect(userActionUnavailable(makeUser({ status: 'restricted' }), admin, 'grant')).toMatch(
      /đang hoạt động/
    )
    expect(userActionUnavailable(makeUser(), admin, 'revoke')).toMatch(/không có quyền/)
  })

  it('khóa rồi mở khóa khôi phục trạng thái hạn chế và ghi lịch sử thao tác', () => {
    const initial = {
      users: [makeUser({ status: 'restricted', statusReason: 'Chờ xác minh' })],
      logs: [],
    }
    const locked = applyUserAction(initial, {
      id: 'user-1',
      action: 'lock',
      reason: '  Vi phạm quy định  ',
      actor: admin,
      now: 1000,
    })
    expect(locked.error).toBe('')
    expect(locked.state.users[0]).toMatchObject({
      status: 'locked',
      statusReason: 'Vi phạm quy định',
      beforeLock: { status: 'restricted', reason: 'Chờ xác minh' },
    })
    expect(locked.state.logs[0]).toMatchObject({
      action: 'lock',
      reason: 'Vi phạm quy định',
      before: { role: 'user', status: 'restricted' },
      after: { role: 'user', status: 'locked' },
    })

    const unlocked = applyUserAction(locked.state, {
      id: 'user-1',
      action: 'unlock',
      actor: admin,
      now: 2000,
    })
    expect(unlocked.state.users[0]).toMatchObject({
      status: 'restricted',
      statusReason: 'Chờ xác minh',
      beforeLock: null,
    })
    expect(unlocked.state.logs[0].action).toBe('unlock')
    expect(unlocked.state.logs).toHaveLength(2)
  })

  it('cấp rồi thu hồi quyền Moderator và lưu thông tin trước/sau vào lịch sử', () => {
    const state = { users: [makeUser()], logs: [] }
    const granted = applyUserAction(state, {
      id: 'user-1',
      action: 'grant',
      reason: 'Được phân công',
      actor: admin,
      now: 3000,
    })
    expect(granted.state.users[0].role).toBe('moderator')
    expect(granted.state.logs[0]).toMatchObject({
      action: 'grant',
      before: { role: 'user', status: 'active' },
      after: { role: 'moderator', status: 'active' },
    })

    const revoked = applyUserAction(granted.state, {
      id: 'user-1',
      action: 'revoke',
      reason: 'Kết thúc nhiệm vụ',
      actor: admin,
      now: 4000,
    })
    expect(revoked.state.users[0].role).toBe('user')
    expect(revoked.state.logs[0].action).toBe('revoke')
    expect(revoked.state.logs).toHaveLength(2)
  })

  it('từ chối lý do khóa quá ngắn hoặc mọi lý do dài hơn 500 ký tự mà không đổi state', () => {
    const state = { users: [makeUser()], logs: [] }
    const shortReason = applyUserAction(state, {
      id: 'user-1',
      action: 'lock',
      reason: '  ab ',
      actor: admin,
    })
    expect(shortReason.error).toMatch(/ít nhất 5 ký tự/)
    expect(shortReason.state).toBe(state)

    const longReason = applyUserAction(state, {
      id: 'user-1',
      action: 'grant',
      reason: 'x'.repeat(501),
      actor: admin,
    })
    expect(longReason.error).toMatch(/không được vượt quá 500/)
    expect(longReason.state).toBe(state)
  })

  it('gửi bộ lọc danh sách lên API và chuẩn hóa avatar của từng tài khoản', async () => {
    api.get.mockResolvedValue({
      data: {
        items: [{ id: 'user-1', username: 'an', role: 'user', status: 'active' }],
        total: 1,
      },
    })

    const result = await listAdminUsers({
      query: '  an@example.com  ',
      role: 'user',
      status: 'active',
      sort: 'name',
    })
    const url = new URL(api.get.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toBe('/admin/users')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'an@example.com',
      role: 'user',
      status: 'active',
      sort: 'name',
    })
    expect(result).toMatchObject({
      total: 1,
      items: [{ name: 'an', initials: 'AN', color: expect.any(String) }],
    })
  })

  it('bỏ bộ lọc trống, vẫn gửi sort mặc định và đọc hồ sơ bằng ID đã mã hóa', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [] } }).mockResolvedValueOnce({
      data: { id: 'user/1', username: 'an', role: 'user', status: 'active' },
    })

    await listAdminUsers({ query: '  ', role: '', status: '', sort: 'newest' })
    expect(api.get).toHaveBeenNthCalledWith(1, '/admin/users?sort=newest')
    await expect(getAdminUser('user/1')).resolves.toMatchObject({
      id: 'user/1',
      name: 'an',
      initials: 'AN',
    })
    expect(api.get).toHaveBeenNthCalledWith(2, '/admin/users/user%2F1')
  })

  it('gửi đúng endpoint cho các thao tác, trim lý do và từ chối loại thao tác không hỗ trợ', async () => {
    api.patch.mockResolvedValue({
      data: { id: 'user/1', username: 'an', role: 'moderator', status: 'active' },
    })

    await expect(
      applyAdminUserAction('user/1', 'grant', '  Được phân công  ')
    ).resolves.toMatchObject({
      role: 'moderator',
      initials: 'AN',
    })
    expect(api.patch).toHaveBeenCalledWith('/admin/users/user%2F1/grant-moderator', {
      reason: 'Được phân công',
    })
    await expect(applyAdminUserAction('user-1', 'unlock')).resolves.toMatchObject({
      status: 'active',
    })
    expect(api.patch).toHaveBeenLastCalledWith('/admin/users/user-1/unlock', { reason: '' })
    await expect(applyAdminUserAction('user-1', 'delete')).rejects.toThrow(/không hợp lệ/)
    expect(api.patch).toHaveBeenCalledTimes(2)
  })
})
