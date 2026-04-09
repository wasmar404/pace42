import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { supabase } from '../supabaseClient'
import '../styles/Mfa.css'

function safeNext(next) {
  const n = String(next || '').trim()
  if (!n) return '/home'
  if (!n.startsWith('/')) return '/home'
  if (n.startsWith('//')) return '/home'
  return n
}

export default function Mfa() {
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef(null)

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return safeNext(params.get('next'))
  }, [location.search])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const { data: s } = await supabase.auth.getSession()
        if (!s.session) {
          navigate('/login', { replace: true })
          return
        }
        const { data: aalRes, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aalErr) throw aalErr
        if (aalRes?.currentLevel === 'aal2') {
          navigate(nextPath, { replace: true })
          return
        }

        const { data: factors, error: factorsErr } = await supabase.auth.mfa.listFactors()
        if (factorsErr) throw factorsErr

        const totp = factors?.totp || []
        const factor = totp.find((f) => f.status === 'verified') || totp[0]
        if (!factor?.id) {
          setError('Two-factor authentication is not enabled for this account.')
          return
        }

        const fid = String(factor.id)
        setFactorId(fid)

        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: fid })
        if (chErr) throw chErr
        if (!ch?.id) throw new Error('Failed to start challenge')
        setChallengeId(String(ch.id))
      } catch (e) {
        setError(e?.message || 'Failed to start 2FA challenge')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setTimeout(() => inputRef.current?.focus(), 0)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [navigate, nextPath])

  const canVerify = Boolean(factorId && challengeId)

  const onVerify = async (e) => {
    e.preventDefault()
    const c = code.replace(/\s+/g, '')
    if (!factorId || !challengeId || c.length < 6) return
    setBusy(true)
    setError('')
    try {
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId, code: c })
      if (vErr) throw vErr
      navigate(nextPath, { replace: true })
    } catch (e2) {
      const msg = String(e2?.message || 'Invalid code')
      setError(msg)
      setCode('')
      const lower = msg.toLowerCase()
      if (lower.includes('expired') || lower.includes('challenge') || lower.includes('not found')) {
        try {
          const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
          if (!chErr && ch?.id) setChallengeId(String(ch.id))
        } catch {
        }
      }
      setTimeout(() => inputRef.current?.focus(), 0)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mfa-page">
      <div className="mfa-card">
        <div className="mfa-kicker">Two-factor authentication</div>
        <h1>Enter your code</h1>
        <p>Open your authenticator app (Google Authenticator, Authy, 1Password) and enter the 6-digit code.</p>

        {loading ? <div className="mfa-note">Preparing challenge…</div> : null}
        {error ? <div className="mfa-error">{error}</div> : null}

        <form onSubmit={onVerify} className="mfa-form">
          <label>
            Code
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123 456"
              disabled={loading || busy}
            />
          </label>
          <button type="submit" disabled={loading || busy || !canVerify || code.replace(/\s+/g, '').length < 6}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <button
          type="button"
          className="mfa-link"
          onClick={() => {
            void supabase.auth.signOut().finally(() => navigate('/login'))
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
