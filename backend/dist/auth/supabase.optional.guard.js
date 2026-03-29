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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionalSupabaseAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_jwt_1 = require("./supabase.jwt");
function readBearerToken(ctx) {
    const req = ctx.switchToHttp().getRequest();
    const header = (req.headers?.authorization ?? req.headers?.Authorization);
    if (!header)
        return null;
    const [kind, token] = header.split(' ');
    if (kind !== 'Bearer' || !token)
        return null;
    return token;
}
let OptionalSupabaseAuthGuard = class OptionalSupabaseAuthGuard {
    constructor(config) {
        this.config = config;
        this.tokenCache = new Map();
    }
    cacheGet(token) {
        const v = this.tokenCache.get(token);
        if (!v)
            return null;
        if (Date.now() > v.expiresAt) {
            this.tokenCache.delete(token);
            return null;
        }
        return v;
    }
    cacheSet(token, userId, email) {
        const TTL_MS = 60_000;
        const MAX = 500;
        this.tokenCache.set(token, { userId, email, expiresAt: Date.now() + TTL_MS });
        if (this.tokenCache.size <= MAX)
            return;
        const firstKey = this.tokenCache.keys().next().value;
        if (firstKey)
            this.tokenCache.delete(firstKey);
    }
    async canActivate(context) {
        const token = readBearerToken(context);
        if (!token)
            return true;
        const cached = this.cacheGet(token);
        if (cached) {
            const req = context.switchToHttp().getRequest();
            req.user = { userId: cached.userId, email: cached.email };
            req.supabaseAuth = { accessToken: token };
            return true;
        }
        const supabaseUrl = this.config.getOrThrow('SUPABASE_URL');
        const supabaseAnonKey = this.config.getOrThrow('SUPABASE_ANON_KEY');
        const supabaseJwtSecret = this.config.get('SUPABASE_JWT_SECRET');
        try {
            const decoded = await (0, supabase_jwt_1.verifySupabaseAccessToken)({
                token,
                supabaseUrl,
                supabaseAnonKey,
                supabaseJwtSecret,
            });
            this.cacheSet(token, decoded.userId, decoded.email);
            const req = context.switchToHttp().getRequest();
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
            };
            req.supabaseAuth = {
                accessToken: token,
            };
        }
        catch {
            // optional guard: ignore invalid token
        }
        return true;
    }
};
exports.OptionalSupabaseAuthGuard = OptionalSupabaseAuthGuard;
exports.OptionalSupabaseAuthGuard = OptionalSupabaseAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OptionalSupabaseAuthGuard);
//# sourceMappingURL=supabase.optional.guard.js.map