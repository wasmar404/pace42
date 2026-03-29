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
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../auth/supabase.guard");
const supabase_user_1 = require("../../auth/supabase.user");
const prisma_1 = require("../../prisma");
let NotificationsController = class NotificationsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async unread(user, since) {
        const sinceMs = Number(since ?? 0);
        if (!Number.isFinite(sinceMs) || sinceMs < 0)
            throw new common_1.BadRequestException('Invalid since');
        const sinceDate = new Date(sinceMs || 0);
        const [followCount, unreadMessageConvos, kudoCount, commentCount, inviteCount] = await Promise.all([
            this.prisma.follow.count({
                where: {
                    followingId: user.userId,
                    createdAt: {
                        gt: sinceDate,
                    },
                },
            }),
            this.prisma.conversationParticipant.count({
                where: {
                    userId: user.userId,
                    unreadCount: { gt: 0 },
                    conversation: {
                        lastMessageAt: { gt: sinceDate },
                        lastSenderId: { not: user.userId },
                    },
                },
            }),
            this.prisma.activityKudo.count({
                where: {
                    createdAt: { gt: sinceDate },
                    userId: { not: user.userId },
                    activity: { userId: user.userId },
                },
            }),
            this.prisma.activityComment.count({
                where: {
                    createdAt: { gt: sinceDate },
                    userId: { not: user.userId },
                    activity: { userId: user.userId },
                },
            }),
            this.prisma.clubInvite.count({
                where: {
                    userId: user.userId,
                    status: 'pending',
                    createdAt: { gt: sinceDate },
                },
            }),
        ]);
        return { unread: followCount + unreadMessageConvos + kudoCount + commentCount + inviteCount };
    }
    async list(user) {
        const [follows, convoNotifs, kudos, comments, invites] = await Promise.all([
            this.prisma.follow.findMany({
                where: {
                    followingId: user.userId,
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    followerId: true,
                    createdAt: true,
                },
            }),
            this.prisma.conversationParticipant.findMany({
                where: {
                    userId: user.userId,
                    unreadCount: { gt: 0 },
                    conversation: {
                        lastMessageAt: { not: null },
                        lastSenderId: { not: user.userId },
                    },
                },
                take: 20,
                orderBy: {
                    conversation: {
                        lastMessageAt: 'desc',
                    },
                },
                select: {
                    conversationId: true,
                    unreadCount: true,
                    conversation: {
                        select: {
                            lastMessageAt: true,
                            lastMessageText: true,
                            lastSenderId: true,
                        },
                    },
                },
            }),
            this.prisma.activityKudo.findMany({
                where: {
                    userId: { not: user.userId },
                    activity: { userId: user.userId },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    activityId: true,
                    userId: true,
                    createdAt: true,
                    activity: { select: { title: true, sport: true } },
                },
            }),
            this.prisma.activityComment.findMany({
                where: {
                    userId: { not: user.userId },
                    activity: { userId: user.userId },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    activityId: true,
                    userId: true,
                    body: true,
                    createdAt: true,
                    activity: { select: { title: true, sport: true } },
                },
            }),
            this.prisma.clubInvite.findMany({
                where: { userId: user.userId, status: 'pending' },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    clubId: true,
                    invitedById: true,
                    createdAt: true,
                    club: { select: { name: true } },
                },
            }),
        ]);
        const actorIds = Array.from(new Set([
            ...follows.map((f) => f.followerId),
            ...convoNotifs.map((c) => c.conversation.lastSenderId).filter(Boolean),
            ...kudos.map((k) => k.userId),
            ...comments.map((c) => c.userId),
            ...invites.map((i) => i.invitedById),
        ]));
        const actors = actorIds.length
            ? await this.prisma.profile.findMany({
                where: { userId: { in: actorIds } },
                select: {
                    userId: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                },
            })
            : [];
        const byId = new Map(actors.map((a) => [a.userId, a]));
        const items = [
            ...follows.map((f) => {
                const a = byId.get(f.followerId);
                const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || (a?.username ? `@${a.username}` : 'Someone');
                return {
                    type: 'follow',
                    createdAt: f.createdAt.toISOString(),
                    actor: {
                        id: f.followerId,
                        username: a?.username ?? null,
                        name,
                        avatarUrl: a?.avatarUrl ?? null,
                    },
                    text: `${name} started following you`,
                };
            }),
            ...kudos.map((k) => {
                const a = byId.get(k.userId);
                const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || (a?.username ? `@${a.username}` : 'Someone');
                const title = k.activity?.title || `${String(k.activity?.sport || 'activity')}`;
                return {
                    type: 'kudo',
                    createdAt: k.createdAt.toISOString(),
                    activityId: k.activityId,
                    actor: {
                        id: k.userId,
                        username: a?.username ?? null,
                        name,
                        avatarUrl: a?.avatarUrl ?? null,
                    },
                    text: `${name} gave you kudos on ${title}`,
                };
            }),
            ...comments.map((c) => {
                const a = byId.get(c.userId);
                const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || (a?.username ? `@${a.username}` : 'Someone');
                const title = c.activity?.title || `${String(c.activity?.sport || 'activity')}`;
                const preview = String(c.body ?? '').trim();
                const clip = preview.length > 80 ? `${preview.slice(0, 80)}…` : preview;
                return {
                    type: 'comment',
                    createdAt: c.createdAt.toISOString(),
                    activityId: c.activityId,
                    actor: {
                        id: c.userId,
                        username: a?.username ?? null,
                        name,
                        avatarUrl: a?.avatarUrl ?? null,
                    },
                    text: clip ? `${name} commented on ${title}: ${clip}` : `${name} commented on ${title}`,
                };
            }),
            ...convoNotifs
                .filter((c) => c.conversation.lastMessageAt && c.conversation.lastSenderId)
                .map((c) => {
                const senderId = c.conversation.lastSenderId;
                const a = byId.get(senderId);
                const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || (a?.username ? `@${a.username}` : 'Someone');
                const preview = String(c.conversation.lastMessageText ?? '').trim();
                const clip = preview.length > 90 ? `${preview.slice(0, 90)}…` : preview;
                return {
                    type: 'message',
                    createdAt: c.conversation.lastMessageAt.toISOString(),
                    conversationId: c.conversationId,
                    actor: {
                        id: senderId,
                        username: a?.username ?? null,
                        name,
                        avatarUrl: a?.avatarUrl ?? null,
                    },
                    text: clip ? `${name}: ${clip}` : `New message from ${name}`,
                };
            }),
            ...invites.map((inv) => {
                const a = byId.get(inv.invitedById);
                const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || (a?.username ? `@${a.username}` : 'Someone');
                const clubName = inv.club?.name || 'a club';
                return {
                    type: 'club_invite',
                    createdAt: inv.createdAt.toISOString(),
                    clubId: inv.clubId,
                    actor: {
                        id: inv.invitedById,
                        username: a?.username ?? null,
                        name,
                        avatarUrl: a?.avatarUrl ?? null,
                    },
                    text: `${name} invited you to join ${clubName}`,
                };
            }),
        ];
        items.sort((a, b) => {
            const ta = Date.parse(a.createdAt);
            const tb = Date.parse(b.createdAt);
            return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
        });
        return { items: items.slice(0, 20) };
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)('unread'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('since')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "unread", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "list", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __metadata("design:paramtypes", [prisma_1.PrismaService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map