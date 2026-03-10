import { useEffect, useMemo, useState } from 'react'

const cache = new Map()

function pickInitial(seed) {
  const s = String(seed || '').trim()
  const c = s ? s[0] : 'U'
  return c.toUpperCase()
}

function placeholderDataUri(seed) {
  const initial = pickInitial(seed)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FC4C02" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#0B1220" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="128" height="128" rx="28" fill="url(#g)"/>
  <text x="64" y="76" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="56" font-weight="900" fill="rgba(11,18,32,0.72)">${initial}</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function toDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export default function Avatar({ avatarUrl, seed, alt = '', className = '', loading = 'lazy' }) {
  const seedStr = useMemo(() => String(seed || 'user'), [seed])

  const [src, setSrc] = useState(() => avatarUrl || cache.get(seedStr) || placeholderDataUri(seedStr))

  useEffect(() => {
    setSrc(avatarUrl || cache.get(seedStr) || placeholderDataUri(seedStr))
  }, [avatarUrl, seedStr])

  useEffect(() => {
    let cancelled = false
    if (avatarUrl) return () => {}
    if (cache.has(seedStr)) return () => {}

    void (async () => {
      try {
        const mod = await import('@multiavatar/multiavatar/esm')
        const multiavatar = mod?.default
        if (!multiavatar) return
        const svg = multiavatar(seedStr, true)
        const uri = toDataUri(svg)
        cache.set(seedStr, uri)
        if (!cancelled) setSrc(uri)
      } catch {
        // keep placeholder
      }
    })()

    return () => {
      cancelled = true
    }
  }, [avatarUrl, seedStr])

  return <img src={src} alt={alt} className={className} loading={loading} />
}
