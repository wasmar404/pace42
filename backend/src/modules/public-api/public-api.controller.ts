import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../prisma';
import { PublicApiGuard } from './public-api.guard';
import { PublicActivitiesDto, PublicCreateClubDto, PublicDeleteDto, PublicListDto, PublicUpdateClubDto } from './public-api.dto';

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

    // Deterministic UUID derived from the shared API key.
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
        isPrivate: true,
      },
      update: {
        username,
        firstName: 'Pace42',
        lastName: 'API',
        onboardingCompletedAt: new Date(),
        isPrivate: true,
      },
    });
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

  @Get('clubs')
  async clubs(@Query() q: PublicListDto) {
    const query = String(q?.q || '').trim();
    const take = Number(q?.take ?? 20);
    const limit = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;

    const clubs = await this.prisma.club.findMany({
      where: {
        ...(query.length >= 2
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { location: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        location: true,
        sport: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isInviteOnly: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });

    return {
      clubs: clubs.map((c) => ({
        id: c.id,
        name: c.name,
        location: c.location,
        sport: c.sport,
        description: c.description,
        avatarUrl: c.avatarUrl ?? null,
        bannerUrl: c.bannerUrl ?? null,
        isInviteOnly: Boolean(c.isInviteOnly),
        createdAt: c.createdAt.toISOString(),
        memberCount: c._count.members,
      })),
    };
  }

  @Post('clubs')
  async createClub(@Body() dto: PublicCreateClubDto) {
    const ownerId = this.systemOwnerId();
    await this.ensureSystemOwnerProfile(ownerId);

    const name = trimOrThrow('name', dto.name, 120);
    const location = trimOrThrow('location', dto.location, 160);
    const description = trimOrThrow('description', dto.description, 800);
    const sport = String(dto.sport || '').toLowerCase();

    const club = await this.prisma.club.create({
      data: {
        ownerId,
        name,
        location,
        sport,
        description,
        avatarUrl: dto.avatarUrl ? String(dto.avatarUrl).trim() : null,
        bannerUrl: dto.bannerUrl ? String(dto.bannerUrl).trim() : null,
        isInviteOnly: dto.isInviteOnly === true,
        members: { create: { userId: ownerId, role: 'owner' } },
      },
      select: {
        id: true,
        ownerId: true,
        name: true,
        location: true,
        sport: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isInviteOnly: true,
        createdAt: true,
      },
    });

    return {
      club: {
        ...club,
        avatarUrl: club.avatarUrl ?? null,
        bannerUrl: club.bannerUrl ?? null,
        createdAt: club.createdAt.toISOString(),
      },
    };
  }

  @Put('clubs/:id')
  async updateClub(@Param('id') id: string, @Body() dto: PublicUpdateClubDto) {
    const update: any = {};
    if (typeof dto.name === 'string') update.name = trimOrThrow('name', dto.name, 120);
    if (typeof dto.location === 'string') update.location = trimOrThrow('location', dto.location, 160);
    if (typeof dto.description === 'string') update.description = trimOrThrow('description', dto.description, 800);
    if (typeof dto.sport === 'string') update.sport = String(dto.sport).toLowerCase();
    if (typeof dto.avatarUrl === 'string') update.avatarUrl = dto.avatarUrl.trim() || null;
    if (typeof dto.bannerUrl === 'string') update.bannerUrl = dto.bannerUrl.trim() || null;
    if (typeof dto.isInviteOnly === 'boolean') update.isInviteOnly = dto.isInviteOnly;

    const club = await this.prisma.club.update({
      where: { id },
      data: update,
      select: {
        id: true,
        ownerId: true,
        name: true,
        location: true,
        sport: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isInviteOnly: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      club: {
        ...club,
        avatarUrl: club.avatarUrl ?? null,
        bannerUrl: club.bannerUrl ?? null,
        createdAt: club.createdAt.toISOString(),
        updatedAt: club.updatedAt.toISOString(),
      },
    };
  }

  @Delete('clubs/:id')
  async deleteClub(@Param('id') id: string, @Body() _dto: PublicDeleteDto) {
    await this.prisma.club.delete({ where: { id } });
    return { ok: true };
  }
}
