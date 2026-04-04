import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { backendJson } from '../backendApi'

const logBg = '/assets/log-bg.jpg'

export default function AuthCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [msg, setMsg] = useState('Loading...')

  const errorFromProvider = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search)
      const err = params.get('error')
      const desc = params.get('error_description')
      return desc || err || ''
    } catch {
      return ''
    }
  }, [location.search])

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search)
    // mode=login|signup (used to prevent "login" from creating new OAuth accounts)
    const _mode = params.get('mode')
    const _method = params.get('method')
    const next = params.get('next')
    if (!next) return '/home'
    if (!next.startsWith('/')) return '/home'
    if (next.startsWith('//')) return '/home'
    return next
  }, [location.search])

  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const m = String(params.get('mode') || '').toLowerCase()
    return m === 'signup' ? 'signup' : 'login'
  }, [location.search])

  const method = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const m = String(params.get('method') || '').toLowerCase()
    return m || 'oauth'
  }, [location.search])

  useEffect(() => {
    async function run() {
      if (errorFromProvider) {
        setMsg(errorFromProvider)
        navigate(`/login?error=${encodeURIComponent('oauth_failed')}&message=${encodeURIComponent(errorFromProvider)}`)
        return
      }

      // For PKCE flows, make sure we exchange the code.
      try {
        const params = new URLSearchParams(location.search)
        const code = params.get('code')
        if (code) {
          await supabase.auth.exchangeCodeForSession(window.location.href)
        }
      } catch (e) {
        const m = e?.message || 'OAuth session exchange failed'
        setMsg(m)
        navigate(`/login?error=${encodeURIComponent('oauth_failed')}&message=${encodeURIComponent(m)}`)
        return
      }

      // Wait briefly for the session to persist.
      let session = null
      for (let i = 0; i < 12; i++) {
        // eslint-disable-next-line no-await-in-loop
        const { data } = await supabase.auth.getSession()
        session = data?.session || null
        if (session) break
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 120))
      }

      if (session) {
        // Enforce auth policies server-side (duplicate emails, mixed providers, OAuth-login gating).
        try {
          await backendJson('POST', '/api/auth/policy/enforce', { mode, method })
        } catch (e) {
          const m = e?.message || 'Sign-in blocked by policy'
          setMsg(m)
          await supabase.auth.signOut().catch(() => {})
          navigate(`/login?error=${encodeURIComponent('policy')}&message=${encodeURIComponent(m)}`)
          return
        }

        navigate(nextPath)
      } else {
        navigate(`/login?error=${encodeURIComponent('no_session')}&message=${encodeURIComponent('No session found after OAuth redirect. Try again.')}`)
      }
    }

    void run()
  }, [navigate, nextPath, mode, method, location.search, errorFromProvider])

  return (
    <div
      style={{
        padding: 24,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: `url(${logBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            width: 84,
            height: 84,
            border: '10px solid rgba(232, 57, 30, 0.25)',
            borderTop: '10px solid #e8391e',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: 20,
          }}
        />
        <h1 style={{ fontSize: '5rem', color: '#e8391e' }}>{msg}</h1>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
