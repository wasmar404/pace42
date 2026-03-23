import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma';
import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { supabase } from '../../auth/supabase.auth';
import { CreateClubDto, CreateClubPostDto, DeleteClubDto, InviteUserDto, SetMemberRoleDto, UpdateClubDto } from './clubs.dto';

function clubNameOrThrow(name: string) {
  const s = String(name || '').trim();
  if (!s) throw new BadRequestException('Club name is required');
  if (s.length > 120) throw new BadRequestException('Club name is too long');
  return s;
}

@Controller('clubs')
@UseGuards(SupabaseAuthGuard)
export class ClubsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async uploadClubImage(params: {
    clubId: string;
    kind: 'avatar' | 'banner';
    file: Express.Multer.File;
  }) {
    const { clubId, kind, file } = params;
    if (!file) throw new BadRequestException('Missing file');
    if (!String(file.mimetype || '').startsWith('image/')) throw new BadRequestException('File must be an image');

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    const  service  = supabase;
    // Use an existing bucket by default to avoid local setup footguns.
    const bucket = this.config.get<string>('SUPABASE_CLUB_MEDIA_BUCKET') ?? (this.config.get<string>('SUPABASE_ACTIVITY_MEDIA_BUCKET') ?? 'activity-media');
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const objectPath = `${clubId}/${kind}/${randomUUID()}${safeExt}`;

    const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: publicData } = service.storage.from(bucket).getPublicUrl(objectPath);
    return publicData.publicUrl;
  }

  private async uploadClubPostImage(params: {
    clubId: string;
    postId: string;
    file: Express.Multer.File;
  }) {
    const { clubId, postId, file } = params;
    if (!file) throw new BadRequestException('Missing file');
    if (!String(file.mimetype || '').startsWith('image/')) throw new BadRequestException('File must be an image');

 
    const  service  = supabase;

    const bucket =
      this.config.get<string>('SUPABASE_CLUB_MEDIA_BUCKET') ??
      (this.config.get<string>('SUPABASE_ACTIVITY_MEDIA_BUCKET') ?? 'activity-media');
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const objectPath = `${clubId}/posts/${postId}/${randomUUID()}${safeExt}`;

    const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: publicData } = service.storage.from(bucket).getPublicUrl(objectPath);
    return publicData.publicUrl;
  }

  private async requireMember(params: { clubId: string; userId: string }) {
    const { clubId, userId } = params;
    const m = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { userId: true },
    });
    if (!m) throw new ForbiddenException('Not a club member');
  }

  private async getMyRole(params: { clubId: string; userId: string }): Promise<'owner' | 'admin' | 'member'> {
    const m = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: params.clubId, userId: params.userId } },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException('Not a club member');
    const r = String(m.role || '').toLowerCase();
    if (r === 'owner' || r === 'admin') return r as any;
    return 'member';
  }

  private requireOwner(role: string) {
    if (role !== 'owner') throw new ForbiddenException('Owner only');
  }

  private requireManage(role: string) {
    if (role !== 'owner' && role !== 'admin') throw new ForbiddenException('Admins only');
  }

  private mapClubSportToActivitySports(clubSport: string) {
    const s = String(clubSport || '').toLowerCase();
    if (s === 'cycle') return ['ride'];
    if (s === 'hike') return ['walk'];
    if (s === 'run') return ['run'];
    if (s === 'walk') return ['walk'];
    return ['run', 'walk', 'ride'];
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
      ],
      { limits: { fileSize: 6 * 1024 * 1024 } },
    ),
  )
  async create(
    @CurrentUser() user: { userId: string },
    @UploadedFiles() files: { avatar?: Express.Multer.File[]; banner?: Express.Multer.File[] },
    @Body() dto: CreateClubDto,
  ) {
    const name = clubNameOrThrow(dto.name);
    const location = String(dto.location || '').trim();
    const description = String(dto.description || '').trim();
    const sport = String(dto.sport || '').toLowerCase();
    const allowedSport = new Set(['run', 'walk', 'hike', 'cycle']);
    if (!allowedSport.has(sport)) throw new BadRequestException('Invalid sport');
    if (!location) throw new BadRequestException('Location is required');
    if (!description) throw new BadRequestException('Description is required');

    const avatarFile = files?.avatar?.[0];
    const bannerFile = files?.banner?.[0];
    if (!avatarFile) throw new BadRequestException('Club avatar is required');
    if (!bannerFile) throw new BadRequestException('Club banner is required');

    const clubId = randomUUID();
    const [avatarUrl, bannerUrl] = await Promise.all([
      this.uploadClubImage({ clubId, kind: 'avatar', file: avatarFile }),
      this.uploadClubImage({ clubId, kind: 'banner', file: bannerFile }),
    ]);

    const club = await this.prisma.club.create({
      data: {
        id: clubId,
        ownerId: user.userId,
        name,
        location,
        sport,
        description,
        avatarUrl,
        bannerUrl,
        isInviteOnly: dto.isInviteOnly === true,
        members: {
          create: {
            userId: user.userId,
            role: 'owner',
          },
        },
      },
      select: {
        id: true,
        ownerId: true,
        name: true,
        location: true,
        sport: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isInviteOnly: true,
        createdAt: true,
      },
    });

    return { club };
  }

  @Post(':id([0-9a-fA-F-]{36})/update')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
      ],
      { limits: { fileSize: 6 * 1024 * 1024 } },
    ),
  )
  async updateClub(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @UploadedFiles() files: { avatar?: Express.Multer.File[]; banner?: Express.Multer.File[] },
    @Body() dto: UpdateClubDto,
  ) {
    const role = await this.getMyRole({ clubId: id, userId: user.userId });
    this.requireManage(role);

    const club = await this.prisma.club.findUnique({ where: { id }, select: { id: true, ownerId: true } });
    if (!club) throw new BadRequestException('Club not found');

    const avatarFile = files?.avatar?.[0];
    const bannerFile = files?.banner?.[0];

    const update: any = {};
    if (typeof dto.name === 'string') update.name = clubNameOrThrow(dto.name);
    if (typeof dto.location === 'string') {
      const s = String(dto.location).trim();
      if (!s) throw new BadRequestException('Location is required');
      update.location = s;
    }
    if (typeof dto.description === 'string') {
      const s = String(dto.description).trim();
      if (!s) throw new BadRequestException('Description is required');
      update.description = s;
    }
    if (typeof dto.sport === 'string') {
      const s = String(dto.sport).toLowerCase();
      const allowedSport = new Set(['run', 'walk', 'hike', 'cycle']);
      if (!allowedSport.has(s)) throw new BadRequestException('Invalid sport');
      update.sport = s;
    }
    if (typeof dto.isInviteOnly === 'boolean') {
      if (role !== 'owner') throw new ForbiddenException('Only the owner can change access');
      update.isInviteOnly = dto.isInviteOnly;
    }

    if (avatarFile) update.avatarUrl = await this.uploadClubImage({ clubId: id, kind: 'avatar', file: avatarFile });
    if (bannerFile) update.bannerUrl = await this.uploadClubImage({ clubId: id, kind: 'banner', file: bannerFile });

    const updated = await this.prisma.club.update({
      where: { id },
      data: update,
      select: {
        id: true,
        ownerId: true,
        name: true,
        location: true,
        sport: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isInviteOnly: true,
        createdAt: true,
      },
    });

    return { club: updated };
  }

  @Get('mine')
  async mine(@CurrentUser() user: { userId: string }) {
    const memberships = await this.prisma.clubMember.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        role: true,
        club: {
          select: {
            id: true,
            name: true,
            location: true,
            sport: true,
            description: true,
            isInviteOnly: true,
            avatarUrl: true,
            bannerUrl: true,
            createdAt: true,
            ownerId: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    return {
      clubs: memberships.map((m) => ({
        ...m.club,
        memberCount: m.club._count.members,
        myRole: m.role,
      })),
    };
  }

  @Get('discover')
  async discover(
    @CurrentUser() user: { userId: string },
    @Query('take') take?: string,
    @Query('q') q?: string,
    @Query('seed') seed?: string,
  ) {
    const limit = Math.max(1, Math.min(30, Number(take || 12) || 12));
    const query = String(q || '').trim();
    const seedStr = String(seed || '').trim();

    const myClubIds = await this.prisma.clubMember.findMany({
      where: { userId: user.userId },
      select: { clubId: true },
    });

    const clubs = await this.prisma.club.findMany({
      where: {
        isInviteOnly: false,
        id: { notIn: myClubIds.map((x) => x.clubId) },
        ...(query.length >= 2
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { location: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: Math.max(limit, 24),
      select: {
        id: true,
        ownerId: true,
        name: true,
        location: true,
        sport: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isInviteOnly: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });

    const list = clubs.map((c) => ({
      id: c.id,
      ownerId: c.ownerId,
      name: c.name,
      location: c.location,
      sport: c.sport,
      description: c.description,
      avatarUrl: c.avatarUrl,
      bannerUrl: c.bannerUrl,
      isInviteOnly: c.isInviteOnly,
      createdAt: c.createdAt,
      memberCount: c._count.members,
    }));

    // Sort: top by members; ties shuffled (deterministic-ish).
    const seedBase = seedStr || `${user.userId}:${new Date().toISOString().slice(0, 10)}`;
    let x = 2166136261;
    for (let i = 0; i < seedBase.length; i++) {
      x ^= seedBase.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    const rnd = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };

    list.sort((a, b) => {
      if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
      return rnd() < 0.5 ? -1 : 1;
    });

    return {
      clubs: list.slice(0, limit),
    };
  }

  @Get(':id([0-9a-fA-F-]{36})')
  async get(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        name: true,
        location: true,
        sport: true,
        description: true,
        avatarUrl: true,
        bannerUrl: true,
        isInviteOnly: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    if (!club) throw new BadRequestException('Club not found');

    const myMember = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.userId } },
      select: { role: true },
    });

    return {
      club: {
        ...club,
        memberCount: club._count.members,
      },
      viewer: {
        id: user.userId,
        isMember: Boolean(myMember),
        role: myMember?.role ?? null,
      },
    };
  }

  @Get(':id([0-9a-fA-F-]{36})/members')
  async members(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    const viewerRole = await this.getMyRole({ clubId: id, userId: user.userId });

    const members = await this.prisma.clubMember.findMany({
      where: { clubId: id },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, role: true, createdAt: true },
    });

    const ids = members.map((m) => m.userId);
    const profiles = ids.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: ids } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map(profiles.map((p) => [p.userId, p] as const));

    return {
      viewer: {
        role: viewerRole,
      },
      members: members.map((m) => {
        const p = byId.get(m.userId);
        const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'Member');
        return {
          id: m.userId,
          username: p?.username ?? null,
          name,
          avatarUrl: p?.avatarUrl ?? null,
          role: m.role,
          joinedAt: m.createdAt,
        };
      }),
    };
  }

  @Get(':id([0-9a-fA-F-]{36})/leaderboard')
  async leaderboard(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Query('days') days?: string,
  ) {
    await this.requireMember({ clubId: id, userId: user.userId });

    const n = Number(days || 28);
    const windowDays = Number.isFinite(n) ? Math.max(1, Math.min(365, Math.floor(n))) : 28;

    const club = await this.prisma.club.findUnique({ where: { id }, select: { sport: true } });
    if (!club) throw new BadRequestException('Club not found');
    const sports = this.mapClubSportToActivitySports(club.sport);

    const members = await this.prisma.clubMember.findMany({ where: { clubId: id }, select: { userId: true } });
    const memberIds = members.map((m) => m.userId);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const rows = memberIds.length
      ? await this.prisma.activity.groupBy({
          by: ['userId'],
          where: {
            userId: { in: memberIds },
            startedAt: { gte: since },
            sport: { in: sports },
          },
          _sum: { distanceMeters: true, durationSeconds: true },
          _count: { _all: true },
        })
      : [];

    const ids = rows.map((r: any) => r.userId as string);
    const profiles = ids.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: ids } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map(profiles.map((p) => [p.userId, p] as const));

    const items = (rows as any[])
      .map((r) => {
        const p = byId.get(r.userId);
        const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'Member');
        return {
          user: {
            id: r.userId,
            username: p?.username ?? null,
            name,
            avatarUrl: p?.avatarUrl ?? null,
          },
          activities: Number(r._count?._all ?? 0),
          distanceMeters: Number(r._sum?.distanceMeters ?? 0),
          timeSeconds: Number(r._sum?.durationSeconds ?? 0),
        };
      })
      .sort((a, b) => b.distanceMeters - a.distanceMeters);

    return { windowDays, items };
  }

  @Get(':id([0-9a-fA-F-]{36})/feed')
  async feed(@Param('id') id: string, @CurrentUser() user: { userId: string }, @Query('take') take?: string) {
    await this.requireMember({ clubId: id, userId: user.userId });

    const n = Number(take || 20);
    const limit = Number.isFinite(n) ? Math.max(1, Math.min(50, Math.floor(n))) : 20;

    const club = await this.prisma.club.findUnique({ where: { id }, select: { sport: true } });
    if (!club) throw new BadRequestException('Club not found');
    const sports = this.mapClubSportToActivitySports(club.sport);

    const members = await this.prisma.clubMember.findMany({ where: { clubId: id }, select: { userId: true } });
    const memberIds = members.map((m) => m.userId);
    if (!memberIds.length) return { items: [] };

    const seedActivities = await this.prisma.activity.findMany({
      where: {
        userId: { in: memberIds },
        sport: { in: sports },
        visibility: { in: ['public', 'followers'] },
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(150, limit * 4),
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
        routePolyline: true,
      },
    });

    const actorIds = Array.from(new Set(seedActivities.map((a) => a.userId)));

    const [actors, follows] = await Promise.all([
      actorIds.length
        ? this.prisma.profile.findMany({
            where: { userId: { in: actorIds } },
            select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true, isPrivate: true },
          })
        : Promise.resolve([]),
      actorIds.length
        ? this.prisma.follow.findMany({
            where: { followerId: user.userId, followingId: { in: actorIds } },
            select: { followingId: true },
          })
        : Promise.resolve([]),
    ]);

    const actorById = new Map(actors.map((a) => [a.userId, a] as const));
    const followingSet = new Set((follows as any[]).map((f) => f.followingId));

    const activities = seedActivities
      .filter((a) => {
        if (a.userId === user.userId) return true;
        const p = actorById.get(a.userId);
        const isPrivate = Boolean(p?.isPrivate);
        const followsAuthor = followingSet.has(a.userId);
        if (a.visibility === 'followers') return followsAuthor;
        if (a.visibility === 'public') return !isPrivate || followsAuthor;
        return false;
      })
      .slice(0, limit);

    const activityIds = activities.map((a) => a.id);

    const [media, kudosCounts, commentCounts, myKudos] = await Promise.all([
      activityIds.length
        ? this.prisma.activityMedia.findMany({
            where: { activityId: { in: activityIds }, kind: 'photo', publicUrl: { not: null } },
            orderBy: { createdAt: 'asc' },
            select: { activityId: true, publicUrl: true },
          })
        : Promise.resolve([]),
      activityIds.length
        ? this.prisma.activityKudo.groupBy({
            by: ['activityId'],
            where: { activityId: { in: activityIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      activityIds.length
        ? this.prisma.activityComment.groupBy({
            by: ['activityId'],
            where: { activityId: { in: activityIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      activityIds.length
        ? this.prisma.activityKudo.findMany({
            where: { activityId: { in: activityIds }, userId: user.userId },
            select: { activityId: true },
          })
        : Promise.resolve([]),
    ]);

    const mediaByActivity = new Map<string, string[]>();
    for (const m of media as any[]) {
      if (!m.publicUrl) continue;
      const cur = mediaByActivity.get(m.activityId) ?? [];
      if (cur.length >= 8) continue;
      cur.push(m.publicUrl);
      mediaByActivity.set(m.activityId, cur);
    }

    const kudosByActivity = new Map<string, number>();
    for (const r of kudosCounts as any[]) {
      kudosByActivity.set(r.activityId, Number(r._count?._all ?? 0));
    }

    const commentsByActivity = new Map<string, number>();
    for (const r of commentCounts as any[]) {
      commentsByActivity.set(r.activityId, Number(r._count?._all ?? 0));
    }

    const myKudosSet = new Set((myKudos as any[]).map((k) => k.activityId));

    const items = activities.map((a) => {
      const p = actorById.get(a.userId);
      const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'Athlete');
      return {
        type: 'activity',
        id: a.id,
        createdAt: a.startedAt.toISOString(),
        athlete: {
          id: a.userId,
          username: p?.username ?? null,
          name,
          avatarUrl: p?.avatarUrl ?? null,
        },
        activity: {
          id: a.id,
          sport: a.sport,
          title: a.title ?? null,
          description: a.description ?? null,
          startedAt: a.startedAt.toISOString(),
          durationSeconds: a.durationSeconds,
          distanceMeters: a.distanceMeters,
          visibility: a.visibility,
          routePolyline: a.routePolyline ?? null,
          imageUrls: mediaByActivity.get(a.id) ?? [],
          imageUrl: (mediaByActivity.get(a.id) ?? [])[0] ?? null,
        },
        social: {
          kudosCount: kudosByActivity.get(a.id) ?? 0,
          commentCount: commentsByActivity.get(a.id) ?? 0,
          viewerHasKudo: myKudosSet.has(a.id),
        },
      };
    });

    return { items };
  }

  @Get(':id([0-9a-fA-F-]{36})/posts')
  async listPosts(@Param('id') id: string, @CurrentUser() user: { userId: string }, @Query('take') take?: string) {
    await this.requireMember({ clubId: id, userId: user.userId });

    const n = Number(take || 20);
    const limit = Number.isFinite(n) ? Math.max(1, Math.min(50, Math.floor(n))) : 20;

    const posts = await this.prisma.clubPost.findMany({
      where: { clubId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        media: {
          orderBy: { createdAt: 'asc' },
          select: { publicUrl: true },
        },
      },
    });

    const authorIds = Array.from(new Set(posts.map((p) => p.userId)));
    const activityIds = Array.from(new Set(posts.map((p) => p.activityId).filter(Boolean) as string[]));

    const [profiles, activities] = await Promise.all([
      authorIds.length
        ? this.prisma.profile.findMany({
            where: { userId: { in: authorIds } },
            select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
          })
        : Promise.resolve([]),
      activityIds.length
        ? this.prisma.activity.findMany({
            where: { id: { in: activityIds } },
            select: {
              id: true,
              userId: true,
              sport: true,
              title: true,
              startedAt: true,
              durationSeconds: true,
              distanceMeters: true,
              visibility: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const profById = new Map(profiles.map((p) => [p.userId, p] as const));
    const actById = new Map(activities.map((a) => [a.id, a] as const));

    return {
      items: posts.map((p) => {
        const a = profById.get(p.userId);
        const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || (a?.username ? `@${a.username}` : 'Athlete');
        const act = p.activityId ? actById.get(p.activityId) : null;
        return {
          id: p.id,
          createdAt: p.createdAt.toISOString(),
          body: p.body ?? null,
          author: {
            id: p.userId,
            username: a?.username ?? null,
            name,
            avatarUrl: a?.avatarUrl ?? null,
          },
          media: (p.media || []).map((m) => ({ url: m.publicUrl })),
          activity: act
            ? {
                id: act.id,
                sport: act.sport,
                title: act.title ?? null,
                startedAt: act.startedAt.toISOString(),
                durationSeconds: act.durationSeconds,
                distanceMeters: act.distanceMeters,
                visibility: act.visibility,
              }
            : null,
        };
      }),
    };
  }

  @Post(':id([0-9a-fA-F-]{36})/posts')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 6 }], {
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  async createPost(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @UploadedFiles() files: { images?: Express.Multer.File[] },
    @Body() dto: CreateClubPostDto,
  ) {
    await this.requireMember({ clubId: id, userId: user.userId });

    const body = typeof dto?.body === 'string' ? dto.body.trim() : '';
    const images = (files?.images || []).filter(Boolean);
    if (!body && !images.length) throw new BadRequestException('Post is empty');

    const post = await this.prisma.clubPost.create({
      data: {
        clubId: id,
        userId: user.userId,
        body: body || null,
      },
    });

    if (images.length) {
      const urls = await Promise.all(
        images.map((file) => this.uploadClubPostImage({ clubId: id, postId: post.id, file })),
      );
      await this.prisma.clubPostMedia.createMany({
        data: urls.map((url) => ({ postId: post.id, publicUrl: url })),
      });
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.userId },
      select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
    });
    const name = `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || (profile?.username ? `@${profile.username}` : 'Athlete');

    const media = await this.prisma.clubPostMedia.findMany({
      where: { postId: post.id },
      orderBy: { createdAt: 'asc' },
      select: { publicUrl: true },
    });

    return {
      post: {
        id: post.id,
        createdAt: post.createdAt.toISOString(),
        body: post.body ?? null,
        author: {
          id: user.userId,
          username: profile?.username ?? null,
          name,
          avatarUrl: profile?.avatarUrl ?? null,
        },
        media: media.map((m) => ({ url: m.publicUrl })),
        activity: null,
      },
    };
  }

  @Post(':id([0-9a-fA-F-]{36})/join')
  async join(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    const club = await this.prisma.club.findUnique({ where: { id }, select: { id: true, isInviteOnly: true } });
    if (!club) throw new BadRequestException('Club not found');
    if (club.isInviteOnly) throw new BadRequestException('This club is invite-only');

    await this.prisma.clubMember.upsert({
      where: { clubId_userId: { clubId: id, userId: user.userId } },
      create: { clubId: id, userId: user.userId, role: 'member' },
      update: {},
    });

    return { ok: true };
  }

  @Post(':id([0-9a-fA-F-]{36})/leave')
  async leave(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    const m = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.userId } },
      select: { role: true },
    });
    if (!m) return { ok: true };
    if (m.role === 'owner') throw new BadRequestException('Owner cannot leave the club');

    await this.prisma.clubMember.delete({ where: { clubId_userId: { clubId: id, userId: user.userId } } });
    return { ok: true };
  }

  @Post(':id([0-9a-fA-F-]{36})/invites')
  async invite(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: InviteUserDto,
  ) {
    const role = await this.getMyRole({ clubId: id, userId: user.userId });
    this.requireManage(role);

    const club = await this.prisma.club.findUnique({ where: { id }, select: { id: true, ownerId: true } });
    if (!club) throw new BadRequestException('Club not found');
    if (role !== 'owner' && role !== 'admin') throw new BadRequestException('Only the owner can invite');

    const targetId = String(dto.userId || '').trim();
    if (!targetId) throw new BadRequestException('Missing userId');
    if (targetId === user.userId) throw new BadRequestException('You cannot invite yourself');

    const target = await this.prisma.profile.findUnique({
      where: { userId: targetId },
      select: { userId: true },
    });
    if (!target) throw new BadRequestException('User not found');

    const existingMember = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: targetId } },
      select: { userId: true },
    });
    if (existingMember) throw new BadRequestException('User is already a member');

    const pending = await this.prisma.clubInvite.findFirst({
      where: { clubId: id, userId: targetId, status: 'pending' },
      select: { id: true },
    });
    if (pending) return { ok: true };

    const invite = await this.prisma.clubInvite.create({
      data: {
        clubId: id,
        userId: targetId,
        invitedById: user.userId,
        status: 'pending',
      },
      select: { id: true, clubId: true, userId: true, invitedById: true, status: true, createdAt: true },
    });

    return { invite };
  }

  @Get('invites')
  async myInvites(@CurrentUser() user: { userId: string }) {
    const invites = await this.prisma.clubInvite.findMany({
      where: { userId: user.userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        club: {
          select: {
            id: true,
            name: true,
            location: true,
            sport: true,
            description: true,
            isInviteOnly: true,
            ownerId: true,
            _count: { select: { members: true } },
          },
        },
        invitedById: true,
      },
    });

    const inviterIds = Array.from(new Set(invites.map((i) => i.invitedById)));
    const inviters = inviterIds.length
      ? await this.prisma.profile.findMany({
          where: { userId: { in: inviterIds } },
          select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const byId = new Map(inviters.map((p) => [p.userId, p] as const));

    return {
      invites: invites.map((i) => {
        const inv = byId.get(i.invitedById);
        const inviterName = `${inv?.firstName ?? ''} ${inv?.lastName ?? ''}`.trim() || (inv?.username ? `@${inv.username}` : 'Someone');
        return {
          id: i.id,
          createdAt: i.createdAt,
          inviter: {
            id: i.invitedById,
            username: inv?.username ?? null,
            name: inviterName,
            avatarUrl: inv?.avatarUrl ?? null,
          },
          club: {
            ...i.club,
            memberCount: i.club._count.members,
          },
        };
      }),
    };
  }

  @Post(':id([0-9a-fA-F-]{36})/members/:userId([0-9a-fA-F-]{36})/role')
  async setRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SetMemberRoleDto,
  ) {
    const viewerRole = await this.getMyRole({ clubId: id, userId: user.userId });
    this.requireOwner(viewerRole);

    const target = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new BadRequestException('Member not found');
    if (String(target.role || '').toLowerCase() === 'owner') throw new BadRequestException('Cannot change owner role');

    const next = String(dto.role || '').toLowerCase() === 'admin' ? 'admin' : 'member';
    await this.prisma.clubMember.update({
      where: { clubId_userId: { clubId: id, userId: targetUserId } },
      data: { role: next },
    });

    return { ok: true };
  }

  @Post(':id([0-9a-fA-F-]{36})/members/:userId([0-9a-fA-F-]{36})/remove')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: { userId: string },
  ) {
    const viewerRole = await this.getMyRole({ clubId: id, userId: user.userId });
    this.requireManage(viewerRole);

    const target = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) return { ok: true };
    const tr = String(target.role || '').toLowerCase();
    if (tr === 'owner') throw new BadRequestException('Cannot remove owner');
    if (viewerRole === 'admin' && tr === 'admin') throw new BadRequestException('Admins cannot remove other admins');
    if (targetUserId === user.userId) throw new BadRequestException('Use leave instead');

    await this.prisma.clubMember.delete({ where: { clubId_userId: { clubId: id, userId: targetUserId } } });
    return { ok: true };
  }

  @Post(':id([0-9a-fA-F-]{36})/delete')
  async deleteClub(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: DeleteClubDto,
  ) {
    const viewerRole = await this.getMyRole({ clubId: id, userId: user.userId });
    this.requireOwner(viewerRole);

    const confirm = String(dto?.confirm || '').trim().toUpperCase();
    if (confirm !== 'DELETE') throw new BadRequestException('Type DELETE to confirm');

    await this.prisma.club.delete({ where: { id } });
    return { ok: true };
  }

  @Post('invites/:inviteId([0-9a-fA-F-]{36})/accept')
  async accept(@Param('inviteId') inviteId: string, @CurrentUser() user: { userId: string }) {
    const invite = await this.prisma.clubInvite.findUnique({
      where: { id: inviteId },
      select: { id: true, clubId: true, userId: true, status: true },
    });
    if (!invite || invite.userId !== user.userId || invite.status !== 'pending') throw new BadRequestException('Invite not found');

    await this.prisma.$transaction([
      this.prisma.clubMember.upsert({
        where: { clubId_userId: { clubId: invite.clubId, userId: user.userId } },
        create: { clubId: invite.clubId, userId: user.userId, role: 'member' },
        update: {},
      }),
      this.prisma.clubInvite.update({
        where: { id: inviteId },
        data: { status: 'accepted', respondedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  @Post('invites/:inviteId([0-9a-fA-F-]{36})/decline')
  async decline(@Param('inviteId') inviteId: string, @CurrentUser() user: { userId: string }) {
    const invite = await this.prisma.clubInvite.findUnique({
      where: { id: inviteId },
      select: { id: true, userId: true, status: true },
    });
    if (!invite || invite.userId !== user.userId || invite.status !== 'pending') throw new BadRequestException('Invite not found');

    await this.prisma.clubInvite.update({
      where: { id: inviteId },
      data: { status: 'declined', respondedAt: new Date() },
    });

    return { ok: true };
  }
}
