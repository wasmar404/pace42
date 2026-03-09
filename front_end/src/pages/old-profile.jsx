import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import NavBar from '../components/NavBar'
import RouteMap from '../components/RouteMap'
import { backendGet } from '../backendApi'

import '../styles/Profile.css'
import runners from '../assets/runners.jpg'
import cyclists from '../assets/cyclists.jpg'
import runners2 from '../assets/runners.jpg'

const DEFAULT_HERO = [runners, cyclists, runners2]

const PROFILE_CACHE_KEY = 'pace42.meSummary'
const CACHE_MAX_AGE_MS = 2 * 60 * 1000

function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickHero(photos, seedStr) {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : []
  if (!list.length) return DEFAULT_HERO

  // Deterministic shuffle (stable per user/day) so it doesn't flicker.
  let x = hash32(seedStr || 'pace42') || 123456789
  const rand = () => {
    // xorshift32
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }

  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }

  const picked = copy.slice(0, 3)
  while (picked.length < 3) picked.push(DEFAULT_HERO[picked.length])
  return picked
}

function formatDistance(meters) {
  const n = Number(meters)
  if (!Number.isFinite(n)) return '-'
  const km = n / 1000
  return `${km.toFixed(km < 10 ? 2 : 1)} km`
}

function formatDuration(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n)) return '-'
  const s = Math.max(0, Math.round(n))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${r}s`
  return `${r}s`
}

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
  } catch {
    return '-'
  }
}

function pacePerKm(distanceMeters, durationSeconds) {
  const dist = Number(distanceMeters)
  const dur = Number(durationSeconds)
  if (!Number.isFinite(dist) || !Number.isFinite(dur) || dist <= 0) return '-'
  const secPerKm = dur / (dist / 1000)
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export default function Profile() {
  const [me, setMe] = useState(null)
  const [activities, setActivities] = useState([])
  const [last4WeeksCount, setLast4WeeksCount] = useState(0)
  const [totalActivities, setTotalActivities] = useState(0)
  const [hero, setHero] = useState(DEFAULT_HERO)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Instant paint: hydrate from last known profile summary.
    try {
      const raw = localStorage.getItem(PROFILE_CACHE_KEY)
      if (!raw) return
      const cached = JSON.parse(raw)
      const cachedAt = Number(cached?.cachedAt || 0)
      if (!cachedAt || Date.now() - cachedAt > CACHE_MAX_AGE_MS) return

      const data = cached?.data
      setMe({ user: data?.user, profile: data?.profile })
      setActivities(data?.recentActivities || [])
      setLast4WeeksCount(Number(data?.stats?.last4WeeksCount || 0))
      setTotalActivities(Number(data?.stats?.totalActivities || 0))

      const day = new Date().toISOString().slice(0, 10)
      const seed = `${data?.user?.id || ''}:${day}`
      setHero(pickHero(data?.recentPhotos, seed))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setError('')
      setLoading(true)
      try {
        const res = await backendGet('/api/me/summary')
        if (cancelled) return
        setMe({ user: res?.user, profile: res?.profile })
        setActivities(res?.recentActivities || [])
        setLast4WeeksCount(Number(res?.stats?.last4WeeksCount || 0))
        setTotalActivities(Number(res?.stats?.totalActivities || 0))

        const day = new Date().toISOString().slice(0, 10)
        const seed = `${res?.user?.id || ''}:${day}`
        setHero(pickHero(res?.recentPhotos, seed))

        try {
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: res }))
        } catch {
          // ignore
        }
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = useMemo(() => {
    const p = me?.profile
    const first = p?.firstName || ''
    const last = p?.lastName || ''
    const name = `${first} ${last}`.trim()
    return name || p?.username || 'Your Profile'
  }, [me])

  const recent = activities.slice(0, 2)

  return (
    <div className="profile-page">
      <NavBar />

      <div className="profile-wrap">
        {error ? <div className="activity-error">{error}</div> : null}

        <section className="profile-hero">
          <div className="profile-grid">
            <div><img src={hero[0]} alt="" /></div>
            <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 2 }}>
              <div><img src={hero[1]} alt="" /></div>
              <div><img src={hero[2]} alt="" /></div>
            </div>
          </div>

          <div className="profile-id">
            <div className="profile-avatar">
              {me?.profile?.avatarUrl ? <img src={me.profile.avatarUrl} alt="Profile" /> : null}
            </div>

            <div>
              <h1 className="profile-name">{displayName}</h1>
              <div className="profile-meta">
                {me?.profile?.username ? <span className="profile-chip accent">@{me.profile.username}</span> : null}
                <span className="profile-chip">Last 4 weeks: {last4WeeksCount} activities</span>
                <span className="profile-chip">Total: {totalActivities}</span>
                {me?.profile?.level ? <span className="profile-chip">Level: {me.profile.level}</span> : null}
              </div>
            </div>
          </div>
        </section>

        <div className="profile-body">
          <section className="panel">
            <div className="panel-head">
              <h2>About</h2>
            </div>
            <div className="panel-body">
              <p className="bio">
                {me?.profile?.bio ? me.profile.bio : 'No bio yet. Add one later.'}
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Recent Workouts</h2>
              <Link className="activity-back" to="/activities/new">+ add</Link>
            </div>
            <div className="panel-body">
              <div className="workouts">
                {loading && !recent.length ? <div className="activity-empty">Loading workouts...</div> : null}
                {recent.map((a) => (
                  <article className="workout-card" key={a.id}>
                    <div className="workout-top">
                      <div>
                        <h3 className="workout-title">
                          <Link to={`/activities/${a.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {a.title || `${a.sport} · ${formatDistance(a.distanceMeters)}`}
                          </Link>
                        </h3>
                        <div className="workout-sub">
                          <span className="profile-chip">{formatWhen(a.startedAt)}</span>
                          <span className="profile-chip">{a.visibility}</span>
                          <span className="profile-chip">{a.source}</span>
                        </div>
                      </div>
                    </div>

                    <div className="workout-stats">
                      <div className="mini">
                        <div className="mini-k">DIST</div>
                        <div className="mini-v">{formatDistance(a.distanceMeters)}</div>
                      </div>
                      <div className="mini">
                        <div className="mini-k">TIME</div>
                        <div className="mini-v">{formatDuration(a.durationSeconds)}</div>
                      </div>
                      <div className="mini">
                        <div className="mini-k">PACE</div>
                        <div className="mini-v">{pacePerKm(a.distanceMeters, a.durationSeconds)}</div>
                      </div>
                    </div>

                    {a.routePolyline ? (
                      <div style={{ padding: '0 14px 14px' }}>
                        <RouteMap polyline={a.routePolyline} height={210} />
                      </div>
                    ) : null}

                    {a.description ? <div className="workout-desc">{a.description}</div> : null}
                  </article>
                ))}

                {!loading && !recent.length ? (
                  <div className="activity-empty">No workouts yet. Add your first activity.</div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
