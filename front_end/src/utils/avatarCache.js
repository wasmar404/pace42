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

export function readSupabaseSessionUserForStorageKeySync(storageKey) {
  try {
    const k = String(storageKey || '').trim()
    if (!k) return null
    const raw = localStorage.getItem(k)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const u = parsed?.user
    const id = typeof u?.id === 'string' ? u.id : ''
    if (!id) return null
    const email = typeof u?.email === 'string' ? u.email : null
    return { id, email }
  } catch {
    return null
  }
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

export function readSupabaseAccessTokenForStorageKeySync(storageKey) {
  try {
    const k = String(storageKey || '').trim()
    if (!k) return ''
    const raw = localStorage.getItem(k)
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    const token = typeof parsed?.access_token === 'string' ? parsed.access_token : ''
    return token && String(token).trim() ? String(token).trim() : ''
  } catch {
    return ''
  }
}
