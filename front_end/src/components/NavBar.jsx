import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, Search } from 'lucide-react'

import { supabase } from '../supabaseClient'
import { backendGet } from '../backendApi'
import Avatar from './Avatar'
import { readSupabaseSessionUserForStorageKeySync, readSupabaseSessionUserSync } from '../utils/avatarCache'
import '../styles/NavBar.css'

const logo = '/assets/logo-removebg-preview.png'

export default function NavBar() {
  const navigate = useNavigate()

  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarSeed, setAvatarSeed] = useState(() => {
    const key = supabase?.auth?.storageKey
    const u = key ? readSupabaseSessionUserForStorageKeySync(key) : readSupabaseSessionUserSync()
    return u?.id || 'athlete'
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const avatarRef = useRef(null)
  const avatarCloseTimerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadMe() {
      try {
        const res = await backendGet('/api/me')
        if (cancelled) return
        const nextUrl = res?.profile?.avatarUrl || ''
        const nextSeed = res?.user?.id || 'athlete'
        setAvatarUrl(nextUrl)
        setAvatarSeed(nextSeed)
      } catch {
        // ignore (user might not be logged in yet)
      }
    }

    // Set a stable seed from current session (sync, no network call needed).
    const key = supabase?.auth?.storageKey
    const cached = key ? readSupabaseSessionUserForStorageKeySync(key) : readSupabaseSessionUserSync()
    if (cached?.id) {
      setAvatarSeed(cached.id)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return

      const id = session?.user?.id
      if (!id) {
        // Clear any previous user's avatar on logout.
        setAvatarUrl('')
        setAvatarSeed('athlete')
        return
      }

      // Reset immediately, then re-fetch profile for this user.
      setAvatarUrl('')
      setAvatarSeed(id)
      void loadMe()
    })

    void loadMe()
    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current && !avatarRef.current) return
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarMenuOpen(false)
    }

    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    return () => {
      if (avatarCloseTimerRef.current) clearTimeout(avatarCloseTimerRef.current)
    }
  }, [])

  const logout = async () => {
    await supabase.auth.signOut().catch(() => {})
    setAvatarUrl('')
    setAvatarSeed('athlete')
    navigate('/login')
  }

  const onAvatarClick = (e) => {
    // On touch devices, first tap opens the menu; second tap follows the link.
    const isTouch = e?.nativeEvent?.pointerType === 'touch'
    if (!isTouch) return
    if (!avatarMenuOpen) {
      e.preventDefault()
      setMenuOpen(false)
      setAvatarMenuOpen(true)
    }
  }

  const onAvatarEnter = () => {
    if (avatarCloseTimerRef.current) clearTimeout(avatarCloseTimerRef.current)
    setAvatarMenuOpen(true)
  }

  const onAvatarLeave = () => {
    if (avatarCloseTimerRef.current) clearTimeout(avatarCloseTimerRef.current)
    // Small delay prevents flicker when crossing tiny gaps.
    avatarCloseTimerRef.current = setTimeout(() => setAvatarMenuOpen(false), 140)
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/home" className="nav-logo" aria-label="Pace42">
          <img className="nav-logo-img" src={logo} alt="Pace42" />
        </Link>

        <Link to="/search" className="nav-icon" aria-label="Search">
          <Search size={18} strokeWidth={2.4} />
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <Link to="/training" className="nav-link">Training Logs</Link>
        </nav>

        <div className="nav-actions">
          <Link to="/chat" className="nav-icon nav-chat-btn" aria-label="Chat">
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

            <div className={`nav-plus-menu ${menuOpen ? 'is-open' : ''}`} role="menu">
              <Link to="/activities/new?mode=gpx" className="nav-plus-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Upload workout (GPX)
              </Link>
              <Link to="/activities/new?mode=manual" className="nav-plus-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Enter workout manually
              </Link>
            </div>
          </div>

          <div className="nav-avatar-wrap" ref={avatarRef} onMouseEnter={onAvatarEnter} onMouseLeave={onAvatarLeave}>
            <Link
              to="/profile"
              className="nav-avatar"
              aria-label="Profile"
              aria-haspopup="menu"
              aria-expanded={avatarMenuOpen}
              onPointerDown={onAvatarClick}
            >
              <Avatar avatarUrl={avatarUrl} seed={avatarSeed} alt="Profile" loading="eager" />
            </Link>

            <div className={`nav-avatar-menu ${avatarMenuOpen ? 'is-open' : ''}`} role="menu" aria-label="Profile menu">
              <Link to="/profile" className="nav-avatar-item" role="menuitem" onClick={() => setAvatarMenuOpen(false)}>
                My Profile
              </Link>
              <Link to="/settings" className="nav-avatar-item" role="menuitem" onClick={() => setAvatarMenuOpen(false)}>
                Settings
              </Link>
              <button
                className="nav-avatar-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  setAvatarMenuOpen(false)
                  void logout()
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
