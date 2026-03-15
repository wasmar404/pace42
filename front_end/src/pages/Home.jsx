import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Calendar,
  ChevronRight,
  Heart,
  MessageCircle,
  Mountain,
  Target,
  Users,
  X,
} from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import { backendGet } from '../backendApi'
import { followUser } from '../api/users'
import { getGoals, getHomeFeed, getRecommendedUsers } from '../api/home'
import { addComment, getComments, giveKudos, listKudos, removeKudos } from '../api/activities'

import '../styles/Home.css'

const RouteMap = lazy(() => import('../components/RouteMap'))

function fmtWhen(iso) {
  try {
    const t = Date.parse(iso)
    if (!Number.isFinite(t)) return ''
    const d = new Date(t)
    return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
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
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function paceOrSpeed(sport, distanceMeters, durationSeconds) {
  const dist = Number(distanceMeters)
  const dur = Number(durationSeconds)
  if (!Number.isFinite(dist) || !Number.isFinite(dur) || dist <= 0 || dur <= 0) return '-'
  const km = dist / 1000
  const hours = dur / 3600

  if (String(sport).toLowerCase() === 'ride' || String(sport).toLowerCase() === 'cycle') {
    const kph = km / hours
    return `${kph.toFixed(1)} km/h`
  }

  const secPerKm = dur / km
  const mm = Math.floor(secPerKm / 60)
  const ss = Math.round(secPerKm % 60)
  return `${mm}:${String(ss).padStart(2, '0')} /km`
}

function sportLabel(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'run') return 'Run'
  if (v === 'walk') return 'Walk'
  if (v === 'ride' || v === 'cycle') return 'Ride'
  if (!v) return 'Activity'
  return v.slice(0, 1).toUpperCase() + v.slice(1)
}

function FeedSkeleton() {
  return (
    <div className="feed-skel">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="feed-card sk" style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
  )
}

function AnnouncementCard({ item }) {
  return (
    <article className="feed-card ann">
      <div className="ann-top">
        <div className="ann-badge">
          <span className="dot" />
          Club
        </div>
        <div className="ann-club">
          <span className="icon" aria-hidden="true">{item?.club?.icon || '🏁'}</span>
          <span>{item?.club?.name || 'Club'}</span>
        </div>
      </div>
      <h3 className="ann-title">{item?.title || 'Announcement'}</h3>
      <p className="ann-body">{item?.body || ''}</p>
    </article>
  )
}

function ActivityCard({ item, meId, onOpenSocial, onSocialUpdate }) {
  const a = item?.activity
  const athlete = item?.athlete
  const mine = athlete?.id && meId && athlete.id === meId

  const social = item?.social || {}
  const kudosOn = Boolean(social.viewerHasKudo)
  const kudosCount = Number(social.kudosCount || 0)
  const commentCount = Number(social.commentCount || 0)
  const [kudosBusy, setKudosBusy] = useState(false)

  const title = a?.title || `${sportLabel(a?.sport)} activity`

  const onKudos = async () => {
    if (!a?.id || kudosBusy) return
    const next = !kudosOn

    onSocialUpdate(a.id, {
      viewerHasKudo: next,
      kudosCount: Math.max(0, kudosCount + (next ? 1 : -1)),
    })

    setKudosBusy(true)
    try {
      const res = next ? await giveKudos(a.id) : await removeKudos(a.id)
      onSocialUpdate(a.id, {
        viewerHasKudo: Boolean(res?.viewerHasKudo),
        kudosCount: typeof res?.kudosCount === 'number' ? res.kudosCount : kudosCount,
        commentCount: typeof res?.commentCount === 'number' ? res.commentCount : commentCount,
      })
    } catch {
      // revert
      onSocialUpdate(a.id, {
        viewerHasKudo: kudosOn,
        kudosCount,
      })
    } finally {
      setKudosBusy(false)
    }
  }

  return (
    <article className="feed-card">
      <header className="feed-head">
        <Link to={mine ? '/profile' : `/users/${athlete?.id}`} className="athlete">
          <span className="av">
            <Avatar avatarUrl={athlete?.avatarUrl} seed={athlete?.username || athlete?.id || athlete?.name} alt="" />
          </span>
          <span className="who">
            <span className="name">{athlete?.name || 'Athlete'}</span>
            <span className="act-title">{title}</span>
            <span className="meta">
              <span className="pill">{sportLabel(a?.sport)}</span>
              <span className="time">
                <Calendar size={14} />
                {fmtWhen(a?.startedAt)}
              </span>
            </span>
          </span>
        </Link>

        <Link to={`/activities/${a?.id}`} className="feed-open" aria-label="Open activity">
          <ChevronRight size={18} />
        </Link>
      </header>

      <div className="feed-body">
        {a?.description ? <p className="desc">{a.description}</p> : null}

        <div className="stats">
          <div className="stat">
            <div className="k">Distance</div>
            <div className="v">{formatDistance(a?.distanceMeters)}</div>
          </div>
          <div className="stat">
            <div className="k">Time</div>
            <div className="v">{formatDuration(a?.durationSeconds)}</div>
          </div>
          <div className="stat">
            <div className="k">Pace/Speed</div>
            <div className="v">{paceOrSpeed(a?.sport, a?.distanceMeters, a?.durationSeconds)}</div>
          </div>
        </div>

        <div className="media">
          {a?.routePolyline ? (
            <Suspense fallback={<div className="media-fallback">Loading map...</div>}>
              <RouteMap polyline={a.routePolyline} height={210} variant="clean" />
            </Suspense>
          ) : a?.imageUrl ? (
            <img className="media-img" src={a.imageUrl} alt="Activity" loading="lazy" />
          ) : (
            <div className="media-fallback">
              <Mountain size={18} />
              No map preview
            </div>
          )}
        </div>
      </div>

      <footer className="feed-foot">
        <button className={kudosOn ? 'kudos on' : 'kudos'} type="button" onClick={onKudos} disabled={kudosBusy}>
          <Heart size={16} />
          <span>Kudos</span>
          <span className="count">{kudosCount}</span>
        </button>
        <button className="comment" type="button" onClick={() => onOpenSocial(a?.id, 'comments')}>
          <MessageCircle size={16} />
          Comments
          <span className="count">{commentCount}</span>
        </button>
      </footer>
    </article>
  )
}

function Widget({ icon, title, children }) {
  return (
    <section className="w">
      <header className="w-h">
        <span className="w-i">{icon}</span>
        <h3>{title}</h3>
      </header>
      <div className="w-b">{children}</div>
    </section>
  )
}

function SocialModal({ open, item, tab, onTab, onClose, onSocialUpdate }) {
  const a = item?.activity
  const athlete = item?.athlete
  const activityId = a?.id

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [comments, setComments] = useState([])
  const [kudos, setKudos] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!open || !activityId) return
      setError('')
      setLoading(true)
      try {
        if (tab === 'kudos') {
          const res = await listKudos(activityId)
          if (!cancelled) setKudos(res?.items || [])
        } else {
          const res = await getComments(activityId)
          if (!cancelled) setComments(res?.items || [])
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, activityId, tab])

  const onSend = async () => {
    const body = text.trim()
    if (!activityId || !body || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await addComment(activityId, body)
      setText('')
      onSocialUpdate(activityId, {
        kudosCount: typeof res?.kudosCount === 'number' ? res.kudosCount : item?.social?.kudosCount,
        commentCount: typeof res?.commentCount === 'number' ? res.commentCount : item?.social?.commentCount,
      })
      const list = await getComments(activityId)
      setComments(list?.items || [])
    } catch (e) {
      setError(e?.message || 'Failed to comment')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const kudosCount = Number(item?.social?.kudosCount || 0)
  const commentCount = Number(item?.social?.commentCount || 0)
  const title = a?.title || `${sportLabel(a?.sport)} activity`

  return (
    <div className="social-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="social-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="sm-head">
          <div className="sm-left">
            <div className="sm-av">
              <Avatar avatarUrl={athlete?.avatarUrl} seed={athlete?.username || athlete?.id || athlete?.name} alt="" />
            </div>
            <div className="sm-title">
              <div className="t1">{athlete?.name || 'Athlete'}</div>
              <div className="t2">{title}</div>
            </div>
          </div>
          <button className="sm-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="sm-tabs" role="tablist" aria-label="Social tabs">
          <button className={tab === 'kudos' ? 'sm-tab on' : 'sm-tab'} type="button" onClick={() => onTab('kudos')} role="tab">
            Kudos ({kudosCount})
          </button>
          <button className={tab === 'comments' ? 'sm-tab on' : 'sm-tab'} type="button" onClick={() => onTab('comments')} role="tab">
            Comments ({commentCount})
          </button>
        </div>

        <div className="sm-body">
          {loading ? <div className="sm-hint">Loading...</div> : null}
          {error ? <div className="sm-err">{error}</div> : null}

          {!loading && !error && tab === 'kudos' ? (
            <div className="sm-list">
              {kudos.map((k, idx) => (
                <div key={`${k?.actor?.id || 'k'}-${k?.createdAt || idx}`} className="sm-row">
                  <div className="av">
                    <Avatar avatarUrl={k?.actor?.avatarUrl} seed={k?.actor?.username || k?.actor?.id || k?.actor?.name} alt="" />
                  </div>
                  <div className="main">
                    <div className="who">{k?.actor?.name || 'Athlete'}</div>
                    {k?.actor?.username ? <div className="sub">@{k.actor.username}</div> : null}
                  </div>
                  <div className="time">{fmtWhen(k?.createdAt)}</div>
                </div>
              ))}
              {!kudos.length ? <div className="sm-hint">No kudos yet.</div> : null}
            </div>
          ) : null}

          {!loading && !error && tab === 'comments' ? (
            <div className="sm-list">
              {comments.map((c) => (
                <div key={c.id} className="sm-row">
                  <div className="av">
                    <Avatar avatarUrl={c?.actor?.avatarUrl} seed={c?.actor?.username || c?.actor?.id || c?.actor?.name} alt="" />
                  </div>
                  <div className="main">
                    <div className="who">{c?.actor?.name || 'Athlete'}</div>
                    <div className="txt">{c?.body || ''}</div>
                  </div>
                  <div className="time">{fmtWhen(c?.createdAt)}</div>
                </div>
              ))}
              {!comments.length ? <div className="sm-hint">Be the first to comment.</div> : null}
            </div>
          ) : null}
        </div>

        {tab === 'comments' ? (
          <footer className="sm-compose">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void onSend()
                }
              }}
            />
            <button type="button" onClick={onSend} disabled={!text.trim() || busy}>
              Post
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  )
}

function AthleteSummaryWidget({ me, avatarSeed }) {
  const followers = Number(me?.stats?.followersCount || 0)
  const following = Number(me?.stats?.followingCount || 0)
  const total = Number(me?.stats?.totalActivities || 0)
  const p = me?.profile
  const name = `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || (p?.username ? `@${p.username}` : 'Athlete')
  const email = me?.user?.email || ''

  return (
    <section className="w w-ath">
      <div className="ath-top">
        <div className="ath-av">
          <Avatar avatarUrl={p?.avatarUrl} seed={avatarSeed} alt="" />
        </div>
        <div className="ath-name">{name}</div>
        {email ? <div className="ath-sub">{email}</div> : null}
      </div>

      <div className="ath-stats">
        <div className="s">
          <div className="k">Following</div>
          <div className="v">{following}</div>
        </div>
        <div className="s">
          <div className="k">Followers</div>
          <div className="v">{followers}</div>
        </div>
        <div className="s">
          <div className="k">Activities</div>
          <div className="v">{total}</div>
        </div>
      </div>

      <div className="ath-links">
        <Link to="/profile" className="ath-link">Your profile</Link>
        <Link to="/settings" className="ath-link">Settings</Link>
      </div>
    </section>
  )
}

export default function Home() {
  const [me, setMe] = useState(null)
  const [feed, setFeed] = useState([])
  const [feedSource, setFeedSource] = useState('')
  const [recUsers, setRecUsers] = useState([])
  const [goals, setGoals] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [socialId, setSocialId] = useState('')
  const [socialTab, setSocialTab] = useState('comments')

  const meId = me?.user?.id

  const avatarSeed = useMemo(() => {
    const p = me?.profile
    return p?.username || meId || 'athlete'
  }, [meId, me])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const [meRes, feedRes, recRes, goalsRes] = await Promise.all([
          backendGet('/api/me/summary'),
          getHomeFeed(20),
          getRecommendedUsers(6),
          getGoals(7, 30),
        ])
        if (cancelled) return
        setMe(meRes)
        setFeed(feedRes?.items || [])
        setFeedSource(feedRes?.source || '')
        setRecUsers(recRes?.items || [])
        setGoals(goalsRes)
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load feed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const goalPct = useMemo(() => {
    const d = Number(goals?.distanceMeters || 0)
    const g = Number(goals?.goalDistanceMeters || 0)
    if (!g) return 0
    return Math.max(0, Math.min(100, Math.round((d / g) * 100)))
  }, [goals])

  const onSocialUpdate = (activityId, patch) => {
    setFeed((prev) =>
      (prev || []).map((it) => {
        if (it?.type !== 'activity') return it
        if (it?.id !== activityId) return it
        return {
          ...it,
          social: {
            ...(it.social || {}),
            ...(patch || {}),
          },
        }
      }),
    )
  }

  const onOpenSocial = (activityId, tab) => {
    if (!activityId) return
    setSocialId(String(activityId))
    setSocialTab(tab === 'kudos' ? 'kudos' : 'comments')
  }

  const onCloseSocial = () => {
    setSocialId('')
    setSocialTab('comments')
  }

  const socialItem = useMemo(() => {
    if (!socialId) return null
    return (feed || []).find((it) => it?.type === 'activity' && it?.id === socialId) || null
  }, [socialId, feed])

  const onFollowRec = async (id) => {
    try {
      await followUser(id)
      setRecUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {
      // ignore
    }
  }

  return (
    <div className="home">
      <NavBar />

      <main className="dash">
        <header className="dash-top">
          <div className="dash-spacer" aria-hidden="true" />
        </header>

        {error ? <div className="dash-err">{error}</div> : null}

        <div className="dash-grid">
          <aside className="side side-left" aria-label="Athlete panel">
            <AthleteSummaryWidget me={me} avatarSeed={avatarSeed} />
          </aside>

          <section className="feed" aria-label="Activity feed">
            {loading ? <FeedSkeleton /> : null}

            {!loading ? (
              <div className="feed-list">
                {feed.map((it) =>
                  it?.type === 'announcement' ? (
                    <AnnouncementCard key={it.id} item={it} />
                  ) : (
                    <ActivityCard key={it.id} item={it} meId={meId} onOpenSocial={onOpenSocial} onSocialUpdate={onSocialUpdate} />
                  ),
                )}

                {!feed.length ? (
                  <div className="feed-empty">
                    <div className="icon"><Activity size={22} /></div>
                    <div>
                      <div className="t">No activities yet</div>
                      <div className="s">Follow athletes or log your first workout to get started.</div>
                    </div>
                    <Link to="/activities/new" className="cta">Log activity</Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="side side-right" aria-label="Dashboard widgets">

            <Widget icon={<Users size={16} />} title="Clubs">
              <div className="muted">No clubs yet. (Coming soon)</div>
            </Widget>

            <Widget icon={<Target size={16} />} title="Goals">
              <div className="goal">
                <div className="g-top">
                  <div>
                    <div className="k">Last {goals?.windowDays || 7} days</div>
                    <div className="v">
                      {formatDistance(goals?.distanceMeters || 0)} / {formatDistance(goals?.goalDistanceMeters || 0)}
                    </div>
                  </div>
                  <div className="pct">{goalPct}%</div>
                </div>
                <div className="bar" aria-hidden="true">
                  <div className="fill" style={{ width: `${goalPct}%` }} />
                </div>
              </div>
            </Widget>

            <Widget icon={<Users size={16} />} title="Recommended Athletes">
              {!recUsers.length ? (
                <div className="muted">You’re all caught up.</div>
              ) : (
                <div className="recs">
                  {recUsers.map((u) => (
                    <div key={u.id} className="rec">
                      <Link to={`/users/${u.id}`} className="r-who">
                        <span className="av">
                          <Avatar avatarUrl={u.avatarUrl} seed={u.username || u.id || u.name} alt="" />
                        </span>
                        <span>
                          <span className="name">{u.name}</span>
                          {u.username ? <span className="sub">@{u.username}</span> : null}
                        </span>
                      </Link>
                      <button type="button" className="r-btn" onClick={() => onFollowRec(u.id)}>
                        Follow
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Widget>
          </aside>
        </div>

        <SocialModal
          open={Boolean(socialId)}
          item={socialItem}
          tab={socialTab}
          onTab={setSocialTab}
          onClose={onCloseSocial}
          onSocialUpdate={onSocialUpdate}
        />
      </main>
    </div>
  )
}
