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
exports.ActivitiesController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const platform_express_1 = require("@nestjs/platform-express");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const supabase_guard_1 = require("../../auth/supabase.guard");
const supabase_optional_guard_1 = require("../../auth/supabase.optional.guard");
const supabase_user_1 = require("../../auth/supabase.user");
const supabase_auth_1 = require("../../auth/supabase.auth");
const activities_dto_1 = require("./activities.dto");
const prisma_1 = require("../../prisma");
const time_1 = require("../../common/time");
let ActivitiesController = class ActivitiesController {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
    }
    async ensureCanViewActivity(params) {
        const { viewerId, activityId } = params;
        const activity = await this.prisma.activity.findUnique({
            where: { id: activityId },
            select: { id: true, userId: true, visibility: true },
        });
        if (!activity)
            throw new common_1.NotFoundException('Activity not found');
        if (activity.userId === viewerId)
            return activity;
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
            if (shared)
                return activity;
        }
        if (activity.visibility === 'only_me')
            throw new common_1.NotFoundException('Activity not found');
        if (activity.visibility === 'followers') {
            if (!viewerId)
                throw new common_1.NotFoundException('Activity not found');
            const follow = await this.prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: viewerId,
                        followingId: activity.userId,
                    },
                },
            });
            if (!follow)
                throw new common_1.NotFoundException('Activity not found');
        }
        // visibility public: allow
        // Account privacy overrides public activities
        if (activity.visibility === 'public') {
            const p = await this.prisma.profile.findUnique({
                where: { userId: activity.userId },
                select: { isPrivate: true },
            });
            if (p?.isPrivate) {
                if (!viewerId)
                    throw new common_1.NotFoundException('Activity not found');
                const follow = await this.prisma.follow.findUnique({
                    where: {
                        followerId_followingId: {
                            followerId: viewerId,
                            followingId: activity.userId,
                        },
                    },
                });
                if (!follow)
                    throw new common_1.NotFoundException('Activity not found');
            }
        }
        return activity;
    }
    async mine(user, q, from, to, minDistanceMeters, maxDistanceMeters, minDurationSeconds, maxDurationSeconds, source, take) {
        const query = String(q || '').trim();
        const src = String(source || 'any').trim().toLowerCase();
        const allowedSource = new Set(['any', 'manual', 'gpx']);
        if (!allowedSource.has(src))
            throw new common_1.BadRequestException('Invalid source');
        const limit = Math.max(1, Math.min(200, Number(take || 50) || 50));
        const fromTs = from ? Date.parse(from) : NaN;
        const toTs = to ? Date.parse(to) : NaN;
        const fromDate = Number.isFinite(fromTs) ? new Date(fromTs) : null;
        const toDate = Number.isFinite(toTs) ? new Date(toTs) : null;
        if (from && !fromDate)
            throw new common_1.BadRequestException('Invalid from');
        if (to && !toDate)
            throw new common_1.BadRequestException('Invalid to');
        const minDist = minDistanceMeters ? Number(minDistanceMeters) : NaN;
        const maxDist = maxDistanceMeters ? Number(maxDistanceMeters) : NaN;
        const minDur = minDurationSeconds ? Number(minDurationSeconds) : NaN;
        const maxDur = maxDurationSeconds ? Number(maxDurationSeconds) : NaN;
        const where = {
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
        const mediaByActivity = new Map();
        for (const m of media) {
            const list = mediaByActivity.get(m.activityId) ?? [];
            list.push({ kind: m.kind, publicUrl: m.publicUrl ?? null });
            mediaByActivity.set(m.activityId, list);
        }
        const items = acts.map((a) => {
            const list = mediaByActivity.get(a.id) ?? [];
            const photos = list.filter((x) => x.kind === 'photo' && x.publicUrl).map((x) => x.publicUrl);
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
    validateStartedAt(d, errMsg) {
        if (Number.isNaN(d.getTime()))
            throw new common_1.BadRequestException(errMsg);
        const now = new Date();
        const year = d.getUTCFullYear();
        const cur = now.getUTCFullYear();
        if (year < 1900 || year > cur)
            throw new common_1.BadRequestException(errMsg);
        if (d.getTime() > now.getTime() + 60_000)
            throw new common_1.BadRequestException('startedAt cannot be in the future');
    }
    async createActivity(user, dto) {
        const title = String(dto.title || '').trim();
        if (!title)
            throw new common_1.BadRequestException('Title is required');
        const reqStart = process.hrtime.bigint();
        const startedAt = new Date(dto.startedAt);
        this.validateStartedAt(startedAt, 'Invalid startedAt');
        let visibility = dto.visibility ?? 'public';
        if (!['public', 'followers', 'only_me'].includes(visibility))
            visibility = 'public';
        // Account privacy overrides activity visibility.
        const p = await this.prisma.profile.findUnique({ where: { userId: user.userId }, select: { isPrivate: true } });
        if (p?.isPrivate && visibility === 'public')
            visibility = 'followers';
        const { ms: createMs, result: activity } = await (0, time_1.time)('prisma.activity.create(manual)', () => this.prisma.activity.create({
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
        }));
        if (dto.clubId) {
            const member = await this.prisma.clubMember.findUnique({
                where: { clubId_userId: { clubId: dto.clubId, userId: user.userId } },
                select: { userId: true },
            });
            if (!member)
                throw new common_1.BadRequestException('You are not a member of that club');
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
        console.log(`[activity.create] create=${createMs.toFixed(1)}ms total=${(0, time_1.msSince)(reqStart).toFixed(1)}ms`);
        return { activity };
    }
    async giveKudos(user, id) {
        const a = await this.ensureCanViewActivity({ viewerId: user.userId, activityId: id });
        if (a.userId === user.userId)
            throw new common_1.BadRequestException('Cannot kudo your own activity');
        try {
            await this.prisma.activityKudo.create({
                data: {
                    activityId: id,
                    userId: user.userId,
                },
            });
        }
        catch {
            // ignore duplicate
        }
        const [kudosCount, commentCount] = await Promise.all([
            this.prisma.activityKudo.count({ where: { activityId: id } }),
            this.prisma.activityComment.count({ where: { activityId: id } }),
        ]);
        return { kudosCount, commentCount, viewerHasKudo: true };
    }
    async listKudos(user, id) {
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
        const byId = new Map(profiles.map((p) => [p.userId, p]));
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
    async removeKudos(user, id) {
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
            .catch(() => { });
        const [kudosCount, commentCount] = await Promise.all([
            this.prisma.activityKudo.count({ where: { activityId: id } }),
            this.prisma.activityComment.count({ where: { activityId: id } }),
        ]);
        return { kudosCount, commentCount, viewerHasKudo: false };
    }
    async listComments(user, id) {
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
        const byId = new Map(profiles.map((p) => [p.userId, p]));
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
    async addComment(user, id, body) {
        const a = await this.ensureCanViewActivity({ viewerId: user.userId, activityId: id });
        const text = String(body?.body ?? '').trim();
        if (!text)
            throw new common_1.BadRequestException('Comment is empty');
        if (text.length > 500)
            throw new common_1.BadRequestException('Comment too long');
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
    async getActivity(id, req, includeRoute) {
        const reqStart = process.hrtime.bigint();
        const wantRoute = includeRoute === '1' || includeRoute === 'true';
        const { ms: findMs, result: activity } = await (0, time_1.time)('prisma.activity.findUnique', () => this.prisma.activity.findUnique({
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
        }));
        if (!activity)
            throw new common_1.NotFoundException('Activity not found');
        if (activity.visibility === 'public') {
            // Account privacy overrides activity visibility.
            const viewerId = req?.user?.userId;
            if (activity.userId !== viewerId) {
                const p = await this.prisma.profile.findUnique({ where: { userId: activity.userId }, select: { isPrivate: true } });
                if (p?.isPrivate) {
                    if (!viewerId)
                        throw new common_1.NotFoundException('Activity not found');
                    const follow = await this.prisma.follow.findUnique({
                        where: {
                            followerId_followingId: {
                                followerId: viewerId,
                                followingId: activity.userId,
                            },
                        },
                        select: { followerId: true },
                    });
                    if (!follow)
                        throw new common_1.NotFoundException('Activity not found');
                }
            }
            // eslint-disable-next-line no-console
            console.log(`[activity.get] find=${findMs.toFixed(1)}ms total=${(0, time_1.msSince)(reqStart).toFixed(1)}ms route=${wantRoute ? '1' : '0'}`);
            return { activity };
        }
        const viewerId = req?.user?.userId;
        if (!viewerId)
            throw new common_1.NotFoundException('Activity not found');
        if (viewerId === activity.userId)
            return { activity };
        if (activity.visibility === 'followers') {
            const follow = await this.prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: viewerId,
                        followingId: activity.userId,
                    },
                },
            });
            if (follow)
                return { activity };
        }
        throw new common_1.NotFoundException('Activity not found');
    }
    async deleteActivity(id, user) {
        const activity = await this.prisma.activity.findUnique({ where: { id } });
        if (!activity)
            throw new common_1.NotFoundException('Activity not found');
        if (activity.userId !== user.userId)
            throw new common_1.ForbiddenException('Not allowed');
        await this.prisma.activity.delete({ where: { id } });
        return { message: 'Deleted' };
    }
    async uploadActivityPhoto(activityId, user, file) {
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
        if (!activity)
            throw new common_1.NotFoundException('Activity not found');
        if (activity.userId !== user.userId)
            throw new common_1.ForbiddenException('Not allowed');
        const allowed = new Set([
            'image/jpeg',
            'image/png',
            'image/webp',
        ]);
        if (!allowed.has(file.mimetype))
            throw new common_1.BadRequestException(`Unsupported image type: ${file.mimetype}`);
        const service = (0, supabase_auth_1.getSupabaseAdminClient)();
        const bucket = this.config.get('SUPABASE_ACTIVITY_MEDIA_BUCKET') ?? 'activity-media';
        const ext = node_path_1.default.extname(file.originalname || '').toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : '';
        const objectPath = `${user.userId}/${activityId}/${(0, node_crypto_1.randomUUID)()}${safeExt}`;
        const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });
        if (uploadError)
            throw new common_1.BadRequestException(uploadError.message);
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
    async importGpx(user, file, body, req) {
        const reqStart = process.hrtime.bigint();
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        if (!file.originalname.toLowerCase().endsWith('.gpx') && file.mimetype !== 'application/gpx+xml' && file.mimetype !== 'application/xml' && file.mimetype !== 'text/xml') {
            throw new common_1.BadRequestException('File must be .gpx');
        }
        const service = (0, supabase_auth_1.getSupabaseAdminClient)();
        const gpxBucket = this.config.get('SUPABASE_GPX_BUCKET') ?? 'gpx';
        const ext = node_path_1.default.extname(file.originalname || '').toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : '.gpx';
        const gpxPath = `${user.userId}/${(0, node_crypto_1.randomUUID)()}${safeExt}`;
        const { ms: uploadMs, result: uploadRes } = await (0, time_1.time)('storage.upload(gpx)', () => service.storage.from(gpxBucket).upload(gpxPath, file.buffer, {
            contentType: file.mimetype || 'application/gpx+xml',
            upsert: false,
        }));
        const { error: uploadError } = uploadRes;
        if (uploadError)
            throw new common_1.BadRequestException(uploadError.message);
        // Invoke Edge Function if configured.
        const functionName = this.config.get('SUPABASE_IMPORT_GPX_FUNCTION') ?? 'import-gpx';
        const accessToken = req?.supabaseAuth?.accessToken;
        if (!accessToken)
            throw new common_1.BadRequestException('Missing access token');
        const sport = typeof body?.sport === 'string' ? body.sport : undefined;
        const title = typeof body?.title === 'string' ? String(body.title).trim() : '';
        const description = typeof body?.description === 'string' ? body.description : undefined;
        const visibility = typeof body?.visibility === 'string' ? body.visibility : undefined;
        const clubId = typeof body?.clubId === 'string' ? body.clubId : undefined;
        const allowedVisibility = new Set(['public', 'followers', 'only_me']);
        const allowedSport = new Set(['run', 'walk', 'ride']);
        if (visibility && !allowedVisibility.has(visibility))
            throw new common_1.BadRequestException('Invalid visibility');
        if (sport && !allowedSport.has(sport))
            throw new common_1.BadRequestException('Invalid sport');
        if (!title)
            throw new common_1.BadRequestException('Title is required');
        const { ms: invokeMs, result: invokeRes } = await (0, time_1.time)('functions.invoke(import-gpx)', () => service.functions.invoke(functionName, {
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
        }));
        const { data, error } = invokeRes;
        if (error)
            throw new common_1.BadRequestException(error.message);
        const parsed = data;
        const startedAt = new Date(parsed.startedAt);
        this.validateStartedAt(startedAt, 'Invalid startedAt from parser');
        let finalVisibility = visibility ?? 'public';
        const p = await this.prisma.profile.findUnique({ where: { userId: user.userId }, select: { isPrivate: true } });
        if (p?.isPrivate && finalVisibility === 'public')
            finalVisibility = 'followers';
        const { ms: createMs, result: activity } = await (0, time_1.time)('prisma.activity.create(gpx)', () => this.prisma.activity.create({
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
        }));
        if (clubId) {
            const member = await this.prisma.clubMember.findUnique({
                where: { clubId_userId: { clubId, userId: user.userId } },
                select: { userId: true },
            });
            if (!member)
                throw new common_1.BadRequestException('You are not a member of that club');
            await this.prisma.clubPost.create({
                data: {
                    clubId,
                    userId: user.userId,
                    activityId: activity.id,
                    body: null,
                },
            });
        }
        const { ms: mediaMs } = await (0, time_1.time)('prisma.activityMedia.create(gpx)', () => this.prisma.activityMedia.create({
            data: {
                activityId: activity.id,
                userId: user.userId,
                kind: 'gpx',
                storageBucket: gpxBucket,
                storagePath: gpxPath,
            },
        }));
        // eslint-disable-next-line no-console
        console.log(`[gpx] size=${file.size}B upload=${uploadMs.toFixed(1)}ms invoke=${invokeMs.toFixed(1)}ms create=${createMs.toFixed(1)}ms media=${mediaMs.toFixed(1)}ms total=${(0, time_1.msSince)(reqStart).toFixed(1)}ms polylineLen=${(parsed.polyline || '').length}`);
        return { activity };
    }
};
exports.ActivitiesController = ActivitiesController;
__decorate([
    (0, common_1.Get)('mine'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __param(4, (0, common_1.Query)('minDistanceMeters')),
    __param(5, (0, common_1.Query)('maxDistanceMeters')),
    __param(6, (0, common_1.Query)('minDurationSeconds')),
    __param(7, (0, common_1.Query)('maxDurationSeconds')),
    __param(8, (0, common_1.Query)('source')),
    __param(9, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "mine", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, activities_dto_1.CreateActivityDto]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "createActivity", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/kudos'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "giveKudos", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})/kudos'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "listKudos", null);
__decorate([
    (0, common_1.Delete)(':id([0-9a-fA-F-]{36})/kudos'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "removeKudos", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})/comments'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "listComments", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/comments'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "addComment", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})'),
    (0, common_1.UseGuards)(supabase_optional_guard_1.OptionalSupabaseAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Query)('includeRoute')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "getActivity", null);
__decorate([
    (0, common_1.Delete)(':id([0-9a-fA-F-]{36})'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "deleteActivity", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/media'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 25 * 1024 * 1024 } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "uploadActivityPhoto", null);
__decorate([
    (0, common_1.Post)('import/gpx'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 20 * 1024 * 1024 } })),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "importGpx", null);
exports.ActivitiesController = ActivitiesController = __decorate([
    (0, common_1.Controller)('activities'),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_1.PrismaService])
], ActivitiesController);
//# sourceMappingURL=activities.controller.js.map