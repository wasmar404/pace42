import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
} from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import { backendGet } from '../backendApi'
import { followUser } from '../api/users'
import { getHomeFeed, getRecommendedUsers } from '../api/home'
import { readAvatarSeed, readSupabaseSessionUserSync, writeAvatarSeed } from '../utils/avatarCache'

import ActivityCard from '../components/home/ActivityCard'
import AthleteSummaryWidget from '../components/home/AthleteSummaryWidget'
import FeedEmpty from '../components/home/FeedEmpty'
import FeedSkeleton from '../components/home/FeedSkeleton'
import SocialModal from '../components/home/SocialModal'
import Widget from '../components/home/Widget'

import '../styles/Home.css'

export default function Home() {
  const [me, setMe] = useState(() => {
    const u = readSupabaseSessionUserSync()
    if (!u?.id) return null
    return {
      user: { id: u.id, email: u.email },
      profile: null,
      stats: { followersCount: 0, followingCount: 0, totalActivities: 0 },
      recentActivities: [],
      recentPhotos: [],
      settings: {},
    }
  })
  const [feed, setFeed] = useState([])
  const [feedSource, setFeedSource] = useState('')
  const [recUsers, setRecUsers] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [socialId, setSocialId] = useState('')
  const [socialTab, setSocialTab] = useState('comments')

  const [seedFallback, setSeedFallback] = useState(() => {
    const u = readSupabaseSessionUserSync()
    return u?.id || readAvatarSeed('athlete')
  })

  const meId = me?.user?.id

  const avatarSeed = useMemo(() => {
    return meId || seedFallback || 'athlete'
  }, [meId, seedFallback])

  useEffect(() => {
    const cached = readSupabaseSessionUserSync()
    if (cached?.id) {
      setSeedFallback(cached.id)
      writeAvatarSeed(cached.id)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')

      //fetches all data
      try {
        // Fast path: fetch basic profile for immediate UI.
        const meBasic = await backendGet('/api/me').catch(() => null)
        if (!cancelled && meBasic) setMe((prev) => ({ ...meBasic, stats: prev?.stats }))

        const [feedRes, recRes] = await Promise.all([
          getHomeFeed(20),
          getRecommendedUsers(6),
        ])
        if (cancelled) return
        setFeed((feedRes?.items || []).filter((it) => it?.type !== 'announcement'))
        setFeedSource(feedRes?.source || '')
        setRecUsers(recRes?.items || [])
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

  useEffect(() => {
    let cancelled = false
    // Background: fetch full summary (counts/photos) without blocking initial paint.
    void backendGet('/api/me/summary')
      .then((res) => {
        if (cancelled) return
        if (res) setMe(res)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

//update likes/cpmments
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

//get the selected activity for the social modal
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
                  <ActivityCard key={it.id} item={it} meId={meId} onOpenSocial={onOpenSocial} onSocialUpdate={onSocialUpdate} />
                ))}

                {!feed.length ? <FeedEmpty /> : null}
              </div>
            ) : null}
          </section>

          <aside className="side side-right" aria-label="Dashboard widgets">
            <Widget icon={<Users size={16} />} title="Recommended Athletes">
              {!recUsers.length ? (
                <div className="muted">You’re all caught up.</div>
              ) : (
                <div className="recs">
                  {recUsers.map((u) => (
                    <div key={u.id} className="rec">
                      <Link to={`/users/${u.id}`} className="r-who">
                        <span className="av">
                          <Avatar avatarUrl={u.avatarUrl} seed={u.id || u.userId || u.username || u.name} alt="" />
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
