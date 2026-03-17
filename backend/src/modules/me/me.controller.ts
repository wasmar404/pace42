import { Body, Controller, Get, Put, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { PrismaService } from '../../prisma';
import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { UpdateMeDto, UpdatePersonalDto } from '../../me/me.dto';
import { createSupabaseClients } from '../../auth/supabase.auth';

function fallbackUsername(userId: string): string {
  return `user_${userId.replace(/-/g, '').slice(0, 10)}`;
}

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class MeController {
  private readonly summaryCache = new Map<string, { expiresAt: number; data: any }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async getMe(@CurrentUser() user?: { userId: string; email?: string }) {
    if (!user) throw new BadRequestException('Missing user');

    let profile = await this.prisma.profile.findUnique({ where: { userId: user.userId } });
    if (!profile) {
      profile = await this.prisma.profile.create({
        data: {
          userId: user.userId,
          username: fallbackUsername(user.userId),
        },
      });
    }

    return {
      user: {
        id: user.userId,
        email: user.email ?? null,
      },
      profile: profile ?? null,
    };
  }

  @Get('summary')
  async getMySummary(@CurrentUser() user: { userId: string; email?: string }) {
    const cached = this.summaryCache.get(user.userId);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    let profile = await this.prisma.profile.findUnique({ where: { userId: user.userId } });
    if (!profile) {
      profile = await this.prisma.profile.create({
        data: {
          userId: user.userId,
          username: fallbackUsername(user.userId),
        },
      });
    }

    const [recentActivities, last4WeeksCount, totalActivities, recentPhotos, followersCount, followingCount] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId: user.userId },
        orderBy: { startedAt: 'desc' },
        take: 2,
        select: {
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
        },
      }),
      this.prisma.activity.count({
        where: {
          userId: user.userId,
          startedAt: {
            gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.activity.count({ where: { userId: user.userId } }),

      this.prisma.activityMedia.findMany({
        where: {
          userId: user.userId,
          kind: 'photo',
          publicUrl: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: { publicUrl: true },
      }),

      this.prisma.follow.count({ where: { followingId: user.userId } }),
      this.prisma.follow.count({ where: { followerId: user.userId } }),
    ]);

    const resp = {
      user: {
        id: user.userId,
        email: user.email ?? null,
      },
      profile: profile ?? null,
      stats: {
        last4WeeksCount,
        totalActivities,
        followersCount,
        followingCount,
      },
      recentActivities,
      recentPhotos: recentPhotos.map((p) => p.publicUrl).filter(Boolean),
      settings: {
        isPrivate: Boolean(profile?.isPrivate ?? false),
      },
    };

    // Very short TTL to reduce repeated hits during page transitions.
    this.summaryCache.set(user.userId, { expiresAt: Date.now() + 5000, data: resp });
    if (this.summaryCache.size > 2000) {
      const firstKey = this.summaryCache.keys().next().value as string | undefined;
      if (typeof firstKey === 'string') this.summaryCache.delete(firstKey);
    }

    return resp;
  }

  @Get('performance')
  async performance(@CurrentUser() user: { userId: string }) {
    const now = new Date();
    const since4w = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

    const year = now.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

    const [last4, yr, all, runActs] = await Promise.all([
      this.prisma.activity.aggregate({
        where: { userId: user.userId, startedAt: { gte: since4w } },
        _count: { _all: true },
        _sum: { distanceMeters: true, durationSeconds: true },
      }),
      this.prisma.activity.aggregate({
        where: { userId: user.userId, startedAt: { gte: yearStart, lt: yearEnd } },
        _count: { _all: true },
        _sum: { distanceMeters: true, durationSeconds: true },
      }),
      this.prisma.activity.aggregate({
        where: { userId: user.userId },
        _count: { _all: true },
        _sum: { distanceMeters: true, durationSeconds: true },
      }),
      this.prisma.activity.findMany({
        where: { userId: user.userId, sport: 'run', distanceMeters: { gte: 400 } },
        select: { id: true, startedAt: true, distanceMeters: true, durationSeconds: true },
        orderBy: { startedAt: 'desc' },
        take: 5000,
      }),
    ]);

    const total4 = Number(last4?._count?._all ?? 0);
    const dist4 = Number(last4?._sum?.distanceMeters ?? 0);
    const dur4 = Number(last4?._sum?.durationSeconds ?? 0);

    const totalYr = Number(yr?._count?._all ?? 0);
    const distYr = Number(yr?._sum?.distanceMeters ?? 0);
    const durYr = Number(yr?._sum?.durationSeconds ?? 0);

    const totalAll = Number(all?._count?._all ?? 0);
    const distAll = Number(all?._sum?.distanceMeters ?? 0);
    const durAll = Number(all?._sum?.durationSeconds ?? 0);

    const targets: Array<{ key: string; label: string; meters: number }> = [
      { key: '400m', label: '400m', meters: 400 },
      { key: 'half_mile', label: '1/2 mile', meters: 804.672 },
      { key: '1k', label: '1K', meters: 1000 },
      { key: '1mile', label: '1 mile', meters: 1609.344 },
      { key: '2mile', label: '2 mile', meters: 3218.688 },
      { key: '5k', label: '5K', meters: 5000 },
      { key: '10k', label: '10K', meters: 10000 },
      { key: '15k', label: '15K', meters: 15000 },
      { key: '10mile', label: '10 mile', meters: 16093.44 },
      { key: '20k', label: '20K', meters: 20000 },
      { key: 'half_marathon', label: 'Half-Marathon', meters: 21097.5 },
    ];

    const bestEfforts = targets
      .map((t) => {
        let bestSeconds: number | null = null;
        let best: any = null;

        for (const a of runActs || []) {
          const dist = Number(a.distanceMeters || 0);
          const dur = Number(a.durationSeconds || 0);
          if (!dist || !dur) continue;
          if (dist < t.meters) continue;
          const est = (dur / dist) * t.meters;
          if (!Number.isFinite(est) || est <= 0) continue;
          if (bestSeconds == null || est < bestSeconds) {
            bestSeconds = Math.round(est);
            best = a;
          }
        }

        return {
          key: t.key,
          label: t.label,
          meters: t.meters,
          bestSeconds,
          activityId: best?.id ?? null,
          startedAt: best?.startedAt ?? null,
        };
      })
      .filter((x) => x.bestSeconds != null);

    return {
      last4Weeks: {
        activitiesPerWeek: Math.round((total4 / 4) * 10) / 10,
        avgDistancePerWeekMeters: Math.round(dist4 / 4),
        avgTimePerWeekSeconds: Math.round(dur4 / 4),
      },
      year: {
        year,
        activities: totalYr,
        distanceMeters: distYr,
        timeSeconds: durYr,
      },
      allTime: {
        activities: totalAll,
        distanceMeters: distAll,
        timeSeconds: durAll,
      },
      bestEfforts,
    };
  }

  @Put('personal')
  async updatePersonal(@CurrentUser() user: { userId: string }, @Body() dto: UpdatePersonalDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId: user.userId },
      select: { onboardingCompletedAt: true },
    });
    const completedAt = existing?.onboardingCompletedAt ?? new Date();

    const profile = await this.prisma.profile.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        username: fallbackUsername(user.userId),
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        bio: dto.bio,
        onboardingCompletedAt: completedAt,
      },
      update: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        bio: dto.bio,
        onboardingCompletedAt: completedAt,
      },
    });

    return { profile };
  }

  // Convenience endpoint for the frontend: update any profile fields in one request.
  @Put()
  async updateMe(@CurrentUser() user: { userId: string }, @Body() dto: UpdateMeDto) {
    const profile = await this.prisma.profile.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        username: fallbackUsername(user.userId),
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        level: dto.level,
        bio: dto.bio,
        isPrivate: dto.isPrivate ?? false,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        onboardingCompletedAt: dto.onboardingCompletedAt ? new Date(dto.onboardingCompletedAt) : undefined,
      },
      update: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        level: dto.level,
        bio: dto.bio,
        ...(typeof dto.isPrivate === 'boolean' ? { isPrivate: dto.isPrivate } : {}),
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        onboardingCompletedAt: dto.onboardingCompletedAt ? new Date(dto.onboardingCompletedAt) : undefined,
      },
    });

    return { profile };
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(@CurrentUser() user: { userId: string }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Missing file');

    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'image/heic',
      'image/heif',
    ]);
    if (!allowed.has(file.mimetype)) throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const { service } = createSupabaseClients({
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey,
    });

    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const objectPath = `${user.userId}/${randomUUID()}${safeExt}`;

    const bucket = this.config.get<string>('SUPABASE_AVATARS_BUCKET') ?? 'avatars';
    const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: publicData } = service.storage.from(bucket).getPublicUrl(objectPath);
    const avatarUrl = publicData.publicUrl;

    await this.prisma.profile.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        username: fallbackUsername(user.userId),
        avatarUrl,
      },
      update: {
        avatarUrl,
      },
    });

    return { avatarUrl };
  }

  @Post('delete-account')
  async deleteAccount(
    @CurrentUser() user: { userId: string },
    @Body() body: { confirm?: string },
  ) {
    const confirm = String(body?.confirm ?? '').trim().toUpperCase();
    if (confirm !== 'DELETE') throw new BadRequestException('Type DELETE to confirm');

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    const { service } = createSupabaseClients({ supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey });

    const { error } = await service.auth.admin.deleteUser(user.userId);
    if (error) throw new BadRequestException(error.message);

    return { ok: true };
  }

  @Get('activities')
  async myActivities(@CurrentUser() user: { userId: string }) {
    const activities = await this.prisma.activity.findMany({
      where: { userId: user.userId },
      orderBy: { startedAt: 'desc' },
    });

    return { activities };
  }
}
