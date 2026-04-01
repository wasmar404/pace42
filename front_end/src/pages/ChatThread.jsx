import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Send, UserRound, Wifi, WifiOff } from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import { getMessages, listConversations, sendMessage } from '../api/chat'
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

  // ─── FIX: track in-flight sends so the poll doesn't stomp optimistic messages ───
  const sendingRef = useRef(false)

  const other = convo?.otherUser

  const presenceText = useMemo(() => {
    if (!other?.id) return ''
    if (presence?.online) return 'Online'
    return 'Offline'
  }, [other?.id, other?.username, presence])

  const seenRef = useRef(new Set())

  const requestScrollToBottom = (behavior = 'auto') => {
    pendingScrollRef.current = behavior
    setScrollTick((x) => x + 1)
  }

  // Auto-scroll after every messages change (catches polling + socket + optimistic)
  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [messages])

  // ResizeObserver to catch layout shifts (textarea grow, images loading)
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
      // ignore
    }
    try {
      bottomRef.current?.scrollIntoView({ behavior })
    } catch {
      // ignore
    }
  }, [scrollTick])

  useEffect(() => {
    void (async () => {
      try {
        const me = await backendGet('/api/me')
        setMeId(me?.user?.id || '')
      } catch {
        // ignore
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // flushSync so DOM is updated before we scroll
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
        // ignore
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
        // ignore
      }
      if (cancelled) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, other?.id])

  // Fallback polling — skips while a send is in-flight to avoid stomping optimistic messages
  useEffect(() => {
    let alive = true

    const poll = async () => {
      // ─── FIX: don't poll while sending — stops the optimistic message
      //         getting wiped before the server confirms it ───
      if (sendingRef.current) return

      try {
        const res = await getMessages(id, { limit: 80 })
        if (!alive) return
        const server = res?.messages || []
        for (const m of server) {
          if (m?.id) seenRef.current.add(m.id)
        }

        setMessages((prev) => {
          const now = Date.now()
          // Keep optimistic messages not yet confirmed by the server
          const pending = prev.filter((m) => {
            if (!m?.clientId) return false
            const t = Date.parse(m.createdAt)
            if (!Number.isFinite(t)) return false
            return now - t < 20_000
          })
          // Drop pending msgs whose real id already exists in the server list
          const serverIds = new Set(server.map((m) => m.id))
          const unconfirmed = pending.filter(
            (m) => !serverIds.has(m.id?.replace('tmp-', ''))
          )
          return [...server, ...unconfirmed]
        })
      } catch {
        // ignore
      }
    }

    const t = setInterval(poll, 2500)
    void poll()
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [id])

  const canSend = useMemo(() => text.trim().length > 0 && !sending, [text, sending])
  const hasAlert = loading || Boolean(error)

  const onSend = async () => {
    const t = text.trim()
    if (!t) return
    setText('')
    setSending(true)
    sendingRef.current = true  // ─── FIX: block poll while sending ───
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

      // flushSync so optimistic message is in the DOM before we scroll
      flushSync(() => {
        setMessages((prev) => [...prev, optimistic])
      })
      requestScrollToBottom('auto')

      // Send via socket if possible, fallback to REST
      try {
        const s = await getChatSocket()
        const ack = await new Promise((resolve, reject) => {
          s.timeout(8000).emit('message:send', { conversationId: id, text: t, clientId }, (err, resp) => {
            if (err) return reject(err)
            resolve(resp)
          })
        })
        if (ack && ack.error) throw new Error(ack.error)
      } catch {
        const res = await sendMessage(id, t, clientId)
        const m = res?.message
        setMessages((prev) => {
          const next = prev.filter((x) => x?.clientId !== clientId)
          if (m?.id && !seenRef.current.has(m.id)) {
            seenRef.current.add(m.id)
            return [...next, m]
          }
          return next
        })
      }
      void refreshConvo().catch(() => {})
    } catch (e) {
      setError(e?.message || 'Failed to send')
    } finally {
      setSending(false)
      sendingRef.current = false  // ─── FIX: unblock poll after send completes ───
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
                <Avatar avatarUrl={other?.avatarUrl} seed={other?.username || other?.id || other?.name} alt="" />
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
              <div
                className={`rt-pill ${rt === 'connected' ? 'ok' : 'bad'}`}
                title={rt === 'connected' ? 'Realtime connected' : 'Realtime offline (polling)'}
              >
                {rt === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span>{rt === 'connected' ? 'Live' : 'Syncing'}</span>
              </div>
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
