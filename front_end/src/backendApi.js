import { supabase } from './supabaseClient'
import { readSupabaseAccessTokenForStorageKeySync, readSupabaseAccessTokenSync } from './utils/avatarCache'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://localhost:3443'

function timeoutSignal(timeoutMs) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(t),
  }
}

async function fetchJson(url, options, timeoutMs) {
  const { signal, cancel } = timeoutSignal(timeoutMs)
  try {
    const res = await fetch(url, { ...(options || {}), signal })
    const json = await res.json().catch(() => ({}))
    return { res, json }
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Request timed out. Is the backend running?')
    throw e
  } finally {
    cancel()
  }
}

async function authHeader() {
  let token = ''
  try {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token || ''
  } catch {
    const key = supabase?.auth?.storageKey
    token = key ? readSupabaseAccessTokenForStorageKeySync(key) : readSupabaseAccessTokenSync()
  }
  if (!token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${token}` }
}

async function optionalAuthHeader() {
  let token = ''
  try {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token || ''
  } catch {
    const key = supabase?.auth?.storageKey
    token = key ? readSupabaseAccessTokenForStorageKeySync(key) : readSupabaseAccessTokenSync()
  }
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function backendGet(path) {
  const headers = await authHeader()
  const { res, json } = await fetchJson(`${BASE_URL}${path}`, { headers }, 20000)
  if (res.status === 401) {
    await supabase.auth.signOut().catch(() => {})
    throw new Error('Session expired. Please log in again.')
  }
  if (!res.ok) throw new Error(json?.error?.message || 'Request failed')
  return json
}

export async function backendGetOptional(path) {
  const headers = await optionalAuthHeader()
  const { res, json } = await fetchJson(`${BASE_URL}${path}`, { headers }, 20000)
  if (res.status === 401) {
    await supabase.auth.signOut().catch(() => {})
    throw new Error('Session expired. Please log in again.')
  }
  if (!res.ok) throw new Error(json?.error?.message || 'Request failed')
  return json
}

export async function backendJson(method, path, body) {
  const headers = { ...(await authHeader()), 'content-type': 'application/json' }
  const { res, json } = await fetchJson(`${BASE_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  }, 20000)
  if (res.status === 401) {
    await supabase.auth.signOut().catch(() => {})
    throw new Error('Session expired. Please log in again.')
  }
  if (!res.ok) throw new Error(json?.error?.message || 'Request failed')
  return json
}

export async function backendUpload(path, fileOrForm) {
  const headers = await authHeader()

  const form = fileOrForm instanceof FormData ? fileOrForm : new FormData()
  if (!(fileOrForm instanceof FormData)) {
    form.append('file', fileOrForm)
  }

  const { res, json } = await fetchJson(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: form,
  }, 60000)
  if (res.status === 401) {
    await supabase.auth.signOut().catch(() => {})
    throw new Error('Session expired. Please log in again.')
  }
  if (!res.ok) throw new Error(json?.error?.message || 'Upload failed')
  return json
}

export async function backendUploadWithProgress(path, fileOrForm, opts = {}) {
  const headers = await authHeader()

  const form = fileOrForm instanceof FormData ? fileOrForm : new FormData()
  if (!(fileOrForm instanceof FormData)) {
    form.append('file', fileOrForm)
  }

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}${path}`)
    xhr.setRequestHeader('Authorization', headers.Authorization)
    xhr.responseType = 'text'
    xhr.timeout = 60000

    const onProgress = typeof opts?.onProgress === 'function' ? opts.onProgress : null
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return
        const p = e.total > 0 ? e.loaded / e.total : 0
        onProgress(Math.max(0, Math.min(1, p)))
      }
    }

    xhr.onload = async () => {
      let json = {}
      try {
        json = JSON.parse(xhr.responseText || '{}')
      } catch {
        json = {}
      }

      if (xhr.status === 401) {
        await supabase.auth.signOut().catch(() => {})
        reject(new Error('Session expired. Please log in again.'))
        return
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(json?.error?.message || 'Upload failed'))
        return
      }

      resolve(json)
    }

    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.ontimeout = () => reject(new Error('Request timed out. Is the backend running?'))

    xhr.send(form)
  })
}
