import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Crown, MapPin, Pencil, Shield, Trophy, Trash2, Users, X } from 'lucide-react'

import NavBar from '../components/NavBar'
import Avatar from '../components/Avatar'
import SegmentedControl from '../components/ui/SegmentedControl'
import ActivityCard from '../components/home/ActivityCard'
import SocialModal from '../components/home/SocialModal'

import {
  createClubPost,
  deleteClub,
  getClub,
  getClubLeaderboard,
  getClubMembers,
  getClubFeed,
  getClubPosts,
  inviteToClub,
  joinClub,
  leaveClub,
  removeClubMember,
  setClubMemberRole,
  updateClub,
} from '../api/clubs'
import { searchUsers } from '../api/users'
import '../styles/ClubDetails.css'

import { useUnitsValue } from '../preferences'
import { formatDistance } from '../utils/format'

function sportLabel(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'run') return 'Running'
  if (v === 'walk') return 'Walking'
  if (v === 'hike') return 'Hiking'
  if (v === 'cycle') return 'Cycling'
  return 'Sport'
}

function fmtDuration(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return '--'
  const s = Math.round(n)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

export default function ClubDetails() {
  const { id } = useParams()
  const units = useUnitsValue()

  const [club, setClub] = useState(null)
  const [viewer, setViewer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('posts')

  const [posts, setPosts] = useState([])
  const [clubPosts, setClubPosts] = useState([])
  const [members, setMembers] = useState([])
  const [leaders, setLeaders] = useState([])
  const [lbDays, setLbDays] = useState(28)

  const [postsMode, setPostsMode] = useState('club')
  const [postBody, setPostBody] = useState('')
  const [postImages, setPostImages] = useState([])

  const postPreviews = useMemo(() => {
    return (postImages || []).map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }))
  }, [postImages])

  useEffect(() => {
    return () => {
      ;(postPreviews || []).forEach((p) => {
        try {
          URL.revokeObjectURL(p.url)
        } catch {
          // ignore
        }
      })
    }
  }, [postPreviews])

  const [busy, setBusy] = useState(false)

  const [socialId, setSocialId] = useState('')
  const [socialTab, setSocialTab] = useState('comments')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteQ, setInviteQ] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteResults, setInviteResults] = useState([])
  const inviteTimerRef = useRef(null)

  const isOwner = Boolean(viewer?.role === 'owner' || club?.ownerId === viewer?.id)
  const isAdmin = Boolean(viewer?.role === 'admin')
  const isMember = Boolean(viewer?.isMember)
  const canManage = isOwner || isAdmin

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editSport, setEditSport] = useState('run')
  const [editDesc, setEditDesc] = useState('')
  const [editAccess, setEditAccess] = useState('open')
  const [editAvatar, setEditAvatar] = useState(null)
  const [editBanner, setEditBanner] = useState(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const refreshBase = async () => {
    const res = await getClub(id)
    setClub(res?.club || null)
    setViewer(res?.viewer || null)
    return res
  }

  const refreshTab = async (nextTab, baseRes) => {
    const t = nextTab || tab
    if (t === 'posts') {
      if (postsMode === 'workouts') {
        const res = await getClubFeed(id, 20)
        setPosts(res?.items || [])
      } else {
        const res = await getClubPosts(id, 20)
        setClubPosts(res?.items || [])
      }
    } else if (t === 'members') {
      const res = await getClubMembers(id)
      setMembers(res?.members || [])
      if (res?.viewer?.role) setViewer((prev) => ({ ...(prev || {}), role: res.viewer.role }))
    } else {
      const res = await getClubLeaderboard(id, lbDays)
      setLeaders(res?.items || [])
    }
    if (baseRes) {
      setClub(baseRes?.club || null)
      setViewer(baseRes?.viewer || null)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const base = await refreshBase()
        if (cancelled) return
        if (base?.viewer?.isMember) {
          await refreshTab('posts', base)
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load club')
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
    if (!isMember) return
    let cancelled = false
    void (async () => {
      try {
        await refreshTab(tab)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, lbDays, isMember])

  useEffect(() => {
    if (!isMember) return
    if (tab !== 'posts') return
    let cancelled = false
    void (async () => {
      try {
        await refreshTab('posts')
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postsMode])

  useEffect(() => {
    if (!inviteOpen) return
    const q = String(inviteQ || '').trim()
    if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current)
    if (q.length < 2) {
      setInviteResults([])
      setInviteLoading(false)
      return
    }

    setInviteLoading(true)
    inviteTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await searchUsers(q)
          setInviteResults(res?.users || [])
        } catch {
          setInviteResults([])
        } finally {
          setInviteLoading(false)
        }
      })()
    }, 250)

    return () => {
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current)
    }
  }, [inviteQ, inviteOpen])

  const onJoin = async () => {
    setBusy(true)
    setError('')
    try {
      await joinClub(id)
      const base = await refreshBase()
      await refreshTab('posts', base)
      setTab('posts')
    } catch (e) {
      setError(e?.message || 'Could not join')
    } finally {
      setBusy(false)
    }
  }

  const onLeave = async () => {
    setBusy(true)
    setError('')
    try {
      await leaveClub(id)
      await refreshBase()
      setPosts([])
      setClubPosts([])
      setMembers([])
      setLeaders([])
    } catch (e) {
      setError(e?.message || 'Could not leave')
    } finally {
      setBusy(false)
    }
  }

  const openEdit = () => {
    if (!club) return
    setEditName(club?.name || '')
    setEditLocation(club?.location || '')
    setEditSport(club?.sport || 'run')
    setEditDesc(club?.description || '')
    setEditAccess(club?.isInviteOnly ? 'invite' : 'open')
    setEditAvatar(null)
    setEditBanner(null)
    setEditOpen(true)
  }

  const onSaveEdit = async (e) => {
    e.preventDefault()
    if (!canManage) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('name', editName)
      form.append('location', editLocation)
      form.append('sport', editSport)
      form.append('description', editDesc)
      if (isOwner) form.append('isInviteOnly', editAccess === 'invite' ? 'true' : 'false')
      if (editAvatar) form.append('avatar', editAvatar)
      if (editBanner) form.append('banner', editBanner)

      await updateClub(id, form)
      setEditOpen(false)
      const base = await refreshBase()
      if (base?.viewer?.isMember) await refreshTab(tab, base)
    } catch (e2) {
      setError(e2?.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const onSetRole = async (userId, role) => {
    if (!isOwner) return
    setBusy(true)
    setError('')
    try {
      await setClubMemberRole(id, userId, role)
      const res = await getClubMembers(id)
      setMembers(res?.members || [])
    } catch (e) {
      setError(e?.message || 'Failed to change role')
    } finally {
      setBusy(false)
    }
  }

  const onRemoveMember = async (userId) => {
    if (!canManage) return
    setBusy(true)
    setError('')
    try {
      await removeClubMember(id, userId)
      const res = await getClubMembers(id)
      setMembers(res?.members || [])
    } catch (e) {
      setError(e?.message || 'Failed to remove member')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!isOwner) return
    setBusy(true)
    setError('')
    try {
      await deleteClub(id, deleteConfirm)
      window.location.href = '/clubs'
    } catch (e) {
      setError(e?.message || 'Failed to delete club')
    } finally {
      setBusy(false)
    }
  }

  const onInvite = async (userId) => {
    setBusy(true)
    setError('')
    try {
      await inviteToClub(id, userId)
      setInviteQ('')
      setInviteResults([])
    } catch (e) {
      setError(e?.message || 'Could not invite')
    } finally {
      setBusy(false)
    }
  }

  const onPickPostImages = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => String(f.type || '').startsWith('image/'))
    if (!files.length) return
    setPostImages((prev) => [...(prev || []), ...files].slice(0, 6))
    e.target.value = ''
  }

  const removePostImage = (idx) => {
    setPostImages((prev) => (prev || []).filter((_, i) => i !== idx))
  }

  const onCreatePost = async (e) => {
    e.preventDefault()
    if (!isMember) return
    setBusy(true)
    setError('')
    try {
      const body = String(postBody || '').trim()
      const images = postImages || []
      await createClubPost(id, { body, images })
      setPostBody('')
      setPostImages([])
      const res = await getClubPosts(id, 20)
      setClubPosts(res?.items || [])
    } catch (e2) {
      setError(e2?.message || 'Failed to post')
    } finally {
      setBusy(false)
    }
  }

  const fmtWhen = (iso) => {
    const d = iso ? new Date(iso) : null
    if (!d || Number.isNaN(d.getTime())) return ''
    return d.toLocaleString()
  }

  const onSocialUpdate = (activityId, patch) => {
    setPosts((prev) =>
      (prev || []).map((it) => {
        if (it?.type !== 'activity') return it
        if (it?.id !== activityId) return it
        return { ...it, social: { ...(it.social || {}), ...(patch || {}) } }
      }),
    )
  }

  const onOpenSocial = (activityId, nextTab) => {
    setSocialId(String(activityId || ''))
    setSocialTab(nextTab === 'kudos' ? 'kudos' : 'comments')
  }

  const onCloseSocial = () => {
    setSocialId('')
    setSocialTab('comments')
  }

  const socialItem = useMemo(() => {
    if (!socialId) return null
    return (posts || []).find((it) => it?.type === 'activity' && it?.id === socialId) || null
  }, [socialId, posts])

  return (
    <div className="club-page">
      <NavBar />

      <main className="club-wrap">
        {error ? <div className="club-banner err">{error}</div> : null}
        {loading ? <div className="club-banner">Loading…</div> : null}

        <section className="club-hero">
          <div
            className="club-cover"
            aria-hidden="true"
            style={club?.bannerUrl ? { '--clubBanner': `url(${club.bannerUrl})` } : undefined}
          >
            <div className="club-cover-overlay" aria-hidden="true" />
          </div>

          <div className="club-card">
            <div className="club-mark" aria-hidden="true">
              <Avatar avatarUrl={club?.avatarUrl} seed={club?.name || club?.id} alt="" className="club-avatar" size={92} />
            </div>
            <div className="club-main">
              <div className="club-name">{club?.name || 'Club'}</div>
              <div className="club-meta">
                <span className="m">
                  <MapPin size={14} />
                  {club?.location || '—'}
                </span>
                <span className="m">
                  <Users size={14} />
                  {club?.memberCount ?? 0} members
                </span>
                <span className="m">{sportLabel(club?.sport)}</span>
              </div>
              <p className="club-desc">{club?.description || ''}</p>

              <div className="club-cta">
                {!isMember ? (
                  club?.isInviteOnly ? (
                    <div className="club-lock">Invite-only</div>
                  ) : (
                    <button className="club-btn primary" type="button" onClick={onJoin} disabled={busy}>
                      Join club
                    </button>
                  )
                ) : (
                  <>
                    {canManage ? (
                      <button className="club-btn" type="button" onClick={() => setInviteOpen(true)} disabled={busy}>
                        Invite athletes
                      </button>
                    ) : null}
                    {canManage ? (
                      <button className="club-btn" type="button" onClick={openEdit} disabled={busy}>
                        <Pencil size={16} /> Edit
                      </button>
                    ) : null}
                    <button className="club-btn" type="button" onClick={onLeave} disabled={busy || viewer?.role === 'owner'}>
                      Leave
                    </button>
                    {isOwner ? (
                      <button className="club-btn danger" type="button" onClick={() => setDeleteOpen(true)} disabled={busy}>
                        <Trash2 size={16} /> Delete
                      </button>
                    ) : null}
                  </>
                )}

                <Link to="/clubs" className="club-link">Back to clubs</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="club-body">
          <div className="club-tabs">
            <SegmentedControl
              value={tab}
              ariaLabel="Club tabs"
              options={[
                { value: 'posts', label: 'Posts' },
                { value: 'leaderboard', label: 'Club leaderboard' },
                { value: 'members', label: 'Members' },
              ]}
              onChange={(v) => setTab(['posts', 'leaderboard', 'members'].includes(v) ? v : 'posts')}
              disabled={!isMember}
            />

            {tab === 'leaderboard' ? (
              <div className="lb-controls">
                <span className="k">Window</span>
                <select value={lbDays} onChange={(e) => setLbDays(Number(e.target.value) || 28)}>
                  <option value={7}>7 days</option>
                  <option value={28}>28 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            ) : null}
          </div>

          {!isMember ? (
            <div className="club-gate">
              <div className="t">Join to view club posts, leaderboard, and members.</div>
              <div className="s">Open clubs let anyone join. Invite-only clubs require an owner invite.</div>
            </div>
          ) : tab === 'posts' ? (
            <div className="club-posts">
              <div className="posts-head">
                <SegmentedControl
                  value={postsMode}
                  ariaLabel="Posts mode"
                  options={[
                    { value: 'club', label: 'Club posts' },
                    { value: 'workouts', label: 'Workouts' },
                  ]}
                  onChange={(v) => setPostsMode(v === 'workouts' ? 'workouts' : 'club')}
                />
              </div>

              {postsMode === 'club' ? (
                <>
                  <form className="post-compose" onSubmit={onCreatePost}>
                    <textarea
                      value={postBody}
                      onChange={(e) => setPostBody(e.target.value)}
                      placeholder="Share something with the club…"
                      rows={3}
                    />
                    <div className="post-tools">
                      <label className="img-pick">
                        <input type="file" accept="image/*" multiple onChange={onPickPostImages} />
                        Add photos
                      </label>
                      <button
                        className="club-btn primary"
                        type="submit"
                        disabled={busy || (!String(postBody || '').trim() && !(postImages || []).length)}
                      >
                        Post
                      </button>
                    </div>

                    {postPreviews.length ? (
                      <div className="post-previews">
                        {postPreviews.map((p, idx) => (
                          <div key={`${p.name}-${idx}`} className="pimg">
                            <img src={p.url} alt="" />
                            <button type="button" className="rm" onClick={() => removePostImage(idx)} aria-label="Remove">
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </form>

                  <div className="post-list">
                    {clubPosts.map((p) => (
                      <article key={p.id} className="post-card">
                        <div className="post-top">
                          <div className="av">
                            <Avatar avatarUrl={p.author?.avatarUrl} seed={p.author?.username || p.author?.id || p.author?.name} alt="" size={44} />
                          </div>
                          <div className="who">
                            <div className="n">{p.author?.name || 'Athlete'}</div>
                            <div className="s">{fmtWhen(p.createdAt)}</div>
                          </div>
                        </div>

                        {p.body ? <div className="post-body">{p.body}</div> : null}

                        {p.media?.length ? (
                          <div className="post-media">
                            {p.media.map((m, idx) => (
                              <a key={`${m.url}-${idx}`} className="m" href={m.url} target="_blank" rel="noreferrer">
                                <img src={m.url} alt="" loading="lazy" />
                              </a>
                            ))}
                          </div>
                        ) : null}

                        {p.activity ? (
                          <div className="post-activity">
                            <div className="k">Workout</div>
                            <Link to={`/activities/${p.activity.id}`} className="a">
                              <span className="t">{p.activity.title || p.activity.sport}</span>
                              <span className="s">{formatDistance(p.activity.distanceMeters, units)} · {fmtDuration(p.activity.durationSeconds)}</span>
                            </Link>
                          </div>
                        ) : null}
                      </article>
                    ))}
                    {!clubPosts.length && !loading ? <div className="club-muted">No club posts yet.</div> : null}
                  </div>
                </>
              ) : (
                <div className="club-feed">
                  {posts.map((it, idx) => (
                    <div key={it.id} className="club-feed-item" style={{ '--i': idx }}>
                      <ActivityCard item={it} meId={viewer?.id} units={units} onOpenSocial={onOpenSocial} onSocialUpdate={onSocialUpdate} />
                    </div>
                  ))}
                  {!posts.length && !loading ? <div className="club-muted">No workouts yet.</div> : null}
                </div>
              )}
            </div>
          ) : tab === 'members' ? (
            <div className="members">
              {members.map((m) => (
                <div key={m.id} className="member-row">
                  <div className="av">
                    <Avatar avatarUrl={m.avatarUrl} seed={m.username || m.id || m.name} alt="" size={44} />
                  </div>
                  <div className="main">
                    <div className="n">{m.name}</div>
                    <div className="s">{m.username ? `@${m.username}` : 'Athlete'}</div>
                  </div>
                  <div className="role">
                    {m.role === 'owner' ? <span className="pill"><Crown size={14} /> Owner</span> : null}
                    {m.role === 'admin' ? <span className="pill"><Shield size={14} /> Admin</span> : null}
                    {m.role !== 'owner' && m.role !== 'admin' ? <span className="pill">Member</span> : null}
                  </div>

                  {canManage && m.role !== 'owner' ? (
                    <div className="member-manage">
                      {isOwner ? (
                        <select
                          value={m.role === 'admin' ? 'admin' : 'member'}
                          onChange={(e) => onSetRole(m.id, e.target.value)}
                          disabled={busy}
                          aria-label="Member role"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : null}

                      <button
                        type="button"
                        className="kick"
                        onClick={() => onRemoveMember(m.id)}
                        disabled={busy || (viewer?.role === 'admin' && m.role === 'admin')}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {!members.length && !loading ? <div className="club-muted">No members found.</div> : null}
            </div>
          ) : (
            <div className="leaderboard">
              {leaders.map((r, idx) => (
                <div key={r.user?.id || idx} className="lb-row">
                  <div className="rank">{idx + 1}</div>
                  <div className="av">
                    <Avatar avatarUrl={r.user?.avatarUrl} seed={r.user?.username || r.user?.id || r.user?.name} alt="" size={44} />
                  </div>
                  <div className="main">
                    <div className="n">{r.user?.name || 'Member'}</div>
                    <div className="s">{r.user?.username ? `@${r.user.username}` : ''}</div>
                  </div>
                  <div className="metrics">
                  <div className="m">
                    <Trophy size={14} />
                    {formatDistance(r.distanceMeters, units)}
                  </div>
                  <div className="m">{r.activities} acts</div>
                  <div className="m">{fmtDuration(r.timeSeconds)}</div>
                </div>
              </div>
            ))}
              {!leaders.length && !loading ? <div className="club-muted">No activity in this window.</div> : null}
            </div>
          )}
        </section>

        <SocialModal
          open={Boolean(socialId)}
          item={socialItem}
          tab={socialTab}
          onTab={setSocialTab}
          onClose={onCloseSocial}
          onSocialUpdate={onSocialUpdate}
        />
      </main>

      {inviteOpen ? (
        <div className="club-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={() => !busy && setInviteOpen(false)}>
          <div className="club-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="club-modal-head">
              <div>
                <div className="t">Invite athletes</div>
                <div className="s">Search and invite to this club.</div>
              </div>
              <button className="x" type="button" onClick={() => !busy && setInviteOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="club-modal-body">
              <input value={inviteQ} onChange={(e) => setInviteQ(e.target.value)} placeholder="Type a name or @username" />
              {inviteLoading ? <div className="club-muted">Searching…</div> : null}
              <div className="invite-list">
                {inviteResults.map((u) => {
                  const name = `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || (u?.username ? `@${u.username}` : 'User')
                  return (
                    <button key={u.id} className="invite-row" type="button" onClick={() => onInvite(u.id)} disabled={busy}>
                      <div className="av"><Avatar avatarUrl={u.avatarUrl} seed={u.username || u.id || name} alt="" size={44} /></div>
                      <div className="main">
                        <div className="n">{name}</div>
                        <div className="s">{u.username ? `@${u.username}` : 'Athlete'}</div>
                      </div>
                      <div className="go">Invite</div>
                    </button>
                  )
                })}
                {!inviteLoading && inviteQ.trim().length >= 2 && !inviteResults.length ? <div className="club-muted">No users found.</div> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="club-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={() => !busy && setEditOpen(false)}>
          <div className="club-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="club-modal-head">
              <div>
                <div className="t">Edit club</div>
                <div className="s">Update details and images. Admins can edit; only owner can change access.</div>
              </div>
              <button className="x" type="button" onClick={() => !busy && setEditOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form className="club-modal-body" onSubmit={onSaveEdit}>
              <label className="f">
                Name
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>

              <label className="f">
                Location
                <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
              </label>

              <label className="f">
                Sport
                <select value={editSport} onChange={(e) => setEditSport(e.target.value)}>
                  <option value="run">Running</option>
                  <option value="walk">Walking</option>
                  <option value="hike">Hiking</option>
                  <option value="cycle">Cycling</option>
                </select>
              </label>

              <label className="f">
                Description
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} />
              </label>

              {isOwner ? (
                <div className="f">
                  <div className="k">Access</div>
                  <SegmentedControl
                    value={editAccess}
                    ariaLabel="Club access"
                    options={[
                      { value: 'open', label: 'Open' },
                      { value: 'invite', label: 'Invite only' },
                    ]}
                    onChange={(v) => setEditAccess(v === 'invite' ? 'invite' : 'open')}
                    disabled={busy}
                  />
                </div>
              ) : null}

              <div className="f images">
                <label className="pick">
                  <span>Avatar image</span>
                  <input type="file" accept="image/*" onChange={(e) => setEditAvatar((e.target.files || [])[0] || null)} />
                </label>
                <label className="pick">
                  <span>Banner image</span>
                  <input type="file" accept="image/*" onChange={(e) => setEditBanner((e.target.files || [])[0] || null)} />
                </label>
              </div>

              <button className="club-btn primary" type="submit" disabled={busy || !editName.trim() || !editLocation.trim() || !editDesc.trim()}>
                Save
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="club-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={() => !busy && setDeleteOpen(false)}>
          <div className="club-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="club-modal-head">
              <div>
                <div className="t">Delete club</div>
                <div className="s">This permanently deletes the club, invites, and memberships.</div>
              </div>
              <button className="x" type="button" onClick={() => !busy && setDeleteOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="club-modal-body">
              <label className="f">
                Type DELETE to confirm
                <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
              </label>
              <button className="club-btn danger" type="button" onClick={onDelete} disabled={busy || deleteConfirm.trim().toUpperCase() !== 'DELETE'}>
                Delete club
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
