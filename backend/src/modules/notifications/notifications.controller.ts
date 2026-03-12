import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';

import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { PrismaService } from '../../prisma';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('unread')
  async unread(
    @CurrentUser() user: { userId: string },
    @Query('since') since?: string,
  ) {
    const sinceMs = Number(since ?? 0);
    if (!Number.isFinite(sinceMs) || sinceMs < 0) throw new BadRequestException('Invalid since');

    const sinceDate = new Date(sinceMs || 0);

    const [followCount, unreadMessageConvos] = await Promise.all([
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
    ]);

    return { unread: followCount + unreadMessageConvos };
  }

  @Get()
  async list(@CurrentUser() user: { userId: string }) {
    const follows = await this.prisma.follow.findMany({
      where: {
        followingId: user.userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        followerId: true,
        createdAt: true,
      },
    });

    const convoNotifs = await this.prisma.conversationParticipant.findMany({
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
    });

    const actorIds = Array.from(
      new Set([
        ...follows.map((f) => f.followerId),
        ...convoNotifs.map((c) => c.conversation.lastSenderId).filter(Boolean) as string[],
      ]),
    );
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

    const byId = new Map(actors.map((a) => [a.userId, a] as const));

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
      ...convoNotifs
        .filter((c) => c.conversation.lastMessageAt && c.conversation.lastSenderId)
        .map((c) => {
          const senderId = c.conversation.lastSenderId as string;
          const a = byId.get(senderId);
          const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || (a?.username ? `@${a.username}` : 'Someone');
          const preview = String(c.conversation.lastMessageText ?? '').trim();
          const clip = preview.length > 90 ? `${preview.slice(0, 90)}…` : preview;
          return {
            type: 'message',
            createdAt: (c.conversation.lastMessageAt as Date).toISOString(),
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
    ];

    items.sort((a: any, b: any) => {
      const ta = Date.parse(a.createdAt);
      const tb = Date.parse(b.createdAt);
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    return { items: items.slice(0, 20) };
  }
}
