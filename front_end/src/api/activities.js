import { backendGet, backendJson, backendUpload } from '../backendApi'

export function createActivity(input) {
  return backendJson('POST', '/api/activities', input)
}

export function getActivity(id) {
  return backendGet(`/api/activities/${id}`)
}

export function deleteActivity(id) {
  return backendJson('DELETE', `/api/activities/${id}`, {})
}

export function uploadActivityPhoto(activityId, file) {
  return backendUpload(`/api/activities/${activityId}/media`, file)
}

export function importGpx(file, meta = {}) {
  const form = new FormData()
  form.append('file', file)
  if (meta?.title) form.append('title', meta.title)
  if (meta?.description) form.append('description', meta.description)
  if (meta?.visibility) form.append('visibility', meta.visibility)
  if (meta?.sport) form.append('sport', meta.sport)

  return backendUpload('/api/activities/import/gpx', form)
}
