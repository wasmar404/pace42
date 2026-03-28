import { backendGet, backendJson, backendUploadWithProgress } from '../backendApi'

export function createActivity(input) {
  return backendJson('POST', '/api/activities', input)
}

export function getActivity(id, { includeRoute = false } = {}) {
  const qs = includeRoute ? '?includeRoute=1' : ''
  return backendGet(`/api/activities/${id}${qs}`)
}

export function listMyActivities(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    qs.set(k, String(v))
  })
  const s = qs.toString()
  return backendGet(`/api/activities/mine${s ? `?${s}` : ''}`)
}

export function deleteActivity(id) {
  return backendJson('DELETE', `/api/activities/${id}`, {})
}

export function uploadActivityPhoto(activityId, file, opts = {}) {
  return backendUploadWithProgress(`/api/activities/${activityId}/media`, file, opts)
}

export function importGpx(file, meta = {}, opts = {}) {
  const form = new FormData()
  form.append('file', file)
  if (meta?.title) form.append('title', meta.title)
  if (meta?.description) form.append('description', meta.description)
  if (meta?.visibility) form.append('visibility', meta.visibility)
  if (meta?.sport) form.append('sport', meta.sport)

  return backendUploadWithProgress('/api/activities/import/gpx', form, opts)
}

export function giveKudos(activityId) {
  return backendJson('POST', `/api/activities/${activityId}/kudos`, {})
}

export function removeKudos(activityId) {
  return backendJson('DELETE', `/api/activities/${activityId}/kudos`, {})
}

export function listKudos(activityId) {
  return backendGet(`/api/activities/${activityId}/kudos`)
}

export function getComments(activityId) {
  return backendGet(`/api/activities/${activityId}/comments`)
}

export function addComment(activityId, body) {
  return backendJson('POST', `/api/activities/${activityId}/comments`, { body })
}
