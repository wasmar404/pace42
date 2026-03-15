import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { OptionalSupabaseAuthGuard } from '../../auth/supabase.optional.guard';
import { PrismaService } from '../../prisma';

@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  @UseGuards(OptionalSupabaseAuthGuard)
  async searchUsers(@Query('q') q: string, @Req() req: Request) {
    const query = (q ?? '').trim();
    if (query.length < 2) return { users: [] };

    const viewerId = (req as any)?.user?.userId as string | undefined;

    const users = await this.prisma.profile.findMany({
      where: {
        onboardingCompletedAt: { not: null },
        firstName: { not: null },
        lastName: { not: null },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: {
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        level: true,
      },
    });

    const ids = users.map((u) => u.userId);
    let followingSet = new Set<string>();
    if (viewerId && ids.length) {
      const follows = await this.prisma.follow.findMany({
        where: {
          followerId: viewerId,
          followingId: { in: ids },
        },
        select: { followingId: true },
      });
      followingSet = new Set(follows.map((f) => f.followingId));
    }

    return {
      users: users.map((u) => ({
        id: u.userId,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        avatarUrl: u.avatarUrl,
        level: u.level,
        isFollowing: viewerId ? followingSet.has(u.userId) : false,
      })),
    };
  }
}
