import { PASSWORD_RULES } from '../../../lib/passwordRules'
import { cx } from '../classes'

// Danh sách yêu cầu mật khẩu cho nền sáng, dùng chung quy tắc với trang Đăng ký
export default function PasswordRules({ password }) {
  return (
    <ul
      aria-label="Yêu cầu mật khẩu"
      className="m-0 mt-2 flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0 text-tiny"
    >
      {PASSWORD_RULES.map(({ label, test }) => {
        const ok = test(password)
        return (
          <li
            key={label}
            className={cx(
              'flex items-center gap-1.5 transition-colors',
              ok ? 'text-success' : 'text-ink-subtle'
            )}
          >
            <span
              aria-hidden="true"
              className={cx('size-1.5 rounded-full', ok ? 'bg-success' : 'bg-line-strong')}
            />
            {label}
            <span className="sr-only">{ok ? ' (đạt)' : ' (chưa đạt)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
