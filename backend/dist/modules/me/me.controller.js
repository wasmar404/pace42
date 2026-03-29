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
exports.MeController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
const prisma_1 = require("../../prisma");
const supabase_guard_1 = require("../../auth/supabase.guard");
const supabase_user_1 = require("../../auth/supabase.user");
const me_dto_1 = require("../../me/me.dto");
const supabase_auth_1 = require("../../auth/supabase.auth");
const ACTIVITY_BASE_SELECT = {
    id: true,
    sport: true,
    title: true,
    description: true,
    startedAt: true,
    durationSeconds: true,
    distanceMeters: true,
    visibility: true,
    source: true,
    routePolyline: true,
};
const ACTIVITY_LIST_SELECT = {
    ...ACTIVITY_BASE_SELECT,
    mapImageUrl: true,
    createdAt: true,
};
let MeController = class MeController {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async requireProfile(userId) {
        const profile = await this.prisma.profile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Profile not found. Complete onboarding first.');
        return profile;
    }
    getActivities(userId, opts = {}) {
        return this.prisma.activity.findMany({
            where: { userId },
            orderBy: { startedAt: 'desc' },
            ...(opts.take ? { take: opts.take } : {}),
            select: opts.select ?? ACTIVITY_BASE_SELECT,
        });
    }
    countActivities(userId, since) {
        return this.prisma.activity.count({
            where: { userId, ...(since ? { startedAt: { gte: since } } : {}) },
        });
    }
    getFollowerCount(userId) {
        return this.prisma.follow.count({ where: { followingId: userId } });
    }
    getFollowingCount(userId) {
        return this.prisma.follow.count({ where: { followerId: userId } });
    }
    supabaseAdminClient() {
        try {
            return (0, supabase_auth_1.getSupabaseAdminClient)();
        }
        catch {
            throw new common_1.BadRequestException('Server missing SUPABASE_SERVICE_ROLE_KEY');
        }
    }
    async getMe(user) {
        if (!user)
            throw new common_1.BadRequestException('Missing user');
        const profile = await this.requireProfile(user.userId);
        return {
            user: {
                id: user.userId,
                email: user.email ?? null,
            },
            profile: profile ?? null,
        };
    }
    async getMySummary(user) {
        const profile = await this.requireProfile(user.userId);
        const since4w = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
        const [recentActivities, last4WeeksCount, totalActivities, recentPhotos, followersCount, followingCount] = await Promise.all([
            this.getActivities(user.userId, { take: 2 }),
            this.countActivities(user.userId, since4w),
            this.countActivities(user.userId),
            this.prisma.activityMedia.findMany({
                where: {
                    userId: user.userId,
                    kind: 'photo',
                    publicUrl: { not: null },
                },
                orderBy: { createdAt: 'desc' },
                take: 3,
                select: { publicUrl: true },
            }),
            this.getFollowerCount(user.userId),
            this.getFollowingCount(user.userId),
        ]);
        const resp = {
            user: {
                id: user.userId,
                email: user.email ?? null,
            },
            profile: profile ?? null,
            stats: {
                last4WeeksCount,
                totalActivities,
                followersCount,
                followingCount,
            },
            recentActivities,
            recentPhotos: recentPhotos.map((p) => p.publicUrl).filter(Boolean),
            settings: {
                isPrivate: Boolean(profile?.isPrivate ?? false),
            },
        };
        return resp;
    }
    async updateMe(user, dto) {
        const existing = await this.prisma.profile.findUnique({
            where: { userId: user.userId },
            select: { onboardingCompletedAt: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Profile not found. Complete onboarding first.');
        const hasPersonalPayload = dto.firstName !== undefined ||
            dto.lastName !== undefined ||
            dto.dateOfBirth !== undefined ||
            dto.gender !== undefined ||
            dto.bio !== undefined;
        const onboardingCompletedAt = dto.onboardingCompletedAt
            ? new Date(dto.onboardingCompletedAt)
            : (!existing?.onboardingCompletedAt && hasPersonalPayload ? new Date() : undefined);
        const weeklyGoalDistanceMeters = typeof dto.weeklyGoalDistanceMeters === 'number'
            ? dto.weeklyGoalDistanceMeters > 0
                ? Math.round(dto.weeklyGoalDistanceMeters)
                : null
            : undefined;
        const profile = await this.prisma.profile.update({
            where: { userId: user.userId },
            data: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                gender: dto.gender,
                bio: dto.bio,
                ...(typeof dto.isPrivate === 'boolean' ? { isPrivate: dto.isPrivate } : {}),
                ...(onboardingCompletedAt ? { onboardingCompletedAt } : {}),
                ...(weeklyGoalDistanceMeters !== undefined ? { weeklyGoalDistanceMeters } : {}),
            },
        });
        return { profile };
    }
    async uploadAvatar(user, file) {
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        const allowed = new Set([
            'image/jpeg',
            'image/png',
            'image/webp',
        ]);
        if (!allowed.has(file.mimetype))
            throw new common_1.BadRequestException(`Unsupported image type: ${file.mimetype}`);
        const service = this.supabaseAdminClient();
        const ext = node_path_1.default.extname(file.originalname || '').toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : '';
        const objectPath = `${user.userId}/${(0, node_crypto_1.randomUUID)()}${safeExt}`;
        const bucket = this.config.get('SUPABASE_AVATARS_BUCKET') ?? 'test';
        const { error: uploadError } = await service.storage.from(bucket).upload(objectPath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });
        if (uploadError)
            throw new common_1.BadRequestException(uploadError.message);
        const { data: publicData } = service.storage.from(bucket).getPublicUrl(objectPath);
        const avatarUrl = publicData.publicUrl;
        await this.requireProfile(user.userId);
        await this.prisma.profile.update({ where: { userId: user.userId }, data: { avatarUrl } });
        return { avatarUrl };
    }
    async deleteAccount(user, body) {
        const confirm = String(body?.confirm ?? '').trim().toUpperCase();
        if (confirm !== 'DELETE')
            throw new common_1.BadRequestException('Type DELETE to confirm');
        const service = this.supabaseAdminClient();
        const { error } = await service.auth.admin.deleteUser(user.userId);
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { ok: true };
    }
    async myActivities(user, take) {
        await this.requireProfile(user.userId);
        const n = Number(take ?? 500);
        const limit = Number.isFinite(n) ? Math.max(1, Math.min(2000, Math.floor(n))) : 500;
        const activities = await this.prisma.activity.findMany({
            where: { userId: user.userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: ACTIVITY_LIST_SELECT,
        });
        const ids = activities.map((a) => a.id);
        const media = ids.length
            ? await this.prisma.activityMedia.findMany({
                where: { activityId: { in: ids }, userId: user.userId, kind: { in: ['photo', 'gpx'] } },
                orderBy: { createdAt: 'asc' },
                select: { activityId: true, kind: true, publicUrl: true },
            })
            : [];
        const mediaByActivity = new Map();
        for (const m of media) {
            const list = mediaByActivity.get(m.activityId) ?? [];
            list.push({ kind: m.kind, publicUrl: m.publicUrl ?? null });
            mediaByActivity.set(m.activityId, list);
        }
        return {
            activities: activities.map((a) => {
                const list = mediaByActivity.get(a.id) ?? [];
                const photos = list.filter((x) => x.kind === 'photo' && x.publicUrl).map((x) => x.publicUrl);
                const hasGpx = list.some((x) => x.kind === 'gpx');
                return {
                    ...a,
                    startedAt: a.startedAt.toISOString(),
                    createdAt: a.createdAt.toISOString(),
                    media: {
                        photoCount: photos.length,
                        coverPhotoUrl: photos[0] ?? null,
                        hasGpx,
                    },
                };
            }),
        };
    }
};
exports.MeController = MeController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "getMe", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "getMySummary", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, me_dto_1.UpdateMeDto]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Post)('avatar'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "uploadAvatar", null);
__decorate([
    (0, common_1.Post)('delete-account'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "deleteAccount", null);
__decorate([
    (0, common_1.Get)('activities'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "myActivities", null);
exports.MeController = MeController = __decorate([
    (0, common_1.Controller)('me'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __metadata("design:paramtypes", [prisma_1.PrismaService,
        config_1.ConfigService])
], MeController);
//# sourceMappingURL=me.controller.js.map