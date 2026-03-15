import { getUnits } from '../preferences'

const MI_PER_M = 1 / 1609.344
const KM_PER_M = 1 / 1000

export function distanceInUnits(meters, units = getUnits()) {
  const n = Number(meters)
  if (!Number.isFinite(n)) return 0
  const u = units === 'mi' ? 'mi' : 'km'
  return u === 'mi' ? n * MI_PER_M : n * KM_PER_M
}

export function formatDistance(meters, units = getUnits()) {
  const v = distanceInUnits(meters, units)
  const u = units === 'mi' ? 'mi' : 'km'
  if (!Number.isFinite(v) || v <= 0) return `0.00 ${u}`
  const digits = v < 10 ? 2 : 1
  return `${v.toFixed(digits)} ${u}`
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

export function formatPace(distanceMeters, durationSeconds, units = getUnits()) {
  const dist = Number(distanceMeters)
  const dur = Number(durationSeconds)
  const u = units === 'mi' ? 'mi' : 'km'
  if (!Number.isFinite(dist) || !Number.isFinite(dur) || dist <= 0 || dur <= 0) return '-'
  const perUnit = dur / distanceInUnits(dist, u)
  const mm = Math.floor(perUnit / 60)
  const ss = Math.round(perUnit % 60)
  return `${mm}:${String(ss).padStart(2, '0')} /${u}`
}

export function formatSpeed(distanceMeters, durationSeconds, units = getUnits()) {
  const dist = Number(distanceMeters)
  const dur = Number(durationSeconds)
  const u = units === 'mi' ? 'mi' : 'km'
  if (!Number.isFinite(dist) || !Number.isFinite(dur) || dist <= 0 || dur <= 0) return '-'
  const hours = dur / 3600
  const v = distanceInUnits(dist, u) / hours
  const suffix = u === 'mi' ? 'mph' : 'km/h'
  return `${v.toFixed(1)} ${suffix}`
}

export function formatPaceOrSpeed(sport, distanceMeters, durationSeconds, units = getUnits()) {
  const s = String(sport || '').toLowerCase()
  if (s === 'ride' || s === 'cycle') return formatSpeed(distanceMeters, durationSeconds, units)
  return formatPace(distanceMeters, durationSeconds, units)
}
