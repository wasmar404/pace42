export function sportLabel(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'run') return 'Run'
  if (v === 'walk') return 'Walk'
  if (v === 'ride' || v === 'cycle') return 'Ride'
  if (!v) return 'Activity'
  return v.slice(0, 1).toUpperCase() + v.slice(1)
}
