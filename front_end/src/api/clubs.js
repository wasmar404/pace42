import { backendGet, backendJson, backendUpload } from '../backendApi'

export function createClub(input) {
  if (input instanceof FormData) return backendUpload('/api/clubs', input)
  return backendJson('POST', '/api/clubs', input)
}

export function getMyClubs() {
  return backendGet('/api/clubs/mine')
}

export function discoverClubs({ take = 12, q = '', seed = '' } = {}) {
  const params = new URLSearchParams()
  params.set('take', String(take))
  if (q) params.set('q', String(q))
  if (seed) params.set('seed', String(seed))
  return backendGet(`/api/clubs/discover?${params.toString()}`)
}

export function joinClub(id) {
  return backendJson('POST', `/api/clubs/${id}/join`, {})
}

export function leaveClub(id) {
  return backendJson('POST', `/api/clubs/${id}/leave`, {})
}

export function getClub(id) {
  return backendGet(`/api/clubs/${id}`)
}

export function getClubMembers(id) {
  return backendGet(`/api/clubs/${id}/members`)
}

export function getClubPosts(id, take = 20) {
  return backendGet(`/api/clubs/${id}/posts?take=${encodeURIComponent(String(take))}`)
}

export function getClubFeed(id, take = 20) {
  return backendGet(`/api/clubs/${id}/feed?take=${encodeURIComponent(String(take))}`)
}

export function getClubLeaderboard(id, days = 28) {
  return backendGet(`/api/clubs/${id}/leaderboard?days=${encodeURIComponent(String(days))}`)
}

export function createClubPost(clubId, { body = '', images = [] } = {}) {
  const form = new FormData()
  if (body) form.append('body', body)
  ;(images || []).forEach((f) => form.append('images', f))
  return backendUpload(`/api/clubs/${clubId}/posts`, form)
}

export function inviteToClub(clubId, userId) {
  return backendJson('POST', `/api/clubs/${clubId}/invites`, { userId })
}

export function updateClub(clubId, formData) {
  return backendUpload(`/api/clubs/${clubId}/update`, formData)
}

export function setClubMemberRole(clubId, userId, role) {
  return backendJson('POST', `/api/clubs/${clubId}/members/${userId}/role`, { role })
}

export function removeClubMember(clubId, userId) {
  return backendJson('POST', `/api/clubs/${clubId}/members/${userId}/remove`, {})
}

export function deleteClub(clubId, confirm) {
  return backendJson('POST', `/api/clubs/${clubId}/delete`, { confirm })
}

export function getMyInvites() {
  return backendGet('/api/clubs/invites')
}

export function acceptInvite(inviteId) {
  return backendJson('POST', `/api/clubs/invites/${inviteId}/accept`, {})
}

export function declineInvite(inviteId) {
  return backendJson('POST', `/api/clubs/invites/${inviteId}/decline`, {})
}
