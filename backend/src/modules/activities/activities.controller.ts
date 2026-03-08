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
import { ImportGpxDto } from './gpx.dto';
import { PrismaService } from '../../prisma';

@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async createActivity(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateActivityDto,
  ) {
    const startedAt = new Date(dto.startedAt);
    if (Number.isNaN(startedAt.getTime())) throw new BadRequestException('Invalid startedAt');

    const visibility = dto.visibility ?? 'public';

    const activity = await this.prisma.activity.create({
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
    });

    return { activity };
  }

  @Get(':id')
  @UseGuards(OptionalSupabaseAuthGuard)
  async getActivity(@Param('id') id: string, @Req() req: Request) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');

    if (activity.visibility === 'public') return { activity };

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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadActivityPhoto(
    @Param('id') activityId: string,
    @CurrentUser() user: { userId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Missing file');
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) throw new BadRequestException('Unsupported image type');

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

    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.userId !== user.userId) throw new ForbiddenException('Not allowed');

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
    @Body() dto?: ImportGpxDto,
    @Req() req?: Request,
  ) {
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

    const { error: uploadError } = await service.storage.from(gpxBucket).upload(gpxPath, file.buffer, {
      contentType: file.mimetype || 'application/gpx+xml',
      upsert: false,
    });
    if (uploadError) throw new BadRequestException(uploadError.message);

    // Invoke Edge Function if configured.
    const functionName = this.config.get<string>('SUPABASE_IMPORT_GPX_FUNCTION') ?? 'import-gpx';
    const accessToken = (req as any)?.supabaseAuth?.accessToken as string | undefined;
    if (!accessToken) throw new BadRequestException('Missing access token');

    const { data, error } = await service.functions.invoke(functionName, {
      body: {
        gpxBucket,
        gpxPath,
        sport: dto?.sport,
        title: dto?.title,
        description: dto?.description,
        visibility: dto?.visibility,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) throw new BadRequestException(error.message);

    const parsed = data as {
      startedAt: string;
      durationSeconds: number;
      distanceMeters: number;
      polyline?: string;
    };

    const startedAt = new Date(parsed.startedAt);
    if (Number.isNaN(startedAt.getTime())) throw new BadRequestException('Invalid startedAt from parser');

    const activity = await this.prisma.activity.create({
      data: {
        userId: user.userId,
        sport: dto?.sport ?? 'run',
        title: dto?.title ?? null,
        description: dto?.description ?? null,
        startedAt,
        durationSeconds: parsed.durationSeconds,
        distanceMeters: parsed.distanceMeters,
        visibility: dto?.visibility ?? 'public',
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

    return { activity };
  }
}
