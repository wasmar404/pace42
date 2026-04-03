import { BadRequestException, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { OptionalSupabaseAuthGuard } from '../../auth/supabase.optional.guard';
import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { PrismaService } from '../../prisma';

function isUuidV4(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private pagination(query: { skip?: string; take?: string }) {
    const skipRaw = typeof query?.skip === 'string' ? query.skip : '0';
    const takeRaw = typeof query?.take === 'string' ? query.take : '50';

    const skip = Math.max(0, Number.parseInt(skipRaw, 10) || 0);
    const take = Math.min(100, Math.max(1, Number.parseInt(takeRaw, 10) || 50));
    return { skip, take };
  }

  @Get(':id([0-9a-fA-F-]{36})/summary')
  @UseGuards(OptionalSupabaseAuthGuard)
  async getUserSummary(@Param('id') id: string, @Req() req: Request) {
    if (!id) throw new BadRequestException('Missing user id');
    if (!isUuidV4(id)) throw new BadRequestException('Invalid user id');

    const viewerId = (req as any)?.user?.userId as string | undefined;
    const isSelf = viewerId === id;

    const [profile, followersCount, followingCount] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId: id },
        select: {
          userId: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          bio: true,
          onboardingCompletedAt: true,
        },
      }),
      this.prisma.follow.count({ where: { followingId: id } }),
      this.prisma.follow.count({ where: { followerId: id } }),
    ]);

    if (!profile) throw new BadRequestException('User not found');
    if (!isSelf && !profile.onboardingCompletedAt) throw new BadRequestException('User not found');

    let isFollowing = false;
    if (viewerId && !isSelf) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: id,
          },
        },
        select: { followerId: true },
      });
      isFollowing = Boolean(follow);
    }

    const since4w = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

    const [recentActivities, totalVisibleActivities, last4WeeksCount, sums, recentPhotos] = await Promise.all([
      this.prisma.activity.findMany({
        where: {
          userId: id,
        },
        orderBy: { startedAt: 'desc' },
        take: 2,
        select: {
          id: true,
          userId: true,
          sport: true,
          title: true,
          description: true,
          startedAt: true,
          durationSeconds: true,
          distanceMeters: true,
          source: true,
          routePolyline: true,
        },
      }),
      this.prisma.activity.count({
        where: {
          userId: id,
        },
      }),
      this.prisma.activity.count({
        where: {
          userId: id,
          startedAt: { gte: since4w },
        },
      }),
      this.prisma.activity.aggregate({
        where: {
          userId: id,
        },
        _sum: {
          distanceMeters: true,
          durationSeconds: true,
        },
      }),
      this.prisma.activityMedia.findMany({
        where: {
          userId: id,
          kind: 'photo',
          publicUrl: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: { publicUrl: true },
      }),
    ]);

    const resp = {
      user: {
        id: profile.userId,
        username: profile.username,
      },
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
      },
      relationship: {
        isSelf,
        isFollowing,
      },
      stats: {
        followersCount,
        followingCount,
        totalActivities: totalVisibleActivities,
        last4WeeksCount,
        totalDistanceMeters: Number(sums?._sum?.distanceMeters ?? 0),
        totalDurationSeconds: Number(sums?._sum?.durationSeconds ?? 0),
        lastActivityAt: recentActivities?.[0]?.startedAt ?? null,
      },
      recentActivities,
      recentPhotos: recentPhotos.map((p: { publicUrl: string | null }) => p.publicUrl).filter(Boolean),
    };

    return resp;
  }

  @Get(':id([0-9a-fA-F-]{36})/followers')
  @UseGuards(OptionalSupabaseAuthGuard)
  async listFollowers(@Param('id') id: string, @Req() req: Request, @Query() query: { skip?: string; take?: string }) {
    if (!id) throw new BadRequestException('Missing user id');
    if (!isUuidV4(id)) throw new BadRequestException('Invalid user id');

    const { skip, take } = this.pagination(query);
    const viewerId = (req as any)?.user?.userId as string | undefined;

    const target = await this.prisma.profile.findUnique({ where: { userId: id }, select: { userId: true, onboardingCompletedAt: true } });
    if (!target) throw new BadRequestException('User not found');
    if (!target.onboardingCompletedAt) throw new BadRequestException('User not found');

    const [total, rows] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: id } }),
      this.prisma.follow.findMany({
        where: { followingId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: { followerId: true, createdAt: true },
      }),
    ]);

    const ids = rows.map((r) => r.followerId);
    if (!ids.length) return { total, items: [] };

    const [profiles, viewerFollows] = await Promise.all([
      this.prisma.profile.findMany({
        where: { userId: { in: ids }, onboardingCompletedAt: { not: null } },
        select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
      }),
      viewerId
        ? this.prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: ids } }, select: { followingId: true } })
        : Promise.resolve([] as Array<{ followingId: string }>),
    ]);

    const byId = new Map(profiles.map((p) => [p.userId, p] as const));
    const followingSet = new Set(viewerFollows.map((f) => f.followingId));

    const items = rows
      .map((r) => {
        const p = byId.get(r.followerId);
        if (!p) return null;
        return {
          user: {
            id: p.userId,
            username: p.username,
            firstName: p.firstName,
            lastName: p.lastName,
            avatarUrl: p.avatarUrl,
          },
          relationship: {
            isSelf: viewerId ? viewerId === p.userId : false,
            isFollowing: viewerId ? followingSet.has(p.userId) : false,
          },
          createdAt: r.createdAt,
        };
      })
      .filter(Boolean);

    return { total, items };
  }

  @Get(':id([0-9a-fA-F-]{36})/following')
  @UseGuards(OptionalSupabaseAuthGuard)
  async listFollowing(@Param('id') id: string, @Req() req: Request, @Query() query: { skip?: string; take?: string }) {
    if (!id) throw new BadRequestException('Missing user id');
    if (!isUuidV4(id)) throw new BadRequestException('Invalid user id');

    const { skip, take } = this.pagination(query);
    const viewerId = (req as any)?.user?.userId as string | undefined;

    const target = await this.prisma.profile.findUnique({ where: { userId: id }, select: { userId: true, onboardingCompletedAt: true } });
    if (!target) throw new BadRequestException('User not found');
    if (!target.onboardingCompletedAt) throw new BadRequestException('User not found');

    const [total, rows] = await Promise.all([
      this.prisma.follow.count({ where: { followerId: id } }),
      this.prisma.follow.findMany({
        where: { followerId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: { followingId: true, createdAt: true },
      }),
    ]);

    const ids = rows.map((r) => r.followingId);
    if (!ids.length) return { total, items: [] };

    const [profiles, viewerFollows] = await Promise.all([
      this.prisma.profile.findMany({
        where: { userId: { in: ids }, onboardingCompletedAt: { not: null } },
        select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
      }),
      viewerId
        ? this.prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: ids } }, select: { followingId: true } })
        : Promise.resolve([] as Array<{ followingId: string }>),
    ]);

    const byId = new Map(profiles.map((p) => [p.userId, p] as const));
    const followingSet = new Set(viewerFollows.map((f) => f.followingId));

    const items = rows
      .map((r) => {
        const p = byId.get(r.followingId);
        if (!p) return null;
        return {
          user: {
            id: p.userId,
            username: p.username,
            firstName: p.firstName,
            lastName: p.lastName,
            avatarUrl: p.avatarUrl,
          },
          relationship: {
            isSelf: viewerId ? viewerId === p.userId : false,
            isFollowing: viewerId ? followingSet.has(p.userId) : false,
          },
          createdAt: r.createdAt,
        };
      })
      .filter(Boolean);

    return { total, items };
  }

  @Post(':id([0-9a-fA-F-]{36})/follow')
  @UseGuards(SupabaseAuthGuard)
  async followUser(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    if (!id) throw new BadRequestException('Missing user id');
    if (!isUuidV4(id)) throw new BadRequestException('Invalid user id');
    if (id === user.userId) throw new BadRequestException('Cannot follow yourself');

    const target = await this.prisma.profile.findUnique({ where: { userId: id }, select: { userId: true, onboardingCompletedAt: true } });
    if (!target) throw new BadRequestException('User not found');
    if (!target.onboardingCompletedAt) throw new BadRequestException('User not found');

    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: user.userId,
          followingId: id,
        },
      },
      create: {
        followerId: user.userId,
        followingId: id,
      },
      update: {},
    });

    return { ok: true };
  }

  @Delete(':id([0-9a-fA-F-]{36})/follow')
  @UseGuards(SupabaseAuthGuard)
  async unfollowUser(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    if (!id) throw new BadRequestException('Missing user id');
    if (!isUuidV4(id)) throw new BadRequestException('Invalid user id');
    if (id === user.userId) throw new BadRequestException('Cannot unfollow yourself');

    await this.prisma.follow.deleteMany({
      where: {
        followerId: user.userId,
        followingId: id,
      },
    });

    return { ok: true };
  }

  @Get(':id([0-9a-fA-F-]{36})')
  @UseGuards(OptionalSupabaseAuthGuard)
  async getUser(@Param('id') id: string) {
    if (!id) throw new BadRequestException('Missing user id');
    if (!isUuidV4(id)) throw new BadRequestException('Invalid user id');

    const data = await this.prisma.profile.findUnique({
      where: { userId: id },
      select: {
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        onboardingCompletedAt: true,
      },
    });

    if (!data) throw new BadRequestException('User not found');
    if (!data.onboardingCompletedAt) throw new BadRequestException('User not found');

    return {
      user: {
        id: data.userId,
        username: data.username,
      },
      profile: {
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        bio: data.bio,
      },
    };
  }

  @Get(':id([0-9a-fA-F-]{36})/activities')
  @UseGuards(OptionalSupabaseAuthGuard)
  async getUserActivities(@Param('id') id: string) {
    if (!id) throw new BadRequestException('Missing user id');
    if (!isUuidV4(id)) throw new BadRequestException('Invalid user id');

    const activities = await this.prisma.activity.findMany({
      where: {
        userId: id,
      },
      orderBy: { startedAt: 'desc' },
    });

    return { activities };
  }
}
