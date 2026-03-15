import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, Search } from 'lucide-react'

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
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState('')
  const [notifItems, setNotifItems] = useState([])
  const [notifUnread, setNotifUnread] = useState(0)
  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const avatarRef = useRef(null)

  const NOTIF_LAST_SEEN_KEY = 'pace42.notifications.lastSeenAt'

  const computeUnread = (items) => {
    const lastSeen = Number(localStorage.getItem(NOTIF_LAST_SEEN_KEY) || 0)
    const count = (items || []).filter((it) => {
      const t = Date.parse(it?.createdAt)
      return Number.isFinite(t) && t > lastSeen
    }).length
    setNotifUnread(count)
  }

  const refreshUnread = async () => {
    try {
      const since = Number(localStorage.getItem(NOTIF_LAST_SEEN_KEY) || 0)
      const res = await backendGet(`/api/notifications/unread?since=${encodeURIComponent(String(since))}`)
      const n = Number(res?.unread || 0)
      setNotifUnread(Number.isFinite(n) ? n : 0)
    } catch {
      // ignore
    }
  }

  const fmtWhen = (iso) => {
    try {
      const t = Date.parse(iso)
      if (!Number.isFinite(t)) return ''
      const diff = Math.max(0, Date.now() - t)
      const mins = Math.floor(diff / 60000)
      if (mins < 1) return 'just now'
      if (mins < 60) return `${mins}m`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `${hrs}h`
      const days = Math.floor(hrs / 24)
      return `${days}d`
    } catch {
      return ''
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
      if (!notifOpen) await refreshUnread()
    }

    void tick()
    t = setInterval(tick, 15000)

    const onFocus = () => {
      if (!notifOpen) void refreshUnread()
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
  }, [notifOpen])

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current && !notifRef.current && !avatarRef.current) return
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarMenuOpen(false)
    }

    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadNotifs() {
      if (!notifOpen) return
      setNotifError('')
      setNotifLoading(true)
      try {
        const res = await backendGet('/api/notifications')
        if (cancelled) return
        const items = res?.items || []
        setNotifItems(items)
        computeUnread(items)
      } catch (e) {
        if (cancelled) return
        setNotifError(e?.message || 'Failed to load notifications')
      } finally {
        if (!cancelled) setNotifLoading(false)
      }
    }

    void loadNotifs()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen])

  useEffect(() => {
    // Update unread count after initial mount.
    computeUnread(notifItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const toggleNotifs = () => {
    setMenuOpen(false)
    setAvatarMenuOpen(false)
    setNotifOpen((v) => {
      const next = !v
      if (next) {
        try {
          localStorage.setItem(NOTIF_LAST_SEEN_KEY, String(Date.now()))
        } catch {
          // ignore
        }
        setNotifUnread(0)
      }
      return next
    })
  }

  const onAvatarClick = (e) => {
    // On touch devices, first tap opens the menu; second tap follows the link.
    const isTouch = e?.nativeEvent?.pointerType === 'touch'
    if (!isTouch) return
    if (!avatarMenuOpen) {
      e.preventDefault()
      setMenuOpen(false)
      setNotifOpen(false)
      setAvatarMenuOpen(true)
    }
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
          <Link to="/clubs" className="nav-link">Clubs</Link>
        </nav>

        <div className="nav-actions">
          <div className="nav-notifs" ref={notifRef}>
            <button className="nav-icon nav-notif-btn" type="button" aria-label="Notifications" aria-haspopup="menu" aria-expanded={notifOpen} onClick={toggleNotifs}>
              <Bell size={18} strokeWidth={2.4} />
              {notifUnread > 0 ? <span className="nav-badge" aria-hidden="true" /> : null}
            </button>

            <div className={`nav-notif-menu ${notifOpen ? 'is-open' : ''}`} role="menu" aria-label="Notifications">
              <div className="nav-notif-head">
                <div className="title">Notifications</div>
                <button className="nav-notif-x" type="button" onClick={() => setNotifOpen(false)}>Close</button>
              </div>

              {notifLoading ? <div className="nav-notif-empty">Loading...</div> : null}
              {notifError ? <div className="nav-notif-error">{notifError}</div> : null}

              {!notifLoading && !notifError ? (
                <div className="nav-notif-list">
                   {notifItems.map((it, idx) => {
                     const to = it?.type === 'message' && it?.conversationId
                       ? `/chat/${it.conversationId}`
                       : it?.actor?.id
                         ? `/users/${it.actor.id}`
                         : '/home'

                     return (
                       <Link
                         key={`${it?.type || 'n'}-${it?.actor?.id || 'a'}-${it?.createdAt || idx}`}
                         to={to}
                         className="nav-notif-item"
                         role="menuitem"
                         onClick={() => setNotifOpen(false)}
                       >
                       <div className="nav-notif-avatar">
                         <Avatar avatarUrl={it?.actor?.avatarUrl} seed={it?.actor?.username || it?.actor?.id || it?.actor?.name} alt="" />
                       </div>
                       <div className="nav-notif-text">
                         <div className="line">{it?.text || 'Notification'}</div>
                         <div className="time">{fmtWhen(it?.createdAt)}</div>
                       </div>
                       </Link>
                     )
                   })}

                  {!notifItems.length ? <div className="nav-notif-empty">No notifications yet.</div> : null}
                </div>
              ) : null}
            </div>
          </div>

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

            <div className={`nav-plus-menu ${menuOpen ? 'is-open' : ''}`} role="menu">
              <Link to="/activities/new?mode=gpx" className="nav-plus-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Upload workout (GPX)
              </Link>
              <Link to="/activities/new?mode=manual" className="nav-plus-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Enter workout manually
              </Link>
            </div>
          </div>

          <div className="nav-avatar-wrap" ref={avatarRef}>
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
