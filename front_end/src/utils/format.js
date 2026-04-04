const KM_PER_M = 1 / 1000

export function distanceInUnits(meters) {
  const n = Number(meters)
  if (!Number.isFinite(n)) return 0
  return n * KM_PER_M
}

export function formatDistance(meters) {
  const v = distanceInUnits(meters)
  if (!Number.isFinite(v) || v <= 0) return '0.00 km'
  const digits = v < 10 ? 2 : 1
  return `${v.toFixed(digits)} km`
}

export function formatDuration(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n < 0) return '-'
  const s = Math.max(0, Math.round(n))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m`
  return `${ss}s`
}

export function formatPace(distanceMeters, durationSeconds) {
  const dist = Number(distanceMeters)
  const dur = Number(durationSeconds)
  if (!Number.isFinite(dist) || !Number.isFinite(dur) || dist <= 0 || dur <= 0) return '-'
  const perUnit = dur / distanceInUnits(dist)
  const mm = Math.floor(perUnit / 60)
  const ss = Math.round(perUnit % 60)
  return `${mm}:${String(ss).padStart(2, '0')} /km`
}

export function formatSpeed(distanceMeters, durationSeconds) {
  const dist = Number(distanceMeters)
  const dur = Number(durationSeconds)
  if (!Number.isFinite(dist) || !Number.isFinite(dur) || dist <= 0 || dur <= 0) return '-'
  const hours = dur / 3600
  const v = distanceInUnits(dist) / hours
  return `${v.toFixed(1)} km/h`
}

export function formatPaceOrSpeed(sport, distanceMeters, durationSeconds) {
  const s = String(sport || '').toLowerCase()
  if (s === 'ride' || s === 'cycle') return formatSpeed(distanceMeters, durationSeconds)
  return formatPace(distanceMeters, durationSeconds)
}
