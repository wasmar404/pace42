import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Activity, 
  Upload, 
  Clock, 
  MapPin, 
  Camera, 
  X, 
  ChevronDown, 
  Globe, 
  Users, 
  Lock,
  Zap,
  Trash2,
  Calendar,
  Timer,
  Route
} from 'lucide-react'

import NavBar from '../components/NavBar'
import { createActivity, importGpx, uploadActivityPhoto } from '../api/activities'
import { getUnits, useUnitsValue } from '../preferences'
import { distanceInUnits, formatPaceOrSpeed } from '../utils/format'
import '../styles/AddActivity.css'

function toMeters(value, units) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const u = units === 'mi' ? 'mi' : 'km'
  const meters = u === 'mi' ? n * 1609.344 : n * 1000
  return Math.max(1, Math.round(meters))
}

function toSeconds(hours, minutes, seconds) {
  const h = Number(hours || 0)
  const m = Number(minutes || 0)
  const s = Number(seconds || 0)
  if (![h, m, s].every(Number.isFinite)) return null
  const total = Math.round(h * 3600 + m * 60 + s)
  return total > 0 ? total : null
}

function fmtInputNumber(n) {
  if (!Number.isFinite(n)) return ''
  const s = n.toFixed(2)
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function validateStartedAt(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('Choose a date/time')

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date/time')

  const year = d.getFullYear()
  const now = new Date()
  const currentYear = now.getFullYear()
  if (year < 1900 || year > currentYear) throw new Error('Invalid date/time')
  if (d.getTime() > now.getTime() + 60_000) throw new Error('Date/time cannot be in the future')

  return d
}

const SPORT_OPTIONS = [
  { value: 'run', label: 'Run', icon: '🏃', color: '#f97316' },
  { value: 'walk', label: 'Walk', icon: '🚶', color: '#22c55e' },
  { value: 'ride', label: 'Cycle', icon: '🚴', color: '#3b82f6' },
]

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Everyone', icon: Globe, description: 'Visible to all' },
  { value: 'followers', label: 'Followers', icon: Users, description: 'Only followers' },
  { value: 'only_me', label: 'Only me', icon: Lock, description: 'Private' },
]

