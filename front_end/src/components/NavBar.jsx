import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { supabase } from '../supabaseClient'
import { backendGet } from '../backendApi'
import '../styles/NavBar.css'

export default function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()

  const [avatarUrl, setAvatarUrl] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadMe() {
      try {
        const res = await backendGet('/api/me')
        if (cancelled) return
        setAvatarUrl(res?.profile?.avatarUrl || '')
      } catch {
        // ignore (user might not be logged in yet)
      }
    }

    void loadMe()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) setMenuOpen(false)
    }

    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo" aria-label="Pace42">
          <span className="nav-logo-mark">P</span>
          <span className="nav-logo-text">Pace42</span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <Link to="/clubs" className="nav-link">Clubs</Link>
          <Link to="/search" className="nav-link">Search</Link>
          <Link to="/training" className="nav-link">Training Logs</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
        </nav>

        <div className="nav-actions">
          <button className="nav-ghost" type="button" onClick={logout}>Logout</button>

          <div className="nav-plus" ref={menuRef}>
            <button
              className="nav-plus-btn"
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              +
            </button>

            <div className={`nav-plus-menu ${menuOpen ? 'open' : ''}`} role="menu">
              <Link to="/activities/new?mode=gpx" className="nav-plus-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Upload workout (GPX)
              </Link>
              <Link to="/activities/new?mode=manual" className="nav-plus-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Enter workout manually
              </Link>
            </div>
          </div>

          <Link to="/profile" className="nav-avatar" aria-label="Profile">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" />
            ) : (
              <span className="nav-avatar-fallback">U</span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
