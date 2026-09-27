import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/login', label: 'Đăng nhập' },
  { to: '/register', label: 'Đăng ký' },
]
export default function AuthTabs() {
  return (
    <nav aria-label="Tài khoản" className="mb-4 flex gap-6 border-b border-white/12">
      {tabs.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          replace
          className={({ isActive }) =>
            `-mb-px border-b-2 pb-2.5 text-[15px] font-semibold no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-au-accent ${
              isActive
                ? 'border-au-accent text-au-ink'
                : 'border-transparent text-au-ink/50 hover:text-au-ink/80'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
