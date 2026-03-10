import { BadRequestException, Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { OptionalSupabaseAuthGuard } from '../../auth/supabase.optional.guard';
import { PrismaService } from '../../prisma';

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id')
  @UseGuards(OptionalSupabaseAuthGuard)
  async getUser(@Param('id') id: string) {
    if (!id) throw new BadRequestException('Missing user id');

    const data = await this.prisma.profile.findUnique({
      where: { userId: id },
      select: {
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        level: true,
        bio: true,
      },
    });

    if (!data) throw new BadRequestException('User not found');

    return {
      user: {
        id: data.userId,
        username: data.username,
      },
      profile: {
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        level: data.level,
        bio: data.bio,
      },
    };
  }

  @Get(':id/activities')
  @UseGuards(OptionalSupabaseAuthGuard)
  async getUserActivities(@Param('id') id: string, @Req() req: Request) {
    if (!id) throw new BadRequestException('Missing user id');

    const viewerId = (req as any)?.user?.userId as string | undefined;
    const isOwner = viewerId === id;

    let includeFollowers = false;
    if (viewerId && !isOwner) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: id,
          },
        },
      });
      includeFollowers = Boolean(follow);
    }

    const visibilityFilter: string[] = ['public'];
    if (isOwner) visibilityFilter.push('followers', 'only_me');
    else if (includeFollowers) visibilityFilter.push('followers');

    const activities = await this.prisma.activity.findMany({
      where: {
        userId: id,
        visibility: { in: visibilityFilter },
      },
      orderBy: { startedAt: 'desc' },
    });

    return { activities };
  }
}
