import { backendGet, backendJson } from '../backendApi'

export function searchUsers(q) {
  const query = (q || '').trim()
  if (query.length < 2) return Promise.resolve({ users: [] })
  return backendGet(`/api/search/users?q=${encodeURIComponent(query)}`)
}

export function followUser(userId) {
  return backendJson('POST', `/api/users/${userId}/follow`, {})
}

export function unfollowUser(userId) {
  return backendJson('DELETE', `/api/users/${userId}/follow`, {})
}

export function getUserSummary(userId) {
  return backendGet(`/api/users/${userId}/summary`)
}
