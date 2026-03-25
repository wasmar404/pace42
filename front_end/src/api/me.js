import { backendGet } from '../backendApi'

export function getMyActivities(take = 2000) {
  return backendGet(`/api/me/activities?take=${encodeURIComponent(String(take))}`)
}
