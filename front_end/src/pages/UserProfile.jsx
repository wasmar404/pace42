import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  Activity, 
  Clock, 
  Route, 
  Zap,
  User,
  Users,
  Target,
  ChevronRight,
  ChevronUp,
  Share2,
  MoreHorizontal,
  Loader2,
  UserPlus,
  Globe,
  Lock
} from 'lucide-react'

import NavBar from '../components/NavBar'
import { followUser, getUserSummary, unfollowUser } from '../api/users'
import Avatar from '../components/Avatar'
import { useUnitsValue } from '../preferences'
import { formatDistance, formatDuration, formatPaceOrSpeed } from '../utils/format'

import runners from '../assets/runners.jpg'
import cyclists from '../assets/cyclists.jpg'
import runners2 from '../assets/runners.jpg'

import '../styles/UserProfile.css'

const RouteMap = lazy(() => import('../components/RouteMap'))

const DEFAULT_HERO = [runners, cyclists, runners2]
const CACHE_MAX_AGE_MS = 2 * 60 * 1000

const SPORT_ICONS = {
  run: '🏃',
  walk: '🚶',
  cycle: '🚴',
  swim: '🏊',
  hike: '🥾',
  yoga: '🧘',
}

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


function formatWhen(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString(undefined, { month: 'short', day: '2-digit' })
  } catch {
    return '-'
  }
}

// format helpers live in ../utils/format

function displayName(profile, user) {
  const first = (profile?.firstName || '').trim()
  const last = (profile?.lastName || '').trim()
  const n = `${first} ${last}`.trim()
  return n || user?.username || 'Athlete'
}

