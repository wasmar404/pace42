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

    const [followCount, unreadMessageConvos, kudoCount, commentCount] = await Promise.all([
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
    ]);

    return { unread: followCount + unreadMessageConvos + kudoCount + commentCount };
  }

  @Get()
  async list(@CurrentUser() user: { userId: string }) {
    const [follows, convoNotifs, kudos, comments] = await Promise.all([
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
    ]);

    const actorIds = Array.from(
      new Set([
        ...follows.map((f) => f.followerId),
        ...convoNotifs.map((c) => c.conversation.lastSenderId).filter(Boolean) as string[],
        ...kudos.map((k) => k.userId),
        ...comments.map((c) => c.userId),
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
