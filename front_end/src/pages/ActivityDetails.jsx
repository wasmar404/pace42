import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import NavBar from '../components/NavBar'
import Pill from '../components/ui/Pill'
import TimeText from '../components/ui/TimeText'
import { getActivity } from '../api/activities'
import { useUnitsValue } from '../preferences'
import { formatDistance, formatDuration, formatPaceOrSpeed } from '../utils/format'
import '../styles/ActivityDetails.css'

const RouteMap = lazy(() => import('../components/RouteMap'))

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

// Sport emoji accent for the decorative background glyph
function sportAccent(sport) {
  if (!sport) return '◎'
  const s = sport.toLowerCase()
  if (s === 'run' || s === 'running') return 'RUN'
  if (s === 'ride' || s === 'cycling' || s === 'bike') return 'RIDE'
  if (s === 'swim' || s === 'swimming') return 'SWIM'
  if (s === 'hike' || s === 'hiking') return 'HIKE'
  if (s === 'walk' || s === 'walking') return 'WALK'
  return formatSport(sport).toUpperCase().slice(0, 4)
}

export default function ActivityDetails() {
  const { id } = useParams()
  const units = useUnitsValue()
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
        const res = await getActivity(id, { includeRoute: true })
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
        if ((e?.message || '').toLowerCase().includes('not found')) {
          try { localStorage.removeItem(`pace42.activity.${id}`) } catch { /* ignore */ }
          setActivity(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [id])

  const title = useMemo(() => {
    if (!activity) return 'Activity'
    return activity.title || `${formatSport(activity.sport)} · ${formatDistance(activity.distanceMeters, units)}`
  }, [activity, units])

  return (
    <div className="activity-page">
      <NavBar />

      <div className="activity-wrap">

        {/* ── top nav ── */}
        <div className="activity-top">
          <Link className="activity-back" to="/activities/new">
            New activity
          </Link>
        </div>

        {error ? <div className="activity-error">{error}</div> : null}

        {/* ══ HERO HEADER ══ */}
        <div className="activity-hero">
          {/* big decorative sport word in the background */}
          <div className="activity-hero-accent" aria-hidden="true">
            {sportAccent(activity?.sport)}
          </div>

          {/* sport tag */}
          <div className="activity-sport-tag">
            {formatSport(activity?.sport)}
          </div>

          {/* title */}
          <h1 className="activity-title">{title}</h1>

          {/* meta pills */}
          <div className="activity-meta-row">
            <Pill>
              <TimeText iso={activity?.startedAt} variant="datetime-long" />
            </Pill>
            <Pill>{formatVisibility(activity?.visibility)}</Pill>
            {activity?.source ? <Pill>{activity.source}</Pill> : null}
          </div>
        </div>

        {/* thin ember divider */}
        <div className="activity-divider" />

        {/* ══ BODY CARD ══ */}
        <div className="activity-card">
          <div className="activity-body">

            {loading && !activity ? (
              <div className="activity-empty">Loading…</div>
            ) : null}

            {activity ? (
              <>
                {/* ── stats ── */}
                <div className="stat-grid">
                  <div className="stat">
                    <div className="stat-k">Distance</div>
                    <div className="stat-v">{formatDistance(activity.distanceMeters, units)}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-k">Duration</div>
                    <div className="stat-v">{formatDuration(activity.durationSeconds)}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-k">Pace / Speed</div>
                    <div className="stat-v">
                      {formatPaceOrSpeed(activity.sport, activity.distanceMeters, activity.durationSeconds, units)}
                    </div>
                  </div>
                </div>

                {/* ── map ── */}
                {activity?.routePolyline ? (
                  <div className="activity-map">
                    <Suspense fallback={<div className="activity-empty">Loading map…</div>}>
                      <RouteMap polyline={activity.routePolyline} height={280} variant="clean" />
                    </Suspense>
                  </div>
                ) : activity?.mapImageUrl ? (
                  <div className="activity-map">
                    <img
                      className="activity-map-img"
                      src={activity.mapImageUrl}
                      alt="Route map"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                {/* ── description ── */}
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