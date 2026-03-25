import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { OptionalSupabaseAuthGuard } from '../../auth/supabase.optional.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { getSupabaseAdminClient } from '../../auth/supabase.auth';
import { CreateActivityDto } from './activities.dto';
import { PrismaService } from '../../prisma';
import { msSince, time } from '../../common/time';

@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async ensureCanViewActivity(params: { viewerId?: string; activityId: string }) {
    const { viewerId, activityId } = params;
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true, visibility: true },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    if (activity.userId === viewerId) return activity;

     // Allow access if this activity was shared into a club the viewer belongs to.
     if (viewerId) {
       const shared = await this.prisma.clubPost.findFirst({
         where: {
           activityId,
           club: {
             members: {
               some: { userId: viewerId },
             },
           },
         },
         select: { id: true },
       });
       if (shared) return activity;
     }

    if (activity.visibility === 'only_me') throw new NotFoundException('Activity not found');

    if (activity.visibility === 'followers') {
      if (!viewerId) throw new NotFoundException('Activity not found');
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: activity.userId,
          },
        },
      });
      if (!follow) throw new NotFoundException('Activity not found');
    }

    // visibility public: allow
    // Account privacy overrides public activities
    if (activity.visibility === 'public') {
      const p = await this.prisma.profile.findUnique({
        where: { userId: activity.userId },
        select: { isPrivate: true },
      });
      if (p?.isPrivate) {
        if (!viewerId) throw new NotFoundException('Activity not found');
        const follow = await this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: activity.userId,
            },
          },
        });
        if (!follow) throw new NotFoundException('Activity not found');
      }
    }

    return activity;
  }

  @Get('mine')
  @UseGuards(SupabaseAuthGuard)
  async mine(
    @CurrentUser() user: { userId: string },
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('minDistanceMeters') minDistanceMeters?: string,
    @Query('maxDistanceMeters') maxDistanceMeters?: string,
    @Query('minDurationSeconds') minDurationSeconds?: string,
    @Query('maxDurationSeconds') maxDurationSeconds?: string,
    @Query('source') source?: string,
    @Query('take') take?: string,
  ) {
    const query = String(q || '').trim();
    const src = String(source || 'any').trim().toLowerCase();
    const allowedSource = new Set(['any', 'manual', 'gpx']);
    if (!allowedSource.has(src)) throw new BadRequestException('Invalid source');

    const limit = Math.max(1, Math.min(200, Number(take || 50) || 50));

    const fromTs = from ? Date.parse(from) : NaN;
    const toTs = to ? Date.parse(to) : NaN;
    const fromDate = Number.isFinite(fromTs) ? new Date(fromTs) : null;
    const toDate = Number.isFinite(toTs) ? new Date(toTs) : null;
    if (from && !fromDate) throw new BadRequestException('Invalid from');
    if (to && !toDate) throw new BadRequestException('Invalid to');

    const minDist = minDistanceMeters ? Number(minDistanceMeters) : NaN;
    const maxDist = maxDistanceMeters ? Number(maxDistanceMeters) : NaN;
    const minDur = minDurationSeconds ? Number(minDurationSeconds) : NaN;
    const maxDur = maxDurationSeconds ? Number(maxDurationSeconds) : NaN;

    const where: any = {
      userId: user.userId,
      ...(src !== 'any' ? { source: src } : {}),
      ...(query.length >= 2
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { sport: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (fromDate || toDate) {
      where.startedAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    if (Number.isFinite(minDist) || Number.isFinite(maxDist)) {
      where.distanceMeters = {
        ...(Number.isFinite(minDist) ? { gte: Math.max(0, Math.floor(minDist)) } : {}),
        ...(Number.isFinite(maxDist) ? { lte: Math.max(0, Math.floor(maxDist)) } : {}),
      };
    }

    if (Number.isFinite(minDur) || Number.isFinite(maxDur)) {
      where.durationSeconds = {
        ...(Number.isFinite(minDur) ? { gte: Math.max(0, Math.floor(minDur)) } : {}),
        ...(Number.isFinite(maxDur) ? { lte: Math.max(0, Math.floor(maxDur)) } : {}),
      };
    }

    const [acts, agg] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
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
          mapImageUrl: true,
          createdAt: true,
        },
      }),
      this.prisma.activity.aggregate({
        where,
        _count: { _all: true },
        _sum: { distanceMeters: true, durationSeconds: true },
      }),
    ]);

    const ids = acts.map((a) => a.id);
    const media = ids.length
      ? await this.prisma.activityMedia.findMany({
          where: { activityId: { in: ids }, userId: user.userId, kind: { in: ['photo', 'gpx'] } },
          orderBy: { createdAt: 'asc' },
          select: { activityId: true, kind: true, publicUrl: true, storageBucket: true, storagePath: true, createdAt: true },
        })
      : [];

    const mediaByActivity = new Map<string, Array<{ kind: string; publicUrl: string | null }>>();
    for (const m of media) {
      const list = mediaByActivity.get(m.activityId) ?? [];
      list.push({ kind: m.kind, publicUrl: m.publicUrl ?? null });
      mediaByActivity.set(m.activityId, list);
    }

    const items = acts.map((a) => {
      const list = mediaByActivity.get(a.id) ?? [];
      const photos = list.filter((x) => x.kind === 'photo' && x.publicUrl).map((x) => x.publicUrl as string);
      const hasGpx = list.some((x) => x.kind === 'gpx');
      return {
        id: a.id,
        sport: a.sport,
        title: a.title ?? null,
        description: a.description ?? null,
        startedAt: a.startedAt.toISOString(),
        durationSeconds: a.durationSeconds,
        distanceMeters: a.distanceMeters,
        visibility: a.visibility,
        source: a.source,
        mapImageUrl: a.mapImageUrl ?? null,
        createdAt: a.createdAt.toISOString(),
        media: {
          photoCount: photos.length,
          coverPhotoUrl: photos[0] ?? null,
          hasGpx,
        },
      };
    });

    return {
      items,
      stats: {
        total: Number(agg._count?._all ?? 0),
        distanceMeters: Number(agg._sum?.distanceMeters ?? 0),
        durationSeconds: Number(agg._sum?.durationSeconds ?? 0),
      },
    };
  }

  private validateStartedAt(d: Date, errMsg: string) {
    if (Number.isNaN(d.getTime())) throw new BadRequestException(errMsg);
    const now = new Date();
    const year = d.getUTCFullYear();
    const cur = now.getUTCFullYear();
    if (year < 1900 || year > cur) throw new BadRequestException(errMsg);
    if (d.getTime() > now.getTime() + 60_000) throw new BadRequestException('startedAt cannot be in the future');
  }

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async createActivity(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateActivityDto,
  ) {
    const title = String(dto.title || '').trim();
    if (!title) throw new BadRequestException('Title is required');

    const reqStart = process.hrtime.bigint();
    const startedAt = new Date(dto.startedAt);
    this.validateStartedAt(startedAt, 'Invalid startedAt');

    let visibility = dto.visibility ?? 'public';
    if (!['public', 'followers', 'only_me'].includes(visibility)) visibility = 'public';

    // Account privacy overrides activity visibility.
    const p = await this.prisma.profile.findUnique({ where: { userId: user.userId }, select: { isPrivate: true } });
    if (p?.isPrivate && visibility === 'public') visibility = 'followers';

    const { ms: createMs, result: activity } = await time('prisma.activity.create(manual)', () =>
      this.prisma.activity.create({
        data: {
          userId: user.userId,
          sport: dto.sport,
          title,
          description: dto.description ?? null,
          startedAt,
          durationSeconds: dto.durationSeconds,
          distanceMeters: dto.distanceMeters,
          visibility,
          source: 'manual',
        },
      }),
    );

    if (dto.clubId) {
      const member = await this.prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: dto.clubId, userId: user.userId } },
        select: { userId: true },
      });
      if (!member) throw new BadRequestException('You are not a member of that club');

      await this.prisma.clubPost.create({
        data: {
          clubId: dto.clubId,
          userId: user.userId,
          activityId: activity.id,
          body: null,
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log(`[activity.create] create=${createMs.toFixed(1)}ms total=${msSince(reqStart).toFixed(1)}ms`);

    return { activity };
  }

  @Post(':id([0-9a-fA-F-]{36})/kudos')
  @UseGuards(SupabaseAuthGuard)
  async giveKudos(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    const a = await this.ensureCanViewActivity({ viewerId: user.userId, activityId: id });
    if (a.userId === user.userId) throw new BadRequestException('Cannot kudo your own activity');

    try {
      await this.prisma.activityKudo.create({
        data: {
          activityId: id,
          userId: user.userId,
        },
      });
    } catch {
      // ignore duplicate
    }

    const [kudosCount, commentCount] = await Promise.all([
      this.prisma.activityKudo.count({ where: { activityId: id } }),
      this.prisma.activityComment.count({ where: { activityId: id } }),
    ]);

    return { kudosCount, commentCount, viewerHasKudo: true };
  }

  @Get(':id([0-9a-fA-F-]{36})/kudos')
  @UseGuards(SupabaseAuthGuard)
  async listKudos(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    await this.ensureCanViewActivity({ viewerId: user.userId, activityId: id });

    const kudos = await this.prisma.activityKudo.findMany({
      where: { activityId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        userId: true,
        createdAt: true,
      },
    });

    const userIds = Array.from(new Set(kudos.map((k) => k.userId)));
    const profiles = userIds.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map(profiles.map((p) => [p.userId, p] as const));

    return {
      items: kudos.map((k) => {
        const p = byId.get(k.userId);
        const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'Athlete');
        return {
          createdAt: k.createdAt.toISOString(),
          actor: {
            id: k.userId,
            username: p?.username ?? null,
            name,
            avatarUrl: p?.avatarUrl ?? null,
          },
        };
      }),
    };
  }

  @Delete(':id([0-9a-fA-F-]{36})/kudos')
  @UseGuards(SupabaseAuthGuard)
  async removeKudos(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    await this.ensureCanViewActivity({ viewerId: user.userId, activityId: id });

    await this.prisma.activityKudo
      .delete({
        where: {
          activityId_userId: {
            activityId: id,
            userId: user.userId,
          },
        },
      })
      .catch(() => {});

    const [kudosCount, commentCount] = await Promise.all([
      this.prisma.activityKudo.count({ where: { activityId: id } }),
      this.prisma.activityComment.count({ where: { activityId: id } }),
    ]);

    return { kudosCount, commentCount, viewerHasKudo: false };
  }

  @Get(':id([0-9a-fA-F-]{36})/comments')
  @UseGuards(SupabaseAuthGuard)
  async listComments(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    await this.ensureCanViewActivity({ viewerId: user.userId, activityId: id });

    const comments = await this.prisma.activityComment.findMany({
      where: { activityId: id },
      orderBy: { createdAt: 'asc' },
      take: 30,
      select: {
        id: true,
        userId: true,
        body: true,
        createdAt: true,
      },
    });

    const userIds = Array.from(new Set(comments.map((c) => c.userId)));
    const profiles = userIds.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map(profiles.map((p) => [p.userId, p] as const));

    return {
      items: comments.map((c) => {
        const p = byId.get(c.userId);
        const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'Athlete');
        return {
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          actor: {
            id: c.userId,
            username: p?.username ?? null,
            name,
            avatarUrl: p?.avatarUrl ?? null,
          },
        };
      }),
    };
  }

  @Post(':id([0-9a-fA-F-]{36})/comments')
  @UseGuards(SupabaseAuthGuard)
  async addComment(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { body?: string },
  ) {
    const a = await this.ensureCanViewActivity({ viewerId: user.userId, activityId: id });

    const text = String(body?.body ?? '').trim();
    if (!text) throw new BadRequestException('Comment is empty');
    if (text.length > 500) throw new BadRequestException('Comment too long');

    const comment = await this.prisma.activityComment.create({
      data: {
        activityId: id,
        userId: user.userId,
        body: text,
      },
      select: { id: true, body: true, createdAt: true },
    });

    // return counts so UI can update
    const [kudosCount, commentCount] = await Promise.all([
      this.prisma.activityKudo.count({ where: { activityId: id } }),
      this.prisma.activityComment.count({ where: { activityId: id } }),
    ]);

    return {
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        actor: {
          id: user.userId,
        },
      },
      kudosCount,
      commentCount,
      activityOwnerId: a.userId,
    };
  }

  @Get(':id([0-9a-fA-F-]{36})')
  @UseGuards(OptionalSupabaseAuthGuard)
  async getActivity(@Param('id') id: string, @Req() req: Request, @Query('includeRoute') includeRoute?: string) {
    const reqStart = process.hrtime.bigint();
    const wantRoute = includeRoute === '1' || includeRoute === 'true';

    const { ms: findMs, result: activity } = await time('prisma.activity.findUnique', () =>
      this.prisma.activity.findUnique({
        where: { id },
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
        source: true,
        createdAt: true,
        updatedAt: true,
        // Potentially large fields.
          routePolyline: wantRoute,
          mapImageUrl: wantRoute,
        },
      }),
    );
    if (!activity) throw new NotFoundException('Activity not found');

    if (activity.visibility === 'public') {
      // Account privacy overrides activity visibility.
      const viewerId = (req as any)?.user?.userId as string | undefined;
      if (activity.userId !== viewerId) {
        const p = await this.prisma.profile.findUnique({ where: { userId: activity.userId }, select: { isPrivate: true } });
        if (p?.isPrivate) {
          if (!viewerId) throw new NotFoundException('Activity not found');
          const follow = await this.prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: viewerId,
                followingId: activity.userId,
              },
            },
            select: { followerId: true },
          });
          if (!follow) throw new NotFoundException('Activity not found');
        }
      }

      // eslint-disable-next-line no-console
      console.log(`[activity.get] find=${findMs.toFixed(1)}ms total=${msSince(reqStart).toFixed(1)}ms route=${wantRoute ? '1' : '0'}`);
      return { activity };
    }

    const viewerId = (req as any)?.user?.userId as string | undefined;
    if (!viewerId) throw new NotFoundException('Activity not found');

    if (viewerId === activity.userId) return { activity };

    if (activity.visibility === 'followers') {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: activity.userId,
          },
        },
      });

      if (follow) return { activity };
    }

    throw new NotFoundException('Activity not found');
  }

  @Delete(':id([0-9a-fA-F-]{36})')
  @UseGuards(SupabaseAuthGuard)
  async deleteActivity(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.userId !== user.userId) throw new ForbiddenException('Not allowed');

    await this.prisma.activity.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  @Post(':id([0-9a-fA-F-]{36})/media')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async uploadActivityPhoto(
    @Param('id') activityId: string,
    @CurrentUser() user: { userId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Missing file');

    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.userId !== user.userId) throw new ForbiddenException('Not allowed');

    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    if (!allowed.has(file.mimetype)) throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);

    const service = getSupabaseAdminClient();

    const bucket = this.config.get<string>('SUPABASE_ACTIVITY_MEDIA_BUCKET') ?? 'activity-media';
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const objectPath = `${user.userId}/${activityId}/${randomUUID()}${safeExt}`;

    const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: publicData } = service.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = publicData.publicUrl;

    await this.prisma.activityMedia.create({
      data: {
        activityId,
        userId: user.userId,
        kind: 'photo',
        storageBucket: bucket,
        storagePath: objectPath,
        publicUrl,
      },
    });

    return { url: publicUrl };
  }

  @Post('import/gpx')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async importGpx(
    @CurrentUser() user: { userId: string },
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: Record<string, any>,
    @Req() req?: Request,
  ) {
    const reqStart = process.hrtime.bigint();
    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname.toLowerCase().endsWith('.gpx') && file.mimetype !== 'application/gpx+xml' && file.mimetype !== 'application/xml' && file.mimetype !== 'text/xml') {
      throw new BadRequestException('File must be .gpx');
    }

    const service = getSupabaseAdminClient();

    const gpxBucket = this.config.get<string>('SUPABASE_GPX_BUCKET') ?? 'gpx';
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '.gpx';
    const gpxPath = `${user.userId}/${randomUUID()}${safeExt}`;

    const { ms: uploadMs, result: uploadRes } = await time('storage.upload(gpx)', () =>
      service.storage.from(gpxBucket).upload(gpxPath, file.buffer, {
        contentType: file.mimetype || 'application/gpx+xml',
        upsert: false,
      }),
    );
    const { error: uploadError } = uploadRes;
    if (uploadError) throw new BadRequestException(uploadError.message);

    // Invoke Edge Function if configured.
    const functionName = this.config.get<string>('SUPABASE_IMPORT_GPX_FUNCTION') ?? 'import-gpx';
    const accessToken = (req as any)?.supabaseAuth?.accessToken as string | undefined;
    if (!accessToken) throw new BadRequestException('Missing access token');

    const sport = typeof body?.sport === 'string' ? body.sport : undefined;
    const title = typeof body?.title === 'string' ? String(body.title).trim() : '';
    const description = typeof body?.description === 'string' ? body.description : undefined;
    const visibility = typeof body?.visibility === 'string' ? body.visibility : undefined;
    const clubId = typeof body?.clubId === 'string' ? body.clubId : undefined;

    const allowedVisibility = new Set(['public', 'followers', 'only_me']);
    const allowedSport = new Set(['run', 'walk', 'ride']);
    if (visibility && !allowedVisibility.has(visibility)) throw new BadRequestException('Invalid visibility');
    if (sport && !allowedSport.has(sport)) throw new BadRequestException('Invalid sport');
    if (!title) throw new BadRequestException('Title is required');

    const { ms: invokeMs, result: invokeRes } = await time('functions.invoke(import-gpx)', () =>
      service.functions.invoke(functionName, {
        body: {
          gpxBucket,
          gpxPath,
          sport,
          title,
          description,
          visibility,
          // Pass user JWT in the body because custom headers may be dropped.
          userJwt: accessToken,
        },
      }),
    );
    const { data, error } = invokeRes;

    if (error) throw new BadRequestException(error.message);

    const parsed = data as {
      startedAt: string;
      durationSeconds: number;
      distanceMeters: number;
      polyline?: string;
    };

    const startedAt = new Date(parsed.startedAt);
    this.validateStartedAt(startedAt, 'Invalid startedAt from parser');

    let finalVisibility = visibility ?? 'public';
    const p = await this.prisma.profile.findUnique({ where: { userId: user.userId }, select: { isPrivate: true } });
    if (p?.isPrivate && finalVisibility === 'public') finalVisibility = 'followers';

    const { ms: createMs, result: activity } = await time('prisma.activity.create(gpx)', () =>
      this.prisma.activity.create({
        data: {
          userId: user.userId,
          sport: sport ?? 'run',
          title,
          description: description ?? null,
          startedAt,
          durationSeconds: parsed.durationSeconds,
          distanceMeters: parsed.distanceMeters,
          visibility: finalVisibility,
          source: 'gpx',
          routePolyline: parsed.polyline ?? null,
        },
      }),
    );

    if (clubId) {
      const member = await this.prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: user.userId } },
        select: { userId: true },
      });
      if (!member) throw new BadRequestException('You are not a member of that club');

      await this.prisma.clubPost.create({
        data: {
          clubId,
          userId: user.userId,
          activityId: activity.id,
          body: null,
        },
      });
    }

    const { ms: mediaMs } = await time('prisma.activityMedia.create(gpx)', () =>
      this.prisma.activityMedia.create({
        data: {
          activityId: activity.id,
          userId: user.userId,
          kind: 'gpx',
          storageBucket: gpxBucket,
          storagePath: gpxPath,
        },
      }),
    );

    // eslint-disable-next-line no-console
    console.log(
      `[gpx] size=${file.size}B upload=${uploadMs.toFixed(1)}ms invoke=${invokeMs.toFixed(1)}ms create=${createMs.toFixed(1)}ms media=${mediaMs.toFixed(1)}ms total=${msSince(reqStart).toFixed(1)}ms polylineLen=${(parsed.polyline || '').length}`,
    );

    return { activity };
  }
}
