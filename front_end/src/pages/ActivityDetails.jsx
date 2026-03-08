import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import NavBar from '../components/NavBar'
import { getActivity } from '../api/activities'

export default function ActivityDetails() {
  const { id } = useParams()
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await getActivity(id)
        if (cancelled) return
        setActivity(res.activity)
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load activity')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
        <Link to="/activities/new">Back</Link>
        {error ? <p>{error}</p> : null}
        {activity ? (
          <pre style={{ background: 'white', padding: 16, borderRadius: 14, overflow: 'auto' }}>
            {JSON.stringify(activity, null, 2)}
          </pre>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  )
}
