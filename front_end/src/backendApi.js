import { supabase } from './supabaseClient'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${token}` }
}

export async function backendGet(path) {
  const headers = await authHeader()
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || 'Request failed')
  return json
}

export async function backendJson(method, path, body) {
  const headers = { ...(await authHeader()), 'content-type': 'application/json' }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || 'Request failed')
  return json
}

export async function backendUpload(path, fileOrForm) {
  const headers = await authHeader()

  const form = fileOrForm instanceof FormData ? fileOrForm : new FormData()
  if (!(fileOrForm instanceof FormData)) {
    form.append('file', fileOrForm)
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: form,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || 'Upload failed')
  return json
}
