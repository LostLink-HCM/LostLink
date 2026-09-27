import { PASSWORD_RULES } from '../../lib/passwordRules'

export default function PasswordChecklist({ password }) {
  return (
    <ul
      aria-label="Yêu cầu mật khẩu"
      className="m-0 flex list-none flex-wrap gap-x-3.5 gap-y-0.5 p-0 text-[11px] leading-[1.4]"
    >
      {PASSWORD_RULES.map(({ label, test }) => {
        const ok = test(password)
        return (
          <li
            key={label}
            className={`flex items-center gap-1.5 whitespace-nowrap transition-colors ${ok ? 'text-au-success' : 'text-au-ink/50'}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="flex-none">
              {ok ? (
                <path d="M2.5 6.2 5 8.6 9.5 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <circle cx="6" cy="6" r="2" fill="currentColor" />
              )}
            </svg>
            <span>{label}</span>
            <span className="sr-only">{ok ? ' (đạt)' : ' (chưa đạt)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
