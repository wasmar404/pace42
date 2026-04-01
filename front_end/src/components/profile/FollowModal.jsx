import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

import Avatar from '../Avatar'
import TimeText from '../ui/TimeText'
import { listFollowers, listFollowing } from '../../api/users'

import '../../styles/FollowModal.css'

function nameOf(u) {
  const first = (u?.firstName || '').trim()
  const last = (u?.lastName || '').trim()
  const n = `${first} ${last}`.trim()
  return n || (u?.username ? `@${u.username}` : 'Athlete')
}

export default function FollowModal({ open, user, followersCount, followingCount, tab, onTab, onClose }) {
  const navigate = useNavigate()
  const userId = user?.id

  const [loading, setLoading] = useState(false)
  const [busyMore, setBusyMore] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)

  const title = useMemo(() => {
    if (!userId) return 'People'
    return user?.name || (user?.username ? `@${user.username}` : 'Profile')
  }, [userId, user])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const fetchPage = async (skip) => {
    if (!userId) return { total: 0, items: [] }
    const fn = tab === 'following' ? listFollowing : listFollowers
    const res = await fn(userId, { skip, take: 50 })
    return {
      total: Number(res?.total || 0),
      items: Array.isArray(res?.items) ? res.items : [],
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!open || !userId) return
      setError('')
      setLoading(true)
      setItems([])
      setTotal(0)
      try {
        const res = await fetchPage(0)
        if (cancelled) return
        setTotal(res.total)
        setItems(res.items)
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
  }, [open, userId, tab])

  const canLoadMore = items.length < total
  const onMore = async () => {
    if (!canLoadMore || busyMore || loading) return
    setBusyMore(true)
    setError('')
    try {
      const res = await fetchPage(items.length)
      setTotal(res.total)
      setItems((prev) => [...prev, ...res.items])
    } catch (e) {
      setError(e?.message || 'Failed to load more')
    } finally {
      setBusyMore(false)
    }
  }

  if (!open) return null

  return (
    <div className="social-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="social-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="sm-head">
          <div className="sm-left">
            <div className="sm-av">
              <Avatar avatarUrl={user?.avatarUrl} seed={userId || 'athlete'} alt="" />
            </div>
            <div className="sm-title">
              <div className="t1">{title}</div>
              <div className="t2">Connections</div>
            </div>
          </div>
          <button className="sm-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="sm-tabs" role="tablist" aria-label="Follow tabs">
          <button className={tab === 'followers' ? 'sm-tab on' : 'sm-tab'} type="button" onClick={() => onTab('followers')} role="tab">
            Followers ({Number(followersCount || 0)})
          </button>
          <button className={tab === 'following' ? 'sm-tab on' : 'sm-tab'} type="button" onClick={() => onTab('following')} role="tab">
            Following ({Number(followingCount || 0)})
          </button>
        </div>

        <div className="sm-body">
          {loading ? <div className="sm-hint">Loading...</div> : null}
          {error ? <div className="sm-err">{error}</div> : null}

          {!loading && !error ? (
            <div className="sm-list">
              {items.map((r, idx) => (
                <div
                  key={`${r?.user?.id || 'u'}-${r?.createdAt || idx}`}
                  className="sm-row clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const id = r?.user?.id
                    if (!id) return
                    onClose()
                    navigate(`/users/${id}`)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      const id = r?.user?.id
                      if (!id) return
                      onClose()
                      navigate(`/users/${id}`)
                    }
                  }}
                >
                  <div className="av">
                    <Avatar avatarUrl={r?.user?.avatarUrl} seed={r?.user?.id || 'athlete'} alt="" />
                  </div>
                  <div className="main">
                    <div className="who">{nameOf(r?.user)}</div>
                    {r?.user?.username ? <div className="sub">@{r.user.username}</div> : null}
                  </div>
                  <div className="time">
                    <TimeText iso={r?.createdAt} variant="datetime-short" wrap={false} />
                  </div>
                </div>
              ))}
              {!items.length ? <div className="sm-hint">No users yet.</div> : null}
            </div>
          ) : null}
        </div>

        {canLoadMore ? (
          <div className="sm-footer">
            <button className="sm-more" type="button" onClick={onMore} disabled={busyMore}>
              {busyMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
