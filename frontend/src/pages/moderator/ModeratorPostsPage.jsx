import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Logo from '../../components/Logo'
import ModIcon from '../../components/moderator/ModIcon'
import { createWorkspacePosts, workspacePostMatches } from '../../data/workspacePosts'
import Posts from './Posts'
import Review from './Review'
import '../../theme/moderator.css'

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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [posts, setPosts] = useState(createWorkspacePosts)
  const active = navigation.find((item) => pathname === `/moderator${item.path}`) || navigation[1]

  return (
    <div className="mod-app">
      {sidebarOpen && <button className="mod-sidebar-overlay" aria-label="Đóng menu điều hướng" onClick={() => setSidebarOpen(false)} />}
      <aside id="moderator-sidebar" className={`mod-sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="mod-sidebar-header">
          <NavLink to="/moderator" className="mod-brand" aria-label="LostLink - Bài đăng" onClick={() => setSidebarOpen(false)}>
            <span><Logo size={36} /></span>
            <div className="mod-brand-text">LostLink</div>
          </NavLink>
          <button className="mod-icon-button mod-collapse-toggle" aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'} title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'} aria-expanded={!sidebarCollapsed} aria-controls="moderator-sidebar" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>
            <ModIcon name={sidebarCollapsed ? 'next' : 'back'} />
          </button>
        </div>
        <nav className="mod-nav" aria-label="Điều hướng moderator">
          {navigation.map((item) => (
            <NavLink key={item.path} to={`/moderator${item.path}`} end aria-label={item.label} title={item.label} className={({ isActive }) => `mod-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <ModIcon name={item.icon} />
              <span className="mod-nav-text">{item.label}</span>
              {item.path === '/review' && posts.some((post) => post.status === 'pending') && <span className="mod-nav-badge">{posts.filter((post) => post.status === 'pending').length}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mod-user">
          <div className="mod-avatar">MO</div>
          <div className="mod-user-info"><strong>Moderator</strong></div>
          <button className="mod-logout" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => window.location.assign('/')}><ModIcon name="logout" size={20} /></button>
        </div>
      </aside>
      <div className="mod-main">
        <header className="mod-header">
          <button className="mod-icon-button mod-menu-toggle" aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={sidebarOpen} aria-controls="moderator-sidebar" onClick={() => setSidebarOpen((open) => !open)}><ModIcon name="menu" /></button>
          <div className="mod-header-title"><span><ModIcon name={active.icon} size={20} /></span><h1>{active.label}</h1></div>
          <div className="mod-header-date"><ModIcon name="calendar" size={16} /><time dateTime={new Date().toLocaleDateString('en-CA')}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time></div>
        </header>
        <main className="mod-main-content">
          {active.path === '' ? <Posts posts={posts} setPosts={setPosts} matchPairs={workspacePostMatches} /> : active.path === '/review' ? <Review posts={posts} setPosts={setPosts} /> : <div className="mod-page-placeholder">Chưa cập nhật</div>}
        </main>
      </div>
    </div>
  )
}
