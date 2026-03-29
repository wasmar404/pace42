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
exports.HomeController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../auth/supabase.guard");
const supabase_user_1 = require("../../auth/supabase.user");
const prisma_1 = require("../../prisma");
function displayName(p) {
    const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();
    return name || (p?.username ? `@${p.username}` : 'Athlete');
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
let HomeController = class HomeController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async feed(user, take) {
        const n = Number(take ?? 20);
        if (!Number.isFinite(n))
            throw new common_1.BadRequestException('Invalid take');
        const limit = clamp(Math.floor(n), 1, 50);
        const following = await this.prisma.follow.findMany({
            where: { followerId: user.userId },
            select: { followingId: true },
        });
        const followingIds = following.map((f) => f.followingId);
        const hasFollowing = followingIds.length > 0;
        // Over-fetch a bit for explore so we can filter out private accounts.
        const seedActivities = await this.prisma.activity.findMany({
            where: hasFollowing
                ? {
                    userId: { in: followingIds },
                    visibility: { in: ['public', 'followers'] },
                }
                : {
                    visibility: 'public',
                    userId: { not: user.userId },
                },
            orderBy: { startedAt: 'desc' },
            take: hasFollowing ? limit : Math.min(150, limit * 3),
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
                createdAt: true,
            },
        });
        const seedActorIds = Array.from(new Set(seedActivities.map((a) => a.userId)));
        const actors = seedActorIds.length
            ? await this.prisma.profile.findMany({
                where: { userId: { in: seedActorIds } },
                select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true, isPrivate: true },
            })
            : [];
        const actorById = new Map(actors.map((a) => [a.userId, a]));
        const activities = hasFollowing
            ? seedActivities.slice(0, limit)
            : seedActivities
                .filter((a) => {
                const p = actorById.get(a.userId);
                return p ? !p.isPrivate : false;
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
        const items = [];
        // Include a single announcement item sometimes so the feed supports multiple entry types.
        if (!hasFollowing) {
            items.push({
                type: 'announcement',
                id: 'a-welcome',
                club: { name: 'Pace42 Club', icon: '🏁' },
                title: 'Welcome to your feed',
                body: 'Follow a few athletes to see their workouts here. Until then, we show public activities to explore.',
                createdAt: new Date().toISOString(),
            });
        }
        for (const a of activities) {
            const p = actorById.get(a.userId);
            items.push({
                type: 'activity',
                id: a.id,
                createdAt: a.startedAt.toISOString(),
                athlete: {
                    id: a.userId,
                    username: p?.username ?? null,
                    name: displayName(p),
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
            });
        }
        return {
            source: hasFollowing ? 'following' : 'explore',
            items,
        };
    }
    async recommendedUsers(user, take) {
        const n = Number(take ?? 6);
        if (!Number.isFinite(n))
            throw new common_1.BadRequestException('Invalid take');
        const limit = clamp(Math.floor(n), 1, 20);
        const following = await this.prisma.follow.findMany({
            where: { followerId: user.userId },
            select: { followingId: true },
        });
        const followingIds = new Set(following.map((f) => f.followingId));
        const profiles = await this.prisma.profile.findMany({
            where: {
                userId: {
                    not: user.userId,
                },
                onboardingCompletedAt: { not: null },
                firstName: { not: null },
                lastName: { not: null },
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
            select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
        });
        const items = [];
        for (const p of profiles) {
            if (followingIds.has(p.userId))
                continue;
            items.push({
                id: p.userId,
                username: p.username,
                name: displayName(p),
                avatarUrl: p.avatarUrl ?? null,
                isFollowing: false,
            });
            if (items.length >= limit)
                break;
        }
        return { items };
    }
    async goals(user, days, goalKm) {
        const d = Number(days ?? 7);
        if (!Number.isFinite(d) || d <= 0)
            throw new common_1.BadRequestException('Invalid days');
        const windowDays = clamp(Math.floor(d), 1, 31);
        const p = await this.prisma.profile.findUnique({ where: { userId: user.userId }, select: { weeklyGoalDistanceMeters: true } });
        let goalDistanceMeters = null;
        if (typeof p?.weeklyGoalDistanceMeters === 'number' && p.weeklyGoalDistanceMeters > 0) {
            goalDistanceMeters = Math.max(1000, Math.round(p.weeklyGoalDistanceMeters));
        }
        else if (goalKm != null && String(goalKm).trim()) {
            const goal = Number(goalKm);
            if (!Number.isFinite(goal) || goal <= 0)
                throw new common_1.BadRequestException('Invalid goalKm');
            goalDistanceMeters = Math.max(1000, Math.round(goal * 1000));
        }
        const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
        const rows = await this.prisma.activity.findMany({
            where: {
                userId: user.userId,
                startedAt: { gte: since },
            },
            select: { distanceMeters: true },
        });
        const distanceMeters = rows.reduce((sum, r) => sum + (Number(r.distanceMeters) || 0), 0);
        return {
            windowDays,
            goalDistanceMeters,
            distanceMeters,
        };
    }
};
exports.HomeController = HomeController;
__decorate([
    (0, common_1.Get)('feed'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], HomeController.prototype, "feed", null);
__decorate([
    (0, common_1.Get)('recommended-users'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], HomeController.prototype, "recommendedUsers", null);
__decorate([
    (0, common_1.Get)('goals'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('days')),
    __param(2, (0, common_1.Query)('goalKm')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], HomeController.prototype, "goals", null);
exports.HomeController = HomeController = __decorate([
    (0, common_1.Controller)('home'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __metadata("design:paramtypes", [prisma_1.PrismaService])
], HomeController);
//# sourceMappingURL=home.controller.js.map