import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Send } from 'lucide-react'

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
  const bottomRef = useRef(null)

  const other = convo?.otherUser

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
        s.emit('conversation:join', { conversationId: id })
        s.on('message:new', (payload) => {
          const m = payload?.message
          if (!m || m.conversationId !== id) return
          setMessages((prev) => [...prev, m])
          void markRead(id).catch(() => {})
          void refreshConvo().catch(() => {})
          scrollToBottom()
        })
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
      try {
        s?.off('message:new')
      } catch {
        // ignore
      }
      if (cancelled) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const canSend = useMemo(() => text.trim().length > 0 && !sending, [text, sending])

  const onSend = async () => {
    const t = text.trim()
    if (!t) return
    setText('')
    setSending(true)
    setError('')

    try {
      // optimistic local append (will also arrive via socket)
      const optimistic = {
        id: `tmp-${Date.now()}`,
        conversationId: id,
        senderId: meId,
        body: t,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])
      scrollToBottom()

      // send via socket if possible, fallback to REST
      try {
        const s = await getChatSocket()
        s.emit('message:send', { conversationId: id, text: t })
      } catch {
        await sendMessage(id, t)
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
        <header className="thread-head">
          <Link to="/chat" className="back">← Conversations</Link>
          <div className="peer">
            <div className="av">
              <Avatar avatarUrl={other?.avatarUrl} seed={other?.username || other?.id || other?.name} alt="" />
            </div>
            <div>
              <div className="name">{other?.name || 'Chat'}</div>
              <div className="sub">Mutual follow required</div>
            </div>
          </div>
        </header>

        {loading ? <div className="chat-banner">Loading...</div> : null}
        {error ? <div className="chat-banner err">{error}</div> : null}

        <section className="thread">
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

        <footer className="composer">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message..." onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) void onSend()
            }
          }} />
          <button type="button" onClick={onSend} disabled={!canSend}>
            <Send size={18} />
          </button>
        </footer>
      </main>
    </div>
  )
}
