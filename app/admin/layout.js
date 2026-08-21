'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import styles from './layout.module.css'
import { supabase } from '@/lib/supabase'

export default function AdminLayout({ children }) {
  const [links, setLinks] = useState([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Check if previously authenticated in this session
    if (typeof window !== 'undefined' && sessionStorage.getItem('adminAuth')) {
      setIsAuthenticated(true)
    }

    const fetchLinks = async () => {
      const { data } = await supabase
        .from('InterviewLink')
        .select('id, title')
        .order('createdAt', { ascending: false })
      setLinks(data || [])
    }
    
    if (isAuthenticated) {
      fetchLinks()
    }
  }, [pathname, isAuthenticated])

  const handleDeleteLink = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!window.confirm('Are you sure you want to delete this interview and all its candidate sessions? This action cannot be undone.')) {
      return
    }
    
    try {
      await supabase.from('InterviewSession').delete().eq('interviewLinkId', id)
      const { error } = await supabase.from('InterviewLink').delete().eq('id', id)
      if (error) throw error
      
      setLinks(prev => prev.filter(l => l.id !== id))
      if (pathname === `/admin/link/${id}`) {
        router.push('/admin')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to delete interview link.')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsAuthenticated(true)
        setLoginError('')
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('adminAuth', 'true')
        }
      } else {
        setLoginError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setLoginError('Error connecting to server')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.backgroundGlow} />
        <div className={styles.loginCard}>
          <img src="https://xobin.com/wp-content/uploads/2026/04/logo-CQAmVy86.png" alt="Xobin" className={styles.loginLogoImg} />
          <h1 className={styles.loginTitle}>Admin Login</h1>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <input 
              type="text" 
              placeholder="Admin ID" 
              className={styles.inputField} 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input 
              type="password" 
              placeholder="Password" 
              className={styles.inputField} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {loginError && <div className={styles.errorText}>{loginError}</div>}
            <button type="submit" className={styles.loginButton}>Sign In</button>
          </form>
        </div>
      </div>
    )
  }

  const isWizardRoute = pathname === '/admin/create'
  
  if (isWizardRoute) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fb' }}>
        {children}
      </div>
    )
  }

  return (
    <div className={styles.adminLayout}>
      <div className={styles.backgroundGlow} />
      {/* Primary Sidebar (Slim) */}
      <aside className={styles.primarySidebar}>
        <nav className={styles.primaryNav}>
          <Link href="/admin" className={`${styles.iconLink} ${pathname === '/admin' ? styles.activeIcon : ''}`} title="Dashboard">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </Link>
          <Link href="/admin/candidates" className={`${styles.iconLink} ${pathname === '/admin/candidates' ? styles.activeIcon : ''}`} title="All Candidates">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </Link>
          <div className={styles.iconLink} style={{ marginTop: 'auto', opacity: 0.5, cursor: 'not-allowed' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </div>
        </nav>
      </aside>

      <aside className={styles.secondarySidebar}>
        <div style={{ marginBottom: '32px' }}>
          <img src="https://xobin.com/wp-content/uploads/2026/04/logo-CQAmVy86.png" alt="Xobin" style={{ width: '120px', height: 'auto' }} />
        </div>
        <div className={styles.searchWrapper}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="#9ca3af" strokeWidth="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search..." 
            className={styles.searchInput} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className={styles.sidebarSection}>
          <div className={styles.sectionHeader}>ALL INTERVIEWS</div>
          <div className={styles.projectList}>
            {links.filter(link => link.title.toLowerCase().includes(searchQuery.toLowerCase())).map(link => {
              const isActive = pathname === `/admin/link/${link.id}`
              return (
                <Link key={link.id} href={`/admin/link/${link.id}`} className={`${styles.projectLink} ${isActive ? styles.activeProject : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    <div className={styles.projectIcon}>
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <span className={styles.projectTitle} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.title}</span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteLink(e, link.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isActive ? '#f87171' : '#9ca3af', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete Interview"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </Link>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>Workspace</div>
          <div className={styles.headerUser}>
            <div className={styles.avatar}>A</div>
          </div>
        </header>
        <div className={styles.pageContent}>
          {children}
        </div>
      </main>
    </div>
  )
}
