const SEED_KEY = 'pace42_avatar_seed'
const URL_KEY = 'pace42_avatar_url'
const SVG_SEED_KEY = 'pace42_avatar_svg_seed'
const SVG_KEY = 'pace42_avatar_svg'

export function readSupabaseSessionUserSync() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      // Supabase JS v2 default storage key format.
      if (!k.startsWith('sb-') || !k.endsWith('-auth-token')) continue

      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const u = parsed?.user
      const id = typeof u?.id === 'string' ? u.id : ''
      if (!id) continue
      const email = typeof u?.email === 'string' ? u.email : null
      return { id, email }
    }
  } catch {
    // ignore
  }
  return null
}

export function readSupabaseAccessTokenSync() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (!k.startsWith('sb-') || !k.endsWith('-auth-token')) continue

      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const token = typeof parsed?.access_token === 'string' ? parsed.access_token : ''
      if (token) return token
    }
  } catch {
    // ignore
  }
  return ''
}

export function readAvatarSeed(fallback = 'athlete') {
  try {
    const v = localStorage.getItem(SEED_KEY)
    return v && String(v).trim() ? String(v).trim() : fallback
  } catch {
    return fallback
  }
}

export function writeAvatarSeed(seed) {
  try {
    const v = String(seed || '').trim()
    if (!v) return
    localStorage.setItem(SEED_KEY, v)
  } catch {
    // ignore
  }
}

export function readAvatarUrl() {
  try {
    const v = localStorage.getItem(URL_KEY)
    return v && String(v).trim() ? String(v).trim() : ''
  } catch {
    return ''
  }
}

export function writeAvatarUrl(url) {
  try {
    const v = String(url || '').trim()
    if (!v) {
      localStorage.removeItem(URL_KEY)
      return
    }
    localStorage.setItem(URL_KEY, v)
  } catch {
    // ignore
  }
}

export function readAvatarSvg(seed) {
  try {
    const s = String(seed || '').trim()
    if (!s) return ''
    const storedSeed = localStorage.getItem(SVG_SEED_KEY)
    if (!storedSeed || storedSeed !== s) return ''
    const v = localStorage.getItem(SVG_KEY)
    return v && String(v).trim() ? String(v).trim() : ''
  } catch {
    return ''
  }
}

export function writeAvatarSvg(seed, dataUri) {
  try {
    const s = String(seed || '').trim()
    const v = String(dataUri || '').trim()
    if (!s || !v) return
    // keep only the last generated avatar to avoid uncontrolled growth
    localStorage.setItem(SVG_SEED_KEY, s)
    localStorage.setItem(SVG_KEY, v)
  } catch {
    // ignore
  }
}
