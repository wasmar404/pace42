import { Body, Controller, Get, Put, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException, NotFoundException, Res, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Response } from 'express';
import archiver from 'archiver';

import { PrismaService } from '../../prisma';
import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { UpdateMeDto, UpdatePersonalDto } from '../../me/me.dto';
import { supabase } from '../../auth/supabase.auth';


const ACTIVITY_BASE_SELECT = {
  id: true,
  sport: true,
  title: true,
  description: true,
  startedAt: true,
  durationSeconds: true,
  distanceMeters: true,
  visibility: true,
  source: true,
  routePolyline: true,
} as const;

const ACTIVITY_FULL_SELECT = {
  ...ACTIVITY_BASE_SELECT,
  mapImageUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;


@Controller('me')
@UseGuards(SupabaseAuthGuard)

export class MeController {

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}


  private getProfile(userId: string) {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  private async requireProfile(userId: string) {
    const profile = await this.getProfile(userId);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  private getActivities(userId: string, opts: { take?: number; select?: object } = {}) {
    return this.prisma.activity.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      ...(opts.take ? { take: opts.take } : {}),
      select: opts.select ?? ACTIVITY_BASE_SELECT, //if opts.select is provided, use it; otherwise, use ACTIVITY_BASE_SELECT
    });
  }

  private countActivities(userId: string, since?: Date) {
    return this.prisma.activity.count({
      where: { userId, ...(since ? { startedAt: { gte: since } } : {}) },
    });
  }

  private aggregateActivities(userId: string, dateFilter?: { gte?: Date; lt?: Date }) {
    return this.prisma.activity.aggregate({
      where: { userId, ...(dateFilter ? { startedAt: dateFilter } : {}) },
      _count: { _all: true },
      _sum: { distanceMeters: true, durationSeconds: true },
    });
  }

  private getFollowerCount(userId: string) {
    return this.prisma.follow.count({ where: { followingId: userId } });
  }

  private getFollowingCount(userId: string) {
    return this.prisma.follow.count({ where: { followerId: userId } });
  }

  private getActivityMedia(userId: string, opts: { activityIds?: string[]; kinds?: string[] } = {}) {
    return this.prisma.activityMedia.findMany({
      where: {
        userId,
        ...(opts.activityIds ? { activityId: { in: opts.activityIds } } : {}),
        ...(opts.kinds ? { kind: { in: opts.kinds } } : {}),
      },      orderBy: { createdAt: 'asc' },
      select: { activityId: true, kind: true, publicUrl: true },
    });
  }


  @Get()
  async getMe(@CurrentUser() user?: { userId: string; email?: string }) {
    if (!user) throw new BadRequestException('Missing user');
    const profile = await this.requireProfile(user.userId);
    return { user: { id: user.userId, email: user.email ?? null }, profile };
  }

  @Get('summary')
  async getMySummary(@CurrentUser() user: { userId: string; email?: string }) {
    const profile = await this.requireProfile(user.userId);
    const since4w = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

    const [recentActivities, last4WeeksCount, totalActivities, recentPhotos, followersCount, followingCount] =
      await Promise.all([
        this.getActivities(user.userId, { take: 2 }),
        this.countActivities(user.userId, since4w),
        this.countActivities(user.userId),
        this.prisma.activityMedia.findMany({
          where: { userId: user.userId, kind: 'photo', publicUrl: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { publicUrl: true },
        }),
        this.getFollowerCount(user.userId),
        this.getFollowingCount(user.userId),
      ]);

    return {
      user: { id: user.userId, email: user.email ?? null },
      profile,
      stats: { last4WeeksCount, totalActivities, followersCount, followingCount },
      recentActivities,
      recentPhotos: recentPhotos.map((p) => p.publicUrl).filter(Boolean),
      settings: { isPrivate: Boolean(profile.isPrivate) },
    };
  }

  @Get('performance')
  async performance(@CurrentUser() user: { userId: string }) {
    const now = new Date();
    const since4w = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const year = now.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const [last4, yr, all, runActs] = await Promise.all([
      this.aggregateActivities(user.userId, { gte: since4w }),
      this.aggregateActivities(user.userId, { gte: yearStart, lt: yearEnd }),
      this.aggregateActivities(user.userId),
      this.prisma.activity.findMany({
        where: { userId: user.userId, sport: 'run', distanceMeters: { gte: 400 } },
        select: { id: true, startedAt: true, distanceMeters: true, durationSeconds: true },
        orderBy: { startedAt: 'desc' },
        take: 5000,
      }),
    ]);

    const toNum = (v: any) => Number(v ?? 0);

    const dist4 = toNum(last4._sum?.distanceMeters);
    const dur4  = toNum(last4._sum?.durationSeconds);
    const total4 = toNum(last4._count?._all);

    const targets = [
      { key: '400m',          label: '400m',          meters: 400 },
      { key: 'half_mile',     label: '1/2 mile',      meters: 804.672 },
      { key: '1k',            label: '1K',            meters: 1000 },
      { key: '1mile',         label: '1 mile',        meters: 1609.344 },
      { key: '2mile',         label: '2 mile',        meters: 3218.688 },
      { key: '5k',            label: '5K',            meters: 5000 },
      { key: '10k',           label: '10K',           meters: 10000 },
      { key: '15k',           label: '15K',           meters: 15000 },
      { key: '10mile',        label: '10 mile',       meters: 16093.44 },
      { key: '20k',           label: '20K',           meters: 20000 },
      { key: 'half_marathon', label: 'Half-Marathon', meters: 21097.5 },
    ];

    const bestEfforts = targets
      .map((t) => {
        let bestSeconds: number | null = null;
        let best: any = null;
        for (const a of runActs) {
          const dist = toNum(a.distanceMeters);
          const dur  = toNum(a.durationSeconds);
          if (!dist || !dur || dist < t.meters) continue;
          const est = (dur / dist) * t.meters;
          if (!Number.isFinite(est) || est <= 0) continue;
          if (bestSeconds == null || est < bestSeconds) {
            bestSeconds = Math.round(est);
            best = a;
          }
        }
        return { key: t.key, label: t.label, meters: t.meters, bestSeconds, activityId: best?.id ?? null, startedAt: best?.startedAt ?? null };
      })
      .filter((x) => x.bestSeconds != null);

    return {
      last4Weeks: {
        activitiesPerWeek:       Math.round((total4 / 4) * 10) / 10,
        avgDistancePerWeekMeters: Math.round(dist4 / 4),
        avgTimePerWeekSeconds:    Math.round(dur4 / 4),
      },
      year: { year, activities: toNum(yr._count?._all), distanceMeters: toNum(yr._sum?.distanceMeters), timeSeconds: toNum(yr._sum?.durationSeconds) },
      allTime: { activities: toNum(all._count?._all), distanceMeters: toNum(all._sum?.distanceMeters), timeSeconds: toNum(all._sum?.durationSeconds) },
      bestEfforts,
    };
  }



  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(@CurrentUser() user: { userId: string }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Missing file');

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif']);
    if (!allowed.has(file.mimetype)) throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);

    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const objectPath = `${user.userId}/${randomUUID()}${safeExt}`;

    const bucket = this.config.get<string>('SUPABASE_AVATARS_BUCKET') ?? 'avatars';
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: true });
    if (uploadError) throw new BadRequestException(uploadError.message);

    await this.requireProfile(user.userId);
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    await this.prisma.profile.update({ where: { userId: user.userId }, data: { avatarUrl: publicData.publicUrl } });

    return { avatarUrl: publicData.publicUrl };
  }

  @Post('delete-account')
  async deleteAccount(@CurrentUser() user: { userId: string }, @Body() body: { confirm?: string }) {
    if (String(body?.confirm ?? '').trim().toUpperCase() !== 'DELETE') throw new BadRequestException('Type DELETE to confirm');
    const { error } = await supabase.auth.admin.deleteUser(user.userId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  @Get('activities')
  async myActivities(@CurrentUser() user: { userId: string }, @Query('take') take?: string) {
    const n = Number(take ?? 500);
    const limit = Number.isFinite(n) ? Math.max(1, Math.min(2000, Math.floor(n))) : 500;

    const activities = await this.prisma.activity.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, sport: true, title: true, description: true, startedAt: true, durationSeconds: true, distanceMeters: true, visibility: true, source: true, mapImageUrl: true, createdAt: true },
    });

    const ids = activities.map((a) => a.id);
    const media = ids.length ? await this.getActivityMedia(user.userId, { activityIds: ids, kinds: ['photo', 'gpx'] }) : [];

    const mediaByActivity = new Map<string, Array<{ kind: string; publicUrl: string | null }>>();
    for (const m of media) {
      (mediaByActivity.get(m.activityId) ?? mediaByActivity.set(m.activityId, []).get(m.activityId)!).push({ kind: m.kind, publicUrl: m.publicUrl ?? null });
    }

    return {
      activities: activities.map((a) => {
        const list   = mediaByActivity.get(a.id) ?? [];
        const photos = list.filter((x) => x.kind === 'photo' && x.publicUrl).map((x) => x.publicUrl as string);
        return {
          ...a,
          startedAt: a.startedAt.toISOString(),
          createdAt: a.createdAt.toISOString(),
          media: { photoCount: photos.length, coverPhotoUrl: photos[0] ?? null, hasGpx: list.some((x) => x.kind === 'gpx') },
        };
      }),
    };
  }
}