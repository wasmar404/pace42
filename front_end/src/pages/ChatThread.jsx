import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Send, UserRound, Wifi, WifiOff } from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import { getMessages, listConversations, markRead, sendMessage } from '../api/chat'
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
  const bottomRef = useRef(null)

  const other = convo?.otherUser

  const seenRef = useRef(new Set())

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
        await markRead(id)
        scrollToBottom()
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
        s.on('connect', () => setRt('connected'))
        s.on('disconnect', () => setRt('disconnected'))
        s.on('connect_error', () => setRt('disconnected'))
        s.emit('conversation:join', { conversationId: id })
        s.on('message:new', (payload) => {
          const m = payload?.message
          if (!m || m.conversationId !== id) return
          const clientId = payload?.clientId || null
          setMessages((prev) => {
            // Dedupe by server message id
            if (m?.id && seenRef.current.has(m.id)) return prev
            if (m?.id) seenRef.current.add(m.id)

            // If this confirms an optimistic message, drop the optimistic one.
            const next = clientId
              ? prev.filter((x) => x?.clientId !== clientId)
              : prev

            return [...next, m]
          })
          void markRead(id).catch(() => {})
          void refreshConvo().catch(() => {})
          scrollToBottom()
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
        s?.off('connect')
        s?.off('disconnect')
        s?.off('connect_error')
      } catch {
        // ignore
      }
      if (cancelled) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Fallback polling so messages appear without refresh.
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const res = await getMessages(id, { limit: 80 })
        if (!alive) return
        const server = res?.messages || []
        for (const m of server) {
          if (m?.id) seenRef.current.add(m.id)
        }

        setMessages((prev) => {
          const now = Date.now()
          const pending = prev.filter((m) => {
            if (!m?.clientId) return false
            const t = Date.parse(m.createdAt)
            if (!Number.isFinite(t)) return false
            return now - t < 20_000
          })
          return [...server, ...pending]
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

  const onSend = async () => {
    const t = text.trim()
    if (!t) return
    setText('')
    setSending(true)
    setError('')

    const clientId = `c-${Date.now()}-${Math.random().toString(16).slice(2)}`

    try {
      // optimistic local append (will also arrive via socket)
      const optimistic = {
        id: `tmp-${clientId}`,
        conversationId: id,
        senderId: meId,
        body: t,
        createdAt: new Date().toISOString(),
        clientId,
      }
      setMessages((prev) => [...prev, optimistic])
      scrollToBottom()

      // send via socket if possible, fallback to REST
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
              </div>
              <div className="peer-main">
                <div className="name">{other?.name || 'Chat'}</div>
                <div className="sub">
                  {other?.username ? `@${other.username}` : 'Mutual followers'}
                </div>
              </div>
            </div>

            <div className="thread-right">
              <div className={`rt-pill ${rt === 'connected' ? 'ok' : 'bad'}`} title={rt === 'connected' ? 'Realtime connected' : 'Realtime offline (polling)'}>
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

          {loading ? <div className="chat-banner">Loading...</div> : null}
          {error ? <div className="chat-banner err">{error}</div> : null}

          <section className="thread" aria-label="Messages">
            {messages.map((m) => {
              const mine = m.senderId && meId && m.senderId === meId
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
