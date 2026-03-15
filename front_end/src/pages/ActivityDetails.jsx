import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import NavBar from '../components/NavBar'
import { getActivity } from '../api/activities'
import { useUnitsValue } from '../preferences'
import { formatDistance, formatDuration, formatPaceOrSpeed } from '../utils/format'
import '../styles/ActivityDetails.css'

const CACHE_MAX_AGE_MS = 2 * 60 * 1000

function formatSport(sport) {
  if (!sport) return 'Activity'
  return sport.charAt(0).toUpperCase() + sport.slice(1)
}

function formatVisibility(v) {
  if (v === 'public') return 'Everyone'
  if (v === 'followers') return 'Followers'
  if (v === 'only_me') return 'Only me'
  return v
}

// format helpers live in ../utils/format

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '-'
  }
}

export default function ActivityDetails() {
  const { id } = useParams()
  const units = useUnitsValue()
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Instant paint: show cached activity while we refresh.
    try {
      const raw = localStorage.getItem(`pace42.activity.${id}`)
      if (!raw) return
      const cached = JSON.parse(raw)
      const cachedAt = Number(cached?.cachedAt || 0)
      const data = cached?.data
      if (!cachedAt || Date.now() - cachedAt > CACHE_MAX_AGE_MS) return
      if (data?.id === id) setActivity(data)
    } catch {
      // ignore
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const res = await getActivity(id)
        if (cancelled) return
        setActivity(res.activity)

        try {
          localStorage.setItem(`pace42.activity.${id}`, JSON.stringify({ cachedAt: Date.now(), data: res.activity }))
        } catch {
          // ignore
        }
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load activity')

        // If the server says it's gone, don't keep showing stale cache.
        if ((e?.message || '').toLowerCase().includes('not found')) {
          try {
            localStorage.removeItem(`pace42.activity.${id}`)
          } catch {
            // ignore
          }
          setActivity(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id])

  const title = useMemo(() => {
    if (!activity) return 'Activity'
    return activity.title || `${formatSport(activity.sport)} · ${formatDistance(activity.distanceMeters, units)}`
  }, [activity, units])

  return (
    <div className="activity-page">
      <NavBar />

      <div className="activity-wrap">
        <div className="activity-top">
          <Link className="activity-back" to="/activities/new">← New activity</Link>
        </div>

        {error ? <div className="activity-error">{error}</div> : null}

        <div className="activity-card">
          <div className="activity-card-head">
            <h1 className="activity-title">{title}</h1>
            <div className="activity-sub">
              <span className="pill accent">{formatSport(activity?.sport)}</span>
              <span className="pill">{formatWhen(activity?.startedAt)}</span>
              <span className="pill">{formatVisibility(activity?.visibility)}</span>
              <span className="pill">{activity?.source || '-'}</span>
            </div>
          </div>

          <div className="activity-body">
            {loading ? <div className="activity-empty">Loading...</div> : null}

            {activity ? (
              <>
                <div className="stat-grid">
                    <div className="stat">
                      <div className="stat-k">DISTANCE</div>
                      <div className="stat-v">{formatDistance(activity.distanceMeters, units)}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-k">DURATION</div>
                      <div className="stat-v">{formatDuration(activity.durationSeconds)}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-k">PACE/SPEED</div>
                      <div className="stat-v">{formatPaceOrSpeed(activity.sport, activity.distanceMeters, activity.durationSeconds, units)}</div>
                    </div>
                  </div>

                {activity.description ? (
                  <div className="activity-desc">{activity.description}</div>
                ) : (
                  <div className="activity-empty">No description yet.</div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
