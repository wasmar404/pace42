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
import { getSupabaseAdminClient, toPublicUrl } from '../../auth/supabase.auth';
import { CreateActivityDto } from './activities.dto';
import { PrismaService } from '../../prisma';

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
    @Query('sport') sport?: string,
    @Query('visibility') visibility?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('minDistanceMeters') minDistanceMeters?: string,
    @Query('maxDistanceMeters') maxDistanceMeters?: string,
    @Query('minDurationSeconds') minDurationSeconds?: string,
    @Query('maxDurationSeconds') maxDurationSeconds?: string,
    @Query('source') source?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ) {
    const query = String(q || '').trim();
    const sportQ0 = String(sport || '').trim().toLowerCase();
    const sportQ = sportQ0 === 'ride' ? 'cycle' : sportQ0;
    const visQ = String(visibility || '').trim().toLowerCase();
    const src = String(source || 'any').trim().toLowerCase();
    const allowedSource = new Set(['any', 'manual', 'gpx']);
    if (!allowedSource.has(src)) throw new BadRequestException('Invalid source');

    const allowedVisibility = new Set(['any', 'public', 'followers', 'only_me']);
    if (visQ && !allowedVisibility.has(visQ)) throw new BadRequestException('Invalid visibility');

    const allowedSports = new Set(['run', 'walk', 'cycle', 'swim', 'hike', 'yoga']);
    if (sportQ && !allowedSports.has(sportQ)) throw new BadRequestException('Invalid sport');

    const limit = Math.max(1, Math.min(50, Number(take || 20) || 20));
    const pageNum = Math.max(1, Math.floor(Number(page || 1) || 1));
    const skip = (pageNum - 1) * limit;

    const sb = String(sortBy || 'startedAt').trim();
    const sd = String(sortDir || 'desc').trim().toLowerCase();
    const allowedSortBy = new Set(['startedAt', 'createdAt', 'distance', 'duration']);
    if (!allowedSortBy.has(sb)) throw new BadRequestException('Invalid sortBy');
    if (sd !== 'asc' && sd !== 'desc') throw new BadRequestException('Invalid sortDir');

    const orderBy =
      sb === 'createdAt'
        ? { createdAt: sd as any }
        : sb === 'distance'
          ? { distanceMeters: sd as any }
          : sb === 'duration'
            ? { durationSeconds: sd as any }
            : { startedAt: sd as any };

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
      ...(sportQ ? { sport: sportQ } : {}),
      ...(visQ && visQ !== 'any' ? { visibility: visQ } : {}),
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
        orderBy,
        take: limit,
        skip,
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

    const ids = acts.map((a: any) => a.id);
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

    const items = acts.map((a: any) => {
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
      page: pageNum,
      take: limit,
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

    const startedAt = new Date(dto.startedAt);
    this.validateStartedAt(startedAt, 'Invalid startedAt');

    let visibility = dto.visibility ?? 'public';
    if (!['public', 'followers', 'only_me'].includes(visibility)) visibility = 'public';

    // Account privacy overrides activity visibility.
    const p = await this.prisma.profile.findUnique({ where: { userId: user.userId }, select: { isPrivate: true } });
    if (p?.isPrivate && visibility === 'public') visibility = 'followers';

    const activity = await this.prisma.activity.create({
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
    });

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

    const userIds = Array.from(new Set(kudos.map((k: any) => k.userId)));
    const profiles = userIds.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map<string, any>(profiles.map((p: any) => [p.userId, p] as const));

    return {
      items: kudos.map((k: any) => {
        const p = byId.get(k.userId) as any;
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

    const userIds = Array.from(new Set(comments.map((c: any) => c.userId)));
    const profiles = userIds.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map<string, any>(profiles.map((p: any) => [p.userId, p] as const));

    return {
      items: comments.map((c: any) => {
        const p = byId.get(c.userId) as any;
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
    const wantRoute = includeRoute === '1' || includeRoute === 'true';

    const activity = await this.prisma.activity.findUnique({
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
    });
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

    const media = await this.prisma.activityMedia.findMany({
      where: { activityId: id, userId: user.userId },
      select: { storageBucket: true, storagePath: true },
    });

    // Best-effort delete from Supabase Storage.
    try {
      const service = getSupabaseAdminClient();
      const byBucket = new Map<string, string[]>();
      for (const m of media) {
        const b = String((m as any).storageBucket || '').trim();
        const p = String((m as any).storagePath || '').trim();
        if (!b || !p) continue;
        const list = byBucket.get(b) ?? [];
        list.push(p);
        byBucket.set(b, list);
      }

      for (const [bucket, paths] of byBucket.entries()) {
        // eslint-disable-next-line no-await-in-loop
        await service.storage.from(bucket).remove(paths).catch(() => {});
      }
    } catch {
      // ignore
    }

    await this.prisma.activity.delete({ where: { id } });
    return { ok: true };
  }

  @Delete(':id([0-9a-fA-F-]{36})/media/:mediaId([0-9a-fA-F-]{36})')
  @UseGuards(SupabaseAuthGuard)
  async deleteActivityMedia(
    @Param('id') activityId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: { userId: string },
  ) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, userId: true } });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.userId !== user.userId) throw new ForbiddenException('Not allowed');

    const media = await this.prisma.activityMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, activityId: true, userId: true, storageBucket: true, storagePath: true },
    });
    if (!media || media.activityId !== activityId || media.userId !== user.userId) throw new NotFoundException('Media not found');

    // Best-effort delete storage object first.
    try {
      const service = getSupabaseAdminClient();
      await service.storage.from(media.storageBucket).remove([media.storagePath]).catch(() => {});
    } catch {
      // ignore
    }

    await this.prisma.activityMedia.delete({ where: { id: mediaId } });
    return { ok: true };
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
    const publicUrl = toPublicUrl(publicData.publicUrl);

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
    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname.toLowerCase().endsWith('.gpx') && file.mimetype !== 'application/gpx+xml' && file.mimetype !== 'application/xml' && file.mimetype !== 'text/xml') {
      throw new BadRequestException('File must be .gpx');
    }

    const service = getSupabaseAdminClient();

    const gpxBucket = this.config.get<string>('SUPABASE_GPX_BUCKET') ?? 'gpx';
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '.gpx';
    const gpxPath = `${user.userId}/${randomUUID()}${safeExt}`;

    const uploadRes = await service.storage.from(gpxBucket).upload(gpxPath, file.buffer, {
      contentType: file.mimetype || 'application/gpx+xml',
      upsert: false,
    });
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

    const allowedVisibility = new Set(['public', 'followers', 'only_me']);
    const allowedSport = new Set(['run', 'walk', 'ride']);
    if (visibility && !allowedVisibility.has(visibility)) throw new BadRequestException('Invalid visibility');
    if (sport && !allowedSport.has(sport)) throw new BadRequestException('Invalid sport');
    if (!title) throw new BadRequestException('Title is required');

    const invokeRes = await service.functions.invoke(functionName, {
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
    });
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

    const activity = await this.prisma.activity.create({
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
    });

    await this.prisma.activityMedia.create({
      data: {
        activityId: activity.id,
        userId: user.userId,
        kind: 'gpx',
        storageBucket: gpxBucket,
        storagePath: gpxPath,
      },
    });

    // No timing logs.

    return { activity };
  }
}
