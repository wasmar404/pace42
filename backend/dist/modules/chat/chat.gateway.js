"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const config_1 = require("@nestjs/config");
const supabase_jwt_1 = require("../../auth/supabase.jwt");
const chat_service_1 = require("./chat.service");
let ChatGateway = class ChatGateway {
    constructor(config, chat) {
        this.config = config;
        this.chat = chat;
        // In-memory presence for a single backend instance.
        this.onlineSocketsByUser = new Map();
        this.lastSeenByUser = new Map();
        this.watchedBySocket = new Map();
        this.watchersByUser = new Map();
    }
    getPresence(userId) {
        const sockets = this.onlineSocketsByUser.get(userId);
        const online = Boolean(sockets && sockets.size > 0);
        return {
            online,
            lastSeenAt: online ? null : this.lastSeenByUser.get(userId) ?? null,
        };
    }
    notifyPresence(userId) {
        const watchers = this.watchersByUser.get(userId);
        if (!watchers || watchers.size === 0)
            return;
        const payload = { userId, ...this.getPresence(userId) };
        for (const socketId of watchers) {
            this.server.to(socketId).emit('presence:update', payload);
        }
    }
    setOnline(userId, socketId) {
        const set = this.onlineSocketsByUser.get(userId) ?? new Set();
        const wasOnline = set.size > 0;
        set.add(socketId);
        this.onlineSocketsByUser.set(userId, set);
        if (!wasOnline)
            this.notifyPresence(userId);
    }
    setOffline(userId, socketId) {
        const set = this.onlineSocketsByUser.get(userId);
        if (!set)
            return;
        const wasOnline = set.size > 0;
        set.delete(socketId);
        if (set.size === 0) {
            this.onlineSocketsByUser.delete(userId);
            this.lastSeenByUser.set(userId, new Date().toISOString());
        }
        else {
            this.onlineSocketsByUser.set(userId, set);
        }
        const nowOnline = Boolean(this.onlineSocketsByUser.get(userId)?.size);
        if (wasOnline && !nowOnline)
            this.notifyPresence(userId);
    }
    unwatchAll(socketId) {
        const watched = this.watchedBySocket.get(socketId);
        if (!watched)
            return;
        for (const userId of watched) {
            const watchers = this.watchersByUser.get(userId);
            if (!watchers)
                continue;
            watchers.delete(socketId);
            if (watchers.size === 0)
                this.watchersByUser.delete(userId);
        }
        this.watchedBySocket.delete(socketId);
    }
    async authSocket(client) {
        const header = client.handshake.headers?.authorization ?? '';
        const tokenFromHeader = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
        const tokenFromAuth = client.handshake.auth && typeof client.handshake.auth.token === 'string'
            ? String(client.handshake.auth.token)
            : '';
        const tokenFromQuery = typeof client.handshake.query?.token === 'string' ? client.handshake.query.token : '';
        const token = tokenFromHeader || tokenFromAuth || tokenFromQuery;
        if (!token)
            throw new Error('Missing token');
        const supabaseUrl = this.config.getOrThrow('SUPABASE_URL');
        const supabaseAnonKey = this.config.getOrThrow('SUPABASE_ANON_KEY');
        const supabaseJwtSecret = this.config.get('SUPABASE_JWT_SECRET');
        const decoded = await (0, supabase_jwt_1.verifySupabaseAccessToken)({ token, supabaseUrl, supabaseAnonKey, supabaseJwtSecret });
        return decoded.userId;
    }
    async handleConnection(client) {
        try {
            const userId = await this.authSocket(client);
            client.userId = userId;
            await client.join(`u:${userId}`);
            client.emit('ready', { userId });
            this.setOnline(userId, client.id);
        }
        catch {
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        const userId = client.userId;
        if (userId)
            this.setOffline(userId, client.id);
        this.unwatchAll(client.id);
    }
    async watchPresence(client, body) {
        const userId = client.userId;
        if (!userId)
            return;
        const ids = Array.isArray(body?.userIds) ? body.userIds.map((x) => String(x)).filter(Boolean) : [];
        const uniq = Array.from(new Set(ids)).slice(0, 200);
        // Replace watched list for this socket.
        this.unwatchAll(client.id);
        const watched = new Set(uniq);
        this.watchedBySocket.set(client.id, watched);
        for (const id of watched) {
            const watchers = this.watchersByUser.get(id) ?? new Set();
            watchers.add(client.id);
            this.watchersByUser.set(id, watchers);
        }
        const items = uniq.map((id) => ({ userId: id, ...this.getPresence(id) }));
        client.emit('presence:state', { items });
        return { ok: true };
    }
    async joinConversation(client, body) {
        const userId = client.userId;
        if (!userId)
            return;
        const conversationId = String(body?.conversationId ?? '');
        if (!conversationId)
            return;
        // Validate access by attempting read.
        await this.chat.getMessages(userId, conversationId, { limit: 1 });
        await client.join(`c:${conversationId}`);
        client.emit('conversation:joined', { conversationId });
    }
    async sendMessage(client, body) {
        const userId = client.userId;
        if (!userId)
            return;
        const conversationId = String(body?.conversationId ?? '');
        const text = String(body?.text ?? '');
        const clientId = typeof body?.clientId === 'string' ? String(body.clientId) : undefined;
        if (!conversationId)
            return;
        try {
            const res = await this.chat.sendMessage(userId, conversationId, text, clientId);
            const payload = { message: res.message, clientId: res.clientId ?? null };
            // Emit to both users' personal rooms only to avoid duplicates
            // (each socket is also in a conversation room).
            this.server.to(`u:${userId}`).emit('message:new', payload);
            this.server.to(`u:${res.otherUserId}`).emit('message:new', payload);
            return payload;
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to send';
            client.emit('message:error', { conversationId, clientId: clientId ?? null, error: msg });
            return { error: msg, clientId: clientId ?? null };
        }
    }
    async readConversation(client, body) {
        const userId = client.userId;
        if (!userId)
            return;
        const conversationId = String(body?.conversationId ?? '');
        if (!conversationId)
            return;
        await this.chat.markRead(userId, conversationId);
        this.server.to(`u:${userId}`).emit('conversation:read', { conversationId });
        return { ok: true };
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('presence:watch'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "watchPresence", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('conversation:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "joinConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "sendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('conversation:read'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "readConversation", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/chat',
        cors: {
            origin: true,
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [config_1.ConfigService,
        chat_service_1.ChatService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map