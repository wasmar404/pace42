import { Suspense, lazy, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, Heart, MessageCircle } from 'lucide-react'

import Avatar from '../Avatar'
import Pill from '../ui/Pill'
import TimeText from '../ui/TimeText'

import { giveKudos, removeKudos } from '../../api/activities'
import { formatDistance, formatDuration, formatPaceOrSpeed } from '../../utils/format'
import { sportLabel } from '../../utils/sport'

const RouteMap = lazy(() => import('../RouteMap'))

export default function ActivityCard({ item, meId, units, onOpenSocial, onSocialUpdate }) {
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
            <Avatar avatarUrl={athlete?.avatarUrl} seed={athlete?.id || athlete?.userId || athlete?.username || athlete?.name} alt="" />
          </span>
          <span className="who">
            <span className="name">{athlete?.name || 'Athlete'}</span>
            <span className="act-title">{title}</span>
            <span className="meta">
              <Pill>{sportLabel(a?.sport)}</Pill>
              <span className="time">
                <Calendar size={14} />
                <TimeText iso={a?.startedAt} variant="datetime-short" wrap={false} />
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
            <div className="v">{formatDistance(a?.distanceMeters, units)}</div>
          </div>
          <div className="stat">
            <div className="k">Time</div>
            <div className="v">{formatDuration(a?.durationSeconds)}</div>
          </div>
          <div className="stat">
            <div className="k">Pace/Speed</div>
            <div className="v">{formatPaceOrSpeed(a?.sport, a?.distanceMeters, a?.durationSeconds, units)}</div>
          </div>
        </div>

        {a?.routePolyline || a?.imageUrl ? (
          <div className="media">
            {a?.routePolyline ? (
              <Suspense fallback={<div className="media-fallback">Loading map...</div>}>
                <RouteMap polyline={a.routePolyline} height={210} variant="clean" />
              </Suspense>
            ) : (
              <img className="media-img" src={a.imageUrl} alt="Activity" loading="lazy" />
            )}
          </div>
        ) : null}
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
