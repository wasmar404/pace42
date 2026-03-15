import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma';

function normalizeText(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnreadSummary(userId: string) {
    const agg = await this.prisma.conversationParticipant.aggregate({
      where: { userId, unreadCount: { gt: 0 } },
      _count: { _all: true },
      _sum: { unreadCount: true },
    });

    return {
      unreadConversations: agg._count?._all ?? 0,
      unreadMessages: agg._sum?.unreadCount ?? 0,
    };
  }

  async isMutualFollow(a: string, b: string): Promise<boolean> {
    if (!a || !b || a === b) return false;
    const [ab, ba] = await Promise.all([
      this.prisma.follow.findUnique({ where: { followerId_followingId: { followerId: a, followingId: b } } }),
      this.prisma.follow.findUnique({ where: { followerId_followingId: { followerId: b, followingId: a } } }),
    ]);
    return Boolean(ab && ba);
  }

  async getOrCreateConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) throw new BadRequestException('Cannot chat with yourself');
    const mutual = await this.isMutualFollow(userId, otherUserId);
    if (!mutual) throw new ForbiddenException('Mutual follow required');

    const rows = await this.prisma.conversationParticipant.findMany({
      where: { userId: { in: [userId, otherUserId] } },
      select: { conversationId: true, userId: true },
    });

    const counts = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = counts.get(r.conversationId) ?? new Set<string>();
      set.add(r.userId);
      counts.set(r.conversationId, set);
    }

    for (const [conversationId, set] of counts.entries()) {
      if (set.has(userId) && set.has(otherUserId)) {
        const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
        if (convo) return convo;
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const convo = await tx.conversation.create({ data: {} });
      await tx.conversationParticipant.createMany({
        data: [
          { conversationId: convo.id, userId, unreadCount: 0 },
          { conversationId: convo.id, userId: otherUserId, unreadCount: 0 },
        ],
      });
      return convo;
    });
  }

  async listConversations(userId: string) {
    const mine = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: { conversation: true },
    });

    const convoIds = mine.map((m) => m.conversationId);
    if (!convoIds.length) return { conversations: [] as any[] };

    const allParts = await this.prisma.conversationParticipant.findMany({
      where: { conversationId: { in: convoIds } },
      select: { conversationId: true, userId: true },
    });

    const otherByConvo = new Map<string, string>();
    for (const p of allParts) {
      if (p.userId === userId) continue;
      otherByConvo.set(p.conversationId, p.userId);
    }

    const otherIds = Array.from(new Set([...otherByConvo.values()]));
    const profiles = otherIds.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: otherIds } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const profById = new Map(profiles.map((p) => [p.userId, p] as const));

    const convos = mine
      .map((m) => {
        const c = m.conversation;
        const otherId = otherByConvo.get(m.conversationId) ?? null;
        const p = otherId ? profById.get(otherId) : null;
        const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'User');
        return {
          id: c.id,
          lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          lastMessageText: c.lastMessageText ?? null,
          lastSenderId: c.lastSenderId ?? null,
          unreadCount: m.unreadCount,
          otherUser: {
            id: otherId,
            username: p?.username ?? null,
            name,
            avatarUrl: p?.avatarUrl ?? null,
          },
        };
      })
      .sort((a, b) => {
        const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
        const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
        return tb - ta;
      });

    return { conversations: convos };
  }

  async searchMutuals(userId: string, q: string, take = 10) {
    const query = String(q ?? '').trim();
    const limit = Math.min(50, Math.max(1, Number(take || 10)));

    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);
    if (!followingIds.length) return { items: [] as any[] };

    const back = await this.prisma.follow.findMany({
      where: {
        followingId: userId,
        followerId: { in: followingIds },
      },
      select: { followerId: true },
    });

    const mutualIds = back.map((b) => b.followerId);
    if (!mutualIds.length) return { items: [] as any[] };

    const where: any = { userId: { in: mutualIds } };
    if (query) {
      where.OR = [
        { username: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
      ];
    }

    const profiles = await this.prisma.profile.findMany({
      where,
      orderBy: [{ username: 'asc' }],
      take: limit,
      select: {
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    return {
      items: profiles.map((p) => ({
        id: p.userId,
        username: p.username,
        firstName: p.firstName ?? null,
        lastName: p.lastName ?? null,
        avatarUrl: p.avatarUrl ?? null,
      })),
    };
  }

  async getMessages(userId: string, conversationId: string, params: { limit?: number; before?: string }) {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!part) throw new NotFoundException('Conversation not found');

    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 50)));
    const beforeTs = params.before ? Date.parse(params.before) : NaN;
    const before = Number.isFinite(beforeTs) ? new Date(beforeTs) : undefined;

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return {
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async sendMessage(userId: string, conversationId: string, body: string, clientId?: string) {
    const text = normalizeText(String(body ?? ''));
    if (!text) throw new BadRequestException('Message is empty');
    if (text.length > 2000) throw new BadRequestException('Message too long');

    const parts = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    if (!parts.find((p) => p.userId === userId)) throw new NotFoundException('Conversation not found');

    const other = parts.find((p) => p.userId !== userId);
    if (!other) throw new BadRequestException('Invalid conversation');

    const mutual = await this.isMutualFollow(userId, other.userId);
    if (!mutual) throw new ForbiddenException('Mutual follow required');

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          body: text,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          lastMessageText: text.slice(0, 500),
          lastSenderId: userId,
        },
      });

      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: other.userId } },
        data: {
          unreadCount: { increment: 1 },
        },
      });

      return msg;
    });

    return {
      message: {
        id: result.id,
        conversationId: result.conversationId,
        senderId: result.senderId,
        body: result.body,
        createdAt: result.createdAt.toISOString(),
      },
      otherUserId: other.userId,
      clientId: clientId ? String(clientId) : null,
    };
  }

  async markRead(userId: string, conversationId: string) {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!part) throw new NotFoundException('Conversation not found');

    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: {
        unreadCount: 0,
        lastReadAt: new Date(),
      },
    });

    return { ok: true };
  }
}
