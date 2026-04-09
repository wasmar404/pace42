import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, CalendarDays, ChevronDown, ChevronRight, Clock, Filter, List, Route, Search, SlidersHorizontal, TrendingUp, X, Zap } from 'lucide-react'

import NavBar from '../components/NavBar'
import { listMyActivities } from '../api/activities'
import { backendGet } from '../backendApi'
import { formatDistance, formatDuration, formatPaceOrSpeed } from '../utils/format'
import '../styles/Training.css'

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString(undefined, { month: 'short', day: '2-digit' })
  } catch {
    return '-'
  }
}

const SPORT_ICONS = {
  run: '🏃',
  walk: '🚶',
  ride: '🚴',
  cycle: '🚴',
}

function clampNum(n, min, max) {
  const x = Number(n)
  if (!Number.isFinite(x)) return ''
  return String(Math.max(min, Math.min(max, x)))
}

function metersFromKm(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const x = Number(raw)
  if (!Number.isFinite(x) || x <= 0) return ''
  return Math.round(x * 1000)
}

function sportLabel(s) {
  const x = String(s || '').toLowerCase()
  if (x === 'run') return 'Run'
  if (x === 'walk') return 'Walk'
  if (x === 'ride' || x === 'cycle') return 'Ride'
  if (x === 'hike') return 'Hike'
  return x || 'Workout'
}

const FILTER_DEFS = [
  { key: 'sport',   label: 'Sport',        icon: Activity,     type: 'select',
    options: [
      { value: 'any', label: 'Any' },
      { value: 'run', label: 'Run' },
      { value: 'walk', label: 'Walk' },
      { value: 'cycle', label: 'Ride' },
    ],
  },
  { key: 'from',    label: 'Date from',    icon: CalendarDays, type: 'date'   },
  { key: 'to',      label: 'Date to',      icon: CalendarDays, type: 'date'   },
  { key: 'minDist', label: 'Min distance', icon: Route,        type: 'number', placeholder: '0'  },
  { key: 'maxDist', label: 'Max distance', icon: Route,        type: 'number', placeholder: '—'  },
  { key: 'minDur',  label: 'Min duration', icon: Clock,        type: 'number', placeholder: '0'  },
  { key: 'maxDur',  label: 'Max duration', icon: Clock,        type: 'number', placeholder: '—'  },
  { key: 'source',  label: 'Source',       icon: Filter,       type: 'select',
    options: [{ value: 'any', label: 'Any' }, { value: 'manual', label: 'Manual' }, { value: 'gpx', label: 'GPX' }] },
]

const SORT_OPTIONS = [
  { value: 'startedAt_desc', label: 'Newest' },
  { value: 'startedAt_asc', label: 'Oldest' },
  { value: 'distance_desc', label: 'Distance (high)' },
  { value: 'distance_asc', label: 'Distance (low)' },
  { value: 'duration_desc', label: 'Duration (high)' },
  { value: 'duration_asc', label: 'Duration (low)' },
  { value: 'createdAt_desc', label: 'Created (new)' },
  { value: 'createdAt_asc', label: 'Created (old)' },
]

const TAKE_OPTIONS = [10, 20, 50]

function filterSublabel(key) {
  if (key === 'minDist' || key === 'maxDist') return 'km'
  if (key === 'minDur'  || key === 'maxDur')  return 'min'
  return null
}

