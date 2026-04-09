import { io } from 'socket.io-client'

import { supabase } from '../supabaseClient'
import { readSupabaseAccessTokenForStorageKeySync, readSupabaseAccessTokenSync } from '../utils/avatarCache'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://localhost:3443'

let socket = null
let lastToken = ''

function readTokenFast() {
  const key = supabase?.auth?.storageKey
  const t = key ? readSupabaseAccessTokenForStorageKeySync(key) : readSupabaseAccessTokenSync()
  return t && String(t).trim() ? String(t).trim() : ''
}

export async function getChatSocket() {
  let token = ''
  try {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token || ''
  } catch {
    token = readTokenFast()
  }
  if (!token) throw new Error('Not authenticated')

  if (!socket) {
    socket = io(`${BASE_URL}/chat`, {
      transports: ['polling', 'websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 3000,
    })
    try {
      socket.io.on('reconnect_attempt', () => {
        const t = readTokenFast()
        if (!t) return
        socket.auth = { token: t }
        lastToken = t
      })
    } catch {
    }
    lastToken = token
    return socket
  }

  try {
    const tokenChanged = token && token !== lastToken
    socket.auth = { token }
    lastToken = token
    if (tokenChanged && socket.connected) {
      socket.disconnect()
    }
    if (!socket.connected) socket.connect()
  } catch {
  }

  return socket
}

export function disconnectChatSocket() {
  try {
    socket?.disconnect()
  } catch {
  }
  socket = null
}
