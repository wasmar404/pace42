import { backendGet, backendJson } from '../backendApi'

export function listConversations() {
  return backendGet('/api/chat/conversations')
}

export function searchMutuals(q = '') {
  return backendGet(`/api/chat/mutuals?q=${encodeURIComponent(String(q || ''))}`)
}

export function getOrCreateConversation(otherUserId) {
  return backendJson('POST', `/api/chat/conversations/with/${otherUserId}`, {})
}

export function getMessages(conversationId, params = {}) {
  const p = new URLSearchParams()
  if (params?.limit) p.set('limit', String(params.limit))
  if (params?.before) p.set('before', String(params.before))
  const qs = p.toString()
  return backendGet(`/api/chat/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`)
}

export function sendMessage(conversationId, body) {
  return backendJson('POST', `/api/chat/conversations/${conversationId}/messages`, { body })
}

export function markRead(conversationId) {
  return backendJson('POST', `/api/chat/conversations/${conversationId}/read`, {})
}
