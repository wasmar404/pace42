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

    const count = await this.prisma.follow.count({
      where: {
        followingId: user.userId,
        createdAt: {
          gt: new Date(sinceMs || 0),
        },
      },
    });

    return { unread: count };
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

    const actorIds = Array.from(new Set(follows.map((f) => f.followerId)));
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

    return {
      items: follows.map((f) => {
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
    };
  }
}