export default function Training() {
  const navigate = useNavigate()

  const [me, setMe] = useState(null)

  const [activeKeys, setActiveKeys] = useState([])
  const [vals, setVals] = useState({
    sport: 'any',
    from: '', to: '', minDist: '', maxDist: '',
    minDur: '', maxDur: '', source: 'any',
  })

  const [sort, setSort] = useState('startedAt_desc')

  const [q,       setQ]       = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [showSortPicker, setShowSortPicker] = useState(false)
  const [showTakePicker, setShowTakePicker] = useState(false)
  const [openChipKey, setOpenChipKey] = useState(null)
  const pickerRef = useRef(null)
  const sortPickerRef = useRef(null)
  const takePickerRef = useRef(null)
  const chipPickerRef = useRef(null)

  const [items,   setItems]   = useState([])
  const [stats,   setStats]   = useState({ total: 0, distanceMeters: 0, durationSeconds: 0 })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const tokenRef = useRef(0)
  const trimmed  = useMemo(() => String(q || '').trim(), [q])

  useEffect(() => {
    if (!showPicker && !showSortPicker && !showTakePicker && !openChipKey) return
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false)
      if (sortPickerRef.current && !sortPickerRef.current.contains(e.target)) setShowSortPicker(false)
      if (takePickerRef.current && !takePickerRef.current.contains(e.target)) setShowTakePicker(false)
      if (openChipKey && chipPickerRef.current && !chipPickerRef.current.contains(e.target)) setOpenChipKey(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker, showSortPicker, showTakePicker, openChipKey])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await backendGet('/api/me')
        if (!cancelled) setMe(res)
      } catch {
        if (!cancelled) setMe(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setVal = (key, value) => setVals((prev) => ({ ...prev, [key]: value }))

  const addFilter = (key) => {
    if (!activeKeys.includes(key)) setActiveKeys((prev) => [...prev, key])
    setShowPicker(false)
  }

  const removeFilter = (key) => {
    setActiveKeys((prev) => prev.filter((k) => k !== key))
    const def = FILTER_DEFS.find((d) => d.key === key)
    setVals((prev) => ({ ...prev, [key]: def?.type === 'select' ? 'any' : '' }))
  }

  const clearAll = () => {
    setActiveKeys([])
    setVals({ sport: 'any', from: '', to: '', minDist: '', maxDist: '', minDur: '', maxDur: '', source: 'any' })
  }

  const activeCount = activeKeys.filter((k) => {
    const v = vals[k]
    return v && v !== 'any' && v !== ''
  }).length

  const params = useMemo(() => {
    const sportV = activeKeys.includes('sport') ? (vals.sport || 'any') : 'any'
    const fromV = activeKeys.includes('from') ? vals.from : ''
    const toV = activeKeys.includes('to') ? vals.to : ''
    const minDistanceMeters  = activeKeys.includes('minDist') ? metersFromKm(vals.minDist) : ''
    const maxDistanceMeters  = activeKeys.includes('maxDist') ? metersFromKm(vals.maxDist) : ''
    const minDurRaw = activeKeys.includes('minDur') ? String(vals.minDur ?? '').trim() : ''
    const maxDurRaw = activeKeys.includes('maxDur') ? String(vals.maxDur ?? '').trim() : ''
    const minDurNum = minDurRaw ? Number(minDurRaw) : NaN
    const maxDurNum = maxDurRaw ? Number(maxDurRaw) : NaN
    const minDurationSeconds = Number.isFinite(minDurNum) && minDurNum > 0 ? Math.round(minDurNum * 60) : ''
    const maxDurationSeconds = Number.isFinite(maxDurNum) && maxDurNum > 0 ? Math.round(maxDurNum * 60) : ''
    const src = activeKeys.includes('source') ? (vals.source || 'any') : 'any'

    const [sortBy, sortDir] = String(sort || 'startedAt_desc').split('_')
    return {
      q: trimmed,
      sport: sportV,
      from: fromV || '',
      to: toV || '',
      source: src,
      minDistanceMeters: minDistanceMeters || '',
      maxDistanceMeters: maxDistanceMeters || '',
      minDurationSeconds: minDurationSeconds || '',
      maxDurationSeconds: maxDurationSeconds || '',
      sortBy,
      sortDir,
      page,
      take: perPage,
    }
  }, [trimmed, vals, activeKeys, sort, page, perPage])

  useEffect(() => {
    const run = async (tok) => {
      tokenRef.current = tok
      setLoading(true)
      setError('')
      try {
        const res = await listMyActivities(params)
        if (tokenRef.current !== tok) return
        setItems(res?.items || [])
        setStats(res?.stats || { total: 0, distanceMeters: 0, durationSeconds: 0 })
      } catch (e) {
        if (tokenRef.current !== tok) return
        setItems([])
        setStats({ total: 0, distanceMeters: 0, durationSeconds: 0 })
        setError(e?.message || 'Failed to load training')
      } finally {
        if (tokenRef.current === tok) setLoading(false)
      }
    }

    const delay = trimmed.length >= 2 ? 250 : 0
    const tok = Date.now()
    if (!delay) {
      void run(tok)
      return () => {}
    }

    const t = window.setTimeout(() => void run(tok), delay)
    return () => window.clearTimeout(t)
  }, [params, trimmed.length])

  const totalDistance = formatDistance(stats?.distanceMeters || 0)
  const totalTime     = formatDuration(stats?.durationSeconds || 0)
  const avgDistance   = stats?.total
    ? formatDistance(Math.round((stats.distanceMeters || 0) / stats.total))
    : formatDistance(0)

  const availableToAdd = FILTER_DEFS.filter((d) => !activeKeys.includes(d.key))
  const sortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label || 'Newest'
  const takeLabel = TAKE_OPTIONS.includes(perPage) ? String(perPage) : '10'

  const pageCount = useMemo(() => {
    const total = Number(stats?.total || 0)
    const n = total > 0 ? Math.ceil(total / perPage) : 1
    return Math.max(1, n)
  }, [stats, perPage])

  useEffect(() => {
    setPage(1)
  }, [trimmed, vals, activeKeys, sort, perPage])

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount))
  }, [pageCount])

  const pageItems = items

  const who = useMemo(() => {
    const u = me?.profile?.username
    if (u) return `@${u}`
    const id = me?.user?.id
    if (id) return id
    return ''
  }, [me])

  return (
    <div className="training-page">
      <NavBar />

      <main className="training-wrap">
        <header className="training-head">
          <div>
            <div className="k">Training</div>
            <h1>Your workouts</h1>
          </div>
          <Link className="training-new" to="/activities/new">Log activity</Link>
        </header>

        <section className="training-filters" aria-label="Training search and filters">
          <div className="tf-row">
            <div className="search">
              <Search size={16} />
              <input
                id="training-search"
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, notes, or sport…"
              />
              {q ? (
                <button type="button" className="clear" aria-label="Clear search" onClick={() => setQ('')}>
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="tf-sort-wrap" ref={sortPickerRef}>
              <button
                type="button"
                className="tf-sort"
                aria-label="Sort"
                onClick={() => setShowSortPicker((v) => !v)}
                aria-expanded={showSortPicker}
              >
                <SlidersHorizontal size={15} />
                <span>{sortLabel}</span>
                <ChevronDown size={13} className={`tf-chevron${showSortPicker ? ' open' : ''}`} />
              </button>

              {showSortPicker && (
                <div className="tf-picker tf-sort-picker" role="menu" aria-label="Sort options">
                  <div className="tf-picker-head">Sort by</div>
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="tf-picker-item"
                      onClick={() => {
                        setSort(opt.value)
                        setShowSortPicker(false)
                      }}
                      role="menuitem"
                    >
                      {opt.label}
                      {sort === opt.value ? <span className="tf-picker-sub">Selected</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="tf-take-wrap" ref={takePickerRef}>
              <button
                type="button"
                className="tf-take"
                aria-label="Items per page"
                onClick={() => setShowTakePicker((v) => !v)}
                aria-expanded={showTakePicker}
              >
                <List size={15} />
                <span>{takeLabel}</span>
                <ChevronDown size={13} className={`tf-chevron${showTakePicker ? ' open' : ''}`} />
              </button>

              {showTakePicker && (
                <div className="tf-picker tf-take-picker" role="menu" aria-label="Items per page options">
                  <div className="tf-picker-head">Items per page</div>
                  {TAKE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="tf-picker-item"
                      onClick={() => {
                        setPerPage(opt)
                        setShowTakePicker(false)
                      }}
                      role="menuitem"
                    >
                      {opt}
                      {perPage === opt ? <span className="tf-picker-sub">Selected</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="tf-filter-wrap" ref={pickerRef}>
              <button
                type="button"
                className={`tf-filter-btn${activeCount > 0 ? ' has-filters' : ''}`}
                onClick={() => setShowPicker((v) => !v)}
                aria-expanded={showPicker}
              >
                <SlidersHorizontal size={15} />
                Filters
                {activeCount > 0 && <span className="tf-count">{activeCount}</span>}
                <ChevronDown size={13} className={`tf-chevron${showPicker ? ' open' : ''}`} />
              </button>

              {showPicker && (
                <div className="tf-picker" role="menu">
                  <div className="tf-picker-head">Add a filter</div>
                  {availableToAdd.length === 0 ? (
                    <div className="tf-picker-empty">All filters added</div>
                  ) : (
                    availableToAdd.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        className="tf-picker-item"
                        onClick={() => addFilter(d.key)}
                        role="menuitem"
                      >
                        <d.icon size={14} />
                        {d.label}
                        {filterSublabel(d.key) ? (
                          <span className="tf-picker-sub">{filterSublabel(d.key)}</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {activeKeys.length > 0 && (
            <div className="tf-chips">
              {activeKeys.map((key) => {
                const def = FILTER_DEFS.find((d) => d.key === key)
                if (!def) return null
                const sub = filterSublabel(key)
                return (
                  <div key={key} className="tf-chip">
                    <def.icon size={13} className="tf-chip-icon" />
                    <span className="tf-chip-label">{def.label}{sub ? ` (${sub})` : ''}</span>

                    {def.type === 'select' ? (
                      <div
                        className="tf-chip-sel-wrap"
                        ref={openChipKey === key ? chipPickerRef : null}
                      >
                        <button
                          type="button"
                          className="tf-chip-sel-btn"
                          onClick={() => setOpenChipKey(openChipKey === key ? null : key)}
                        >
                          <span>{def.options.find((o) => o.value === vals[key])?.label || 'Any'}</span>
                          <ChevronDown size={11} className={`tf-chevron${openChipKey === key ? ' open' : ''}`} />
                        </button>
                        {openChipKey === key && (
                          <div className="tf-picker tf-chip-picker" role="menu">
                            <div className="tf-picker-head">{def.label}</div>
                            {def.options.map((o) => (
                              <button
                                key={o.value}
                                type="button"
                                className={`tf-picker-item${vals[key] === o.value ? ' tf-picker-item--active' : ''}`}
                                onClick={() => { setVal(key, o.value); setOpenChipKey(null) }}
                                role="menuitem"
                              >
                                {o.label}
                                {vals[key] === o.value ? <span className="tf-picker-sub tf-picker-sub--active">Selected</span> : null}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        id={`filter-${key}`}
                        name={`filter_${key}`}
                        className="tf-chip-input"
                        type={def.type === 'date' ? 'date' : 'text'}
                        inputMode={def.type === 'number' ? 'decimal' : undefined}
                        value={vals[key]}
                        onChange={(e) => {
                          const v = def.type === 'number'
                            ? clampNum(e.target.value, 0, 100000)
                            : e.target.value
                          setVal(key, v)
                        }}
                        placeholder={def.placeholder || ''}
                      />
                    )}

                    <button
                      type="button"
                      className="tf-chip-remove"
                      onClick={() => removeFilter(key)}
                      aria-label={`Remove ${def.label} filter`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })}

              {activeKeys.length > 1 && (
                <button type="button" className="tf-clear" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
          )}
        </section>

        <section className="training-stats" aria-label="Training stats">
          <div className="stat"><div className="v">{stats?.total || 0}</div><div className="s">Workouts</div></div>
          <div className="stat"><div className="v">{totalDistance}</div><div className="s">Distance</div></div>
          <div className="stat"><div className="v">{totalTime}</div><div className="s">Time</div></div>
          <div className="stat"><div className="v">{avgDistance}</div><div className="s">Avg / workout</div></div>
        </section>

        {error   ? <div className="training-banner err">{error}</div>   : null}
        {loading ? <div className="training-banner">Loading…</div>      : null}
        <section className="training-list" aria-label="Training log">
          <div className="list-label">
            <span className="s-icon"><List size={14} /></span>
            All workouts
          </div>

          {!loading && !items.length ? (
            <div className="training-empty">
              <div className="icon"><Zap size={20} /></div>
              <div>
                <div className="t">No workouts found</div>
                <div className="s">Try clearing your filters or log your first activity.</div>
                {who ? <div className="s">Account: <span className="mono">{who}</span></div> : null}
              </div>
              <Link className="training-new" to="/activities/new">Log activity</Link>
            </div>
          ) : (
            <div className="workouts-list">
              {pageItems.map((activity, index) => (
                <article
                  key={activity.id}
                  className="workout-item"
                  style={{ animationDelay: `${index * 60}ms` }}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/activities/${activity.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/activities/${activity.id}`)
                    }
                  }}
                >
                  <div className="workout-main">
                    <div className="workout-sport">
                      <span className="sport-emoji">{SPORT_ICONS[activity.sport] || '🏃'}</span>
                    </div>

                    <div className="workout-details">
                      <div className="workout-header">
                        <h3>{activity.title || `${activity.sport} activity`}</h3>
                        <span className="workout-date">{formatWhen(activity.startedAt)}</span>
                      </div>

                      <div className="workout-metrics">
                        <div className="metric">
                          <Route size={14} />
                          <span>{formatDistance(activity.distanceMeters)}</span>
                        </div>
                        <div className="metric">
                          <Clock size={14} />
                          <span>{formatDuration(activity.durationSeconds)}</span>
                        </div>
                        <div className="metric">
                          <TrendingUp size={14} />
                          <span>{formatPaceOrSpeed(activity.sport, activity.distanceMeters, activity.durationSeconds)}</span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight size={20} className="workout-arrow" />
                  </div>

                  {activity.description ? <p className="workout-description">{activity.description}</p> : null}
                </article>
              ))}

              {pageCount > 1 ? (
                <div className="training-pagination" aria-label="Pagination">
                  <button type="button" className="pg" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Prev
                  </button>
                  <div className="pg-meta">Page {page} / {pageCount}</div>
                  <button type="button" className="pg" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
