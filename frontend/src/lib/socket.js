import { io } from 'socket.io-client';
import { supabase } from './supabase.js';

let socket = null;

export async function getSocket() {
  if (socket?.connected) return socket;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
