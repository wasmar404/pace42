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
exports.PublicApiController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const prisma_1 = require("../../prisma");
const public_api_guard_1 = require("./public-api.guard");
const public_api_dto_1 = require("./public-api.dto");
function trimOrThrow(name, value, max) {
    const s = String(value ?? '').trim();
    if (!s)
        throw new common_1.BadRequestException(`${name} is required`);
    if (s.length > max)
        throw new common_1.BadRequestException(`${name} is too long`);
    return s;
}
let PublicApiController = class PublicApiController {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    systemOwnerId() {
        const apiKey = (this.config.get('PUBLIC_API_KEY') || '').trim();
        if (!apiKey)
            throw new common_1.BadRequestException('Public API is disabled');
        // Deterministic UUID derived from the shared API key.
        const hex = (0, node_crypto_1.createHash)('sha256').update(`pace42-public-api-owner:${apiKey}`).digest('hex').slice(0, 32);
        const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
        return uuid;
    }
    async ensureSystemOwnerProfile(userId) {
        const suffix = userId.replace(/-/g, '').slice(0, 8);
        const username = `pace42_api_${suffix}`;
        await this.prisma.profile.upsert({
            where: { userId },
            create: {
                userId,
                username,
                firstName: 'Pace42',
                lastName: 'API',
                onboardingCompletedAt: new Date(),
                isPrivate: true,
            },
            update: {
                username,
                firstName: 'Pace42',
                lastName: 'API',
                onboardingCompletedAt: new Date(),
                isPrivate: true,
            },
        });
    }
    async health() {
        return { ok: true, now: new Date().toISOString() };
    }
    async users(q) {
        const query = String(q?.q || '').trim();
        const take = Number(q?.take ?? 20);
        const limit = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;
        if (query.length < 2)
            return { users: [] };
        const users = await this.prisma.profile.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { firstName: { contains: query, mode: 'insensitive' } },
                    { lastName: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true, isPrivate: true },
        });
        return {
            users: users.map((u) => ({
                id: u.userId,
                username: u.username,
                firstName: u.firstName ?? null,
                lastName: u.lastName ?? null,
                avatarUrl: u.avatarUrl ?? null,
                isPrivate: Boolean(u.isPrivate ?? false),
            })),
        };
    }
    async activities(q) {
        const take = Number(q?.take ?? 20);
        const limit = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;
        let since = null;
        if (typeof q?.since === 'string' && q.since.trim()) {
            const d = new Date(q.since);
            if (Number.isNaN(d.getTime()))
                throw new common_1.BadRequestException('Invalid since');
            since = d;
        }
        const acts = await this.prisma.activity.findMany({
            where: {
                visibility: 'public',
                ...(since ? { startedAt: { gte: since } } : {}),
            },
            orderBy: { startedAt: 'desc' },
            take: limit,
            select: {
                id: true,
                userId: true,
                sport: true,
                title: true,
                description: true,
                startedAt: true,
                durationSeconds: true,
                distanceMeters: true,
                routePolyline: true,
                mapImageUrl: true,
                createdAt: true,
            },
        });
        const ids = Array.from(new Set(acts.map((a) => a.userId)));
        const profiles = ids.length
            ? await this.prisma.profile.findMany({
                where: { userId: { in: ids } },
                select: { userId: true, username: true, firstName: true, lastName: true, avatarUrl: true },
            })
            : [];
        const byId = new Map(profiles.map((p) => [p.userId, p]));
        return {
            activities: acts.map((a) => {
                const p = byId.get(a.userId);
                return {
                    id: a.id,
                    sport: a.sport,
                    title: a.title ?? null,
                    description: a.description ?? null,
                    startedAt: a.startedAt.toISOString(),
                    durationSeconds: a.durationSeconds,
                    distanceMeters: a.distanceMeters,
                    routePolyline: a.routePolyline ?? null,
                    mapImageUrl: a.mapImageUrl ?? null,
                    createdAt: a.createdAt.toISOString(),
                    athlete: {
                        id: a.userId,
                        username: p?.username ?? null,
                        name: `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || (p?.username ? `@${p.username}` : 'Athlete'),
                        avatarUrl: p?.avatarUrl ?? null,
                    },
                };
            }),
        };
    }
    async clubs(q) {
        const query = String(q?.q || '').trim();
        const take = Number(q?.take ?? 20);
        const limit = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;
        const clubs = await this.prisma.club.findMany({
            where: {
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
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
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
        return {
            clubs: clubs.map((c) => ({
                id: c.id,
                name: c.name,
                location: c.location,
                sport: c.sport,
                description: c.description,
                avatarUrl: c.avatarUrl ?? null,
                bannerUrl: c.bannerUrl ?? null,
                isInviteOnly: Boolean(c.isInviteOnly),
                createdAt: c.createdAt.toISOString(),
                memberCount: c._count.members,
            })),
        };
    }
    async createClub(dto) {
        const ownerId = this.systemOwnerId();
        await this.ensureSystemOwnerProfile(ownerId);
        const name = trimOrThrow('name', dto.name, 120);
        const location = trimOrThrow('location', dto.location, 160);
        const description = trimOrThrow('description', dto.description, 800);
        const sport = String(dto.sport || '').toLowerCase();
        const club = await this.prisma.club.create({
            data: {
                ownerId,
                name,
                location,
                sport,
                description,
                avatarUrl: dto.avatarUrl ? String(dto.avatarUrl).trim() : null,
                bannerUrl: dto.bannerUrl ? String(dto.bannerUrl).trim() : null,
                isInviteOnly: dto.isInviteOnly === true,
                members: { create: { userId: ownerId, role: 'owner' } },
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
        return {
            club: {
                ...club,
                avatarUrl: club.avatarUrl ?? null,
                bannerUrl: club.bannerUrl ?? null,
                createdAt: club.createdAt.toISOString(),
            },
        };
    }
    async updateClub(id, dto) {
        const update = {};
        if (typeof dto.name === 'string')
            update.name = trimOrThrow('name', dto.name, 120);
        if (typeof dto.location === 'string')
            update.location = trimOrThrow('location', dto.location, 160);
        if (typeof dto.description === 'string')
            update.description = trimOrThrow('description', dto.description, 800);
        if (typeof dto.sport === 'string')
            update.sport = String(dto.sport).toLowerCase();
        if (typeof dto.avatarUrl === 'string')
            update.avatarUrl = dto.avatarUrl.trim() || null;
        if (typeof dto.bannerUrl === 'string')
            update.bannerUrl = dto.bannerUrl.trim() || null;
        if (typeof dto.isInviteOnly === 'boolean')
            update.isInviteOnly = dto.isInviteOnly;
        const club = await this.prisma.club.update({
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
                updatedAt: true,
            },
        });
        return {
            club: {
                ...club,
                avatarUrl: club.avatarUrl ?? null,
                bannerUrl: club.bannerUrl ?? null,
                createdAt: club.createdAt.toISOString(),
                updatedAt: club.updatedAt.toISOString(),
            },
        };
    }
    async deleteClub(id, _dto) {
        await this.prisma.club.delete({ where: { id } });
        return { ok: true };
    }
};
exports.PublicApiController = PublicApiController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PublicApiController.prototype, "health", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [public_api_dto_1.PublicListDto]),
    __metadata("design:returntype", Promise)
], PublicApiController.prototype, "users", null);
__decorate([
    (0, common_1.Get)('activities'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [public_api_dto_1.PublicActivitiesDto]),
    __metadata("design:returntype", Promise)
], PublicApiController.prototype, "activities", null);
__decorate([
    (0, common_1.Get)('clubs'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [public_api_dto_1.PublicListDto]),
    __metadata("design:returntype", Promise)
], PublicApiController.prototype, "clubs", null);
__decorate([
    (0, common_1.Post)('clubs'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [public_api_dto_1.PublicCreateClubDto]),
    __metadata("design:returntype", Promise)
], PublicApiController.prototype, "createClub", null);
__decorate([
    (0, common_1.Put)('clubs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, public_api_dto_1.PublicUpdateClubDto]),
    __metadata("design:returntype", Promise)
], PublicApiController.prototype, "updateClub", null);
__decorate([
    (0, common_1.Delete)('clubs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, public_api_dto_1.PublicDeleteDto]),
    __metadata("design:returntype", Promise)
], PublicApiController.prototype, "deleteClub", null);
exports.PublicApiController = PublicApiController = __decorate([
    (0, common_1.Controller)('public'),
    (0, common_1.UseGuards)(public_api_guard_1.PublicApiGuard),
    __metadata("design:paramtypes", [prisma_1.PrismaService,
        config_1.ConfigService])
], PublicApiController);
//# sourceMappingURL=public-api.controller.js.map