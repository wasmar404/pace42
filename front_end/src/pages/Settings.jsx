import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Lock, Mail, Shield, SlidersHorizontal, Upload, UserCircle } from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import { backendGet, backendJson, backendUpload } from '../backendApi'
import { supabase } from '../supabaseClient'
import '../styles/Settings.css'

const PROFILE_CACHE_KEY = 'pace42.meSummary'

function safeBool(v) {
  return v === true
}

export default function Settings() {
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const [units, setUnits] = useState(() => localStorage.getItem('pace42.units') || 'km')

  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setError('')
      setNotice('')
      setLoading(true)
      try {
        const res = await backendGet('/api/me/summary')
        if (cancelled) return
        setMe(res)
        setIsPrivate(safeBool(res?.settings?.isPrivate))
        setNewEmail(res?.user?.email || '')
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const avatarSeed = useMemo(() => {
    return me?.profile?.username || me?.user?.id || 'user'
  }, [me])

  const onPickAvatar = () => fileRef.current?.click()

  const onUploadAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNotice('')
    setError('')
    setBusy(true)
    try {
      const res = await backendUpload('/api/me/avatar', file)

      // Refresh cached profile summary (so NavBar updates instantly)
      const next = await backendGet('/api/me/summary')
      setMe(next)
      try {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: next }))
      } catch {
        // ignore
      }

      setNotice('Profile picture updated.')
      return res
    } catch (e2) {
      setError(e2?.message || 'Upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onTogglePrivacy = async () => {
    const next = !isPrivate
    setIsPrivate(next)
    setNotice('')
    setError('')
    try {
      const res = await backendJson('PUT', '/api/me', { isPrivate: next })
      const merged = {
        ...(me || {}),
        profile: res?.profile || me?.profile,
        settings: { ...(me?.settings || {}), isPrivate: next },
      }
      setMe(merged)
      try {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: merged }))
      } catch {
        // ignore
      }
      setNotice(next ? 'Account is now private.' : 'Account is now public.')
    } catch (e) {
      setIsPrivate(!next)
      setError(e?.message || 'Failed to update privacy')
    }
  }

  const onSaveUnits = () => {
    try {
      localStorage.setItem('pace42.units', units)
    } catch {
      // ignore
    }
    setNotice('Preferences saved.')
  }

  const onChangeEmail = async (e) => {
    e.preventDefault()
    setNotice('')
    setError('')
    const email = (newEmail || '').trim()
    if (!email.includes('@')) {
      setError('Enter a valid email address.')
      return
    }

    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ email })
      if (err) throw err
      setNotice('Email update requested. Check your inbox to confirm.')
    } catch (e2) {
      setError(e2?.message || 'Failed to update email')
    } finally {
      setBusy(false)
    }
  }

  const onChangePassword = async (e) => {
    e.preventDefault()
    setNotice('')
    setError('')
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword })
      if (err) throw err
      setNewPassword('')
      setConfirmPassword('')
      setNotice('Password updated.')
    } catch (e2) {
      setError(e2?.message || 'Failed to update password')
    } finally {
      setBusy(false)
    }
  }

  const onLogout = async () => {
    await supabase.auth.signOut().catch(() => {})
    navigate('/login')
  }

  const onDeleteAccount = async () => {
    setNotice('')
    setError('')
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm account deletion.')
      return
    }

    setBusy(true)
    try {
      await backendJson('POST', '/api/me/delete-account', { confirm: 'DELETE' })
      await supabase.auth.signOut().catch(() => {})

      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('pace42.'))
          .forEach((k) => localStorage.removeItem(k))
      } catch {
        // ignore
      }

      navigate('/login')
    } catch (e) {
      setError(e?.message || 'Failed to delete account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-page">
      <NavBar />

      <main className="settings-wrap">
        <header className="settings-head">
          <div className="settings-kicker">Control Room</div>
          <h1>Settings</h1>
          <p>Privacy, login, and preferences. Keep it tight.</p>
        </header>

        {loading ? <div className="settings-banner">Loading...</div> : null}
        {error ? <div className="settings-banner error">{error}</div> : null}
        {notice ? <div className="settings-banner ok">{notice}</div> : null}

        <div className="settings-grid">
          <aside className="settings-nav" aria-label="Settings sections">
            <div className="settings-me">
              <div className="settings-me-av">
                <Avatar avatarUrl={me?.profile?.avatarUrl} seed={avatarSeed} alt="" loading="eager" />
              </div>
              <div className="settings-me-main">
                <div className="settings-me-name">{me?.profile?.username ? `@${me.profile.username}` : 'Athlete'}</div>
                <div className="settings-me-sub">{me?.user?.email || 'Signed in'}</div>
              </div>
            </div>

            <div className="settings-nav-links">
              <a href="#profile">Profile</a>
              <a href="#privacy">Privacy</a>
              <a href="#email">Email</a>
              <a href="#password">Password</a>
              <a href="#prefs">Preferences</a>
              <a href="#danger">Danger Zone</a>
            </div>

            <div className="settings-nav-foot">
              <div className="settings-nav-note">Tip: keep your account private if you only want followers to see workouts.</div>
            </div>
          </aside>

          <div className="settings-panels">
            <section className="settings-card" id="profile" style={{ '--i': 0 }}>
              <div className="settings-card-title">
                <UserCircle size={18} />
                <h2>Profile</h2>
              </div>

              <div className="settings-row with-avatar">
                <div className="settings-avatar">
                  <Avatar avatarUrl={me?.profile?.avatarUrl} seed={avatarSeed} alt="" loading="eager" />
                </div>
                <div className="settings-row-main">
                  <div className="settings-row-label">Profile picture</div>
                  <div className="settings-row-help">Upload a photo. If you don’t, we generate an avatar automatically.</div>
                </div>
                <div className="settings-row-actions">
                  <button className="settings-btn" type="button" onClick={onPickAvatar} disabled={busy}>
                    <Upload size={16} />
                    Change
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onUploadAvatar} style={{ display: 'none' }} />
                </div>
              </div>
            </section>

            <section className="settings-card" id="privacy" style={{ '--i': 1 }}>
              <div className="settings-card-title">
                <Shield size={18} />
                <h2>Privacy</h2>
              </div>

              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Private account</div>
                  <div className="settings-row-help">When private, only followers can see your workouts and followers-only content.</div>
                </div>
                <div className="settings-row-actions">
                  <button
                    className={isPrivate ? 'settings-toggle on' : 'settings-toggle'}
                    type="button"
                    onClick={onTogglePrivacy}
                    disabled={busy || loading}
                    aria-label={isPrivate ? 'Disable private account' : 'Enable private account'}
                  >
                    <span className="dot" />
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-card" id="email" style={{ '--i': 2 }}>
              <div className="settings-card-title">
                <Mail size={18} />
                <h2>Email</h2>
              </div>

              <form onSubmit={onChangeEmail} className="settings-form">
                <label>
                  New email
                  <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" autoComplete="email" />
                </label>
                <button className="settings-btn primary" type="submit" disabled={busy || loading}>
                  Update email
                </button>
                <div className="settings-row-help">You may need to confirm the change via email.</div>
              </form>
            </section>

            <section className="settings-card" id="password" style={{ '--i': 3 }}>
              <div className="settings-card-title">
                <Lock size={18} />
                <h2>Password</h2>
              </div>

              <form onSubmit={onChangePassword} className="settings-form">
                <label>
                  New password
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" autoComplete="new-password" />
                </label>
                <label>
                  Confirm password
                  <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" />
                </label>
                <button className="settings-btn primary" type="submit" disabled={busy || loading}>
                  Update password
                </button>
              </form>
            </section>

            <section className="settings-card" id="prefs" style={{ '--i': 4 }}>
              <div className="settings-card-title">
                <SlidersHorizontal size={18} />
                <h2>Preferences</h2>
              </div>

              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Units</div>
                  <div className="settings-row-help">Choose how distances are displayed.</div>
                </div>
                <div className="settings-row-actions">
                  <div className="seg">
                    <button
                      className={units === 'km' ? 'seg-btn on' : 'seg-btn'}
                      type="button"
                      onClick={() => setUnits('km')}
                    >
                      km
                    </button>
                    <button
                      className={units === 'mi' ? 'seg-btn on' : 'seg-btn'}
                      type="button"
                      onClick={() => setUnits('mi')}
                    >
                      mi
                    </button>
                  </div>
                  <button className="settings-btn" type="button" onClick={onSaveUnits}>Save</button>
                </div>
              </div>
            </section>

            <section className="settings-card danger" id="danger" style={{ '--i': 5 }}>
              <div className="settings-card-title">
                <span className="danger-dot" aria-hidden="true" />
                <h2>Danger Zone</h2>
              </div>

              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Sign out</div>
                  <div className="settings-row-help">Ends your session on this device.</div>
                </div>
                <div className="settings-row-actions">
                  <button className="settings-btn danger" type="button" onClick={onLogout}>Logout</button>
                </div>
              </div>

              <div className="settings-row split">
                <div className="settings-row-main">
                  <div className="settings-row-label">Delete account</div>
                  <div className="settings-row-help">Permanently deletes your account and all data. This cannot be undone.</div>
                  <div className="settings-delete">
                    <label>
                      Type DELETE to confirm
                      <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
                    </label>
                  </div>
                </div>
                <div className="settings-row-actions">
                  <button className="settings-btn danger" type="button" onClick={onDeleteAccount} disabled={busy || loading}>
                    <AlertTriangle size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
