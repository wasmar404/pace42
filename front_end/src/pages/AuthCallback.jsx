import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { backendJson } from '../backendApi'

export default function AuthCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [msg, setMsg] = useState('Signing you in...')

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
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        const user = data.session.user
        const providers = (user?.identities || []).map((i) => i.provider)
        const hasGoogle = providers.includes('google')
        const hasEmail = providers.includes('email')

        // Enforce auth policies server-side (duplicate emails, mixed providers, OAuth-login gating).
        try {
          await backendJson('POST', '/api/auth/policy/enforce', { mode, method })
        } catch (e) {
          setMsg(e?.message || 'Sign-in blocked by policy')
          await supabase.auth.signOut().catch(() => {})
          navigate('/login')
          return
        }

        navigate(nextPath)
      } else {
        navigate('/login')
      }
    }

    void run()
  }, [navigate, nextPath])

  return (
    <div style={{ padding: 24 }}>
      <h1>{msg}</h1>
    </div>
  )
}
