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
import { createSupabaseClients } from '../../auth/supabase.auth';
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

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async createActivity(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateActivityDto,
  ) {
    const reqStart = process.hrtime.bigint();
    const startedAt = new Date(dto.startedAt);
    if (Number.isNaN(startedAt.getTime())) throw new BadRequestException('Invalid startedAt');

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
          title: dto.title ?? null,
          description: dto.description ?? null,
          startedAt,
          durationSeconds: dto.durationSeconds,
          distanceMeters: dto.distanceMeters,
          visibility,
          source: 'manual',
        },
      }),
    );

    // eslint-disable-next-line no-console
    console.log(`[activity.create] create=${createMs.toFixed(1)}ms total=${msSince(reqStart).toFixed(1)}ms`);

    return { activity };
  }

  @Post(':id/kudos')
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

  @Get(':id/kudos')
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

  @Delete(':id/kudos')
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

  @Get(':id/comments')
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

  @Post(':id/comments')
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

  @Get(':id')
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

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  async deleteActivity(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.userId !== user.userId) throw new ForbiddenException('Not allowed');

    await this.prisma.activity.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  @Post(':id/media')
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
      'image/avif',
      'image/gif',
      'image/heic',
      'image/heif',
    ]);
    if (!allowed.has(file.mimetype)) throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    const { service } = createSupabaseClients({
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey,
    });

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

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    const { service } = createSupabaseClients({ supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey });

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
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const description = typeof body?.description === 'string' ? body.description : undefined;
    const visibility = typeof body?.visibility === 'string' ? body.visibility : undefined;

    const allowedVisibility = new Set(['public', 'followers', 'only_me']);
    const allowedSport = new Set(['run', 'walk', 'ride']);
    if (visibility && !allowedVisibility.has(visibility)) throw new BadRequestException('Invalid visibility');
    if (sport && !allowedSport.has(sport)) throw new BadRequestException('Invalid sport');

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
    if (Number.isNaN(startedAt.getTime())) throw new BadRequestException('Invalid startedAt from parser');

    let finalVisibility = visibility ?? 'public';
    const p = await this.prisma.profile.findUnique({ where: { userId: user.userId }, select: { isPrivate: true } });
    if (p?.isPrivate && finalVisibility === 'public') finalVisibility = 'followers';

    const { ms: createMs, result: activity } = await time('prisma.activity.create(gpx)', () =>
      this.prisma.activity.create({
        data: {
          userId: user.userId,
          sport: sport ?? 'run',
          title: title ?? null,
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
