import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import NavBar from '../components/NavBar'
import { followUser, getUserSummary, unfollowUser } from '../api/users'
import Avatar from '../components/Avatar'

import runners from '../assets/runners.jpg'
import cyclists from '../assets/cyclists.jpg'
import runners2 from '../assets/runners.jpg'

import '../styles/UserProfile.css'

const RouteMap = lazy(() => import('../components/RouteMap'))

const DEFAULT_HERO = [runners, cyclists, runners2]
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

  let x = hash32(seedStr || 'pace42') || 123456789
  const rand = () => {
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
  if (!Number.isFinite(n)) return '0.00'
  const km = n / 1000
  return km.toFixed(km < 10 ? 2 : 1)
}

function formatDuration(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n)) return '0s'
  const s = Math.max(0, Math.round(n))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${r}s`
  return `${r}s`
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

function displayName(profile, user) {
  const first = (profile?.firstName || '').trim()
  const last = (profile?.lastName || '').trim()
  const n = `${first} ${last}`.trim()
  return n || user?.username || 'Athlete'
}

export default function UserProfile() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hero, setHero] = useState(DEFAULT_HERO)
  const [openMaps, setOpenMaps] = useState(() => new Set())

  useEffect(() => {
    // Instant paint from cache.
    try {
      const raw = localStorage.getItem(`pace42.userSummary.${id}`)
      if (!raw) return
      const cached = JSON.parse(raw)
      const cachedAt = Number(cached?.cachedAt || 0)
      if (!cachedAt || Date.now() - cachedAt > CACHE_MAX_AGE_MS) return
      const d = cached?.data
      setData(d)

      const day = new Date().toISOString().slice(0, 10)
      setHero(pickHero(d?.recentPhotos, `${id}:${day}`))
    } catch {
      // ignore
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setError('')
      setLoading(true)
      try {
        const res = await getUserSummary(id)
        if (cancelled) return
        setData(res)

        const day = new Date().toISOString().slice(0, 10)
        setHero(pickHero(res?.recentPhotos, `${id}:${day}`))

        try {
          localStorage.setItem(`pace42.userSummary.${id}`, JSON.stringify({ cachedAt: Date.now(), data: res }))
        } catch {
          // ignore
        }
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load user')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id])

  const name = useMemo(() => displayName(data?.profile, data?.user), [data])

  const stats = data?.stats || {}

  const onToggleFollow = async () => {
    if (!data || data?.relationship?.isSelf) return
    const next = !data?.relationship?.isFollowing
    setBusy(true)
    setError('')
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        relationship: { ...prev.relationship, isFollowing: next },
        stats: {
          ...prev.stats,
          followersCount: Math.max(0, Number(prev.stats?.followersCount || 0) + (next ? 1 : -1)),
        },
      }
    })

    try {
      if (next) await followUser(id)
      else await unfollowUser(id)
    } catch (e) {
      // rollback
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          relationship: { ...prev.relationship, isFollowing: !next },
          stats: {
            ...prev.stats,
            followersCount: Math.max(0, Number(prev.stats?.followersCount || 0) + (next ? -1 : 1)),
          },
        }
      })
      setError(e?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const activities = data?.recentActivities || []

  const toggleMap = (activityId) => {
    setOpenMaps((prev) => {
      const next = new Set(prev)
      if (next.has(activityId)) next.delete(activityId)
      else next.add(activityId)
      return next
    })
  }

  return (
    <div className="user-profile-page">
      <NavBar />

      <main className="user-profile-wrap">
        <div className="user-top">
          <Link to="/search" className="user-back">← Back to search</Link>
        </div>

        {error ? <div className="user-error">{error}</div> : null}

        <section className="user-hero">
          <div className="user-bento">
            <div className="user-bento-main">
              <img src={hero[0]} alt="" />
              <div className="user-bento-overlay" />
            </div>

            <div className="user-bento-stack">
              <div className="stack-img"><img src={hero[1]} alt="" /></div>
              <div className="stack-img"><img src={hero[2]} alt="" /></div>
            </div>

            <div className="user-bento-card">
              <div className="user-card-left">
                <div className="user-avatar">
                  <Avatar avatarUrl={data?.profile?.avatarUrl} seed={data?.user?.username || data?.user?.id || name} alt="" loading="eager" />
                </div>
                <div>
                  <div className="user-name">{name}</div>
                  <div className="user-handle">{data?.user?.username ? `@${data.user.username}` : ''}</div>
                  <div className="user-chips">
                    {data?.profile?.level ? <span className="chip">Level {data.profile.level}</span> : null}
                    {data?.relationship?.isFollowing ? <span className="chip accent">Following</span> : <span className="chip">Public</span>}
                    {stats?.lastActivityAt ? <span className="chip">Last: {new Date(stats.lastActivityAt).toLocaleDateString()}</span> : null}
                  </div>
                </div>
              </div>

              <div className="user-card-right">
                {!data?.relationship?.isSelf ? (
                  <button className={data?.relationship?.isFollowing ? 'user-follow following' : 'user-follow'} onClick={onToggleFollow} disabled={busy || loading}>
                    {busy ? '...' : data?.relationship?.isFollowing ? 'Following' : 'Follow'}
                  </button>
                ) : (
                  <span className="user-self">This is you</span>
                )}
              </div>
            </div>

            <div className="user-bento-stats">
              <div className="stat">
                <div className="k">Followers</div>
                <div className="v">{Number(stats.followersCount || 0)}</div>
              </div>
              <div className="stat">
                <div className="k">Following</div>
                <div className="v">{Number(stats.followingCount || 0)}</div>
              </div>
              <div className="stat">
                <div className="k">Activities</div>
                <div className="v">{Number(stats.totalActivities || 0)}</div>
              </div>
              <div className="stat">
                <div className="k">Last 4 Weeks</div>
                <div className="v">{Number(stats.last4WeeksCount || 0)}</div>
              </div>
              <div className="stat">
                <div className="k">Total Km</div>
                <div className="v">{formatDistance(stats.totalDistanceMeters || 0)}</div>
              </div>
              <div className="stat">
                <div className="k">Total Time</div>
                <div className="v">{formatDuration(stats.totalDurationSeconds || 0)}</div>
              </div>
            </div>
          </div>

          {!data?.relationship?.isSelf && !data?.relationship?.isFollowing ? (
            <div className="user-note">Follow to see followers-only workouts (if the athlete enabled it).</div>
          ) : null}
        </section>

        <section className="user-section">
          <h2>About</h2>
          <div className="user-about">
            {data?.profile?.bio ? <p>{data.profile.bio}</p> : <p className="muted">No bio yet.</p>}
          </div>
        </section>

        <section className="user-section">
          <h2>Recent Workouts</h2>
          {loading ? <div className="muted">Loading...</div> : null}
          {!loading && !activities.length ? <div className="muted">No visible activities yet.</div> : null}

          <div className="user-workouts">
            {activities.map((a) => (
              <Link to={`/activities/${a.id}`} className="user-workout" key={a.id}>
                <div className="user-workout-head">
                  <div className="title">{a.title || a.sport}</div>
                  <div className="sub">{new Date(a.startedAt).toLocaleDateString()}</div>
                </div>

                <div className="user-workout-metrics">
                  <span>{formatDistance(a.distanceMeters)} km</span>
                  <span>·</span>
                  <span>{formatDuration(a.durationSeconds)}</span>
                  <span>·</span>
                  <span>{pacePerKm(a.distanceMeters, a.durationSeconds)}</span>
                </div>

                {a.routePolyline ? (
                  <div className="map-wrap" onClick={(e) => e.preventDefault()}>
                    <button type="button" className="map-toggle" onClick={() => toggleMap(a.id)}>
                      {openMaps.has(a.id) ? 'Hide map' : 'Show map'}
                    </button>
                    {openMaps.has(a.id) ? (
                      <div className="map">
                        <Suspense fallback={<div className="map placeholder">Loading map...</div>}>
                          <RouteMap polyline={a.routePolyline} height={210} />
                        </Suspense>
                      </div>
                    ) : (
                      <div className="map placeholder">Route available</div>
                    )}
                  </div>
                ) : (
                  <div className="map placeholder">No route</div>
                )}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
