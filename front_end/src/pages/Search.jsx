import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, UserCheck, Loader2, AlertCircle } from 'lucide-react'

import NavBar from '../components/NavBar'
import { followUser, searchUsers, unfollowUser } from '../api/users'
import Avatar from '../components/Avatar'
import '../styles/Search.css'

function displayName(u) {
  const first = (u?.firstName || '').trim()
  const last = (u?.lastName || '').trim()
  const n = `${first} ${last}`.trim()
  return n || (u?.username ? `@${u.username}` : 'User')
}

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastReq = useRef(0)
  const inputRef = useRef(null)

  const trimmed = useMemo(() => (q || '').trim(), [q])

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus()

    const onKey = (e) => {
      if (e.key === '/' && !(e.metaKey || e.ctrlKey || e.altKey)) {
        const tag = String(document.activeElement?.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea') return
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const token = Date.now()
    lastReq.current = token

    setError('')
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await searchUsers(trimmed)
          if (lastReq.current !== token) return
          setResults(res?.users || [])
        } catch (e) {
          if (lastReq.current !== token) return
          setError(e?.message || 'Search failed')
        } finally {
          if (lastReq.current === token) setLoading(false)
        }
      })()
    }, 250)

    return () => clearTimeout(t)
  }, [trimmed])

  const toggleFollow = async (u) => {
    setError('')
    const userId = u.id
    const next = !u.isFollowing
    setResults((prev) => prev.map((x) => (x.id === userId ? { ...x, isFollowing: next } : x)))

    try {
      if (next) await followUser(userId)
      else await unfollowUser(userId)
    } catch (e) {
      // rollback
      setResults((prev) => prev.map((x) => (x.id === userId ? { ...x, isFollowing: !next } : x)))
      setError(e?.message || 'Action failed')
    }
  }

  const showEmpty = !loading && trimmed.length >= 2 && !results.length
  const showResults = results.length > 0
  const showPanel = trimmed.length >= 2 || loading

  return (
    <div className="search-page">
      <NavBar />

      <main className="search-container">
        <header className="search-header">
          <div className="search-kicker">Scout Board</div>
          <h1 className="search-title">Find Athletes</h1>
          <p className="search-subtitle">Search by name or handle. Follow to unlock followers-only activities and mutual chat.</p>
        </header>

        <div className="search-input-wrapper">
          <div className="search-input-box">
            <Search className="search-icon" size={20} />
            <input
              ref={inputRef}
              className="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or @username..."
              autoComplete="off"
              spellCheck="false"
            />
            {q && (
              <button 
                className="search-clear" 
                onClick={() => setQ('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          
          <div className="search-status">
            {loading ? (
              <span className="status-loading">
                <Loader2 className="spin" size={14} />
                Searching...
              </span>
            ) : trimmed.length >= 2 ? (
              <span className="status-results">{results.length} athlete{results.length !== 1 ? 's' : ''} found</span>
            ) : (
              <span className="status-hint">Type 2+ characters to search (press / to focus)</span>
            )}
          </div>
        </div>

        {error && (
          <div className="search-error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {showPanel ? (
          <section className="search-results-container" aria-label="Search results">
            {loading ? (
              <div className="search-grid" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="athlete-card skeleton" style={{ animationDelay: `${idx * 40}ms` }} />
                ))}
              </div>
            ) : null}

            {showResults ? (
              <div className="search-grid">
                {results.map((u, idx) => (
                  <article className="athlete-card" key={u.id} style={{ animationDelay: `${idx * 30}ms` }}>
                    <Link className="athlete-info" to={`/users/${u.id}`}>
                      <div className="athlete-avatar-wrapper">
                        <Avatar
                          avatarUrl={u.avatarUrl}
                          seed={u.username || u.id || displayName(u)}
                          alt={displayName(u)}
                          size={56}
                        />
                        {u.isFollowing ? <div className="following-badge" title="Following" /> : null}
                      </div>

                      <div className="athlete-details">
                        <div className="athlete-name">{displayName(u)}</div>
                        <div className="athlete-meta">
                          {u.username ? <span className="athlete-username">@{u.username}</span> : null}
                          {u.level ? <span className="athlete-level">{u.level}</span> : null}
                        </div>
                      </div>
                    </Link>

                    <button
                      className={`follow-button ${u.isFollowing ? 'following' : ''}`}
                      type="button"
                      onClick={() => toggleFollow(u)}
                      aria-label={u.isFollowing ? 'Unfollow user' : 'Follow user'}
                    >
                      {u.isFollowing ? (
                        <>
                          <UserCheck size={16} />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  </article>
                ))}
              </div>
            ) : null}

            {showEmpty ? (
              <div className="search-empty-state">
                <div className="empty-icon">
                  <Search size={46} strokeWidth={1.35} />
                </div>
                <h3>No athletes found</h3>
                <p>Try a different name, a shorter handle, or remove symbols.</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  )
}
