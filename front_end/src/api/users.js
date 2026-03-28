import { backendGet, backendGetOptional, backendJson } from '../backendApi'

export function searchUsers(q) {
  const query = (q || '').trim()
  if (query.length < 2) return Promise.resolve({ users: [] })
  return backendGetOptional(`/api/search/users?q=${encodeURIComponent(query)}`)
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

export function listFollowers(userId, opts = {}) {
  const skip = typeof opts?.skip === 'number' ? opts.skip : 0
  const take = typeof opts?.take === 'number' ? opts.take : 50
  return backendGet(`/api/users/${userId}/followers?skip=${encodeURIComponent(skip)}&take=${encodeURIComponent(take)}`)
}

export function listFollowing(userId, opts = {}) {
  const skip = typeof opts?.skip === 'number' ? opts.skip : 0
  const take = typeof opts?.take === 'number' ? opts.take : 50
  return backendGet(`/api/users/${userId}/following?skip=${encodeURIComponent(skip)}&take=${encodeURIComponent(take)}`)
}
