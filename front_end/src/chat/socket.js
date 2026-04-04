import { io } from 'socket.io-client'

import { supabase } from '../supabaseClient'
import { readSupabaseAccessTokenSync } from '../utils/avatarCache'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'

let socket = null

export async function getChatSocket() {
  let token = readSupabaseAccessTokenSync()
  if (!token) {
    try {
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token || ''
    } catch { }
  }
  if (!token) throw new Error('Not authenticated')

  if (!socket) {
    socket = io(`${BASE_URL}/chat`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 3000,
    })
    return socket
  }

  try {
    socket.auth = { token }
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
