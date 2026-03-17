import { Body, Controller, Get, Put, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
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

  @Get('export')
  async exportData(@CurrentUser() user: { userId: string; email?: string }) {
    const userId = user.userId;

    const [profile, activities, activityMedia, commentsGiven, commentsReceived, kudosGiven, kudosReceived, following, followers, clubMemberships, clubPosts] =
      await Promise.all([
        this.prisma.profile.findUnique({ where: { userId } }),
        this.prisma.activity.findMany({
          where: { userId },
          orderBy: { startedAt: 'desc' },
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
            mapImageUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.activityMedia.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            activityId: true,
            kind: true,
            storageBucket: true,
            storagePath: true,
            publicUrl: true,
            createdAt: true,
          },
        }),
        this.prisma.activityComment.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, activityId: true, body: true, createdAt: true },
        }),
        this.prisma.activityComment.findMany({
          where: { activity: { userId }, userId: { not: userId } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, activityId: true, userId: true, body: true, createdAt: true },
        }),
        this.prisma.activityKudo.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { activityId: true, createdAt: true },
        }),
        this.prisma.activityKudo.findMany({
          where: { activity: { userId }, userId: { not: userId } },
          orderBy: { createdAt: 'desc' },
          select: { activityId: true, userId: true, createdAt: true },
        }),
        this.prisma.follow.findMany({
          where: { followerId: userId },
          orderBy: { createdAt: 'desc' },
          select: { followingId: true, createdAt: true },
        }),
        this.prisma.follow.findMany({
          where: { followingId: userId },
          orderBy: { createdAt: 'desc' },
          select: { followerId: true, createdAt: true },
        }),
        this.prisma.clubMember.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            role: true,
            createdAt: true,
            club: { select: { id: true, name: true, location: true, sport: true, description: true, avatarUrl: true, bannerUrl: true, isInviteOnly: true, createdAt: true } },
          },
        }),
        this.prisma.clubPost.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          include: {
            club: { select: { id: true, name: true } },
            media: { orderBy: { createdAt: 'asc' }, select: { publicUrl: true, createdAt: true } },
            activity: {
              select: { id: true, sport: true, title: true, startedAt: true, durationSeconds: true, distanceMeters: true, visibility: true },
            },
          },
        }),
      ]);

    const mediaByActivity = new Map<string, any[]>();
    for (const m of activityMedia) {
      const list = mediaByActivity.get(m.activityId) ?? [];
      list.push({
        id: m.id,
        kind: m.kind,
        storageBucket: m.storageBucket,
        storagePath: m.storagePath,
        publicUrl: m.publicUrl ?? null,
        createdAt: m.createdAt.toISOString(),
      });
      mediaByActivity.set(m.activityId, list);
    }

    return {
      exportedAt: new Date().toISOString(),
      user: { id: userId, email: user.email ?? null },
      profile: profile ?? null,
      accountSettings: {
        isPrivate: Boolean(profile?.isPrivate ?? false),
      },
      workouts: activities.map((a) => ({
        ...a,
        startedAt: a.startedAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        media: mediaByActivity.get(a.id) ?? [],
      })),
      uploadedImages: {
        activityMedia: activityMedia
          .filter((m) => m.kind === 'photo' && m.publicUrl)
          .map((m) => ({
            activityId: m.activityId,
            publicUrl: m.publicUrl,
            storageBucket: m.storageBucket,
            storagePath: m.storagePath,
            createdAt: m.createdAt.toISOString(),
          })),
        clubPostMedia: clubPosts
          .flatMap((p) => (p.media || []).map((m) => ({ clubId: p.clubId, postId: p.id, publicUrl: m.publicUrl, createdAt: m.createdAt.toISOString() })))
          .filter((m) => m.publicUrl),
      },
      comments: {
        given: commentsGiven.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
        receivedOnMyWorkouts: commentsReceived.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
      },
      likes: {
        given: kudosGiven.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() })),
        receivedOnMyWorkouts: kudosReceived.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() })),
      },
      followersFollowing: {
        followers: followers.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
        following: following.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
      },
      clubs: {
        memberships: clubMemberships.map((m) => ({
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
          club: { ...m.club, createdAt: m.club.createdAt.toISOString() },
        })),
        posts: clubPosts.map((p) => ({
          id: p.id,
          club: p.club,
          body: p.body ?? null,
          createdAt: p.createdAt.toISOString(),
          media: (p.media || []).map((m) => ({ publicUrl: m.publicUrl, createdAt: m.createdAt.toISOString() })),
          activity: p.activity
            ? {
                ...p.activity,
                startedAt: p.activity.startedAt.toISOString(),
              }
            : null,
        })),
      },
    };
  }

  @Get('export.zip')
  async exportZip(@CurrentUser() user: { userId: string; email?: string }, @Res() res: Response) {
    const userId = user.userId;

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    const { service } = createSupabaseClients({ supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey });

    const safeSeg = (s: string) => String(s || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'x';
    const extFromPath = (p: string) => {
      const ext = path.extname(p || '').toLowerCase();
      if (!ext) return '';
      if (ext.length > 12) return '';
      return ext;
    };
    const json = (obj: any) => JSON.stringify(obj, null, 2);

    const exportObj = await this.exportData(user);

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('content-type', 'application/zip');
    res.setHeader('content-disposition', `attachment; filename="pace42-export-${stamp}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err: any) => {
      // eslint-disable-next-line no-console
      console.error('[export.zip] archive error', err);
      try {
        res.status(500).end();
      } catch {
        // ignore
      }
    });
    archive.pipe(res);

    const errors: Array<{ kind: string; id?: string; detail: string }> = [];

    // Core JSON files
    archive.append(json(exportObj), { name: 'export.json' });
    archive.append(json(exportObj?.profile ?? null), { name: 'profile.json' });
    archive.append(json(exportObj?.accountSettings ?? {}), { name: 'account_settings.json' });
    archive.append(json(exportObj?.followersFollowing ?? {}), { name: 'followers_following.json' });
    archive.append(json(exportObj?.comments ?? {}), { name: 'comments.json' });
    archive.append(json(exportObj?.likes ?? {}), { name: 'likes.json' });
    archive.append(json(exportObj?.clubs ?? {}), { name: 'clubs.json' });

    // Workouts
    const workouts = Array.isArray(exportObj?.workouts) ? exportObj.workouts : [];
    archive.append(json(workouts.map((w: any) => ({ id: w?.id, sport: w?.sport, startedAt: w?.startedAt }))), {
      name: 'workouts/index.json',
    });

    // Download activity media from Storage
    for (const w of workouts) {
      const wid = String(w?.id || '');
      if (!wid) continue;
      archive.append(json(w), { name: `workouts/${safeSeg(wid)}/workout.json` });

      const media = Array.isArray(w?.media) ? w.media : [];
      for (const m of media) {
        const mid = String(m?.id || '');
        const bucket = String(m?.storageBucket || '');
        const storagePath = String(m?.storagePath || '');
        if (!mid || !bucket || !storagePath) continue;

        const ext = extFromPath(storagePath) || (m?.kind === 'gpx' ? '.gpx' : '');
        const base = m?.kind === 'gpx' ? 'gpx' : 'media';
        const name = `workouts/${safeSeg(wid)}/${base}/${safeSeg(mid)}${ext}`;

        try {
          const { data, error } = await service.storage.from(bucket).download(storagePath);
          if (error) throw new Error(error.message);
          const buf = Buffer.from(await (data as any).arrayBuffer());
          archive.append(buf, { name });
        } catch (e: any) {
          errors.push({ kind: 'activity_media', id: mid, detail: String(e?.message || e) });
        }
      }
    }

    // Club post media (stored as publicUrl only)
    const clubPosts = Array.isArray(exportObj?.clubs?.posts) ? exportObj.clubs.posts : [];
    for (const p of clubPosts) {
      const postId = String(p?.id || '');
      if (!postId) continue;
      archive.append(json(p), { name: `club_posts/${safeSeg(postId)}/post.json` });
      const items = Array.isArray(p?.media) ? p.media : [];
      for (let i = 0; i < items.length; i++) {
        const url = String(items[i]?.publicUrl || '');
        if (!url) continue;
        const ext = extFromPath(url) || '.jpg';
        const name = `club_posts/${safeSeg(postId)}/media/media-${String(i + 1).padStart(2, '0')}${ext}`;
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const buf = Buffer.from(await r.arrayBuffer());
          archive.append(buf, { name });
        } catch (e: any) {
          errors.push({ kind: 'club_post_media', id: postId, detail: String(e?.message || e) });
        }
      }
    }

    archive.append(
      json({
        note: 'This export contains your Pace42 data at the time of export.',
        exportedAt: exportObj?.exportedAt,
      }),
      { name: 'README.json' },
    );

    if (errors.length) archive.append(json(errors), { name: 'errors.json' });

    await archive.finalize();
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
