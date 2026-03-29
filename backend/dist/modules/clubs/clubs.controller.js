"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClubsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const config_1 = require("@nestjs/config");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const prisma_1 = require("../../prisma");
const supabase_guard_1 = require("../../auth/supabase.guard");
const supabase_user_1 = require("../../auth/supabase.user");
const supabase_auth_1 = require("../../auth/supabase.auth");
const clubs_dto_1 = require("./clubs.dto");
function clubNameOrThrow(name) {
    const s = String(name || '').trim();
    if (!s)
        throw new common_1.BadRequestException('Club name is required');
    if (s.length > 120)
        throw new common_1.BadRequestException('Club name is too long');
    return s;
}
let ClubsController = class ClubsController {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async uploadClubImage(params) {
        const { clubId, kind, file } = params;
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        if (!String(file.mimetype || '').startsWith('image/'))
            throw new common_1.BadRequestException('File must be an image');
        const service = (0, supabase_auth_1.getSupabaseAdminClient)();
        // Use an existing bucket by default to avoid local setup footguns.
        const bucket = this.config.get('SUPABASE_CLUB_MEDIA_BUCKET') ?? (this.config.get('SUPABASE_ACTIVITY_MEDIA_BUCKET') ?? 'activity-media');
        const ext = node_path_1.default.extname(file.originalname || '').toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : '';
        const objectPath = `${clubId}/${kind}/${(0, node_crypto_1.randomUUID)()}${safeExt}`;
        const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });
        if (uploadError)
            throw new common_1.BadRequestException(uploadError.message);
        const { data: publicData } = service.storage.from(bucket).getPublicUrl(objectPath);
        return publicData.publicUrl;
    }
    async uploadClubPostImage(params) {
        const { clubId, postId, file } = params;
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        if (!String(file.mimetype || '').startsWith('image/'))
            throw new common_1.BadRequestException('File must be an image');
        const service = (0, supabase_auth_1.getSupabaseAdminClient)();
        const bucket = this.config.get('SUPABASE_CLUB_MEDIA_BUCKET') ??
            (this.config.get('SUPABASE_ACTIVITY_MEDIA_BUCKET') ?? 'activity-media');
        const ext = node_path_1.default.extname(file.originalname || '').toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : '';
        const objectPath = `${clubId}/posts/${postId}/${(0, node_crypto_1.randomUUID)()}${safeExt}`;
        const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });
        if (uploadError)
            throw new common_1.BadRequestException(uploadError.message);
        const { data: publicData } = service.storage.from(bucket).getPublicUrl(objectPath);
        return publicData.publicUrl;
    }
    async requireMember(params) {
        const { clubId, userId } = params;
        const m = await this.prisma.clubMember.findUnique({
            where: { clubId_userId: { clubId, userId } },
            select: { userId: true },
        });
        if (!m)
            throw new common_1.ForbiddenException('Not a club member');
    }
    async getMyRole(params) {
        const m = await this.prisma.clubMember.findUnique({
            where: { clubId_userId: { clubId: params.clubId, userId: params.userId } },
            select: { role: true },
        });
        if (!m)
            throw new common_1.ForbiddenException('Not a club member');
        const r = String(m.role || '').toLowerCase();
        if (r === 'owner' || r === 'admin')
            return r;
        return 'member';
    }
    requireOwner(role) {
        if (role !== 'owner')
            throw new common_1.ForbiddenException('Owner only');
    }
    requireManage(role) {
        if (role !== 'owner' && role !== 'admin')
            throw new common_1.ForbiddenException('Admins only');
    }
    mapClubSportToActivitySports(clubSport) {
        const s = String(clubSport || '').toLowerCase();
        if (s === 'cycle')
            return ['ride'];
        if (s === 'hike')
            return ['walk'];
        if (s === 'run')
            return ['run'];
        if (s === 'walk')
            return ['walk'];
        return ['run', 'walk', 'ride'];
    }
    async create(user, files, dto) {
        const name = clubNameOrThrow(dto.name);
        const location = String(dto.location || '').trim();
        const description = String(dto.description || '').trim();
        const sport = String(dto.sport || '').toLowerCase();
        const allowedSport = new Set(['run', 'walk', 'hike', 'cycle']);
        if (!allowedSport.has(sport))
            throw new common_1.BadRequestException('Invalid sport');
        if (!location)
            throw new common_1.BadRequestException('Location is required');
        if (!description)
            throw new common_1.BadRequestException('Description is required');
        const avatarFile = files?.avatar?.[0];
        const bannerFile = files?.banner?.[0];
        if (!avatarFile)
            throw new common_1.BadRequestException('Club avatar is required');
        if (!bannerFile)
            throw new common_1.BadRequestException('Club banner is required');
        const clubId = (0, node_crypto_1.randomUUID)();
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
    async updateClub(id, user, files, dto) {
        const role = await this.getMyRole({ clubId: id, userId: user.userId });
        this.requireManage(role);
        const club = await this.prisma.club.findUnique({ where: { id }, select: { id: true, ownerId: true } });
        if (!club)
            throw new common_1.BadRequestException('Club not found');
        const avatarFile = files?.avatar?.[0];
        const bannerFile = files?.banner?.[0];
        const update = {};
        if (typeof dto.name === 'string')
            update.name = clubNameOrThrow(dto.name);
        if (typeof dto.location === 'string') {
            const s = String(dto.location).trim();
            if (!s)
                throw new common_1.BadRequestException('Location is required');
            update.location = s;
        }
        if (typeof dto.description === 'string') {
            const s = String(dto.description).trim();
            if (!s)
                throw new common_1.BadRequestException('Description is required');
            update.description = s;
        }
        if (typeof dto.sport === 'string') {
            const s = String(dto.sport).toLowerCase();
            const allowedSport = new Set(['run', 'walk', 'hike', 'cycle']);
            if (!allowedSport.has(s))
                throw new common_1.BadRequestException('Invalid sport');
            update.sport = s;
        }
        if (typeof dto.isInviteOnly === 'boolean') {
            if (role !== 'owner')
                throw new common_1.ForbiddenException('Only the owner can change access');
            update.isInviteOnly = dto.isInviteOnly;
        }
        if (avatarFile)
            update.avatarUrl = await this.uploadClubImage({ clubId: id, kind: 'avatar', file: avatarFile });
        if (bannerFile)
            update.bannerUrl = await this.uploadClubImage({ clubId: id, kind: 'banner', file: bannerFile });
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
    async mine(user) {
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
    async discover(user, take, q, seed) {
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
            if (b.memberCount !== a.memberCount)
                return b.memberCount - a.memberCount;
            return rnd() < 0.5 ? -1 : 1;
        });
        return {
            clubs: list.slice(0, limit),
        };
    }
    async get(id, user) {
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
        if (!club)
            throw new common_1.BadRequestException('Club not found');
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
    async members(id, user) {
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
        const byId = new Map(profiles.map((p) => [p.userId, p]));
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
    async leaderboard(id, user, days) {
        await this.requireMember({ clubId: id, userId: user.userId });
        const n = Number(days || 28);
        const windowDays = Number.isFinite(n) ? Math.max(1, Math.min(365, Math.floor(n))) : 28;
        const club = await this.prisma.club.findUnique({ where: { id }, select: { sport: true } });
        if (!club)
            throw new common_1.BadRequestException('Club not found');
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
        const ids = rows.map((r) => r.userId);
        const profiles = ids.length
            ? await this.prisma.profile.findMany({
                where: { userId: { in: ids } },
                select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
            })
            : [];
        const byId = new Map(profiles.map((p) => [p.userId, p]));
        const items = rows
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
    async feed(id, user, take) {
        await this.requireMember({ clubId: id, userId: user.userId });
        const n = Number(take || 20);
        const limit = Number.isFinite(n) ? Math.max(1, Math.min(50, Math.floor(n))) : 20;
        const club = await this.prisma.club.findUnique({ where: { id }, select: { sport: true } });
        if (!club)
            throw new common_1.BadRequestException('Club not found');
        const sports = this.mapClubSportToActivitySports(club.sport);
        const members = await this.prisma.clubMember.findMany({ where: { clubId: id }, select: { userId: true } });
        const memberIds = members.map((m) => m.userId);
        if (!memberIds.length)
            return { items: [] };
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
        const actorById = new Map(actors.map((a) => [a.userId, a]));
        const followingSet = new Set(follows.map((f) => f.followingId));
        const activities = seedActivities
            .filter((a) => {
            if (a.userId === user.userId)
                return true;
            const p = actorById.get(a.userId);
            const isPrivate = Boolean(p?.isPrivate);
            const followsAuthor = followingSet.has(a.userId);
            if (a.visibility === 'followers')
                return followsAuthor;
            if (a.visibility === 'public')
                return !isPrivate || followsAuthor;
            return false;
        })
            .slice(0, limit);
        const activityIds = activities.map((a) => a.id);
        const [media, kudosCounts, commentCounts, myKudos] = await Promise.all([
            activityIds.length
                ? this.prisma.activityMedia.findMany({
                    where: { activityId: { in: activityIds } },
                    orderBy: { createdAt: 'desc' },
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
        const mediaByActivity = new Map();
        for (const m of media) {
            if (!m.publicUrl)
                continue;
            if (!mediaByActivity.has(m.activityId))
                mediaByActivity.set(m.activityId, m.publicUrl);
        }
        const kudosByActivity = new Map();
        for (const r of kudosCounts) {
            kudosByActivity.set(r.activityId, Number(r._count?._all ?? 0));
        }
        const commentsByActivity = new Map();
        for (const r of commentCounts) {
            commentsByActivity.set(r.activityId, Number(r._count?._all ?? 0));
        }
        const myKudosSet = new Set(myKudos.map((k) => k.activityId));
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
                    imageUrl: mediaByActivity.get(a.id) ?? null,
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
    async listPosts(id, user, take) {
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
        const activityIds = Array.from(new Set(posts.map((p) => p.activityId).filter(Boolean)));
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
        const profById = new Map(profiles.map((p) => [p.userId, p]));
        const actById = new Map(activities.map((a) => [a.id, a]));
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
    async createPost(id, user, files, dto) {
        await this.requireMember({ clubId: id, userId: user.userId });
        const body = typeof dto?.body === 'string' ? dto.body.trim() : '';
        const images = (files?.images || []).filter(Boolean);
        if (!body && !images.length)
            throw new common_1.BadRequestException('Post is empty');
        const post = await this.prisma.clubPost.create({
            data: {
                clubId: id,
                userId: user.userId,
                body: body || null,
            },
        });
        if (images.length) {
            const urls = await Promise.all(images.map((file) => this.uploadClubPostImage({ clubId: id, postId: post.id, file })));
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
    async join(id, user) {
        const club = await this.prisma.club.findUnique({ where: { id }, select: { id: true, isInviteOnly: true } });
        if (!club)
            throw new common_1.BadRequestException('Club not found');
        if (club.isInviteOnly)
            throw new common_1.BadRequestException('This club is invite-only');
        await this.prisma.clubMember.upsert({
            where: { clubId_userId: { clubId: id, userId: user.userId } },
            create: { clubId: id, userId: user.userId, role: 'member' },
            update: {},
        });
        return { ok: true };
    }
    async leave(id, user) {
        const m = await this.prisma.clubMember.findUnique({
            where: { clubId_userId: { clubId: id, userId: user.userId } },
            select: { role: true },
        });
        if (!m)
            return { ok: true };
        if (m.role === 'owner')
            throw new common_1.BadRequestException('Owner cannot leave the club');
        await this.prisma.clubMember.delete({ where: { clubId_userId: { clubId: id, userId: user.userId } } });
        return { ok: true };
    }
    async invite(id, user, dto) {
        const role = await this.getMyRole({ clubId: id, userId: user.userId });
        this.requireManage(role);
        const club = await this.prisma.club.findUnique({ where: { id }, select: { id: true, ownerId: true } });
        if (!club)
            throw new common_1.BadRequestException('Club not found');
        if (role !== 'owner' && role !== 'admin')
            throw new common_1.BadRequestException('Only the owner can invite');
        const targetId = String(dto.userId || '').trim();
        if (!targetId)
            throw new common_1.BadRequestException('Missing userId');
        if (targetId === user.userId)
            throw new common_1.BadRequestException('You cannot invite yourself');
        const target = await this.prisma.profile.findUnique({
            where: { userId: targetId },
            select: { userId: true },
        });
        if (!target)
            throw new common_1.BadRequestException('User not found');
        const existingMember = await this.prisma.clubMember.findUnique({
            where: { clubId_userId: { clubId: id, userId: targetId } },
            select: { userId: true },
        });
        if (existingMember)
            throw new common_1.BadRequestException('User is already a member');
        const pending = await this.prisma.clubInvite.findFirst({
            where: { clubId: id, userId: targetId, status: 'pending' },
            select: { id: true },
        });
        if (pending)
            return { ok: true };
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
    async myInvites(user) {
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
        const byId = new Map(inviters.map((p) => [p.userId, p]));
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
    async setRole(id, targetUserId, user, dto) {
        const viewerRole = await this.getMyRole({ clubId: id, userId: user.userId });
        this.requireOwner(viewerRole);
        const target = await this.prisma.clubMember.findUnique({
            where: { clubId_userId: { clubId: id, userId: targetUserId } },
            select: { role: true },
        });
        if (!target)
            throw new common_1.BadRequestException('Member not found');
        if (String(target.role || '').toLowerCase() === 'owner')
            throw new common_1.BadRequestException('Cannot change owner role');
        const next = String(dto.role || '').toLowerCase() === 'admin' ? 'admin' : 'member';
        await this.prisma.clubMember.update({
            where: { clubId_userId: { clubId: id, userId: targetUserId } },
            data: { role: next },
        });
        return { ok: true };
    }
    async removeMember(id, targetUserId, user) {
        const viewerRole = await this.getMyRole({ clubId: id, userId: user.userId });
        this.requireManage(viewerRole);
        const target = await this.prisma.clubMember.findUnique({
            where: { clubId_userId: { clubId: id, userId: targetUserId } },
            select: { role: true },
        });
        if (!target)
            return { ok: true };
        const tr = String(target.role || '').toLowerCase();
        if (tr === 'owner')
            throw new common_1.BadRequestException('Cannot remove owner');
        if (viewerRole === 'admin' && tr === 'admin')
            throw new common_1.BadRequestException('Admins cannot remove other admins');
        if (targetUserId === user.userId)
            throw new common_1.BadRequestException('Use leave instead');
        await this.prisma.clubMember.delete({ where: { clubId_userId: { clubId: id, userId: targetUserId } } });
        return { ok: true };
    }
    async deleteClub(id, user, dto) {
        const viewerRole = await this.getMyRole({ clubId: id, userId: user.userId });
        this.requireOwner(viewerRole);
        const confirm = String(dto?.confirm || '').trim().toUpperCase();
        if (confirm !== 'DELETE')
            throw new common_1.BadRequestException('Type DELETE to confirm');
        await this.prisma.club.delete({ where: { id } });
        return { ok: true };
    }
    async accept(inviteId, user) {
        const invite = await this.prisma.clubInvite.findUnique({
            where: { id: inviteId },
            select: { id: true, clubId: true, userId: true, status: true },
        });
        if (!invite || invite.userId !== user.userId || invite.status !== 'pending')
            throw new common_1.BadRequestException('Invite not found');
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
    async decline(inviteId, user) {
        const invite = await this.prisma.clubInvite.findUnique({
            where: { id: inviteId },
            select: { id: true, userId: true, status: true },
        });
        if (!invite || invite.userId !== user.userId || invite.status !== 'pending')
            throw new common_1.BadRequestException('Invite not found');
        await this.prisma.clubInvite.update({
            where: { id: inviteId },
            data: { status: 'declined', respondedAt: new Date() },
        });
        return { ok: true };
    }
};
exports.ClubsController = ClubsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
    ], { limits: { fileSize: 6 * 1024 * 1024 } })),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, clubs_dto_1.CreateClubDto]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/update'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
    ], { limits: { fileSize: 6 * 1024 * 1024 } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, clubs_dto_1.UpdateClubDto]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "updateClub", null);
__decorate([
    (0, common_1.Get)('mine'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "mine", null);
__decorate([
    (0, common_1.Get)('discover'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('take')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('seed')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "discover", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})/members'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "members", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})/leaderboard'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "leaderboard", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})/feed'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "feed", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})/posts'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "listPosts", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/posts'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([{ name: 'images', maxCount: 6 }], {
        limits: { fileSize: 6 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, clubs_dto_1.CreateClubPostDto]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "createPost", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/join'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "join", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/leave'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "leave", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/invites'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, clubs_dto_1.InviteUserDto]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "invite", null);
__decorate([
    (0, common_1.Get)('invites'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "myInvites", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/members/:userId([0-9a-fA-F-]{36})/role'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, supabase_user_1.CurrentUser)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, clubs_dto_1.SetMemberRoleDto]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "setRole", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/members/:userId([0-9a-fA-F-]{36})/remove'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "removeMember", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, clubs_dto_1.DeleteClubDto]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "deleteClub", null);
__decorate([
    (0, common_1.Post)('invites/:inviteId([0-9a-fA-F-]{36})/accept'),
    __param(0, (0, common_1.Param)('inviteId')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "accept", null);
__decorate([
    (0, common_1.Post)('invites/:inviteId([0-9a-fA-F-]{36})/decline'),
    __param(0, (0, common_1.Param)('inviteId')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClubsController.prototype, "decline", null);
exports.ClubsController = ClubsController = __decorate([
    (0, common_1.Controller)('clubs'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __metadata("design:paramtypes", [prisma_1.PrismaService,
        config_1.ConfigService])
], ClubsController);
//# sourceMappingURL=clubs.controller.js.map