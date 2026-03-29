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
exports.AuthPolicyController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_guard_1 = require("../../auth/supabase.guard");
const supabase_user_1 = require("../../auth/supabase.user");
const supabase_auth_1 = require("../../auth/supabase.auth");
let AuthPolicyController = class AuthPolicyController {
    constructor(config) {
        this.config = config;
    }
    async adminClient() {
        const supabaseServiceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseServiceRoleKey)
            return { service: null, supabaseServiceRoleKey };
        return { service: (0, supabase_auth_1.getSupabaseAdminClient)(), supabaseServiceRoleKey };
    }
    // Best-effort cleanup when OAuth signup is not allowed.
    async rejectOauth(user, _body) {
        const { service, supabaseServiceRoleKey } = await this.adminClient();
        try {
            if (supabaseServiceRoleKey) {
                await service.auth.admin.deleteUser(user.userId);
            }
        }
        catch {
            // ignore - user may already be gone
        }
        return { ok: true };
    }
    async enforce(reqUser, body) {
        const mode = String(body?.mode ?? 'login').toLowerCase() === 'signup' ? 'signup' : 'login';
        const method = String(body?.method ?? '').toLowerCase();
        const { service, supabaseServiceRoleKey } = await this.adminClient();
        if (!supabaseServiceRoleKey) {
            // Without service role we can't enforce safely.
            return { ok: true };
        }
        if (!service)
            return { ok: true };
        const { data, error } = await service.auth.admin.getUserById(reqUser.userId);
        if (error || !data?.user)
            throw new common_1.ForbiddenException('Auth policy check failed');
        const user = data.user;
        const createdAtMs = Date.parse(String(user.created_at ?? ''));
        const ageMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : Number.POSITIVE_INFINITY;
        const identityProviders = Array.isArray(user.identities)
            ? Array.from(new Set(user.identities
                .map((i) => String(i?.provider ?? '').toLowerCase())
                .filter(Boolean)))
            : [];
        const providers = identityProviders.length
            ? identityProviders
            : Array.isArray(user.app_metadata?.providers)
                ? user.app_metadata.providers.map((p) => String(p ?? '').toLowerCase()).filter(Boolean)
                : user.app_metadata?.provider
                    ? [String(user.app_metadata.provider).toLowerCase()]
                    : [];
        const email = String(user.email ?? '').trim().toLowerCase();
        const hasGoogle = providers.includes('google');
        const hasEmail = providers.includes('email');
        // Disallow accounts that have both OAuth + email/password identities.
        if (hasGoogle && hasEmail) {
            // Only delete automatically if it was just created (likely accidental linking/creation).
            if (ageMs < 15 * 60 * 1000) {
                await service.auth.admin.deleteUser(reqUser.userId).catch(() => { });
            }
            throw new common_1.ForbiddenException('This email cannot use both Google and password login.');
        }
        // Disallow duplicate emails across auth users (OAuth + password).
        if (email) {
            let matches = 0;
            for (let page = 1; page <= 5; page++) {
                const res = await service.auth.admin.listUsers({ page, perPage: 200 });
                const users = res.data?.users || [];
                for (const u of users) {
                    if (String(u?.email ?? '').trim().toLowerCase() === email)
                        matches++;
                }
                if (users.length < 200)
                    break;
                if (matches > 1)
                    break;
            }
            if (matches > 1) {
                if (ageMs < 15 * 60 * 1000) {
                    await service.auth.admin.deleteUser(reqUser.userId).catch(() => { });
                }
                throw new common_1.ForbiddenException('This email is already used by another sign-in method.');
            }
        }
        const meta = (user.user_metadata ?? {});
        const oauthSignedUp = meta.oauthSignedUp === true;
        const oauthProvider = String(meta.oauthProvider ?? '').toLowerCase();
        // Prevent users from using the signup flow again for an existing account.
        // We can't stop Supabase from redirecting back, but we can block app access and
        // force them to use the login flow.
        if (mode === 'signup') {
            const tooOldForSignup = ageMs > 60 * 60 * 1000; // 60 minutes
            const alreadySignedUpWithThisMethod = oauthSignedUp && (!oauthProvider || oauthProvider === method);
            if (alreadySignedUpWithThisMethod || tooOldForSignup) {
                throw new common_1.ForbiddenException('Account already exists. Please log in instead of signing up again.');
            }
        }
        if (hasGoogle) {
            if (mode === 'signup') {
                if (!oauthSignedUp) {
                    await service.auth.admin.updateUserById(reqUser.userId, {
                        user_metadata: { ...meta, oauthSignedUp: true, oauthProvider: 'google' },
                    }).catch(() => { });
                }
            }
            else {
                // login mode
                if (!oauthSignedUp) {
                    // Allow older existing accounts (grandfather) and mark them.
                    if (ageMs > 15 * 60 * 1000) {
                        await service.auth.admin.updateUserById(reqUser.userId, {
                            user_metadata: { ...meta, oauthSignedUp: true, oauthProvider: 'google' },
                        }).catch(() => { });
                    }
                    else {
                        await service.auth.admin.deleteUser(reqUser.userId).catch(() => { });
                        throw new common_1.ForbiddenException('Google login is only allowed for accounts that signed up with Google.');
                    }
                }
            }
        }
        return { ok: true };
    }
};
exports.AuthPolicyController = AuthPolicyController;
__decorate([
    (0, common_1.Post)('reject-oauth'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthPolicyController.prototype, "rejectOauth", null);
__decorate([
    (0, common_1.Post)('policy/enforce'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthPolicyController.prototype, "enforce", null);
exports.AuthPolicyController = AuthPolicyController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AuthPolicyController);
//# sourceMappingURL=auth-policy.controller.js.map