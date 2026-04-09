import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import NavBar from '../components/NavBar'
import Pill from '../components/ui/Pill'
import TimeText from '../components/ui/TimeText'
import SocialModal from '../components/home/SocialModal'
import { getActivity, deleteActivity, giveKudos, removeKudos } from '../api/activities'
import { formatDistance, formatDuration, formatPaceOrSpeed } from '../utils/format'
import { readSupabaseSessionUserSync } from '../utils/avatarCache'
import '../styles/ActivityDetails.css'

const RouteMap = lazy(() => import('../components/RouteMap'))

function formatSport(sport) {
  if (!sport) return 'Activity'
  return sport.charAt(0).toUpperCase() + sport.slice(1)
}

function sportAccent(sport) {
  if (!sport) return '◎'
  const s = sport.toLowerCase()
  if (s === 'run' || s === 'running') return 'RUN'
  if (s === 'ride' || s === 'cycling' || s === 'bike') return 'RIDE'
  if (s === 'walk' || s === 'walking') return 'WALK'
  return formatSport(sport).toUpperCase().slice(0, 4)
}

export default function ActivityDetails() {
  const { id } = useParams()
  const [activity, setActivity] = useState(null)
  const [athlete, setAthlete] = useState(null)
  const [social, setSocial] = useState({ kudosCount: 0, commentCount: 0, viewerHasKudo: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [kudosBusy, setKudosBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('comments')

  const meId = useMemo(() => readSupabaseSessionUserSync()?.id || null, [])
  const mine = Boolean(activity?.userId && meId && activity.userId === meId)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const res = await getActivity(id, { includeRoute: true })
        if (cancelled) return
        setActivity(res.activity)
        if (res.social) setSocial(res.social)
        if (res.athlete) setAthlete(res.athlete)
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load activity')
        if ((e?.message || '').toLowerCase().includes('not found')) setActivity(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [id])

  const onKudos = async () => {
    if (kudosBusy) return
    if (mine) return
    setKudosBusy(true)
    try {
      if (social.viewerHasKudo) {
        const res = await removeKudos(id)
        setSocial((s) => ({
          ...s,
          kudosCount: typeof res?.kudosCount === 'number' ? res.kudosCount : Math.max(0, s.kudosCount - 1),
          commentCount: typeof res?.commentCount === 'number' ? res.commentCount : s.commentCount,
          viewerHasKudo: false,
        }))
      } else {
        const res = await giveKudos(id)
        setSocial((s) => ({
          ...s,
          kudosCount: typeof res?.kudosCount === 'number' ? res.kudosCount : s.kudosCount + 1,
          commentCount: typeof res?.commentCount === 'number' ? res.commentCount : s.commentCount,
          viewerHasKudo: true,
        }))
      }
    } catch (e) {
      const msg = e?.message || "You can't kudo this activity"
      setError(String(msg))
    } finally {
      setKudosBusy(false)
    }
  }

  const onSocialUpdate = useCallback((_, counts) => {
    setSocial(s => ({ ...s, ...counts }))
  }, [])

  const openModal = (tab) => { setModalTab(tab); setModalOpen(true) }

  const title = useMemo(() => {
    if (!activity) return 'Activity'
    return activity.title || `${formatSport(activity.sport)} · ${formatDistance(activity.distanceMeters)}`
  }, [activity])

  return (
    <div className="activity-page">
      <NavBar />

      <div className="activity-wrap">
        <div className="activity-top">
          <Link className="activity-back" to="/activities/new">
            New activity
          </Link>

          <button
            type="button"
            className="activity-delete"
            disabled={deleting}
            onClick={async () => {
              if (!activity?.id) return
              const ok = window.confirm('Delete this activity? This will also remove uploaded files.')
              if (!ok) return
              setDeleting(true)
              setError('')
              try {
                await deleteActivity(activity.id)
                window.location.href = '/training'
              } catch (e) {
                setError(e?.message || 'Failed to delete activity')
              } finally {
                setDeleting(false)
              }
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>

        {error ? <div className="activity-error">{error}</div> : null}

        <div className="activity-hero">
          <div className="activity-hero-accent" aria-hidden="true">
            {sportAccent(activity?.sport)}
          </div>

          <div className="activity-sport-tag">
            {formatSport(activity?.sport)}
          </div>

          <h1 className="activity-title">{title}</h1>

          <div className="activity-meta-row">
            <Pill>
              <TimeText iso={activity?.startedAt} variant="datetime-long" />
            </Pill>
            {activity?.source ? <Pill>{activity.source}</Pill> : null}
          </div>
        </div>

        <div className="activity-divider" />

        <div className="activity-card">
          <div className="activity-body">

            {loading && !activity ? (
              <div className="activity-empty">Loading…</div>
            ) : null}

            {activity ? (
              <>
                <div className="stat-grid">
                  <div className="stat">
                    <div className="stat-k">Distance</div>
                    <div className="stat-v">{formatDistance(activity.distanceMeters)}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-k">Duration</div>
                    <div className="stat-v">{formatDuration(activity.durationSeconds)}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-k">Pace / Speed</div>
                    <div className="stat-v">
                      {formatPaceOrSpeed(activity.sport, activity.distanceMeters, activity.durationSeconds)}
                    </div>
                  </div>
                </div>

                {activity?.photos?.length > 0 && (
                  <div className="activity-photos">
                    {activity.photos.map((url, i) => (
                      <img
                        key={i}
                        className="activity-photo"
                        src={url}
                        alt={`Activity photo ${i + 1}`}
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

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

                {activity.description ? (
                  <div className="activity-desc">{activity.description}</div>
                ) : (
                  <div className="activity-empty">No description yet.</div>
                )}
              </>
            ) : null}

          </div>

          {activity ? (
            <div className="activity-social-bar">
              <button
                className={`activity-social-btn kudos${social.viewerHasKudo ? ' active' : ''}`}
                type="button"
                onClick={onKudos}
                disabled={kudosBusy || mine}
                title={mine ? "You can't kudo your own activity" : undefined}
              >
                <span className="social-icon">👊</span>
                <span>{social.kudosCount} Kudos</span>
              </button>
              <button
                className="activity-social-btn"
                type="button"
                onClick={() => openModal('comments')}
              >
                <span className="social-icon">💬</span>
                <span>{social.commentCount} Comments</span>
              </button>
            </div>
          ) : null}
        </div>

      </div>

      <SocialModal
        open={modalOpen}
        item={{ activity, athlete, social }}
        tab={modalTab}
        onTab={setModalTab}
        onClose={() => setModalOpen(false)}
        onSocialUpdate={onSocialUpdate}
      />
    </div>
  )
}
