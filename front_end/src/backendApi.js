import { supabase } from './supabaseClient'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'

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
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${token}` }
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