export default function AddActivity() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const mode = (params.get('mode') || 'manual').toLowerCase()

  const units = useUnitsValue()
  const prevUnitsRef = useRef(units)

  const [sport, setSport] = useState('run')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [visibility, setVisibility] = useState('public')

  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('30')
  const [seconds, setSeconds] = useState('0')
  const [distanceKm, setDistanceKm] = useState(() => (getUnits() === 'mi' ? '3.1' : '5'))

  useEffect(() => {
    const prev = prevUnitsRef.current
    if (prev === units) return

    const n = Number(distanceKm)
    if (Number.isFinite(n) && n > 0) {
      const meters = toMeters(n, prev)
      if (meters) {
        const next = distanceInUnits(meters, units)
        setDistanceKm(fmtInputNumber(next))
      }
    }

    prevUnitsRef.current = units
  }, [units])

  const [gpxFile, setGpxFile] = useState(null)
  const [photos, setPhotos] = useState([])
  const [uploadNote, setUploadNote] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const photoInputRef = useRef(null)
  const gpxInputRef = useRef(null)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeSection, setActiveSection] = useState('details')

  const maxStartedAt = useMemo(() => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }, [])

  async function runWithConcurrency(items, limit, fn) {
    const results = []
    const queue = [...items]
    const workers = Array.from({ length: Math.max(1, limit) }, async () => {
      while (queue.length) {
        const item = queue.shift()
        try {
          results.push(await fn(item))
        } catch (e) {
          results.push(Promise.reject(e))
        }
      }
    })
    await Promise.all(workers)
    return results
  }

  const photoPreviews = useMemo(() => {
    return photos.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }))
  }, [photos])

  const setMode = (next) => {
    params.set('mode', next)
    setParams(params)
  }

  const onPickPhotos = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const filtered = files.filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 25 * 1024 * 1024)
    if (filtered.length !== files.length) {
      setError('Some files were skipped (only JPG/PNG/WEBP up to 25MB).')
    }

    setPhotos((prev) => [...prev, ...filtered].slice(0, 8))
    e.target.value = ''
  }

  const removePhoto = (name) => {
    setPhotos((prev) => prev.filter((f) => f.name !== name))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) {
      setPhotos((prev) => [...prev, ...files].slice(0, 8))
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const submitManual = async () => {
    if (!String(title || '').trim()) throw new Error('Title is required')
    const dur = toSeconds(hours, minutes, seconds)
    if (!dur) throw new Error('Duration must be greater than 0')
    const meters = toMeters(distanceKm, units)
    if (!meters) throw new Error('Distance must be a number')
    const started = validateStartedAt(startedAt)

    const payload = {
      sport,
      title: String(title || '').trim(),
      description: description || undefined,
      startedAt: started.toISOString(),
      durationSeconds: dur,
      distanceMeters: meters,
      visibility,
    }

    const res = await createActivity(payload)
    const activityId = res?.activity?.id
    if (!activityId) throw new Error('Activity created but missing id')

    if (photos.length) {
      let done = 0
      setUploadNote(`Uploading photos 0/${photos.length}`)
      await runWithConcurrency(photos, 1, async (file) => {
        await uploadActivityPhoto(activityId, file, {
          onProgress: (p) => {
            setUploadNote(`Uploading photos ${done}/${photos.length} (${Math.round(p * 100)}%)`)
          },
        })
        done += 1
        setUploadNote(`Uploading photos ${done}/${photos.length}`)
      })
      setUploadNote('')
    }

    navigate(`/activities/${activityId}`)
  }

  const submitGpx = async () => {
    if (!gpxFile) throw new Error('Choose a GPX file')
    if (gpxFile.size > 20 * 1024 * 1024) throw new Error('GPX must be <= 20MB')
    if (!String(title || '').trim()) throw new Error('Title is required')
    setUploadNote('Uploading GPX 0%')
    const res = await importGpx(gpxFile, {
      sport,
      title: String(title || '').trim(),
      description,
      visibility,
    }, {
      onProgress: (p) => setUploadNote(`Uploading GPX ${Math.round(p * 100)}%`),
    })
    setUploadNote('')

    const activityId = res?.activity?.id
    if (!activityId) throw new Error('Import succeeded but missing activity id')

    if (photos.length) {
      let done = 0
      setUploadNote(`Uploading photos 0/${photos.length}`)
      await runWithConcurrency(photos, 1, async (file) => {
        await uploadActivityPhoto(activityId, file, {
          onProgress: (p) => {
            setUploadNote(`Uploading photos ${done}/${photos.length} (${Math.round(p * 100)}%)`)
          },
        })
        done += 1
        setUploadNote(`Uploading photos ${done}/${photos.length}`)
      })
      setUploadNote('')
    }

    navigate(`/activities/${activityId}`)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'gpx') await submitGpx()
      else await submitManual()
    } catch (err) {
      setError(err?.message || 'Failed to save activity')
    } finally {
      setBusy(false)
    }
  }

  const selectedSport = SPORT_OPTIONS.find(s => s.value === sport)
  const selectedVisibility = VISIBILITY_OPTIONS.find(v => v.value === visibility)

  return (
    <div className="add-activity">
      <NavBar />

      <main className="add-wrap">
        {/* Hero Section with Aurora Background */}
        <div className="add-hero">
          <div className="add-hero-content">
            <div className="add-hero-badge">
              <Activity size={16} />
              <span>New Activity</span>
            </div>
            <h1>Log Your Workout</h1>
            <p>Track your progress, celebrate your achievements, share your journey.</p>
          </div>

          {/* Mode Toggle */}
          <div className="mode-toggle-container">
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
                onClick={() => setMode('manual')}
              >
                <Timer size={18} />
                <span>Manual Entry</span>
              </button>
              <button
                type="button"
                className={`mode-btn ${mode === 'gpx' ? 'active' : ''}`}
                onClick={() => setMode('gpx')}
              >
                <Upload size={18} />
                <span>Upload GPX</span>
              </button>
              <div className={`mode-indicator ${mode}`} />
            </div>
          </div>
        </div>

        <form className="add-form" onSubmit={onSubmit}>
          {/* Main Content Grid */}
          <div className="form-layout">
            {/* Left Column - Main Details */}
            <div className="form-main">
              {/* Sport Selection */}
              <section className="form-section">
                <label className="section-label">Activity Type</label>
                <div className="sport-grid">
                  {SPORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`sport-card ${sport === option.value ? 'active' : ''}`}
                      onClick={() => setSport(option.value)}
                      style={{ '--sport-color': option.color }}
                    >
                      <span className="sport-icon">{option.icon}</span>
                      <span className="sport-label">{option.label}</span>
                      {sport === option.value && (
                        <div className="sport-indicator" />
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Title & Description */}
              <section className="form-section">
                <div className="input-group">
                  <label htmlFor="title">Title <span className="optional">optional</span></label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Morning run, easy walk..."
                    className="text-input"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="description">Description <span className="optional">optional</span></label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="How did it feel? What did you learn? Share your thoughts..."
                    rows={3}
                    className="text-input"
                  />
                </div>
              </section>

              {/* Manual Entry Fields */}
              {mode === 'manual' ? (
                <section className="form-section">
                  <label className="section-label">Activity Details</label>
                  
                  <div className="details-grid">
                    {/* Date Time */}
                    <div className="input-group span-2">
                      <label htmlFor="datetime">
                        <Calendar size={16} />
                        Date & Time
                      </label>
                      <input
                        id="datetime"
                        type="datetime-local"
                        value={startedAt}
                        onChange={(e) => setStartedAt(e.target.value)}
                        className="text-input"
                        max={maxStartedAt}
                      />
                    </div>

                    {/* Duration */}
                    <div className="input-group span-2">
                      <label>
                        <Clock size={16} />
                        Duration
                      </label>
                      <div className="duration-inputs">
                        <div className="duration-field">
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            className="text-input"
                          />
                          <span className="duration-label">hr</span>
                        </div>
                        <span className="duration-separator">:</span>
                        <div className="duration-field">
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                            className="text-input"
                          />
                          <span className="duration-label">min</span>
                        </div>
                        <span className="duration-separator">:</span>
                        <div className="duration-field">
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={seconds}
                            onChange={(e) => setSeconds(e.target.value)}
                            className="text-input"
                          />
                          <span className="duration-label">sec</span>
                        </div>
                      </div>
                    </div>

                    {/* Distance */}
                    <div className="input-group">
                      <label htmlFor="distance">
                        <Route size={16} />
                        Distance
                      </label>
                      <div className="distance-input">
                        <input
                          id="distance"
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={distanceKm}
                          onChange={(e) => setDistanceKm(e.target.value)}
                          className="text-input"
                        />
                        <span className="distance-unit">{units}</span>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="form-section">
                  <label className="section-label">GPX File</label>
                  <div 
                    className={`gpx-upload ${gpxFile ? 'has-file' : ''} ${isDragging ? 'dragging' : ''}`}
                    onClick={() => gpxInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <input
                      ref={gpxInputRef}
                      type="file"
                      accept=".gpx,application/gpx+xml,application/xml,text/xml"
                      onChange={(e) => setGpxFile(e.target.files?.[0] || null)}
                      hidden
                    />
                    {gpxFile ? (
                      <div className="gpx-file-info">
                        <div className="gpx-icon">
                          <MapPin size={32} />
                        </div>
                        <div className="gpx-details">
                          <span className="gpx-name">{gpxFile.name}</span>
                          <span className="gpx-size">{(gpxFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                        <button
                          type="button"
                          className="gpx-remove"
                          onClick={(e) => {
                            e.stopPropagation()
                            setGpxFile(null)
                          }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="gpx-upload-icon">
                          <Upload size={40} />
                        </div>
                        <p className="gpx-upload-title">Drop your GPX file here</p>
                        <p className="gpx-upload-subtitle">or click to browse</p>
                        <p className="gpx-upload-hint">Supports .gpx files up to 10MB</p>
                      </>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="form-sidebar">
              {/* Visibility Card */}
              <section className="sidebar-card">
                <label className="sidebar-label">Visibility</label>
                <div className="visibility-options">
                  {VISIBILITY_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`visibility-option ${visibility === option.value ? 'active' : ''}`}
                        onClick={() => setVisibility(option.value)}
                      >
                        <div className="visibility-icon">
                          <Icon size={20} />
                        </div>
                        <div className="visibility-info">
                          <span className="visibility-name">{option.label}</span>
                          <span className="visibility-desc">{option.description}</span>
                        </div>
                        <div className="visibility-check">
                          {visibility === option.value && <Zap size={16} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Photos Card */}
              <section className="sidebar-card">
                <div className="sidebar-header">
                  <label className="sidebar-label">Photos</label>
                  <span className="photo-count">{photos.length}/8</span>
                </div>
                
                <div 
                  className={`photo-upload-area ${isDragging ? 'dragging' : ''}`}
                  onClick={() => photoInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onPickPhotos}
                    hidden
                  />
                  <Camera size={24} />
                  <span>Add photos</span>
                  <small>Drop images here</small>
                </div>

                {photoPreviews.length > 0 && (
                  <div className="photo-grid">
                    {photoPreviews.map((p, index) => (
                      <div className="photo-thumb" key={p.name}>
                        <img src={p.url} alt={p.name} />
                        <button
                          type="button"
                          className="photo-remove"
                          onClick={(e) => {
                            e.stopPropagation()
                            removePhoto(p.name)
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                        {index === 0 && <span className="photo-primary">Cover</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Quick Stats Preview */}
              {mode === 'manual' && distanceKm && (hours !== '0' || minutes !== '0') && (
                <section className="sidebar-card stats-preview">
                  <label className="sidebar-label">Preview</label>
                  <div className="stat-row">
                    <span className="stat-label">Pace/Speed</span>
                    <span className="stat-value">
                      {(() => {
                        const meters = toMeters(distanceKm, units)
                        const secs = toSeconds(hours, minutes, seconds)
                        if (!meters || !secs) return '--'
                        return formatPaceOrSpeed(sport, meters, secs, units)
                      })()}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Duration</span>
                    <span className="stat-value">
                      {Number(hours) > 0 ? `${hours}h ` : ''}
                      {minutes}m
                    </span>
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="form-error">
              <div className="error-icon">!</div>
              <span>{error}</span>
            </div>
          )}

          {busy && uploadNote ? (
            <div className="form-error" style={{ borderColor: 'rgba(16,185,129,0.45)', background: 'rgba(16,185,129,0.08)' }}>
              <div className="error-icon">↑</div>
              <span>{uploadNote}</span>
            </div>
          ) : null}

          {/* Footer Actions */}
          <div className="form-footer">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" />
                  Saving...
                </>
              ) : (
                <>
                  <Activity size={20} />
                  {mode === 'gpx' ? 'Import Activity' : 'Save Activity'}
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
