import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import Avatar from '../Avatar'
import TimeText from '../ui/TimeText'

import { addComment, getComments, listKudos } from '../../api/activities'
import { sportLabel } from '../../utils/sport'

export default function SocialModal({ open, item, tab, onTab, onClose, onSocialUpdate }) {
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
                  <div className="time">
                    <TimeText iso={k?.createdAt} variant="datetime-short" wrap={false} />
                  </div>
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
                  <div className="time">
                    <TimeText iso={c?.createdAt} variant="datetime-short" wrap={false} />
                  </div>
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
