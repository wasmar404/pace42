import { io } from 'socket.io-client'

import { supabase } from '../supabaseClient'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'

let socket = null

export async function getChatSocket() {
  if (socket && socket.connected) return socket

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')

  socket = io(`${BASE_URL}/chat`, {
    transports: ['websocket'],
    extraHeaders: {
      Authorization: `Bearer ${token}`,
    },
  })

  return socket
}

export function disconnectChatSocket() {
  try {
    socket?.disconnect()
  } catch {
    // ignore
  }
  socket = null
}
