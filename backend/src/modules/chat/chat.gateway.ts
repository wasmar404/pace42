import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';

import { verifySupabaseAccessToken } from '../../auth/supabase.jwt';
import { ChatService } from './chat.service';

type AuthedSocket = Socket & { userId?: string };

type Presence = {
  online: boolean;
  lastSeenAt: string | null;
};

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly chat: ChatService,
  ) {}

  // In-memory presence for a single backend instance.
  private readonly onlineSocketsByUser = new Map<string, Set<string>>();
  private readonly lastSeenByUser = new Map<string, string>();
  private readonly watchedBySocket = new Map<string, Set<string>>();
  private readonly watchersByUser = new Map<string, Set<string>>();

  private getPresence(userId: string): Presence {
    const sockets = this.onlineSocketsByUser.get(userId);
    const online = Boolean(sockets && sockets.size > 0);
    return {
      online,
      lastSeenAt: online ? null : this.lastSeenByUser.get(userId) ?? null,
    };
  }

  private notifyPresence(userId: string) {
    const watchers = this.watchersByUser.get(userId);
    if (!watchers || watchers.size === 0) return;
    const payload = { userId, ...this.getPresence(userId) };
    for (const socketId of watchers) {
      this.server.to(socketId).emit('presence:update', payload);
    }
  }

  private setOnline(userId: string, socketId: string) {
    const set = this.onlineSocketsByUser.get(userId) ?? new Set<string>();
    const wasOnline = set.size > 0;
    set.add(socketId);
    this.onlineSocketsByUser.set(userId, set);
    if (!wasOnline) this.notifyPresence(userId);
  }

  private setOffline(userId: string, socketId: string) {
    const set = this.onlineSocketsByUser.get(userId);
    if (!set) return;
    const wasOnline = set.size > 0;
    set.delete(socketId);
    if (set.size === 0) {
      this.onlineSocketsByUser.delete(userId);
      this.lastSeenByUser.set(userId, new Date().toISOString());
    } else {
      this.onlineSocketsByUser.set(userId, set);
    }
    const nowOnline = Boolean(this.onlineSocketsByUser.get(userId)?.size);
    if (wasOnline && !nowOnline) this.notifyPresence(userId);
  }

  private unwatchAll(socketId: string) {
    const watched = this.watchedBySocket.get(socketId);
    if (!watched) return;
    for (const userId of watched) {
      const watchers = this.watchersByUser.get(userId);
      if (!watchers) continue;
      watchers.delete(socketId);
      if (watchers.size === 0) this.watchersByUser.delete(userId);
    }
    this.watchedBySocket.delete(socketId);
  }

  private async authSocket(client: AuthedSocket): Promise<string> {
    const header = (client.handshake.headers?.authorization as string | undefined) ?? '';
    const tokenFromHeader = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    const tokenFromAuth =
      client.handshake.auth && typeof (client.handshake.auth as any).token === 'string'
        ? String((client.handshake.auth as any).token)
        : '';
    const tokenFromQuery = typeof client.handshake.query?.token === 'string' ? (client.handshake.query.token as string) : '';
    const token = tokenFromHeader || tokenFromAuth || tokenFromQuery;
    if (!token) throw new Error('Missing token');

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const supabaseJwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET');

    const decoded = await verifySupabaseAccessToken({ token, supabaseUrl, supabaseAnonKey, supabaseJwtSecret });
    return decoded.userId;
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const userId = await this.authSocket(client);
      client.userId = userId;
      await client.join(`u:${userId}`);
      client.emit('ready', { userId });
      this.setOnline(userId, client.id);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    const userId = client.userId;
    if (userId) this.setOffline(userId, client.id);
    this.unwatchAll(client.id);
  }

  @SubscribeMessage('presence:watch')
  async watchPresence(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { userIds?: string[] },
  ) {
    const userId = client.userId;
    if (!userId) return;

    const ids = Array.isArray(body?.userIds) ? body.userIds.map((x) => String(x)).filter(Boolean) : [];
    const uniq = Array.from(new Set(ids)).slice(0, 200);

    // Replace watched list for this socket.
    this.unwatchAll(client.id);
    const watched = new Set<string>(uniq);
    this.watchedBySocket.set(client.id, watched);
    for (const id of watched) {
      const watchers = this.watchersByUser.get(id) ?? new Set<string>();
      watchers.add(client.id);
      this.watchersByUser.set(id, watchers);
    }

    const items = uniq.map((id) => ({ userId: id, ...this.getPresence(id) }));
    client.emit('presence:state', { items });
    return { ok: true };
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = client.userId;
    if (!userId) return;
    const conversationId = String(body?.conversationId ?? '');
    if (!conversationId) return;
    // Validate access by attempting read.
    await this.chat.getMessages(userId, conversationId, { limit: 1 });
    await client.join(`c:${conversationId}`);
    client.emit('conversation:joined', { conversationId });
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string; text?: string; clientId?: string },
  ) {
    const userId = client.userId;
    if (!userId) return;
    const conversationId = String(body?.conversationId ?? '');
    const text = String(body?.text ?? '');
    const clientId = typeof body?.clientId === 'string' ? String(body.clientId) : undefined;
    if (!conversationId) return;

    try {
      const res = await this.chat.sendMessage(userId, conversationId, text, clientId);
      const payload = { message: res.message, clientId: res.clientId ?? null };
      // Emit to both users' personal rooms only to avoid duplicates
      // (each socket is also in a conversation room).
      this.server.to(`u:${userId}`).emit('message:new', payload);
      this.server.to(`u:${res.otherUserId}`).emit('message:new', payload);
      return payload;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send';
      client.emit('message:error', { conversationId, clientId: clientId ?? null, error: msg });
      return { error: msg, clientId: clientId ?? null };
    }
  }

  @SubscribeMessage('conversation:read')
  async readConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = client.userId;
    if (!userId) return;
    const conversationId = String(body?.conversationId ?? '');
    if (!conversationId) return;
    await this.chat.markRead(userId, conversationId);
    this.server.to(`u:${userId}`).emit('conversation:read', { conversationId });
    return { ok: true };
  }
}
