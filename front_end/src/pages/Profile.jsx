import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  MapPin, 
  Calendar, 
  Trophy, 
  TrendingUp, 
  Activity, 
  Clock, 
  Route, 
  Zap,
  User,
  Plus,
  ChevronRight,
  Flag,
  Target
} from 'lucide-react'

import NavBar from '../components/NavBar'
import { backendGet } from '../backendApi'
import Avatar from '../components/Avatar'

import '../styles/Profile.css'
import runners from '../assets/runners.jpg'
import cyclists from '../assets/cyclists.jpg'
import runners2 from '../assets/runners.jpg'

const RouteMap = lazy(() => import('../components/RouteMap'))

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
  if (!Number.isFinite(n)) return '-'
  const km = n / 1000
  return `${km.toFixed(km < 10 ? 2 : 1)}`
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
    return d.toLocaleString(undefined, { month: 'short', day: '2-digit' })
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
  return `${m}:${String(s).padStart(2, '0')}`
}

const SPORT_ICONS = {
  run: '🏃',
  walk: '🚶',
  cycle: '🚴',
  swim: '🏊',
  hike: '🥾',
  yoga: '🧘',
}

export default function Profile() {
  const [me, setMe] = useState(null)
  const [activities, setActivities] = useState([])
  const [last4WeeksCount, setLast4WeeksCount] = useState(0)
  const [totalActivities, setTotalActivities] = useState(0)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [hero, setHero] = useState(DEFAULT_HERO)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
      setFollowersCount(Number(data?.stats?.followersCount || 0))
      setFollowingCount(Number(data?.stats?.followingCount || 0))

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
        setFollowersCount(Number(res?.stats?.followersCount || 0))
        setFollowingCount(Number(res?.stats?.followingCount || 0))

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
    return name || p?.username || 'Athlete'
  }, [me])

  const recent = activities.slice(0, 3)

  const stats = useMemo(() => {
    const totalDistance = activities.reduce((sum, a) => sum + (Number(a.distanceMeters) || 0), 0)
    const totalDuration = activities.reduce((sum, a) => sum + (Number(a.durationSeconds) || 0), 0)
    return {
      totalDistance,
      totalDuration,
      avgDistance: activities.length ? totalDistance / activities.length : 0
    }
  }, [activities])

  return (
    <div className="profile-page">
      <NavBar />

      <main className="profile-container">
        {error && (
          <div className="profile-error-banner">
            <div className="error-content">
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Hero Section with Bento Grid */}
        <section className="profile-hero">
          <div className="hero-bento">
            {/* Main Large Image */}
            <div className="bento-item bento-main">
              <img src={hero[0]} alt="Activity" />
              <div className="bento-overlay" />
            </div>
            
            {/* Stacked Small Images */}
            <div className="bento-item bento-stack">
              <div className="stack-img">
                <img src={hero[1]} alt="Activity" />
              </div>
              <div className="stack-img">
                <img src={hero[2]} alt="Activity" />
              </div>
            </div>

            {/* Profile Info Card */}
            <div className="bento-item bento-profile">
              <div className="profile-card-content">
                <div className="profile-avatar-large">
                  {me ? (
                    <Avatar avatarUrl={me?.profile?.avatarUrl} seed={me?.profile?.username || me?.user?.id || displayName} alt={displayName} loading="eager" />
                  ) : (
                    <div className="avatar-placeholder">
                      <User size={40} />
                    </div>
                  )}
                  <div className="avatar-status" />
                </div>
                
                <div className="profile-info">
                  <h1>{displayName}</h1>
                  {me?.profile?.username && (
                    <span className="profile-handle">@{me.profile.username}</span>
                  )}
                  
                  <div className="profile-badges">
                    {me?.profile?.level && (
                      <span className="badge badge-level">
                        <Trophy size={12} />
                        Level {me.profile.level}
                      </span>
                    )}
                    <span className="badge badge-public">
                      <Zap size={12} />
                      Public
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bento-item bento-stats">
              <div className="stat-grid">
                <div className="stat-box">
                  <span className="stat-value">{last4WeeksCount}</span>
                  <span className="stat-label">This Month</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{totalActivities}</span>
                  <span className="stat-label">Total</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{followersCount}</span>
                  <span className="stat-label">Followers</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{followingCount}</span>
                  <span className="stat-label">Following</span>
                </div>
                <div className="stat-box highlight">
                  <span className="stat-value">{formatDistance(stats.totalDistance)}</span>
                  <span className="stat-label">Km Total</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="profile-content">
          {/* Left Column */}
          <div className="content-main">
            {/* About Section */}
            <section className="content-card about-card">
              <div className="card-header">
                <div className="header-icon">
                  <User size={20} />
                </div>
                <h2>About</h2>
              </div>
              <div className="card-body">
                {me?.profile?.bio ? (
                  <p className="bio-text">{me.profile.bio}</p>
                ) : (
                  <div className="empty-state">
                    <p>No bio yet.</p>
                    <button className="text-link">Add one</button>
                  </div>
                )}
                
                {me?.profile?.location && (
                  <div className="profile-meta-item">
                    <MapPin size={16} />
                    <span>{me.profile.location}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Recent Workouts */}
            <section className="content-card workouts-card">
              <div className="card-header">
                <div className="header-icon">
                  <Activity size={20} />
                </div>
                <h2>Recent Workouts</h2>
                <Link to="/activities/new" className="btn-add">
                  <Plus size={18} />
                  <span>Log Activity</span>
                </Link>
              </div>
              
              <div className="card-body">
                {loading && !recent.length ? (
                  <div className="loading-state">
                    <div className="spinner" />
                    <span>Loading activities...</span>
                  </div>
                ) : (
                  <div className="workouts-list">
                    {recent.map((activity, index) => (
                      <article 
                        key={activity.id} 
                        className="workout-item"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="workout-main">
                          <div className="workout-sport">
                            <span className="sport-emoji">
                              {SPORT_ICONS[activity.sport] || '🏃'}
                            </span>
                          </div>
                          
                          <div className="workout-details">
                            <div className="workout-header">
                              <h3>
                                <Link to={`/activities/${activity.id}`}>
                                  {activity.title || `${activity.sport} activity`}
                                </Link>
                              </h3>
                              <span className="workout-date">
                                {formatWhen(activity.startedAt)}
                              </span>
                            </div>
                            
                            <div className="workout-metrics">
                              <div className="metric">
                                <Route size={14} />
                                <span>{formatDistance(activity.distanceMeters)} km</span>
                              </div>
                              <div className="metric">
                                <Clock size={14} />
                                <span>{formatDuration(activity.durationSeconds)}</span>
                              </div>
                              <div className="metric">
                                <TrendingUp size={14} />
                                <span>{pacePerKm(activity.distanceMeters, activity.durationSeconds)} /km</span>
                              </div>
                            </div>
                          </div>
                          
                          <ChevronRight size={20} className="workout-arrow" />
                        </div>

                        {activity.routePolyline && (
                          <div className="workout-map">
                            <Suspense fallback={<div className="map-fallback">Loading map...</div>}>
                              <RouteMap polyline={activity.routePolyline} height={180} />
                            </Suspense>
                          </div>
                        )}
                        
                        {activity.description && (
                          <p className="workout-description">{activity.description}</p>
                        )}
                      </article>
                    ))}
                    
                    {!loading && !recent.length && (
                      <div className="empty-state large">
                        <div className="empty-illustration">
                          <Activity size={48} />
                        </div>
                        <h3>No workouts yet</h3>
                        <p>Start tracking your fitness journey today</p>
                        <Link to="/activities/new" className="btn-primary">
                          Log Your First Activity
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                
                {recent.length > 0 && (
                  <Link to="/activities" className="view-all-link">
                    View all activities
                    <ChevronRight size={16} />
                  </Link>
                )}
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="content-sidebar">
            {/* Weekly Goal Card */}
            <div className="sidebar-card goal-card">
              <div className="goal-header">
                <Target size={20} />
                <h3>Weekly Goal</h3>
              </div>
              <div className="goal-progress">
                <div className="progress-ring">
                  <svg viewBox="0 0 36 36">
                    <path
                      className="progress-bg"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="progress-fill"
                      strokeDasharray={`${Math.min((last4WeeksCount / 4) * 100, 100)}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="progress-text">
                    <span className="progress-value">{last4WeeksCount}</span>
                    <span className="progress-label">activities</span>
                  </div>
                </div>
                <p className="goal-subtitle">Keep it up! You're doing great.</p>
              </div>
            </div>

            {/* Monthly Stats */}
            <div className="sidebar-card mini-stats">
              <h3>This Month</h3>
              <div className="mini-stat-list">
                <div className="mini-stat">
                  <div className="mini-stat-icon">
                    <Route size={16} />
                  </div>
                  <div className="mini-stat-info">
                    <span className="mini-value">{formatDistance(stats.totalDistance)} km</span>
                    <span className="mini-label">Distance</span>
                  </div>
                </div>
                <div className="mini-stat">
                  <div className="mini-stat-icon">
                    <Clock size={16} />
                  </div>
                  <div className="mini-stat-info">
                    <span className="mini-value">{formatDuration(stats.totalDuration)}</span>
                    <span className="mini-label">Duration</span>
                  </div>
                </div>
                <div className="mini-stat">
                  <div className="mini-stat-icon">
                    <Flag size={16} />
                  </div>
                  <div className="mini-stat-info">
                    <span className="mini-value">{activities.length > 0 ? formatDistance(stats.avgDistance) : '0'} km</span>
                    <span className="mini-label">Avg Distance</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