export default function UserProfile() {
  const { id } = useParams()
  const units = useUnitsValue()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hero, setHero] = useState(DEFAULT_HERO)

  useEffect(() => {
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


  return (
    <div className="user-profile-page">
      <NavBar />

      <main className="profile-container">
        {/* Back Navigation */}
        <div className="back-nav">
          <Link to="/search" className="back-link">
            <ArrowLeft size={18} />
            <span>Back to search</span>
          </Link>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="profile-error-banner">
            <div className="error-content">
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <section className="user-profile-card">
          <div className="profile-card-header">
            <div className="profile-avatar-large">
              <Avatar 
                avatarUrl={data?.profile?.avatarUrl} 
                seed={data?.user?.username || data?.user?.id || name} 
                alt={name}
                loading="eager" 
              />
              <div className={`avatar-status ${data?.relationship?.isFollowing ? 'following' : ''}`} />
            </div>
            
            <div className="profile-actions">
              {!data?.relationship?.isSelf ? (
                <button 
                  className={`btn-follow ${data?.relationship?.isFollowing ? 'following' : ''}`}
                  onClick={onToggleFollow}
                  disabled={busy || loading}
                >
                  {busy ? (
                    <Loader2 size={18} className="spin" />
                  ) : data?.relationship?.isFollowing ? (
                    <>
                      <Users size={16} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="self-badge">
                  <User size={14} />
                  You
                </span>
              )}
              <button className="btn-icon">
                <Share2 size={18} />
              </button>
              <button className="btn-icon">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>

          <div className="profile-info">
            <h1>{name}</h1>
            {data?.user?.username && (
              <span className="profile-handle">@{data.user.username}</span>
            )}
            
            <div className="profile-badges">
              {data?.relationship?.isFollowing ? (
                <span className="badge badge-following">
                  <Zap size={12} />
                  Following
                </span>
              ) : (
                <span className="badge badge-public">
                  <Globe size={12} />
                  Public
                </span>
              )}
              {stats?.lastActivityAt && (
                <span className="badge badge-recent">
                  <Activity size={12} />
                  Active
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="user-stats-grid">
          <div className="stat-box">
            <div className="stat-icon">
              <Users size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{Number(stats.followersCount || 0)}</span>
              <span className="stat-label">Followers</span>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">
              <User size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{Number(stats.followingCount || 0)}</span>
              <span className="stat-label">Following</span>
            </div>
          </div>
          <div className="stat-box highlight">
            <div className="stat-icon">
              <Activity size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{Number(stats.totalActivities || 0)}</span>
              <span className="stat-label">Activities</span>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">
              <Calendar size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{Number(stats.last4WeeksCount || 0)}</span>
              <span className="stat-label">This Month</span>
            </div>
          </div>
          <div className="stat-box highlight-orange">
            <div className="stat-icon">
              <Route size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{formatDistance(stats.totalDistanceMeters || 0, units)}</span>
              <span className="stat-label">Total distance</span>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">
              <Clock size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{formatDuration(stats.totalDurationSeconds || 0)}</span>
              <span className="stat-label">Total Time</span>
            </div>
          </div>
        </section>

        {/* Hero Images */}
        <section className="profile-hero">
          <div className="hero-bento">
            <div className="bento-item bento-main">
              <img src={hero[0]} alt="Activity" />
              <div className="bento-overlay" />
            </div>

            <div className="bento-item bento-stack">
              <div className="stack-img">
                <img src={hero[1]} alt="Activity" />
              </div>
              <div className="stack-img">
                <img src={hero[2]} alt="Activity" />
              </div>
            </div>
          </div>

          {/* Privacy notice removed per UX preference */}
        </section>

        {/* Main Content */}
        <div className="profile-content">
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
                {data?.profile?.bio ? (
                  <p className="bio-text">{data.profile.bio}</p>
                ) : (
                  <div className="empty-state">
                    <p>No bio yet.</p>
                  </div>
                )}
                
                {data?.profile?.location && (
                  <div className="profile-meta-item">
                    <MapPin size={16} />
                    <span>{data.profile.location}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Recent Workouts */}
            <section className="content-card workouts-card">
              <div className="card-header">
                <div className="header-icon">
                  <TrendingUp size={20} />
                </div>
                <h2>Recent Workouts</h2>
                <span className="activities-count">{activities.length} activities</span>
              </div>
              
              <div className="card-body">
                {loading && !activities.length ? (
                  <div className="loading-state">
                    <div className="spinner" />
                    <span>Loading activities...</span>
                  </div>
                ) : (
                  <div className="workouts-list">
                    {activities.map((activity, index) => (
                      <article 
                        key={activity.id} 
                        className="workout-item"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <Link to={`/activities/${activity.id}`} className="workout-link">
                          <div className="workout-main">
                            <div className="workout-sport">
                              <span className="sport-emoji">
                                {SPORT_ICONS[activity.sport] || '🏃'}
                              </span>
                            </div>
                            
                            <div className="workout-details">
                              <div className="workout-header">
                                <h3>{activity.title || `${activity.sport} activity`}</h3>
                                <span className="workout-date">{formatWhen(activity.startedAt)}</span>
                              </div>
                              
                              <div className="workout-metrics">
                                <div className="metric">
                                  <Route size={14} />
                                  <span>{formatDistance(activity.distanceMeters, units)}</span>
                                </div>
                                <div className="metric">
                                  <Clock size={14} />
                                  <span>{formatDuration(activity.durationSeconds)}</span>
                                </div>
                                <div className="metric">
                                  <TrendingUp size={14} />
                                  <span>{formatPaceOrSpeed(activity.sport, activity.distanceMeters, activity.durationSeconds, units)}</span>
                                </div>
                              </div>
                            </div>
                            
                            <ChevronRight size={20} className="workout-arrow" />
                          </div>
                        </Link>

                        {activity.routePolyline ? (
                          <div className="workout-map">
                            <Suspense
                              fallback={
                                <div className="map-loading">
                                  <div className="spinner small" />
                                  <span>Loading map...</span>
                                </div>
                              }
                            >
                              <RouteMap polyline={activity.routePolyline} height={200} />
                            </Suspense>
                          </div>
                        ) : null}
                      </article>
                    ))}
                    
                    {!loading && !activities.length && (
                      <div className="empty-state large">
                        <div className="empty-illustration">
                          <Activity size={48} />
                        </div>
                        <h3>No visible activities</h3>
                        <p>This user hasn't shared any activities yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="content-sidebar">
            {/* Monthly Progress */}
            <div className="sidebar-card progress-card">
              <div className="sidebar-header">
                <Target size={20} />
                <h3>Monthly Activity</h3>
              </div>
              <div className="progress-content">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${Math.min((stats.last4WeeksCount / 10) * 100, 100)}%` }}
                  />
                </div>
                <div className="progress-stats">
                  <span className="progress-current">{stats.last4WeeksCount || 0}</span>
                  <span className="progress-target">/ 10 activities</span>
                </div>
                <p className="progress-subtitle">
                  {stats.last4WeeksCount >= 10 
                    ? '🎉 Goal reached! Amazing work!' 
                    : 'Keep going! You\'re doing great.'}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="sidebar-card mini-stats">
              <h3>Performance</h3>
              <div className="mini-stat-list">
                <div className="mini-stat">
                  <div className="mini-stat-icon">
                    <Route size={16} />
                  </div>
                  <div className="mini-stat-info">
                    <span className="mini-value">{formatDistance(stats.totalDistanceMeters || 0, units)}</span>
                    <span className="mini-label">Total Distance</span>
                  </div>
                </div>
                <div className="mini-stat">
                  <div className="mini-stat-icon">
                    <Clock size={16} />
                  </div>
                  <div className="mini-stat-info">
                    <span className="mini-value">{formatDuration(stats.totalDurationSeconds || 0)}</span>
                    <span className="mini-label">Total Time</span>
                  </div>
                </div>
                <div className="mini-stat">
                  <div className="mini-stat-icon">
                    <Zap size={16} />
                  </div>
                  <div className="mini-stat-info">
                    <span className="mini-value">
                      {activities.length > 0
                        ? formatDistance((stats.totalDistanceMeters || 0) / activities.length, units)
                        : formatDistance(0, units)}
                    </span>
                    <span className="mini-label">Avg per activity</span>
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
