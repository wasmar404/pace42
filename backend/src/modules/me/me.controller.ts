import { Body, Controller, Get, Put, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { PrismaService } from '../../prisma';
import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { UpdatePersonalDto, UpdatePhysicalDto } from '../../me/me.dto';
import { createSupabaseClients } from '../../auth/supabase.auth';

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async getMe(@CurrentUser() user?: { userId: string; email?: string }) {
    if (!user) throw new BadRequestException('Missing user');

    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.userId },
    });

    return {
      user: {
        id: user.userId,
        email: user.email ?? null,
      },
      profile: profile ?? null,
    };
  }

  @Put('personal')
  async updatePersonal(@CurrentUser() user: { userId: string }, @Body() dto: UpdatePersonalDto) {
    const profile = await this.prisma.profile.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
      },
      update: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
      },
    });

    return { profile };
  }

  @Put('physical')
  async updatePhysical(@CurrentUser() user: { userId: string }, @Body() dto: UpdatePhysicalDto) {
    const profile = await this.prisma.profile.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        level: dto.level,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        onboardingCompletedAt: new Date(),
      },
      update: {
        level: dto.level,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        onboardingCompletedAt: new Date(),
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

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) throw new BadRequestException('Unsupported image type');

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
        avatarUrl,
      },
      update: {
        avatarUrl,
      },
    });

    return { avatarUrl };
  }
}
