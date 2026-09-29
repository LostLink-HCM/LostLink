import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Logo from '../../components/ui/Logo'
import ModIcon from '../../components/ui/Icon'
import { createWorkspacePosts, workspacePostMatches } from '../../data/workspacePosts'
import { moderatorReports } from '../../data/moderatorReports'
import { createEscalationLogs, createEscalationState } from '../../data/escalations'
import Posts from './Posts'
import Review from './Review'
import Reports from './Reports'
import Escalations from './Escalations'
import { moderatorShellUi } from '../../components/moderator/moderatorShellStyles'

const navigation = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '', label: 'Tất cả bài đăng', icon: 'list' },
  { path: '/review', label: 'Kiểm duyệt bài', icon: 'check' },
  { path: '/reports', label: 'Hàng đợi report', icon: 'flag' },
  { path: '/escalations', label: 'Escalation', icon: 'shield' },
  { path: '/messages', label: 'Tin nhắn', icon: 'chat' },
  { path: '/notifications', label: 'Thông báo', icon: 'bell' },
]

export default function ModeratorPostsPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [posts, setPosts] = useState(createWorkspacePosts)
  const [reports, setReports] = useState(moderatorReports)
  const [escalationState, setEscalationState] = useState(() => {
    const state = createEscalationState()
    return { ...state, logs: createEscalationLogs(state.tickets) }
  })
  const active = navigation.find((item) => pathname === `/moderator${item.path}`) || navigation[1]

  return (
    <div className={moderatorShellUi.app}>
      {sidebarOpen && <button className={moderatorShellUi.overlay} aria-label="Đóng menu điều hướng" onClick={() => setSidebarOpen(false)} />}
      <aside id="moderator-sidebar" className={`${moderatorShellUi.sidebar} ${sidebarOpen ? moderatorShellUi.sidebarOpen : ''} ${sidebarCollapsed ? moderatorShellUi.sidebarCollapsed : moderatorShellUi.sidebarExpanded}`}>
        <div className={`${moderatorShellUi.sidebarHeader} ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <NavLink to="/moderator" className={`${moderatorShellUi.brand} ${sidebarCollapsed ? 'is-collapsed' : ''}`} aria-label="LostLink - Bài đăng" onClick={() => setSidebarOpen(false)}>
            <span className={moderatorShellUi.brandMark}><Logo size={32} animated /></span>
            <div className={`${moderatorShellUi.brandText} ${sidebarCollapsed ? 'is-collapsed' : ''}`}>LostLink</div>
          </NavLink>
          <button className={moderatorShellUi.collapseButton} aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'} title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'} aria-expanded={!sidebarCollapsed} aria-controls="moderator-sidebar" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>
            <ModIcon name={sidebarCollapsed ? 'next' : 'back'} />
          </button>
        </div>
        <nav className={moderatorShellUi.nav} aria-label="Điều hướng moderator">
          {navigation.map((item) => (
            <NavLink key={item.path} to={`/moderator${item.path}`} end aria-label={item.label} title={item.label} className={({ isActive }) => `${moderatorShellUi.navItem} ${sidebarCollapsed ? 'is-collapsed' : ''} ${isActive ? moderatorShellUi.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
              <ModIcon name={item.icon} />
              <span className={`${moderatorShellUi.navText} ${sidebarCollapsed ? 'is-collapsed' : ''}`}>{item.label}</span>
              {item.path === '/review' && posts.some((post) => post.status === 'pending') && <span className={`${moderatorShellUi.navBadge} ${sidebarCollapsed ? 'is-collapsed' : ''}`}>{posts.filter((post) => post.status === 'pending').length}</span>}
            </NavLink>
          ))}
        </nav>
        <div className={`${moderatorShellUi.user} ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className={moderatorShellUi.avatar}>{user.username.slice(0, 2).toUpperCase()}</div>
          <div className={`${moderatorShellUi.userInfo} ${sidebarCollapsed ? 'is-collapsed' : ''}`}><strong className={moderatorShellUi.userName}>{user.username}</strong></div>
          <button className={moderatorShellUi.logout} aria-label="Đăng xuất" title="Đăng xuất" onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}><ModIcon name="logout" size={20} /></button>
        </div>
      </aside>
      <div className={moderatorShellUi.main}>
        <header className={moderatorShellUi.header}>
          <div className={moderatorShellUi.headerTitle}><span className={moderatorShellUi.headerIcon}><ModIcon name={active.icon} size={20} /></span><h1 className={moderatorShellUi.headerHeading}>{active.label}</h1></div>
          <div className={moderatorShellUi.headerDate}><ModIcon name="calendar" size={16} /><time dateTime={new Date().toLocaleDateString('en-CA')}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time></div>
        </header>
        <main className={moderatorShellUi.content}>
          {active.path === '' ? <Posts posts={posts} setPosts={setPosts} matchPairs={workspacePostMatches} /> : active.path === '/review' ? <Review posts={posts} setPosts={setPosts} /> : active.path === '/reports' ? <Reports reports={reports} setReports={setReports} posts={posts} /> : active.path === '/escalations' ? <Escalations escalationState={escalationState} setEscalationState={setEscalationState} /> : <div className={moderatorShellUi.placeholder}>Chưa cập nhật</div>}
        </main>
      </div>
    </div>
  )
}
