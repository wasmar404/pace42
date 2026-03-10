import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

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

export default function Search() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastReq = useRef(0)

  const trimmed = useMemo(() => (q || '').trim(), [q])

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

  return (
    <div className="search-page">
      <NavBar />

      <main className="search-wrap">
        <div className="search-head">
          <h1>Find Athletes</h1>
          <p>Search by username or name. Follow to see followers-only activities.</p>
        </div>

        <div className="search-box">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search @username or name..."
            autoComplete="off"
          />
          <div className="search-meta">
            {loading ? <span>Searching...</span> : trimmed.length >= 2 ? <span>{results.length} results</span> : <span>Type 2+ characters</span>}
          </div>
        </div>

        {error ? <div className="search-error">{error}</div> : null}

        <div className="search-results">
          {results.map((u) => (
            <div className="user-row" key={u.id}>
              <Link className="user-left" to={`/users/${u.id}`}>
                <div className="user-avatar">
                  <Avatar avatarUrl={u.avatarUrl} seed={u.username || u.id || displayName(u)} alt="" />
                </div>
                <div>
                  <div className="user-name">{displayName(u)}</div>
                  <div className="user-sub">
                    {u.username ? <span>@{u.username}</span> : null}
                    {u.level ? <span>· {u.level}</span> : null}
                  </div>
                </div>
              </Link>

              <button
                className={u.isFollowing ? 'follow-btn following' : 'follow-btn'}
                type="button"
                onClick={() => toggleFollow(u)}
              >
                {u.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}

          {!loading && trimmed.length >= 2 && !results.length ? (
            <div className="search-empty">No users found.</div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
