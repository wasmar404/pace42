import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Target,
  Users,
} from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import { backendGet } from '../backendApi'
import { followUser } from '../api/users'
import { getGoals, getHomeFeed, getRecommendedUsers } from '../api/home'
import { getMyClubs } from '../api/clubs'
import { useUnitsValue } from '../preferences'
import { formatDistance } from '../utils/format'

import ActivityCard from '../components/home/ActivityCard'
import AthleteSummaryWidget from '../components/home/AthleteSummaryWidget'
import FeedEmpty from '../components/home/FeedEmpty'
import FeedSkeleton from '../components/home/FeedSkeleton'
import SocialModal from '../components/home/SocialModal'
import Widget from '../components/home/Widget'

import '../styles/Home.css'

export default function Home() {
  const units = useUnitsValue()
  const [me, setMe] = useState(null)
  const [feed, setFeed] = useState([])
  const [feedSource, setFeedSource] = useState('')
  const [recUsers, setRecUsers] = useState([])
  const [goals, setGoals] = useState(null)
  const [myClubs, setMyClubs] = useState([])

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
            getGoals(7),
          ])
          const clubsRes = await getMyClubs().catch(() => null)
          if (cancelled) return
          setMe(meRes)
          setFeed((feedRes?.items || []).filter((it) => it?.type !== 'announcement'))
          setFeedSource(feedRes?.source || '')
          setRecUsers(recRes?.items || [])
          setGoals(goalsRes)
          setMyClubs(clubsRes?.clubs || [])
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
                {feed.map((it) => (
                  <ActivityCard key={it.id} item={it} meId={meId} units={units} onOpenSocial={onOpenSocial} onSocialUpdate={onSocialUpdate} />
                ))}

                {!feed.length ? <FeedEmpty /> : null}
              </div>
            ) : null}
          </section>

          <aside className="side side-right" aria-label="Dashboard widgets">

            <Widget icon={<Users size={16} />} title="Clubs">
              {!myClubs.length ? (
                <div className="muted">
                  No clubs yet. <Link to="/clubs" className="inline-link">Create one</Link>
                </div>
              ) : (
                <div className="clubs-mini">
                  {myClubs.slice(0, 3).map((c) => (
                    <div key={c.id} className="club-mini">
                      <div className="n">{c.name}</div>
                      <div className="s">{c.memberCount} members</div>
                    </div>
                  ))}
                  <Link to="/clubs" className="inline-link">View all</Link>
                </div>
              )}
            </Widget>

            {goals?.goalDistanceMeters ? (
              <Widget icon={<Target size={16} />} title="Goals">
                <div className="goal">
                  <div className="g-top">
                    <div>
                      <div className="k">Last {goals?.windowDays || 7} days</div>
                      <div className="v">
                        {formatDistance(goals?.distanceMeters || 0, units)} / {formatDistance(goals?.goalDistanceMeters || 0, units)}
                      </div>
                    </div>
                    <div className="pct">{goalPct}%</div>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <div className="fill" style={{ width: `${goalPct}%` }} />
                  </div>
                </div>
              </Widget>
            ) : null}

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
