import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';

import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { PrismaService } from '../../prisma';

function displayName(p?: { firstName?: string | null; lastName?: string | null; username?: string | null }) {
  const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();
  return name || (p?.username ? `@${p.username}` : 'Athlete');
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

@Controller('home')
@UseGuards(SupabaseAuthGuard)
export class HomeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('feed')
  async feed(
    @CurrentUser() user: { userId: string },
    @Query('take') take?: string,
  ) {
    const n = Number(take ?? 20);
    if (!Number.isFinite(n)) throw new BadRequestException('Invalid take');
    const limit = clamp(Math.floor(n), 1, 50);

    const following = await this.prisma.follow.findMany({
      where: { followerId: user.userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    const hasFollowing = followingIds.length > 0;

    // Over-fetch a bit for explore so we can filter out private accounts.
    const seedActivities = await this.prisma.activity.findMany({
      where: hasFollowing
        ? {
            userId: { in: followingIds },
            visibility: { in: ['public', 'followers'] },
          }
        : {
            visibility: 'public',
            userId: { not: user.userId },
          },
      orderBy: { startedAt: 'desc' },
      take: hasFollowing ? limit : Math.min(150, limit * 3),
      select: {
        id: true,
        userId: true,
        sport: true,
        title: true,
        description: true,
        startedAt: true,
        durationSeconds: true,
        distanceMeters: true,
        visibility: true,
        routePolyline: true,
        createdAt: true,
      },
    });

    const seedActorIds = Array.from(new Set(seedActivities.map((a) => a.userId)));

    const actors = seedActorIds.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: seedActorIds } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true, isPrivate: true },
        })
      : [];

    const actorById = new Map(actors.map((a) => [a.userId, a] as const));

    const activities = hasFollowing
      ? seedActivities.slice(0, limit)
      : seedActivities
          .filter((a) => {
            const p = actorById.get(a.userId);
            return p ? !p.isPrivate : false;
          })
          .slice(0, limit);

    const activityIds = activities.map((a) => a.id);

    const [media, kudosCounts, commentCounts, myKudos] = await Promise.all([
      activityIds.length
        ? this.prisma.activityMedia.findMany({
            where: { activityId: { in: activityIds } },
            orderBy: { createdAt: 'desc' },
            select: { activityId: true, publicUrl: true },
          })
        : Promise.resolve([]),
      activityIds.length
        ? this.prisma.activityKudo.groupBy({
            by: ['activityId'],
            where: { activityId: { in: activityIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      activityIds.length
        ? this.prisma.activityComment.groupBy({
            by: ['activityId'],
            where: { activityId: { in: activityIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      activityIds.length
        ? this.prisma.activityKudo.findMany({
            where: { activityId: { in: activityIds }, userId: user.userId },
            select: { activityId: true },
          })
        : Promise.resolve([]),
    ]);
    const mediaByActivity = new Map<string, string>();
    for (const m of media) {
      if (!m.publicUrl) continue;
      if (!mediaByActivity.has(m.activityId)) mediaByActivity.set(m.activityId, m.publicUrl);
    }

    const kudosByActivity = new Map<string, number>();
    for (const r of kudosCounts as any[]) {
      kudosByActivity.set(r.activityId, Number(r._count?._all ?? 0));
    }

    const commentsByActivity = new Map<string, number>();
    for (const r of commentCounts as any[]) {
      commentsByActivity.set(r.activityId, Number(r._count?._all ?? 0));
    }

    const myKudosSet = new Set((myKudos as any[]).map((k) => k.activityId));

    const items: any[] = [];

    // Include a single announcement item sometimes so the feed supports multiple entry types.
    if (!hasFollowing) {
      items.push({
        type: 'announcement',
        id: 'a-welcome',
        club: { name: 'Pace42 Club', icon: '🏁' },
        title: 'Welcome to your feed',
        body: 'Follow a few athletes to see their workouts here. Until then, we show public activities to explore.',
        createdAt: new Date().toISOString(),
      });
    }

    for (const a of activities) {
      const p = actorById.get(a.userId);
      items.push({
        type: 'activity',
        id: a.id,
        createdAt: a.startedAt.toISOString(),
        athlete: {
          id: a.userId,
          username: p?.username ?? null,
          name: displayName(p),
          avatarUrl: p?.avatarUrl ?? null,
        },
        activity: {
          id: a.id,
          sport: a.sport,
          title: a.title ?? null,
          description: a.description ?? null,
          startedAt: a.startedAt.toISOString(),
          durationSeconds: a.durationSeconds,
          distanceMeters: a.distanceMeters,
          visibility: a.visibility,
          routePolyline: a.routePolyline ?? null,
          imageUrl: mediaByActivity.get(a.id) ?? null,
        },
        social: {
          kudosCount: kudosByActivity.get(a.id) ?? 0,
          commentCount: commentsByActivity.get(a.id) ?? 0,
          viewerHasKudo: myKudosSet.has(a.id),
        },
      });
    }

    return {
      source: hasFollowing ? 'following' : 'explore',
      items,
    };
  }

  @Get('recommended-users')
  async recommendedUsers(
    @CurrentUser() user: { userId: string },
    @Query('take') take?: string,
  ) {
    const n = Number(take ?? 6);
    if (!Number.isFinite(n)) throw new BadRequestException('Invalid take');
    const limit = clamp(Math.floor(n), 1, 20);

    const following = await this.prisma.follow.findMany({
      where: { followerId: user.userId },
      select: { followingId: true },
    });
    const followingIds = new Set(following.map((f) => f.followingId));

    const profiles = await this.prisma.profile.findMany({
      where: {
        userId: {
          not: user.userId,
        },
        onboardingCompletedAt: { not: null },
        firstName: { not: null },
        lastName: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
    });

    const items = [] as any[];
    for (const p of profiles) {
      if (followingIds.has(p.userId)) continue;
      items.push({
        id: p.userId,
        username: p.username,
        name: displayName(p),
        avatarUrl: p.avatarUrl ?? null,
        isFollowing: false,
      });
      if (items.length >= limit) break;
    }

    return { items };
  }

  @Get('goals')
  async goals(
    @CurrentUser() user: { userId: string },
    @Query('days') days?: string,
    @Query('goalKm') goalKm?: string,
  ) {
    const d = Number(days ?? 7);
    if (!Number.isFinite(d) || d <= 0) throw new BadRequestException('Invalid days');
    const windowDays = clamp(Math.floor(d), 1, 31);

    const goal = Number(goalKm ?? 30);
    const goalDistanceMeters = Math.max(1000, Math.round((Number.isFinite(goal) ? goal : 30) * 1000));

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.activity.findMany({
      where: {
        userId: user.userId,
        startedAt: { gte: since },
      },
      select: { distanceMeters: true },
    });
    const distanceMeters = rows.reduce((sum, r) => sum + (Number(r.distanceMeters) || 0), 0);

    return {
      windowDays,
      goalDistanceMeters,
      distanceMeters,
    };
  }
}
