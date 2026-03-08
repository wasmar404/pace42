import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, Search } from 'lucide-react'

import { supabase } from '../supabaseClient'
import { backendGet } from '../backendApi'
import '../styles/NavBar.css'
import logo from '../assets/logo-removebg-preview.png'

const PROFILE_CACHE_KEY = 'pace42.meSummary'
const CACHE_MAX_AGE_MS = 2 * 60 * 1000

export default function NavBar() {
  const navigate = useNavigate()

  const [avatarUrl, setAvatarUrl] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    // Hydrate avatar immediately from cached profile.
    try {
      const raw = localStorage.getItem(PROFILE_CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw)
        const cachedAt = Number(cached?.cachedAt || 0)
        if (cachedAt && Date.now() - cachedAt <= CACHE_MAX_AGE_MS) {
          setAvatarUrl(cached?.data?.profile?.avatarUrl || '')
        }
      }
    } catch {
      // ignore
    }

    async function loadMe() {
      try {
        const res = await backendGet('/api/me/summary')
        if (cancelled) return
        setAvatarUrl(res?.profile?.avatarUrl || '')

        try {
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: res }))
        } catch {
          // ignore
        }
      } catch {
        // ignore (user might not be logged in yet)
      }
    }

    void loadMe()
    return () => {
      cancelled = true
    }
  }, [])

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
          <img className="nav-logo-img" src={logo} alt="Pace42" />
        </Link>

        <Link to="/search" className="nav-icon" aria-label="Search">
          <Search size={18} strokeWidth={2.4} />
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <Link to="/training" className="nav-link">Training Logs</Link>
          <Link to="/clubs" className="nav-link">Clubs</Link>
        </nav>

        <div className="nav-actions">
          <Link to="/notifications" className="nav-icon" aria-label="Notifications">
            <Bell size={18} strokeWidth={2.4} />
          </Link>
          <Link to="/chat" className="nav-icon" aria-label="Chat">
            <MessageCircle size={18} strokeWidth={2.4} />
          </Link>
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
