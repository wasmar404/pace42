import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma';
import { PublicApiGuard } from './public-api.guard';
import { PublicActivitiesDto, PublicCreateActivityDto, PublicDeleteDto, PublicListDto, PublicUpdateActivityDto } from './public-api.dto';

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
    private readonly config: ConfigService,
  ) {}


  private systemOwnerId(): string {
    const apiKey = (this.config.get<string>('PUBLIC_API_KEY') || '').trim();
    if (!apiKey) throw new BadRequestException('Public API is disabled');

    const hex = createHash('sha256').update(`pace42-public-api-owner:${apiKey}`).digest('hex').slice(0, 32);
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
    return uuid;
  }

  private async ensureSystemOwnerProfile(userId: string) {
    const suffix = userId.replace(/-/g, '').slice(0, 8);
    const username = `pace42_api_${suffix}`;
    await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        username,
        firstName: 'Pace42',
        lastName: 'API',
        onboardingCompletedAt: new Date(),
      },
      update: {
        username,
        firstName: 'Pace42',
        lastName: 'API',
        onboardingCompletedAt: new Date(),
      },
    });
  }

  private parseDateOrThrow(name: string, value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid ${name}`);
    return d;
  }

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
      select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
    });

    return {
      users: users.map((u: any) => ({
        id: u.userId,
        username: u.username,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        avatarUrl: u.avatarUrl ?? null,
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

    const ids = Array.from(new Set(acts.map((a: any) => a.userId)));
    const profiles = ids.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: ids } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map<string, any>(profiles.map((p: any) => [p.userId, p] as const));

    return {
      activities: acts.map((a: any) => {
        const p = byId.get(a.userId) as any;
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

  @Post('activities')
  async createActivity(@Body() dto: PublicCreateActivityDto) {
    const ownerId = this.systemOwnerId();
    await this.ensureSystemOwnerProfile(ownerId);

    const startedAt = this.parseDateOrThrow('startedAt', dto.startedAt);

    const activity = await this.prisma.activity.create({
      data: {
        userId: ownerId,
        sport: dto.sport,
        title: dto.title ? trimOrThrow('title', dto.title, 120) : null,
        description: dto.description ? trimOrThrow('description', dto.description, 2000) : null,
        startedAt,
        durationSeconds: dto.durationSeconds,
        distanceMeters: dto.distanceMeters,
        source: 'public_api',
        routePolyline: null,
        mapImageUrl: null,
      },
      select: {
        id: true,
        sport: true,
        title: true,
        description: true,
        startedAt: true,
        durationSeconds: true,
        distanceMeters: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      activity: {
        ...activity,
        startedAt: activity.startedAt.toISOString(),
        createdAt: activity.createdAt.toISOString(),
        updatedAt: activity.updatedAt.toISOString(),
      },
    };
  }

  @Put('activities/:id')
  async updateActivity(@Param('id') id: string, @Body() dto: PublicUpdateActivityDto) {
    const ownerId = this.systemOwnerId();
    await this.ensureSystemOwnerProfile(ownerId);

    const existing = await this.prisma.activity.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!existing || existing.userId !== ownerId) throw new NotFoundException('Activity not found');

    const data: any = {};
    if (typeof dto.sport === 'string') data.sport = dto.sport;
    if (dto.title !== undefined) data.title = dto.title ? trimOrThrow('title', dto.title, 120) : null;
    if (dto.description !== undefined) data.description = dto.description ? trimOrThrow('description', dto.description, 2000) : null;
    if (typeof dto.startedAt === 'string') data.startedAt = this.parseDateOrThrow('startedAt', dto.startedAt);
    if (typeof dto.durationSeconds === 'number') data.durationSeconds = dto.durationSeconds;
    if (typeof dto.distanceMeters === 'number') data.distanceMeters = dto.distanceMeters;

    const activity = await this.prisma.activity.update({
      where: { id },
      data,
      select: {
        id: true,
        sport: true,
        title: true,
        description: true,
        startedAt: true,
        durationSeconds: true,
        distanceMeters: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      activity: {
        ...activity,
        startedAt: activity.startedAt.toISOString(),
        createdAt: activity.createdAt.toISOString(),
        updatedAt: activity.updatedAt.toISOString(),
      },
    };
  }

  @Delete('activities/:id')
  async deleteActivity(@Param('id') id: string, @Body() dto: PublicDeleteDto) {
    if (String(dto?.confirm ?? '').trim().toUpperCase() !== 'DELETE') {
      throw new BadRequestException('Type DELETE to confirm');
    }

    const ownerId = this.systemOwnerId();

    const existing = await this.prisma.activity.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!existing || existing.userId !== ownerId) throw new NotFoundException('Activity not found');

    await this.prisma.activity.delete({ where: { id } });
    return { ok: true };
  }

}
