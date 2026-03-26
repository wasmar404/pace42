import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, Search } from 'lucide-react'

import { supabase } from '../supabaseClient'
import { backendGet } from '../backendApi'
import Avatar from './Avatar'
import '../styles/NavBar.css'
import logo from '../assets/logo-removebg-preview.png'

const PROFILE_CACHE_KEY = 'pace42.meSummary'
const CACHE_MAX_AGE_MS = 2 * 60 * 1000

export default function NavBar() {
  const navigate = useNavigate()

  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarSeed, setAvatarSeed] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)
  const menuRef = useRef(null)
  const avatarRef = useRef(null)
  const avatarCloseTimerRef = useRef(null)

  const refreshChatUnread = async () => {
    try {
      const res = await backendGet('/api/chat/unread')
      const n = Number(res?.unreadMessages || 0)
      setChatUnread(Number.isFinite(n) ? n : 0)
    } catch {
      // ignore
    }
  }

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
          setAvatarSeed(cached?.data?.profile?.username || cached?.data?.user?.id || '')
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
        setAvatarSeed(res?.profile?.username || res?.user?.id || '')

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
    // Poll unread count while app is open.
    let cancelled = false
    let t
    const tick = async () => {
      if (cancelled) return
      await refreshChatUnread()
    }

    void tick()
    t = setInterval(tick, 15000)

    const onFocus = () => {
      void refreshChatUnread()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      cancelled = true
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    void refreshChatUnread()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
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
            {chatUnread > 0 ? <span className="nav-badge" aria-hidden="true" /> : null}
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
