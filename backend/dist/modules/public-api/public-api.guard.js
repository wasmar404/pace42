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
exports.PublicApiGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
function readApiKey(req) {
    const h = req?.headers || {};
    const key = (h['x-api-key'] || h['X-Api-Key'] || h['X-API-KEY']);
    if (key && String(key).trim())
        return String(key).trim();
    const auth = (h['authorization'] || h['Authorization']);
    if (auth && auth.startsWith('Bearer ')) {
        const t = auth.slice('Bearer '.length).trim();
        if (t)
            return t;
    }
    return null;
}
function readIp(req) {
    const h = req?.headers || {};
    const xf = (h['x-forwarded-for'] || h['X-Forwarded-For']);
    if (xf)
        return String(xf).split(',')[0].trim();
    return String(req?.ip || req?.connection?.remoteAddress || 'unknown');
}
let PublicApiGuard = class PublicApiGuard {
    constructor(config) {
        this.config = config;
        this.buckets = new Map();
    }
    hit(key, limit, windowMs, now) {
        const cur = this.buckets.get(key);
        if (!cur || now >= cur.resetAt) {
            const next = { resetAt: now + windowMs, count: 1 };
            this.buckets.set(key, next);
            return { ok: true, remaining: limit - 1, resetAt: next.resetAt };
        }
        if (cur.count >= limit)
            return { ok: false, remaining: 0, resetAt: cur.resetAt };
        cur.count += 1;
        return { ok: true, remaining: limit - cur.count, resetAt: cur.resetAt };
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const expected = (this.config.get('PUBLIC_API_KEY') || '').trim();
        if (!expected)
            throw new common_1.ForbiddenException('Public API is disabled');
        const provided = readApiKey(req);
        if (!provided || provided !== expected)
            throw new common_1.ForbiddenException('Invalid API key');
        const limit = Number(this.config.get('PUBLIC_API_RATELIMIT_MAX') ?? 60);
        const windowMs = Number(this.config.get('PUBLIC_API_RATELIMIT_WINDOW_MS') ?? 60_000);
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(10_000, Math.floor(limit))) : 60;
        const safeWindowMs = Number.isFinite(windowMs) ? Math.max(1000, Math.min(60 * 60_000, Math.floor(windowMs))) : 60_000;
        const ip = readIp(req);
        const bucketKey = `${provided}:${ip}`;
        const now = Date.now();
        const hit = this.hit(bucketKey, safeLimit, safeWindowMs, now);
        try {
            res?.setHeader?.('X-RateLimit-Limit', String(safeLimit));
            res?.setHeader?.('X-RateLimit-Remaining', String(hit.remaining));
            res?.setHeader?.('X-RateLimit-Reset', String(Math.ceil(hit.resetAt / 1000)));
        }
        catch {
            // ignore
        }
        if (!hit.ok)
            throw new common_1.HttpException('Rate limit exceeded', 429);
        return true;
    }
};
exports.PublicApiGuard = PublicApiGuard;
exports.PublicApiGuard = PublicApiGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PublicApiGuard);
//# sourceMappingURL=public-api.guard.js.map