import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { supabase } from '../supabaseClient'
import { readSupabaseAccessTokenSync } from '../utils/avatarCache'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [needsMfa, setNeedsMfa] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function computeMfaRequirement() {
      try {
        const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors()
        if (fErr) return false
        const totp = factors?.totp || []
        const hasVerified = totp.some((f) => f.status === 'verified')
        if (!hasVerified) return false

        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        return aal?.currentLevel !== 'aal2'
      } catch {
        return false
      }
    }

    async function run() {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        setHasSession(Boolean(data.session))

        if (data.session) {
          const require = await computeMfaRequirement()
          if (cancelled) return
          setNeedsMfa(Boolean(require))
        } else {
          setNeedsMfa(false)
        }
      } catch {
        // If Supabase auth endpoints are temporarily unreachable, fall back to
        // the persisted token (lets the app keep working).
        const token = readSupabaseAccessTokenSync()
        setHasSession(Boolean(token))
        setNeedsMfa(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setHasSession(Boolean(session))
      if (session) {
        void computeMfaRequirement().then((require) => setNeedsMfa(Boolean(require))).catch(() => setNeedsMfa(false))
      } else {
        setNeedsMfa(false)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe()
    }
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (needsMfa && location.pathname !== '/mfa') {
    return <Navigate to={`/mfa?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  return children
}
