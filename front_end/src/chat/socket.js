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
    // Allow polling fallback (websocket-only can fail in some dev setups).
    transports: ['websocket', 'polling'],
    // Browsers can't send custom headers on WebSocket upgrade.
    // Pass token via Socket.IO auth payload.
    auth: { token },
    reconnection: true,
    reconnectionDelay: 400,
    reconnectionDelayMax: 3000,
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
