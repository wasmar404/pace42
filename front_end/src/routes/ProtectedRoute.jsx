import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { supabase } from '../supabaseClient'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setHasSession(Boolean(data.session))
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
