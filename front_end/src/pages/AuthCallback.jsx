import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AuthCallback() {
  const navigate = useNavigate()
  const location = useLocation()

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const next = params.get('next')
    if (!next) return '/personal-info'
    if (!next.startsWith('/')) return '/personal-info'
    if (next.startsWith('//')) return '/personal-info'
    return next
  }, [location.search])

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        navigate(nextPath)
      } else {
        navigate('/login')
      }
    }

    void run()
  }, [navigate, nextPath])

  return (
    <div style={{ padding: 24 }}>
      <h1>Signing you in...</h1>
    </div>
  )
}
