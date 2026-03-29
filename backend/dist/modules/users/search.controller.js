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
exports.SearchController = void 0;
const common_1 = require("@nestjs/common");
const supabase_optional_guard_1 = require("../../auth/supabase.optional.guard");
const prisma_1 = require("../../prisma");
let SearchController = class SearchController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async searchUsers(q, req) {
        const query = (q ?? '').trim();
        if (query.length < 2)
            return { users: [] };
        const viewerId = req?.user?.userId;
        const users = await this.prisma.profile.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { firstName: { contains: query, mode: 'insensitive' } },
                    { lastName: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 20,
            orderBy: { updatedAt: 'desc' },
            select: {
                userId: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
            },
        });
        const ids = users.map((u) => u.userId);
        let followingSet = new Set();
        if (viewerId && ids.length) {
            const follows = await this.prisma.follow.findMany({
                where: {
                    followerId: viewerId,
                    followingId: { in: ids },
                },
                select: { followingId: true },
            });
            followingSet = new Set(follows.map((f) => f.followingId));
        }
        return {
            users: users.map((u) => ({
                id: u.userId,
                username: u.username,
                firstName: u.firstName,
                lastName: u.lastName,
                avatarUrl: u.avatarUrl,
                isFollowing: viewerId ? followingSet.has(u.userId) : false,
            })),
        };
    }
};
exports.SearchController = SearchController;
__decorate([
    (0, common_1.Get)('users'),
    (0, common_1.UseGuards)(supabase_optional_guard_1.OptionalSupabaseAuthGuard),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "searchUsers", null);
exports.SearchController = SearchController = __decorate([
    (0, common_1.Controller)('search'),
    __metadata("design:paramtypes", [prisma_1.PrismaService])
], SearchController);
//# sourceMappingURL=search.controller.js.map