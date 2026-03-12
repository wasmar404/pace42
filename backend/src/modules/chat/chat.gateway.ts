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
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: AuthedSocket) {}

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
