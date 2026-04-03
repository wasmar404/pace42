import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Send, UserRound } from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import { getMessages, listConversations } from '../api/chat'
import { getChatSocket } from '../chat/socket'
import { backendGet } from '../backendApi'
import '../styles/Chat.css'

function fmtTime(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatThread() {
  const { id } = useParams()
  const [meId, setMeId] = useState('')
  const [convo, setConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [rt, setRt] = useState('connecting')
  const [presence, setPresence] = useState(null)
  const threadRef = useRef(null)
  const bottomRef = useRef(null)
  const pendingScrollRef = useRef(null)
  const [scrollTick, setScrollTick] = useState(0)

  const other = convo?.otherUser

  const presenceText = useMemo(() => {
    if (!other?.id) return ''
    if (presence?.online) return 'Online'
    if (presence?.lastSeenAt) return 'Last seen ' + fmtTime(presence.lastSeenAt)
    return 'Offline'
  }, [other?.id, presence?.online, presence?.lastSeenAt])

  const seenRef = useRef(new Set())

  const requestScrollToBottom = (behavior = 'auto') => {
    pendingScrollRef.current = behavior
    setScrollTick((x) => x + 1)
  }

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      if (isNearBottom) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    const behavior = pendingScrollRef.current
    if (!behavior) return
    pendingScrollRef.current = null
    try {
      const el = threadRef.current
      if (el) el.scrollTop = el.scrollHeight
    } catch {
    }
    try {
      bottomRef.current?.scrollIntoView({ behavior })
    } catch {
    }
  }, [scrollTick])

  useEffect(() => {
    void (async () => {
      try {
        const me = await backendGet('/api/me')
        setMeId(me?.user?.id || '')
      } catch {
      }
    })()
  }, [])

  const refreshConvo = async () => {
    const res = await listConversations()
    const c = (res?.conversations || []).find((x) => x.id === id) || null
    setConvo(c)
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setError('')
      setLoading(true)
      try {
        await refreshConvo()
        const res = await getMessages(id, { limit: 80 })
        if (cancelled) return
        setMessages(res?.messages || [])
        requestScrollToBottom('auto')
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Failed to load conversation')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let s
    let cancelled = false
    void (async () => {
      try {
        s = await getChatSocket()
        setRt(s.connected ? 'connected' : 'connecting')

        const watch = () => {
          if (other?.id) s.emit('presence:watch', { userIds: [other.id] })
        }

        s.on('connect', () => {
          setRt('connected')
          watch()
        })
        s.on('disconnect', () => setRt('disconnected'))
        s.on('connect_error', () => setRt('disconnected'))

        const onPresence = (p) => {
          const oid = other?.id
          if (!oid) return
          if (p?.userId !== oid) return
          setPresence({ online: p?.online === true, lastSeenAt: p?.lastSeenAt || null })
        }
        const onPresenceState = (payload) => {
          const oid = other?.id
          if (!oid) return
          const items = payload?.items
          if (!Array.isArray(items)) return
          const it = items.find((x) => x?.userId === oid)
          if (!it) return
          setPresence({ online: it?.online === true, lastSeenAt: it?.lastSeenAt || null })
        }

        s.on('presence:update', onPresence)
        s.on('presence:state', onPresenceState)
        watch()

        s.emit('conversation:join', { conversationId: id })

        s.on('message:new', (payload) => {
          const m = payload?.message
          if (!m || m.conversationId !== id) return
          const clientId = payload?.clientId || null

          flushSync(() => {
            setMessages((prev) => {
              const next = clientId ? prev.filter((x) => x?.clientId !== clientId) : prev
              if (m?.id) {
                if (seenRef.current.has(m.id)) return next
                seenRef.current.add(m.id)
              }
              return [...next, m]
            })
          })

          void refreshConvo().catch(() => {})
          requestScrollToBottom('auto')
        })

        s.on('message:error', (payload) => {
          if (payload?.conversationId !== id) return
          const clientId = payload?.clientId || null
          if (clientId) {
            setMessages((prev) => prev.filter((x) => x?.clientId !== clientId))
          }
          setError(payload?.error || 'Failed to send')
        })
      } catch {
        setRt('disconnected')
      }
    })()

    return () => {
      cancelled = true
      try {
        s?.off('message:new')
        s?.off('message:error')
        s?.off('presence:update')
        s?.off('presence:state')
        s?.off('connect')
        s?.off('disconnect')
        s?.off('connect_error')
      } catch {
      }
      if (cancelled) {}
    }
  }, [id, other?.id])

  const canSend = useMemo(() => text.trim().length > 0 && !sending && rt === 'connected', [text, sending, rt])
  const hasAlert = loading || Boolean(error)

  const onSend = async () => {
    const t = text.trim()
    if (!t) return
    if (rt !== 'connected') {
      setError('Realtime disconnected')
      return
    }
    setText('')
    setSending(true)
    setError('')

    const clientId = `c-${Date.now()}-${Math.random().toString(16).slice(2)}`

    try {
      const optimistic = {
        id: `tmp-${clientId}`,
        conversationId: id,
        senderId: meId || null,
        body: t,
        createdAt: new Date().toISOString(),
        clientId,
      }

      flushSync(() => {
        setMessages((prev) => [...prev, optimistic])
      })
      requestScrollToBottom('auto')

      const s = await getChatSocket()
      const ack = await new Promise((resolve, reject) => {
        s.timeout(8000).emit('message:send', { conversationId: id, text: t, clientId }, (err, resp) => {
          if (err) return reject(err)
          resolve(resp)
        })
      })
      if (ack && ack.error) throw new Error(ack.error)
      void refreshConvo().catch(() => {})
    } catch (e) {
      setMessages((prev) => prev.filter((x) => x?.clientId !== clientId))
      setError(e?.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-page">
      <NavBar />

      <main className="thread-wrap">
        <div className="thread-shell">
          <header className="thread-head">
            <div className="thread-left">
              <Link to="/chat" className="back" aria-label="Back to conversations">
                <ArrowLeft size={18} />
                <span>Conversations</span>
              </Link>
            </div>

            <div className="peer">
              <div className="av">
                <Avatar avatarUrl={other?.avatarUrl} seed={other?.id || other?.userId || other?.username || other?.name} alt="" />
                {other?.id && presence ? (
                  <span className={presence.online ? 'presence-dot on' : 'presence-dot'} aria-hidden="true" />
                ) : null}
              </div>
              <div className="peer-main">
                <div className="name">{other?.name || 'Chat'}</div>
                <div className="sub">{presenceText}</div>
              </div>
            </div>

            <div className="thread-right">
              {other?.id ? (
                <Link to={`/users/${other.id}`} className="profile-link" aria-label="Open profile">
                  <UserRound size={16} />
                  <span>Profile</span>
                </Link>
              ) : null}
            </div>
          </header>

          <div className={hasAlert ? 'thread-alerts on' : 'thread-alerts'} aria-live="polite">
            {loading ? <div className="chat-banner">Loading...</div> : null}
            {error ? <div className="chat-banner err">{error}</div> : null}
          </div>

          <section className="thread" aria-label="Messages" ref={threadRef}>
            {messages.map((m) => {
              const mine = Boolean(m?.clientId) || (m.senderId && meId && m.senderId === meId)
              return (
                <div key={m.id} className={mine ? 'bubble mine' : 'bubble'}>
                  <div className="text">{m.body}</div>
                  <div className="meta">{fmtTime(m.createdAt)}</div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </section>

          <footer className="composer" aria-label="Message composer">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (canSend) void onSend()
                }
              }}
            />
            <button type="button" onClick={onSend} disabled={!canSend} aria-label="Send">
              <Send size={18} />
            </button>
          </footer>
        </div>
      </main>
    </div>
  )
}
