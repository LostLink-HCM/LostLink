import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import ModIcon from '../../components/moderator/ModIcon'
import { moderatorPosts } from '../../data/moderatorPosts'
import Posts from './Posts'
import '../../theme/moderator.css'

export default function ModeratorPostsPage() {
  const [posts, setPosts] = useState(moderatorPosts)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  return <div className="mod-app">
    {sidebarOpen && <button className="mod-sidebar-overlay" aria-label="Đóng menu" onClick={() => setSidebarOpen(false)} />}
    <aside className={'mod-sidebar ' + (sidebarOpen ? 'open ' : '') + (sidebarCollapsed ? 'collapsed' : '')}>
      <div className="mod-sidebar-header"><NavLink to="/moderator" className="mod-brand"><span className="mod-brand-mark">L</span><span>LostLink</span></NavLink><button className="mod-icon-button mod-collapse-toggle" aria-label="Thu gọn hoặc mở rộng sidebar" onClick={() => setSidebarCollapsed((value) => !value)}><ModIcon name={sidebarCollapsed ? 'next' : 'back'} /></button></div>
      <nav className="mod-nav" aria-label="Điều hướng Moderator"><NavLink to="/moderator" end className={({ isActive }) => 'mod-nav-item ' + (isActive ? 'active' : '')} onClick={() => setSidebarOpen(false)}><ModIcon name="list" /><span className="mod-nav-text">Tất cả bài đăng</span></NavLink></nav>
      <div className="mod-user"><div className="mod-avatar">MO</div><div className="mod-user-info"><strong>Moderator</strong><span><i />Trực tuyến</span></div></div>
    </aside>
    <div className="mod-main">
      <header className="mod-header"><button className="mod-icon-button mod-menu-toggle" aria-label="Mở menu" onClick={() => setSidebarOpen((value) => !value)}><ModIcon name="menu" /></button><div className="mod-header-title"><span><ModIcon name="list" /></span><h1>Tất cả bài đăng</h1></div><div className="mod-header-date">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></header>
      <main className="mod-main-content"><Posts posts={posts} setPosts={setPosts} matchPairs={[]} /></main>
    </div>
  </div>
}
