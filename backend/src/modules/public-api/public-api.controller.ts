import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
 

import { PrismaService } from '../../prisma';
import { PublicApiGuard } from './public-api.guard';
import { PublicActivitiesDto, PublicListDto } from './public-api.dto';

function trimOrThrow(name: string, value: unknown, max: number) {
  const s = String(value ?? '').trim();
  if (!s) throw new BadRequestException(`${name} is required`);
  if (s.length > max) throw new BadRequestException(`${name} is too long`);
  return s;
}

@Controller('public')
@UseGuards(PublicApiGuard)
export class PublicApiController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Note: Clubs endpoints were removed; keep Public API scoped to health/users/activities.

  @Get('health')
  async health() {
    return { ok: true, now: new Date().toISOString() };
  }

  @Get('users')
  async users(@Query() q: PublicListDto) {
    const query = String(q?.q || '').trim();
    const take = Number(q?.take ?? 20);
    const limit = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;

    if (query.length < 2) return { users: [] };

    const users = await this.prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true, isPrivate: true },
    });

    return {
      users: users.map((u) => ({
        id: u.userId,
        username: u.username,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        isPrivate: Boolean(u.isPrivate ?? false),
      })),
    };
  }

  @Get('activities')
  async activities(@Query() q: PublicActivitiesDto) {
    const take = Number(q?.take ?? 20);
    const limit = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;

    let since: Date | null = null;
    if (typeof q?.since === 'string' && q.since.trim()) {
      const d = new Date(q.since);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid since');
      since = d;
    }

    const acts = await this.prisma.activity.findMany({
      where: {
        visibility: 'public',
        ...(since ? { startedAt: { gte: since } } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        sport: true,
        title: true,
        description: true,
        startedAt: true,
        durationSeconds: true,
        distanceMeters: true,
        routePolyline: true,
        mapImageUrl: true,
        createdAt: true,
      },
    });

    const ids = Array.from(new Set(acts.map((a) => a.userId)));
    const profiles = ids.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: ids } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map(profiles.map((p) => [p.userId, p] as const));

    return {
      activities: acts.map((a) => {
        const p = byId.get(a.userId);
        return {
          id: a.id,
          sport: a.sport,
          title: a.title ?? null,
          description: a.description ?? null,
          startedAt: a.startedAt.toISOString(),
          durationSeconds: a.durationSeconds,
          distanceMeters: a.distanceMeters,
          routePolyline: a.routePolyline ?? null,
          mapImageUrl: a.mapImageUrl ?? null,
          createdAt: a.createdAt.toISOString(),
          athlete: {
            id: a.userId,
            username: p?.username ?? null,
            name: `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'Athlete'),
            avatarUrl: p?.avatarUrl ?? null,
          },
        };
      }),
    };
  }

  // (clubs endpoints removed)
}
