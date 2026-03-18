import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Plus, Search, Users, X } from 'lucide-react'

import NavBar from '../components/NavBar'
import SegmentedControl from '../components/ui/SegmentedControl'
import Avatar from '../components/Avatar'
import { searchUsers } from '../api/users'
import {
  acceptInvite,
  createClub,
  declineInvite,
  discoverClubs,
  getMyClubs,
  getMyInvites,
  inviteToClub,
  joinClub,
  leaveClub,
} from '../api/clubs'

import '../styles/Clubs.css'

const SPORT_OPTIONS = [
  { value: 'run',   label: 'Running' },
  { value: 'walk',  label: 'Walking' },
  { value: 'hike',  label: 'Hiking' },
  { value: 'cycle', label: 'Cycling' },
]

function sportLabel(s) {
  const v = String(s || '').toLowerCase()
  return SPORT_OPTIONS.find((x) => x.value === v)?.label || 'Sport'
}

function safeText(s, max = 180) {
  const t = String(s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export default function Clubs() {
  const navigate = useNavigate()
  const [mine,     setMine]     = useState([])
  const [discover, setDiscover] = useState([])
  const [invites,  setInvites]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  const [q,    setQ]    = useState('')
  const discoverToken = useRef(0)

  const [showCreate, setShowCreate] = useState(false)

  const [name,          setName]          = useState('')
  const [location,      setLocation]      = useState('')
  const [sport,         setSport]         = useState('run')
  const [description,   setDescription]   = useState('')
  const [access,        setAccess]        = useState('open')
  const [avatarFile,    setAvatarFile]    = useState(null)
  const [bannerFile,    setBannerFile]    = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')

  const [inviteClub,    setInviteClub]    = useState(null)
  const [inviteQ,       setInviteQ]       = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [inviteLoading, setInviteLoading] = useState(false)

  const myIds   = useMemo(() => new Set((mine || []).map((c) => c.id)), [mine])
  const trimmed = useMemo(() => String(q || '').trim(), [q])

  const resetForm = () => {
    setName(''); setLocation(''); setSport('run'); setDescription(''); setAccess('open')
    setAvatarFile(null); setBannerFile(null); setAvatarPreview(''); setBannerPreview('')
  }

  const refreshStatic = async () => {
    const [m, inv] = await Promise.all([getMyClubs(), getMyInvites()])
    setMine(m?.clubs || [])
    setInvites(inv?.invites || [])
  }

  const refreshDiscover = async (nextQ = trimmed) => {
    const tok = Date.now()
    discoverToken.current = tok
    try {
      const res = await discoverClubs({ take: 8, q: nextQ })
      if (discoverToken.current !== tok) return
      setDiscover(res?.clubs || [])
    } catch (e) {
      if (discoverToken.current !== tok) return
      setDiscover([])
      setError(e?.message || 'Failed to load clubs')
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true); setError('')
      try {
        await refreshStatic()
        await refreshDiscover('')
        if (cancelled) return
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load clubs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const query = trimmed
    const t = setTimeout(() => {
      void refreshDiscover(query)
    }, query.length >= 2 ? 250 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed])

  useEffect(() => {
    let alive = true
    const query = String(inviteQ || '').trim()
    if (!inviteClub || query.length < 2) {
      setInviteResults([]); setInviteLoading(false)
      return () => {}
    }
    setInviteLoading(true)
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await searchUsers(query)
          if (!alive) return
          setInviteResults(res?.users || [])
        } catch {
          if (!alive) return
          setInviteResults([])
        } finally {
          if (alive) setInviteLoading(false)
        }
      })()
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [inviteQ, inviteClub])

  useEffect(() => {
    if (!showCreate) return
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate])

  const onPickAvatar = (f) => {
    if (!f) return
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f))
  }
  const onPickBanner = (f) => {
    if (!f) return
    if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    setBannerFile(f); setBannerPreview(URL.createObjectURL(f))
  }

  const onCreate = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (!avatarFile) throw new Error('Club avatar is required')
      if (!bannerFile) throw new Error('Club banner is required')
      const form = new FormData()
      form.append('name', name); form.append('location', location)
      form.append('sport', sport); form.append('description', description)
      form.append('isInviteOnly', access === 'invite' ? 'true' : 'false')
      form.append('avatar', avatarFile); form.append('banner', bannerFile)
      await createClub(form)
      setShowCreate(false); resetForm()
      await refreshStatic(); await refreshDiscover(trimmed)
    } catch (e2) {
      setError(e2?.message || 'Failed to create club')
    } finally { setBusy(false) }
  }

  const onJoin = async (id) => {
    setBusy(true); setError('')
    try { await joinClub(id); await refreshStatic(); await refreshDiscover(trimmed) }
    catch (e) { setError(e?.message || 'Could not join') }
    finally { setBusy(false) }
  }

  const onLeave = async (id, myRole) => {
    setBusy(true); setError('')
    try {
      if (myRole === 'owner') throw new Error('Owner cannot leave the club')
      await leaveClub(id); await refreshStatic(); await refreshDiscover(trimmed)
    } catch (e) { setError(e?.message || 'Could not leave') }
    finally { setBusy(false) }
  }

  const onAccept = async (inviteId) => {
    setBusy(true); setError('')
    try { await acceptInvite(inviteId); await refreshStatic(); await refreshDiscover(trimmed) }
    catch (e) { setError(e?.message || 'Could not accept invite') }
    finally { setBusy(false) }
  }

  const onDecline = async (inviteId) => {
    setBusy(true); setError('')
    try { await declineInvite(inviteId); await refreshStatic() }
    catch (e) { setError(e?.message || 'Could not decline invite') }
    finally { setBusy(false) }
  }

  const onInvite = async (clubId, userId) => {
    setBusy(true); setError('')
    try { await inviteToClub(clubId, userId); setInviteQ(''); setInviteResults([]) }
    catch (e) { setError(e?.message || 'Could not invite user') }
    finally { setBusy(false) }
  }

  return (
    <div className="clubs-page">
      <NavBar />

      <main className="clubs-wrap">

        {/* ── HEADER ── */}
        <header className="clubs-head">
          <div className="clubs-head-left">
            <h1 className="clubs-title">Clubs</h1>
          </div>
          <button className="clubs-primary" type="button" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create club
          </button>
        </header>

        {/* ── SEARCH ── */}
        <div className="clubs-tools" aria-label="Club search">
          <div className="clubs-search">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, location, or description…"
            />
          </div>
        </div>

        {error  ? <div className="clubs-banner err">{error}</div>  : null}
        {loading ? <div className="clubs-banner">Loading…</div>    : null}

        {/* ── INVITES ── */}
        {invites.length ? (
          <section className="clubs-section">
            <div className="clubs-section-title">
              <span className="s-icon"><Users size={14} /></span>
              Invites
            </div>
            <div className="clubs-cards">
              {invites.map((i) => (
                <article
                  key={i.id}
                  className="club-tile invite"
                  role="button"
                  tabIndex={0}
                  onClick={() => i.clubId && navigate(`/clubs/${i.clubId}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (i.clubId) navigate(`/clubs/${i.clubId}`)
                    }
                  }}
                >
                  {/* head */}
                  <div className="club-tile-head">
                    <div className="club-tile-icon soft" aria-hidden="true">🎟</div>
                    <div className="club-tile-main">
                      <span className="club-tile-name">{i.club?.name || 'Club invite'}</span>
                      <div className="club-tile-meta">
                        <span className="m"><Users size={12} />{i.club?.memberCount || 0} members</span>
                        <span className="m">{sportLabel(i.club?.sport)}</span>
                      </div>
                    </div>
                    <div className="club-tile-status">Invite</div>
                  </div>
                  {/* body */}
                  <div className="club-tile-body">
                    <div className="club-tile-desc">{safeText(i.club?.description || '', 140)}</div>
                  </div>
                  {/* foot */}
                  <div className="club-tile-actions">
                    <button className="club-action blue" type="button" onClick={(e) => { e.stopPropagation(); onAccept(i.id) }} disabled={busy}>Accept</button>
                    <button className="club-action orange" type="button" onClick={(e) => { e.stopPropagation(); onDecline(i.id) }} disabled={busy}>Decline</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── YOUR CLUBS ── */}
        <section className="clubs-section">
          <div className="clubs-section-title">
            <span className="s-icon"><Users size={14} /></span>
            Your clubs
          </div>

          {!loading && !mine.length ? (
            <div className="clubs-empty">
              <div className="icon"><Users size={20} /></div>
              <div>
                <div className="t">You're not in any club yet</div>
                <div className="s">Create one or join an open club below.</div>
              </div>
              <button className="clubs-primary ghost" type="button" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Create
              </button>
            </div>
          ) : (
            <div className="clubs-cards">
              {mine.map((c) => (
                <article
                  key={c.id}
                  className="club-tile"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/clubs/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/clubs/${c.id}`)
                    }
                  }}
                >
                  {/* head */}
                  <div className="club-tile-head">
                    <div className="club-tile-icon">
                      {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : null}
                    </div>
                    <div className="club-tile-main">
                      <span className="club-tile-name">{c.name}</span>
                      <div className="club-tile-meta">
                        <span className="m"><Users size={12} />{c.memberCount} members</span>
                        {c.location ? <span className="m"><MapPin size={12} />{c.location}</span> : null}
                        <span className="m">{sportLabel(c.sport)}</span>
                      </div>
                    </div>
                    <div className="club-tile-status">{c.isInviteOnly ? 'Invite only' : 'Open'}</div>
                  </div>
                  {/* body */}
                  <div className="club-tile-body">
                    <div className="club-tile-desc">{safeText(c.description, 140)}</div>
                  </div>
                  {/* foot */}
                  <div className="club-tile-actions">
                    {c.myRole === 'owner' || c.myRole === 'admin' ? (
                      <button className="club-action blue" type="button" onClick={(e) => { e.stopPropagation(); setInviteClub(c) }} disabled={busy}>Invite members</button>
                    ) : (
                      <Link className="club-action blue" to={`/clubs/${c.id}`} onClick={(e) => e.stopPropagation()}>Open club</Link>
                    )}
                    <button
                      className="club-action"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onLeave(c.id, c.myRole) }}
                      disabled={busy || c.myRole === 'owner'}
                    >
                      Leave
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── FEATURED ── */}
        <section className="clubs-section">
          <div className="clubs-section-title">
            <span className="s-icon"><Search size={14} /></span>
            Featured
          </div>
          <div className="clubs-cards">
            {discover
              .filter((c) => !myIds.has(c.id))
              .map((c) => (
                <article
                  key={c.id}
                  className="club-tile"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/clubs/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/clubs/${c.id}`)
                    }
                  }}
                >
                  {/* head */}
                  <div className="club-tile-head">
                    <div className="club-tile-icon">
                      {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : null}
                    </div>
                    <div className="club-tile-main">
                      <span className="club-tile-name">{c.name}</span>
                      <div className="club-tile-meta">
                        <span className="m"><Users size={12} />{c.memberCount} members</span>
                        {c.location ? <span className="m"><MapPin size={12} />{c.location}</span> : null}
                        <span className="m">{sportLabel(c.sport)}</span>
                      </div>
                    </div>
                    <div className="club-tile-status">Open</div>
                  </div>
                  {/* body */}
                  <div className="club-tile-body">
                    <div className="club-tile-desc">{safeText(c.description, 140)}</div>
                  </div>
                  {/* foot */}
                  <div className="club-tile-actions">
                    <button className="club-action blue" type="button" onClick={(e) => { e.stopPropagation(); onJoin(c.id) }} disabled={busy}>Join</button>
                    <Link className="club-action orange" to={`/clubs/${c.id}`} onClick={(e) => e.stopPropagation()}>Open</Link>
                  </div>
                </article>
              ))}
            {!loading && !discover.length
              ? <div className="clubs-muted">No clubs found.</div>
              : null}
          </div>
        </section>

      </main>

      {/* ── CREATE MODAL ── */}
      {showCreate ? (
        <div
          className="clubs-modal-backdrop"
          role="dialog" aria-modal="true"
          onMouseDown={() => !busy && setShowCreate(false)}
        >
          <div className="clubs-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="clubs-modal-head">
              <div>
                <div className="clubs-modal-title">Create a club</div>
                <div className="clubs-modal-sub">Clubs require a banner and an avatar. Make it feel real.</div>
              </div>
              <button className="clubs-x" type="button" onClick={() => !busy && setShowCreate(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <form className="clubs-form" onSubmit={onCreate}>
              <div className="clubs-media">
                <div className="media-item">
                  <div className="label">Club avatar</div>
                  <label className="pick">
                    <input type="file" accept="image/*" onChange={(e) => onPickAvatar((e.target.files || [])[0] || null)} />
                    <div className="preview avatar">
                      {avatarPreview ? <img src={avatarPreview} alt="" /> : <div className="ph">Pick image</div>}
                    </div>
                  </label>
                </div>
                <div className="media-item">
                  <div className="label">Club banner</div>
                  <label className="pick">
                    <input type="file" accept="image/*" onChange={(e) => onPickBanner((e.target.files || [])[0] || null)} />
                    <div className="preview banner">
                      {bannerPreview ? <img src={bannerPreview} alt="" /> : <div className="ph">Pick image</div>}
                    </div>
                  </label>
                </div>
              </div>

              <label>Club name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pace42 Downtown" /></label>
              <label>Location  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Rabat, Morocco" /></label>
              <label>Sport
                <select value={sport} onChange={(e) => setSport(e.target.value)}>
                  {SPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label>Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Who the club is for, when you meet, and what kind of pace."
                  rows={4}
                />
              </label>

              <div className="clubs-access">
                <div className="k">Access</div>
                <SegmentedControl
                  value={access}
                  ariaLabel="Club access"
                  options={[{ value: 'open', label: 'Open' }, { value: 'invite', label: 'Invite only' }]}
                  onChange={(v) => setAccess(v === 'invite' ? 'invite' : 'open')}
                  disabled={busy}
                />
              </div>

              <button
                className="clubs-primary"
                type="submit"
                disabled={busy || !name.trim() || !location.trim() || !description.trim() || !avatarFile || !bannerFile}
              >
                {busy ? 'Creating…' : 'Create club'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── INVITE MODAL ── */}
      {inviteClub ? (
        <div
          className="clubs-modal-backdrop"
          role="dialog" aria-modal="true"
          onMouseDown={() => !busy && setInviteClub(null)}
        >
          <div className="clubs-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="clubs-modal-head">
              <div>
                <div className="clubs-modal-title">Invite to {inviteClub?.name}</div>
                <div className="clubs-modal-sub">Search a user and send an invite.</div>
              </div>
              <button className="clubs-x" type="button" onClick={() => !busy && setInviteClub(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="clubs-form">
              <label>
                Search
                <input value={inviteQ} onChange={(e) => setInviteQ(e.target.value)} placeholder="Type a name or @username" />
              </label>

              {inviteLoading ? <div className="clubs-muted">Searching…</div> : null}

              {!inviteLoading && inviteQ.trim().length >= 2 ? (
                <div className="invite-results">
                  {inviteResults.map((u) => {
                    const nm = `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || (u?.username ? `@${u.username}` : 'User')
                    return (
                      <button key={u.id} type="button" className="invite-row" onClick={() => onInvite(inviteClub.id, u.id)} disabled={busy}>
                        <div className="av">
                          <Avatar avatarUrl={u?.avatarUrl} seed={u?.username || u?.id || nm} alt="" size={44} />
                        </div>
                        <div className="main">
                          <div className="n">{nm}</div>
                          {u?.username ? <div className="s">@{u.username}</div> : <div className="s">Athlete</div>}
                        </div>
                        <div className="go">Invite</div>
                      </button>
                    )
                  })}
                  {!inviteResults.length ? <div className="clubs-muted">No users found.</div> : null}
                </div>
              ) : (
                <div className="clubs-muted">Type 2+ characters to search.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
