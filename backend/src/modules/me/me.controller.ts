import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../prisma';
import { CurrentUser, JwtAuthGuard, type RequestUser } from '../../auth/auth.jwt';
import { UpdatePersonalDto, UpdatePhysicalDto } from '../../me/me.dto';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getMe(@CurrentUser() user: RequestUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { profile: true },
    });

    return {
      user: {
        id: dbUser?.id?.toString(),
        email: dbUser?.email,
        emailVerifiedAt: dbUser?.emailVerifiedAt,
        onboardingCompletedAt: dbUser?.profile?.onboardingCompletedAt ?? null,
      },
      profile: dbUser?.profile ?? null,
    };
  }

  @Put('personal')
  async updatePersonal(@CurrentUser() user: RequestUser, @Body() dto: UpdatePersonalDto) {
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { email: dto.email },
    });

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
  async updatePhysical(@CurrentUser() user: RequestUser, @Body() dto: UpdatePhysicalDto)
  {
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
}
