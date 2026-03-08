import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import NavBar from '../components/NavBar'
import { createActivity, importGpx, uploadActivityPhoto } from '../api/activities'
import '../styles/AddActivity.css'

function toMeters(km) {
  const n = Number(km)
  if (!Number.isFinite(n)) return null
  return Math.max(1, Math.round(n * 1000))
}

function toSeconds(hours, minutes, seconds) {
  const h = Number(hours || 0)
  const m = Number(minutes || 0)
  const s = Number(seconds || 0)
  if (![h, m, s].every(Number.isFinite)) return null
  const total = Math.round(h * 3600 + m * 60 + s)
  return total > 0 ? total : null
}

export default function AddActivity() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const mode = (params.get('mode') || 'manual').toLowerCase()

  const [sport, setSport] = useState('run')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [visibility, setVisibility] = useState('public')

  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('30')
  const [seconds, setSeconds] = useState('0')
  const [distanceKm, setDistanceKm] = useState('5')

  const [gpxFile, setGpxFile] = useState(null)
  const [photos, setPhotos] = useState([])
  const photoInputRef = useRef(null)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    setPhotos((prev) => [...prev, ...files].slice(0, 8))
    e.target.value = ''
  }

  const removePhoto = (name) => {
    setPhotos((prev) => prev.filter((f) => f.name !== name))
  }

  const submitManual = async () => {
    const dur = toSeconds(hours, minutes, seconds)
    if (!dur) throw new Error('Duration must be greater than 0')
    const meters = toMeters(distanceKm)
    if (!meters) throw new Error('Distance must be a number')
    if (!startedAt) throw new Error('Choose a date/time')

    const payload = {
      sport,
      title: title || undefined,
      description: description || undefined,
      startedAt: new Date(startedAt).toISOString(),
      durationSeconds: dur,
      distanceMeters: meters,
      visibility,
    }

    const res = await createActivity(payload)
    const activityId = res?.activity?.id
    if (!activityId) throw new Error('Activity created but missing id')

    for (const file of photos) {
      await uploadActivityPhoto(activityId, file)
    }

    navigate(`/activities/${activityId}`)
  }

  const submitGpx = async () => {
    if (!gpxFile) throw new Error('Choose a GPX file')
    // For now importGpx uploads the file; backend creates activity via ORM after parsing.
    const res = await importGpx(gpxFile, {
      sport,
      title,
      description,
      visibility,
    })

    const activityId = res?.activity?.id
    if (!activityId) throw new Error('Import succeeded but missing activity id')

    for (const file of photos) {
      await uploadActivityPhoto(activityId, file)
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

  return (
    <div className="add-activity">
      <NavBar />

      <main className="add-wrap">
        <div className="add-hero">
          <div className="add-hero-title">
            <h1>Add Activity</h1>
            <p>Log it clean. Keep it honest. Share it your way.</p>
          </div>

          <div className="add-mode">
            <button
              type="button"
              className={`add-mode-btn ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >
              Manual
            </button>
            <button
              type="button"
              className={`add-mode-btn ${mode === 'gpx' ? 'active' : ''}`}
              onClick={() => setMode('gpx')}
            >
              Upload GPX
            </button>
          </div>
        </div>

        <form className="add-card" onSubmit={onSubmit}>
          <div className="add-grid">
            <div className="add-field">
              <label>Type</label>
              <select value={sport} onChange={(e) => setSport(e.target.value)}>
                <option value="run">Run</option>
                <option value="walk">Walk</option>
              </select>
            </div>

            <div className="add-field">
              <label>Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="public">Everyone</option>
                <option value="followers">Followers</option>
                <option value="only_me">Only me</option>
              </select>
            </div>

            <div className="add-field span-2">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning run, easy walk, ..." />
            </div>

            <div className="add-field span-2">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="How did it feel? What did you learn?"
                rows={4}
              />
            </div>

            {mode === 'manual' ? (
              <>
                <div className="add-field span-2">
                  <label>Date</label>
                  <input
                    type="datetime-local"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                  />
                </div>

                <div className="add-field">
                  <label>Duration (h)</label>
                  <input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
                </div>
                <div className="add-field">
                  <label>Duration (m)</label>
                  <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                </div>
                <div className="add-field">
                  <label>Duration (s)</label>
                  <input type="number" min={0} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
                </div>

                <div className="add-field">
                  <label>Distance (km)</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="add-field span-2">
                  <label>GPX File</label>
                  <input
                    type="file"
                    accept=".gpx,application/gpx+xml,application/xml,text/xml"
                    onChange={(e) => setGpxFile(e.target.files?.[0] || null)}
                  />
                  <p className="add-hint">
                    Upload a GPX file. We’ll extract distance/duration and generate a map later.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="add-media">
            <div className="add-media-head">
              <h2>Photos</h2>
              <div className="add-media-actions">
                <button type="button" className="add-secondary" onClick={() => photoInputRef.current?.click()}>
                  Add photos
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickPhotos}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {photoPreviews.length ? (
              <div className="add-photo-grid">
                {photoPreviews.map((p) => (
                  <div className="add-photo" key={p.name}>
                    <img src={p.url} alt={p.name} />
                    <button type="button" className="add-photo-x" onClick={() => removePhoto(p.name)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="add-hint">Add up to 8 photos (optional).</p>
            )}
          </div>

          {error ? <div className="add-error">{error}</div> : null}

          <div className="add-footer">
            <button type="submit" className="add-primary" disabled={busy}>
              {busy ? 'Saving...' : mode === 'gpx' ? 'Import Activity' : 'Save Activity'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
