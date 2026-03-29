import { Body, Controller, Get, Put, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { PrismaService } from '../../prisma';
import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { UpdateMeDto } from '../../me/me.dto';
import { getSupabaseAdminClient, toPublicUrl } from '../../auth/supabase.auth';

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

const ACTIVITY_LIST_SELECT = {
  ...ACTIVITY_BASE_SELECT,
  mapImageUrl: true,
  createdAt: true,
} as const;

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async ensureProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (profile) return profile;

    const suffix = userId.replace(/-/g, '').slice(0, 12);
    const username = `athlete_${suffix}`;

    return await this.prisma.profile.create({
      data: {
        userId,
        username,
      },
    });
  }

  private getActivities(userId: string, opts: { take?: number; select?: object } = {}) {
    return this.prisma.activity.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      ...(opts.take ? { take: opts.take } : {}),
      select: opts.select ?? ACTIVITY_BASE_SELECT,
    });
  }

  private countActivities(userId: string, since?: Date) {
    return this.prisma.activity.count({
      where: { userId, ...(since ? { startedAt: { gte: since } } : {}) },
    });
  }

  private getFollowerCount(userId: string) {
    return this.prisma.follow.count({ where: { followingId: userId } });
  }

  private getFollowingCount(userId: string) {
    return this.prisma.follow.count({ where: { followerId: userId } });
  }

  private supabaseAdminClient() {
    try {
      return getSupabaseAdminClient();
    } catch {
      throw new BadRequestException('Server missing SUPABASE_SERVICE_ROLE_KEY');
    }
  }

  @Get()
  async getMe(@CurrentUser() user?: { userId: string; email?: string }) {
    if (!user) throw new BadRequestException('Missing user');

    const profile = await this.ensureProfile(user.userId);

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
    const profile = await this.ensureProfile(user.userId);

    const since4w = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

    const [recentActivities, last4WeeksCount, totalActivities, recentPhotos, followersCount, followingCount] =
      await Promise.all([
        this.getActivities(user.userId, { take: 2 }),
        this.countActivities(user.userId, since4w),
        this.countActivities(user.userId),

        this.prisma.activityMedia.findMany({
          where: {
            userId: user.userId,
            kind: 'photo',
            publicUrl: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { publicUrl: true },
        }),

        this.getFollowerCount(user.userId),
        this.getFollowingCount(user.userId),
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
      recentPhotos: recentPhotos.map((p: any) => p.publicUrl).filter(Boolean),
      settings: {
        isPrivate: Boolean(profile?.isPrivate ?? false),
      },
    };

    return resp;
  }

  @Put()
  async updateMe(@CurrentUser() user: { userId: string }, @Body() dto: UpdateMeDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId: user.userId },
      select: { onboardingCompletedAt: true },
    });
    if (!existing) await this.ensureProfile(user.userId);

    const hasPersonalPayload =
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.dateOfBirth !== undefined ||
      dto.gender !== undefined ||
      dto.bio !== undefined;

    const onboardingCompletedAt = dto.onboardingCompletedAt
      ? new Date(dto.onboardingCompletedAt)
      : (!existing?.onboardingCompletedAt && hasPersonalPayload ? new Date() : undefined);

    const weeklyGoalDistanceMeters =
      typeof dto.weeklyGoalDistanceMeters === 'number'
        ? dto.weeklyGoalDistanceMeters > 0
          ? Math.round(dto.weeklyGoalDistanceMeters)
          : null
        : undefined;

    const profile = await this.prisma.profile.update({
      where: { userId: user.userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        bio: dto.bio,
        ...(typeof dto.isPrivate === 'boolean' ? { isPrivate: dto.isPrivate } : {}),
        ...(onboardingCompletedAt ? { onboardingCompletedAt } : {}),
        ...(weeklyGoalDistanceMeters !== undefined ? { weeklyGoalDistanceMeters } : {}),
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
    ]);
    if (!allowed.has(file.mimetype)) throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);

    const service = this.supabaseAdminClient();

    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const objectPath = `${user.userId}/${randomUUID()}${safeExt}`;

    const bucket = this.config.get<string>('SUPABASE_AVATARS_BUCKET') ?? 'test';
    const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: publicData } = service.storage.from(bucket).getPublicUrl(objectPath);
    const avatarUrl = toPublicUrl(publicData.publicUrl);

    await this.ensureProfile(user.userId);
    await this.prisma.profile.update({ where: { userId: user.userId }, data: { avatarUrl } });

    return { avatarUrl };
  }

  @Post('delete-account')
  async deleteAccount(
    @CurrentUser() user: { userId: string },
    @Body() body: { confirm?: string },
  ) {
    const confirm = String(body?.confirm ?? '').trim().toUpperCase();
    if (confirm !== 'DELETE') throw new BadRequestException('Type DELETE to confirm');

    const service = this.supabaseAdminClient();

    const { error } = await service.auth.admin.deleteUser(user.userId);
    if (error) throw new BadRequestException(error.message);

    return { ok: true };
  }

  @Get('activities')
  async myActivities(@CurrentUser() user: { userId: string }, @Query('take') take?: string) {
    await this.ensureProfile(user.userId);

    const n = Number(take ?? 500);
    const limit = Number.isFinite(n) ? Math.max(1, Math.min(2000, Math.floor(n))) : 500;

    const activities = await this.prisma.activity.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: ACTIVITY_LIST_SELECT,
    });

    const ids = activities.map((a: any) => a.id);
    const media = ids.length
      ? await this.prisma.activityMedia.findMany({
          where: { activityId: { in: ids }, userId: user.userId, kind: { in: ['photo', 'gpx'] } },
          orderBy: { createdAt: 'asc' },
          select: { activityId: true, kind: true, publicUrl: true },
        })
      : [];

    const mediaByActivity = new Map<string, Array<{ kind: string; publicUrl: string | null }>>();
    for (const m of media) {
      const list = mediaByActivity.get(m.activityId) ?? [];
      list.push({ kind: m.kind, publicUrl: m.publicUrl ?? null });
      mediaByActivity.set(m.activityId, list);
    }

    return {
      activities: activities.map((a: any) => {
        const list = mediaByActivity.get(a.id) ?? [];
        const photos = list.filter((x) => x.kind === 'photo' && x.publicUrl).map((x) => x.publicUrl as string);
        const hasGpx = list.some((x) => x.kind === 'gpx');
        return {
          ...a,
          startedAt: a.startedAt.toISOString(),
          createdAt: a.createdAt.toISOString(),
          media: {
            photoCount: photos.length,
            coverPhotoUrl: photos[0] ?? null,
            hasGpx,
          },
        };
      }),
    };
  }
}
