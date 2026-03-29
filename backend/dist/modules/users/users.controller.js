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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const supabase_optional_guard_1 = require("../../auth/supabase.optional.guard");
const supabase_guard_1 = require("../../auth/supabase.guard");
const supabase_user_1 = require("../../auth/supabase.user");
const prisma_1 = require("../../prisma");
function isUuidV4(value) {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
let UsersController = class UsersController {
    constructor(prisma) {
        this.prisma = prisma;
        this.summaryCache = new Map();
    }
    async getUserSummary(id, req) {
        if (!id)
            throw new common_1.BadRequestException('Missing user id');
        if (!isUuidV4(id))
            throw new common_1.BadRequestException('Invalid user id');
        const viewerId = req?.user?.userId;
        const isSelf = viewerId === id;
        const cacheKey = `${viewerId ?? 'anon'}:${id}`;
        const cached = this.summaryCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt)
            return cached.data;
        const [profile, followersCount, followingCount] = await Promise.all([
            this.prisma.profile.findUnique({
                where: { userId: id },
                select: {
                    userId: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    bio: true,
                    isPrivate: true,
                    onboardingCompletedAt: true,
                },
            }),
            this.prisma.follow.count({ where: { followingId: id } }),
            this.prisma.follow.count({ where: { followerId: id } }),
        ]);
        if (!profile)
            throw new common_1.BadRequestException('User not found');
        if (!isSelf && !profile.onboardingCompletedAt)
            throw new common_1.BadRequestException('User not found');
        let isFollowing = false;
        if (viewerId && !isSelf) {
            const follow = await this.prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: viewerId,
                        followingId: id,
                    },
                },
                select: { followerId: true },
            });
            isFollowing = Boolean(follow);
        }
        const visibilityFilter = [];
        if (isSelf)
            visibilityFilter.push('public', 'followers', 'only_me');
        else if (isFollowing)
            visibilityFilter.push('public', 'followers');
        else if (!profile.isPrivate)
            visibilityFilter.push('public');
        const since4w = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
        const [recentActivities, totalVisibleActivities, last4WeeksCount, sums, recentPhotos] = await Promise.all([
            this.prisma.activity.findMany({
                where: {
                    userId: id,
                    ...(visibilityFilter.length ? { visibility: { in: visibilityFilter } } : { visibility: { in: ['__none__'] } }),
                },
                orderBy: { startedAt: 'desc' },
                take: 2,
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
                    routePolyline: true,
                },
            }),
            this.prisma.activity.count({
                where: {
                    userId: id,
                    ...(visibilityFilter.length ? { visibility: { in: visibilityFilter } } : { visibility: { in: ['__none__'] } }),
                },
            }),
            this.prisma.activity.count({
                where: {
                    userId: id,
                    ...(visibilityFilter.length ? { visibility: { in: visibilityFilter } } : { visibility: { in: ['__none__'] } }),
                    startedAt: { gte: since4w },
                },
            }),
            this.prisma.activity.aggregate({
                where: {
                    userId: id,
                    ...(visibilityFilter.length ? { visibility: { in: visibilityFilter } } : { visibility: { in: ['__none__'] } }),
                },
                _sum: {
                    distanceMeters: true,
                    durationSeconds: true,
                },
            }),
            this.prisma.activityMedia.findMany({
                where: {
                    userId: id,
                    kind: 'photo',
                    publicUrl: { not: null },
                },
                orderBy: { createdAt: 'desc' },
                take: 24,
                select: { publicUrl: true },
            }),
        ]);
        const resp = {
            user: {
                id: profile.userId,
                username: profile.username,
            },
            profile: {
                firstName: profile.firstName,
                lastName: profile.lastName,
                avatarUrl: profile.avatarUrl,
                bio: profile.bio,
            },
            relationship: {
                isSelf,
                isFollowing,
            },
            settings: {
                isPrivate: Boolean(profile.isPrivate),
            },
            stats: {
                followersCount,
                followingCount,
                totalActivities: totalVisibleActivities,
                last4WeeksCount,
                totalDistanceMeters: Number(sums?._sum?.distanceMeters ?? 0),
                totalDurationSeconds: Number(sums?._sum?.durationSeconds ?? 0),
                lastActivityAt: recentActivities?.[0]?.startedAt ?? null,
            },
            recentActivities,
            recentPhotos: recentPhotos.map((p) => p.publicUrl).filter(Boolean),
        };
        this.summaryCache.set(cacheKey, { expiresAt: Date.now() + 5000, data: resp });
        if (this.summaryCache.size > 5000) {
            const firstKey = this.summaryCache.keys().next().value;
            if (typeof firstKey === 'string')
                this.summaryCache.delete(firstKey);
        }
        return resp;
    }
    async followUser(id, user) {
        if (!id)
            throw new common_1.BadRequestException('Missing user id');
        if (!isUuidV4(id))
            throw new common_1.BadRequestException('Invalid user id');
        if (id === user.userId)
            throw new common_1.BadRequestException('Cannot follow yourself');
        const target = await this.prisma.profile.findUnique({ where: { userId: id }, select: { userId: true, onboardingCompletedAt: true } });
        if (!target)
            throw new common_1.BadRequestException('User not found');
        if (!target.onboardingCompletedAt)
            throw new common_1.BadRequestException('User not found');
        await this.prisma.follow.upsert({
            where: {
                followerId_followingId: {
                    followerId: user.userId,
                    followingId: id,
                },
            },
            create: {
                followerId: user.userId,
                followingId: id,
            },
            update: {},
        });
        return { ok: true };
    }
    async unfollowUser(id, user) {
        if (!id)
            throw new common_1.BadRequestException('Missing user id');
        if (!isUuidV4(id))
            throw new common_1.BadRequestException('Invalid user id');
        if (id === user.userId)
            throw new common_1.BadRequestException('Cannot unfollow yourself');
        await this.prisma.follow.deleteMany({
            where: {
                followerId: user.userId,
                followingId: id,
            },
        });
        return { ok: true };
    }
    async getUser(id) {
        if (!id)
            throw new common_1.BadRequestException('Missing user id');
        if (!isUuidV4(id))
            throw new common_1.BadRequestException('Invalid user id');
        const data = await this.prisma.profile.findUnique({
            where: { userId: id },
            select: {
                userId: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                bio: true,
                onboardingCompletedAt: true,
            },
        });
        if (!data)
            throw new common_1.BadRequestException('User not found');
        if (!data.onboardingCompletedAt)
            throw new common_1.BadRequestException('User not found');
        return {
            user: {
                id: data.userId,
                username: data.username,
            },
            profile: {
                firstName: data.firstName,
                lastName: data.lastName,
                avatarUrl: data.avatarUrl,
                bio: data.bio,
            },
        };
    }
    async getUserActivities(id, req) {
        if (!id)
            throw new common_1.BadRequestException('Missing user id');
        if (!isUuidV4(id))
            throw new common_1.BadRequestException('Invalid user id');
        const viewerId = req?.user?.userId;
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
        const p = await this.prisma.profile.findUnique({ where: { userId: id }, select: { isPrivate: true } });
        const isPrivate = Boolean(p?.isPrivate);
        const visibilityFilter = [];
        if (isOwner)
            visibilityFilter.push('public', 'followers', 'only_me');
        else if (includeFollowers)
            visibilityFilter.push('public', 'followers');
        else if (!isPrivate)
            visibilityFilter.push('public');
        const activities = await this.prisma.activity.findMany({
            where: {
                userId: id,
                ...(visibilityFilter.length ? { visibility: { in: visibilityFilter } } : { visibility: { in: ['__none__'] } }),
            },
            orderBy: { startedAt: 'desc' },
        });
        return { activities };
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})/summary'),
    (0, common_1.UseGuards)(supabase_optional_guard_1.OptionalSupabaseAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUserSummary", null);
__decorate([
    (0, common_1.Post)(':id([0-9a-fA-F-]{36})/follow'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "followUser", null);
__decorate([
    (0, common_1.Delete)(':id([0-9a-fA-F-]{36})/follow'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "unfollowUser", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})'),
    (0, common_1.UseGuards)(supabase_optional_guard_1.OptionalSupabaseAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUser", null);
__decorate([
    (0, common_1.Get)(':id([0-9a-fA-F-]{36})/activities'),
    (0, common_1.UseGuards)(supabase_optional_guard_1.OptionalSupabaseAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUserActivities", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [prisma_1.PrismaService])
], UsersController);
//# sourceMappingURL=users.controller.js.map