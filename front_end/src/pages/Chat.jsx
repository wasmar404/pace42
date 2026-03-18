import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, Plus } from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import TimeText from '../components/ui/TimeText'
import { getOrCreateConversation, listConversations, searchMutuals } from '../api/chat'
import { getChatSocket } from '../chat/socket'
import '../styles/Chat.css'

export default function Chat() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [mutuals, setMutuals] = useState([])
  const [mutualsLoading, setMutualsLoading] = useState(true)
  const [mutualsError, setMutualsError] = useState('')
  const [presence, setPresence] = useState({})
  const watchedRef = useRef([])
  const debounceRef = useRef(null)

  const itemsUniq = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const c of items || []) {
      const id = c?.id
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(c)
    }
    return out
  }, [items])

  const conversationOtherIds = useMemo(() => {
    const s = new Set()
    for (const c of itemsUniq) {
      const id = c?.otherUser?.id
      if (id) s.add(id)
    }
    return s
  }, [itemsUniq])

  const mutualsToShow = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const u of mutuals || []) {
      const id = u?.id
      if (!id || seen.has(id)) continue
      seen.add(id)
      // If there's already a conversation with this mutual, don't show them twice.
      if (conversationOtherIds.has(id)) continue
      out.push(u)
    }
    return out
  }, [mutuals, conversationOtherIds])

  const totalUnread = useMemo(() => itemsUniq.reduce((a, c) => a + Number(c.unreadCount || 0), 0), [itemsUniq])

  const refresh = async () => {
    const res = await listConversations()
    setItems(res?.conversations || [])
  }

  const refreshMutuals = async (query) => {
    const res = await searchMutuals(query)
    setMutuals(res?.items || [])
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setError('')
      setLoading(true)
      try {
        await refresh()
        if (cancelled) return
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load conversations')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setMutualsError('')
      setMutualsLoading(true)
      try {
        await refreshMutuals('')
      } catch (e) {
        if (!cancelled) setMutualsError(e?.message || 'Failed to load mutuals')
      } finally {
        if (!cancelled) setMutualsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setMutualsError('')
      setMutualsLoading(true)
      try {
        await refreshMutuals(q)
      } catch (e) {
        setMutualsError(e?.message || 'Failed to load mutuals')
      } finally {
        setMutualsLoading(false)
      }
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q])

  const onPickMutual = async (userId) => {
    try {
      const res = await getOrCreateConversation(userId)
      const convoId = res?.conversation?.id
      if (convoId) navigate(`/chat/${convoId}`)
    } catch (e) {
      setMutualsError(e?.message || 'Could not start chat')
    }
  }

  useEffect(() => {
    let s
    let cancelled = false
    void (async () => {
      try {
        s = await getChatSocket()
        const emitWatch = () => {
          const ids = watchedRef.current || []
          if (ids.length) s.emit('presence:watch', { userIds: ids })
        }
        const onPresence = (p) => {
          const id = p?.userId
          if (!id) return
          setPresence((prev) => ({
            ...(prev || {}),
            [id]: { online: p?.online === true, lastSeenAt: p?.lastSeenAt || null },
          }))
        }

        const onPresenceState = (payload) => {
          const items = payload?.items || []
          if (!Array.isArray(items)) return
          setPresence((prev) => {
            const next = { ...(prev || {}) }
            for (const it of items) {
              if (!it?.userId) continue
              next[it.userId] = { online: it?.online === true, lastSeenAt: it?.lastSeenAt || null }
            }
            return next
          })
        }

        s.on('presence:update', onPresence)
        s.on('presence:state', onPresenceState)
        s.on('connect', emitWatch)
        s.on('message:new', () => {
          void refresh().catch(() => {})
        })
        s.on('conversation:read', () => {
          void refresh().catch(() => {})
        })

        // Initial watch list (will be updated by effect below as data loads)
        s.emit('presence:watch', { userIds: [] })
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
      try {
        s?.off('message:new')
        s?.off('conversation:read')
        s?.off('presence:update')
        s?.off('presence:state')
        s?.off('connect')
      } catch {
        // ignore
      }
      if (cancelled) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let s
    let cancelled = false
    const ids = []
    for (const c of itemsUniq) {
      if (c?.otherUser?.id) ids.push(c.otherUser.id)
    }
    for (const u of mutualsToShow) {
      if (u?.id) ids.push(u.id)
    }
    const uniq = Array.from(new Set(ids))
    if (!uniq.length) return

    watchedRef.current = uniq

    void (async () => {
      try {
        s = await getChatSocket()
        if (cancelled) return
        s.emit('presence:watch', { userIds: uniq })
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [itemsUniq, mutualsToShow])

  return (
    <div className="chat-page">
      <NavBar />

      <main className="chat-wrap">
        <header className="chat-head">
          <div>
            <h1>Chat</h1>
            <p>Mutual followers can message each other.</p>
          </div>
          <div className="chat-pill">
            <MessageCircle size={14} />
            <span>{totalUnread} unread</span>
          </div>
        </header>

        {loading ? <div className="chat-banner">Loading...</div> : null}
        {error ? <div className="chat-banner err">{error}</div> : null}

        <section className="chat-search">
          <div className="chat-search-row">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search mutuals..."
              aria-label="Search mutual followers"
            />
            <button className="btn" type="button" onClick={() => navigate('/search')}>
              <Plus size={16} />
              Find athletes
            </button>
          </div>

          {mutualsLoading ? <div className="chat-banner">Loading mutuals...</div> : null}
          {mutualsError ? <div className="chat-banner err">{mutualsError}</div> : null}

          {!mutualsLoading && !mutualsError ? (
            <div className="chat-mutuals">
              {mutualsToShow.map((u) => {
                const name = `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || (u?.username ? `@${u.username}` : 'User')
                const st = u?.id ? presence[u.id] : null
                return (
                  <button key={u.id} type="button" className="chat-mutual" onClick={() => onPickMutual(u.id)}>
                    <div className="av">
                      <Avatar avatarUrl={u?.avatarUrl} seed={u?.username || u?.id || name} alt="" />
                      {st ? <span className={st.online ? 'presence-dot on' : 'presence-dot'} aria-hidden="true" /> : null}
                    </div>
                    <div className="main">
                      <div className="name">{name}</div>
                      <div className="sub">
                        {u?.username ? `@${u.username}` : ''}{u?.username ? ' · ' : ''}{st?.online ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </section>

        <section className="chat-list">
          {!loading && !itemsUniq.length ? (
            <div className="chat-empty">
              <div className="icon"><MessageCircle size={22} /></div>
              <div>
                <div className="t">No conversations yet</div>
                <div className="s">Search mutual followers to start a chat.</div>
              </div>
              <button className="btn" type="button" onClick={() => navigate('/search')}>
                <Plus size={16} />
                Find athletes
              </button>
            </div>
          ) : null}

          {itemsUniq.map((c) => (
            <Link to={`/chat/${c.id}`} className="chat-row" key={c.id}>
              <div className="av">
                <Avatar avatarUrl={c?.otherUser?.avatarUrl} seed={c?.otherUser?.username || c?.otherUser?.id || c?.otherUser?.name} alt="" />
                {c?.otherUser?.id && presence[c.otherUser.id] ? (
                  <span className={presence[c.otherUser.id].online ? 'presence-dot on' : 'presence-dot'} aria-hidden="true" />
                ) : null}
              </div>
              <div className="main">
                <div className="top">
                  <div className="name">{c?.otherUser?.name || 'User'}</div>
                  <div className="time">
                    <span className="presence-text">{c?.otherUser?.id && presence[c.otherUser.id]?.online ? 'Online' : 'Offline'}</span>
                    {c?.lastMessageAt ? <TimeText iso={c.lastMessageAt} variant="relative" /> : ''}
                  </div>
                </div>
                <div className="sub">
                  <div className="msg">{c?.lastMessageText || 'Say hello'}</div>
                  {c.unreadCount > 0 ? <div className="unread">{c.unreadCount}</div> : null}
                </div>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  )
}
