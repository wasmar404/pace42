import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma';

function normalizeText(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) throw new BadRequestException('Cannot chat with yourself');

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
        try {
          return await this.prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
        } catch {
          throw new NotFoundException('Conversation not found');
        }
      }
    }

    return await this.prisma.$transaction(async (tx: any) => {
      const convo = await tx.conversation.create({ data: {} });
      await tx.conversationParticipant.createMany({
        data: [
          { conversationId: convo.id, userId },
          { conversationId: convo.id, userId: otherUserId },
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

    const convoIds = mine.map((m: any) => m.conversationId);
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
    const profById = new Map<string, any>(profiles.map((p: any) => [p.userId, p] as const));

    const convos = mine
      .map((m: any) => {
        const c = m.conversation;
        const otherId = otherByConvo.get(m.conversationId) ?? null;
        const p = otherId ? profById.get(otherId) : null;
        const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'User');
        return {
          id: c.id,
          lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          lastMessageText: c.lastMessageText ?? null,
          lastSenderId: c.lastSenderId ?? null,
          otherUser: {
            id: otherId,
            username: p?.username ?? null,
            name,
            avatarUrl: p?.avatarUrl ?? null,
          },
        };
      })
      .sort((a: any, b: any) => {
        const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
        const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
        return tb - ta;
      });

    return { conversations: convos };
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
      messages: messages.map((m: any) => ({
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
    if (!parts.find((p: any) => p.userId === userId)) throw new NotFoundException('Conversation not found');

    const other = parts.find((p: any) => p.userId !== userId);
    if (!other) throw new BadRequestException('Invalid conversation');

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx: any) => {
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

}
