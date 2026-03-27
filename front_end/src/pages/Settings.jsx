import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, KeyRound, Lock, Mail, Shield, SlidersHorizontal, Upload, UserCircle } from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import SegmentedControl from '../components/ui/SegmentedControl'
import { backendGet, backendJson, backendUploadWithProgress } from '../backendApi'
import { supabase } from '../supabaseClient'
import { setUnits, useUnitsValue } from '../preferences'
import '../styles/Settings.css'

function safeBool(v) {
  return v === true
}

function normalizeQrValue(v) {
  let s = String(v || '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

export default function Settings() {
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const unitsPref = useUnitsValue()
  const [units, setUnitsState] = useState(unitsPref)
  const [weeklyGoal, setWeeklyGoal] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState('')

  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaEnroll, setMfaEnroll] = useState(null)
  const [mfaChallengeId, setMfaChallengeId] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)

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

        const goalMeters = Number(res?.profile?.weeklyGoalDistanceMeters || 0)
        if (goalMeters > 0) {
          const v = unitsPref === 'mi' ? goalMeters / 1609.344 : goalMeters / 1000
          setWeeklyGoal(String(Math.round(v * 10) / 10))
        } else {
          setWeeklyGoal('')
        }

        // MFA state
        try {
          const { data, error: mfaErr } = await supabase.auth.mfa.listFactors()
          if (!mfaErr) {
            const totp = data?.totp || []
            const enabled = totp.some((f) => f.status === 'verified')
            setMfaEnabled(enabled)
          }
        } catch {
          // ignore
        }
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

  const refreshMfa = async () => {
    const { data, error: mfaErr } = await supabase.auth.mfa.listFactors()
    if (mfaErr) throw mfaErr
    const totp = data?.totp || []
    setMfaEnabled(totp.some((f) => f.status === 'verified'))
    return totp
  }

  const onEnable2fa = async () => {
    setNotice('')
    setError('')
    setMfaEnroll(null)
    setMfaChallengeId('')
    setMfaCode('')
    setMfaBusy(true)
    try {
      const { data: enroll, error: enErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Pace42',
      })
      if (enErr) throw enErr
      if (!enroll?.id) throw new Error('Failed to enroll')
      setMfaEnroll(enroll)

      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enroll.id })
      if (chErr) throw chErr
      if (!ch?.id) throw new Error('Failed to start challenge')
      setMfaChallengeId(String(ch.id))
      // Instruction text is shown inline in the 2FA panel.
    } catch (e) {
      setError(e?.message || 'Failed to enable 2FA')
    } finally {
      setMfaBusy(false)
    }
  }

  const onVerify2fa = async () => {
    const c = mfaCode.replace(/\s+/g, '')
    if (!mfaEnroll?.id || !mfaChallengeId || c.length < 6) return
    setNotice('')
    setError('')
    setMfaBusy(true)
    try {
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: mfaEnroll.id,
        challengeId: mfaChallengeId,
        code: c,
      })
      if (vErr) throw vErr
      await refreshMfa()
      setMfaEnroll(null)
      setMfaChallengeId('')
      setMfaCode('')
      setNotice('Two-factor authentication enabled.')
    } catch (e) {
      setError(e?.message || 'Invalid code')
    } finally {
      setMfaBusy(false)
    }
  }

  const onDisable2fa = async () => {
    setNotice('')
    setError('')
    setMfaBusy(true)
    try {
      const totp = await refreshMfa()
      const verified = totp.filter((f) => f.status === 'verified')
      for (const f of verified) {
        // eslint-disable-next-line no-await-in-loop
        const { error: uErr } = await supabase.auth.mfa.unenroll({ factorId: f.id })
        if (uErr) throw uErr
      }
      await refreshMfa()
      setNotice('Two-factor authentication disabled.')
    } catch (e) {
      setError(e?.message || 'Failed to disable 2FA')
    } finally {
      setMfaBusy(false)
    }
  }

  const avatarSeed = useMemo(() => {
    return me?.profile?.username || me?.user?.id || 'user'
  }, [me])

  const onPickAvatar = () => fileRef.current?.click()

  const onUploadAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Avatar must be JPG, PNG, or WEBP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar must be <= 5MB.')
      return
    }
    setNotice('')
    setError('')
    setBusy(true)
    setUploadPct(0)
    try {
      const res = await backendUploadWithProgress('/api/me/avatar', file, {
        onProgress: (p) => setUploadPct(Math.round(p * 100)),
      })

      // Refresh cached profile summary (so NavBar updates instantly)
      const next = await backendGet('/api/me/summary')
      setMe(next)

      setNotice('Profile picture updated.')
      return res
    } catch (e2) {
      setError(e2?.message || 'Upload failed')
    } finally {
      setBusy(false)
      setUploadPct(0)
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
      setNotice(next ? 'Account is now private.' : 'Account is now public.')
    } catch (e) {
      setIsPrivate(!next)
      setError(e?.message || 'Failed to update privacy')
    }
  }

  useEffect(() => {
    setUnitsState(unitsPref)
  }, [unitsPref])

  const toWeeklyGoalMeters = (txt) => {
    const x = Number(String(txt || '').trim())
    if (!Number.isFinite(x) || x <= 0) return 0
    const meters = units === 'mi' ? x * 1609.344 : x * 1000
    return Math.round(meters)
  }

  const onSaveWeeklyGoal = async () => {
    setNotice('')
    setError('')
    setBusy(true)
    try {
      const meters = toWeeklyGoalMeters(weeklyGoal)
      const res = await backendJson('PUT', '/api/me', { weeklyGoalDistanceMeters: meters || 0 })
      setMe((prev) => ({ ...(prev || {}), profile: res?.profile || prev?.profile }))
      setNotice(meters ? 'Weekly goal updated.' : 'Weekly goal cleared.')
    } catch (e) {
      setError(e?.message || 'Failed to update weekly goal')
    } finally {
      setBusy(false)
    }
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
        {loading || error || notice ? (
          <div className="settings-toast" role="status" aria-live="polite">
            {loading ? <div className="settings-toast-inner">Loading…</div> : null}
            {error ? <div className="settings-toast-inner error">{error}</div> : null}
            {notice ? <div className="settings-toast-inner ok">{notice}</div> : null}
          </div>
        ) : null}

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
              <a href="#twofa">2FA</a>
              <a href="#prefs">Preferences</a>
              <a href="#api">API</a>
              <a href="#danger">Danger Zone</a>
            </div>

            <div className="settings-nav-foot" />
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
              {busy && uploadPct > 0 ? (
                <div className="settings-row-help">Uploading: {uploadPct}%</div>
              ) : null}
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

            <section className="settings-card" id="twofa" style={{ '--i': 4 }}>
              <div className="settings-card-title">
                <Lock size={18} />
                <h2>Two-factor authentication</h2>
              </div>

              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Authenticator app (TOTP)</div>
                  <div className="settings-row-help">
                    {mfaEnabled
                      ? 'Enabled. You will be asked for a 6-digit code on every login.'
                      : 'Not enabled. Use an authenticator app like Google Authenticator or Authy.'}
                  </div>
                </div>
                <div className="settings-row-actions">
                  {!mfaEnabled ? (
                    <button className="settings-btn primary" type="button" onClick={onEnable2fa} disabled={mfaBusy || loading}>
                      Enable 2FA
                    </button>
                  ) : (
                    <button className="settings-btn danger" type="button" onClick={onDisable2fa} disabled={mfaBusy || loading}>
                      Disable 2FA
                    </button>
                  )}
                </div>
              </div>

              {mfaEnroll ? (
                <div className="mfa-panel">
                  <div className="mfa-qr">
                    <div className="mfa-qr-inner">
                      {(() => {
                        const qr = normalizeQrValue(mfaEnroll?.totp?.qr_code)
                        if (!qr) return <div className="mfa-qr-text">QR unavailable</div>

                        // Supabase usually returns a data URL.
                        if (qr.startsWith('data:image/') || qr.startsWith('data:')) {
                          return <img className="mfa-qr-img" src={qr} alt="2FA QR code" />
                        }

                        // Fallback: raw SVG markup.
                        if (qr.startsWith('<svg') || qr.includes('<svg')) {
                          return <div className="mfa-qr-svg" dangerouslySetInnerHTML={{ __html: qr }} />
                        }

                        // Last resort: show as text to avoid injecting unknown markup.
                        return <div className="mfa-qr-text">{qr}</div>
                      })()}
                    </div>
                  </div>
                  <div className="mfa-side">
                    <div className="settings-row-label">Verify setup</div>
                    <div className="settings-row-help">
                      Scan the QR code, then enter the 6-digit code to finish enabling 2FA.
                    </div>

                    <div className="mfa-verify">
                      <input
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder="123 456"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                      <button type="button" className="settings-btn" onClick={onVerify2fa} disabled={mfaBusy || mfaCode.replace(/\s+/g, '').length < 6}>
                        Verify
                      </button>
                    </div>

                    {mfaEnroll?.totp?.secret ? (
                      <div className="mfa-secret">
                        <div className="settings-row-help">Manual key</div>
                        <div className="mono">{mfaEnroll.totp.secret}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="settings-card" id="prefs" style={{ '--i': 5 }}>
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
                  <SegmentedControl
                    value={units}
                    ariaLabel="Units"
                    options={[
                      { value: 'km', label: 'km' },
                      { value: 'mi', label: 'mi' },
                    ]}
                    onChange={(v) => {
                      const next = v === 'mi' ? 'mi' : 'km'
                      setUnitsState(next)
                      setUnits(next)
                    }}
                    disabled={busy || loading}
                  />
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Weekly distance goal</div>
                  <div className="settings-row-help">Set a weekly target to show the goal widget on Home.</div>
                </div>
                <div className="settings-row-actions">
                  <input
                    value={weeklyGoal}
                    onChange={(e) => setWeeklyGoal(e.target.value)}
                    placeholder={units === 'mi' ? 'e.g. 15' : 'e.g. 25'}
                    inputMode="decimal"
                    style={{ width: 140 }}
                    disabled={busy || loading}
                  />
                  <div className="settings-row-help" style={{ margin: 0, whiteSpace: 'nowrap' }}>{units === 'mi' ? 'mi / week' : 'km / week'}</div>
                  <button className="settings-btn" type="button" onClick={onSaveWeeklyGoal} disabled={busy || loading}>
                    Save
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-card" id="api" style={{ '--i': 6 }}>
              <div className="settings-card-title">
                <KeyRound size={18} />
                <h2>API</h2>
              </div>

              <div className="settings-row">
                <div className="settings-row-main">
                  <div className="settings-row-label">Public API documentation</div>
                  <div className="settings-row-help">How to authenticate, rate limits, and endpoints.</div>
                </div>
                <div className="settings-row-actions">
                  <button className="settings-btn" type="button" onClick={() => navigate('/api-docs')} disabled={busy || loading}>
                    Open docs
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-card danger" id="danger" style={{ '--i': 7 }}>
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
