import { Server } from 'socket.io';
import { supabaseAdmin } from '../lib/supabase.js';
import { subscribeProgress } from './emitter.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Attaches Socket.io to the HTTP server. Clients authenticate with their
 * Supabase access token and join a room per organization they belong to.
 * Worker progress arrives via Redis pub/sub and is relayed to the org room.
 */
export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.frontendUrl, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) return next(new Error('unauthorized'));
      socket.userId = data.user.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    // Join rooms for every org the user is an active member of.
    const { data: memberships } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', socket.userId)
      .eq('status', 'active');
    for (const m of memberships || []) socket.join(`org:${m.org_id}`);

    socket.on('disconnect', () => {});
  });

  // Relay worker progress to the right org room.
  subscribeProgress(({ orgId, event, payload }) => {
    io.to(`org:${orgId}`).emit(event, payload);
  });

  logger.info('Socket.io attached');
  return io;
}
