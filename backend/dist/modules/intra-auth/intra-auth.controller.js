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
exports.IntraAuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const supabase_auth_1 = require("../../auth/supabase.auth");
function base64url(input) {
    const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return b
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function signState(secret, payload) {
    const json = JSON.stringify(payload);
    const msg = base64url(json);
    const sig = base64url((0, crypto_1.createHmac)('sha256', secret).update(msg).digest());
    return `${msg}.${sig}`;
}
function verifyState(secret, state) {
    const parts = String(state || '').split('.');
    if (parts.length !== 2)
        return null;
    const [msg, sig] = parts;
    const expected = base64url((0, crypto_1.createHmac)('sha256', secret).update(msg).digest());
    if (sig !== expected)
        return null;
    try {
        const json = Buffer.from(msg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
function safeNextPath(next) {
    const n = String(next ?? '').trim();
    if (!n)
        return '/home';
    if (!n.startsWith('/'))
        return '/home';
    if (n.startsWith('//'))
        return '/home';
    return n;
}
async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    const json = (() => {
        try {
            return text ? JSON.parse(text) : {};
        }
        catch {
            return {};
        }
    })();
    return { ok: res.ok, status: res.status, json, text };
}
async function findAuthUserByEmail(service, email) {
    const needle = String(email || '').trim().toLowerCase();
    if (!needle)
        return null;
    for (let page = 1; page <= 10; page++) {
        const res = await service.auth.admin.listUsers({ page, perPage: 200 });
        const users = res.data?.users || [];
        for (const u of users) {
            const e = String(u?.email ?? '').trim().toLowerCase();
            if (e === needle)
                return u;
        }
        if (users.length < 200)
            break;
    }
    return null;
}
let IntraAuthController = class IntraAuthController {
    constructor(config) {
        this.config = config;
    }
    async debug() {
        return {
            intraClientId: this.config.get('INTRA_CLIENT_ID') ? 'set' : 'missing',
            intraRedirectUri: this.config.get('INTRA_REDIRECT_URI') ?? null,
            frontendUrl: this.config.get('FRONTEND_URL') ?? null,
            supabaseUrl: this.config.get('SUPABASE_URL') ?? null,
        };
    }
    async start(res, mode, next) {
        const m = String(mode ?? '').toLowerCase() === 'signup' ? 'signup' : 'login';
        const nextPath = safeNextPath(next);
        const clientId = this.config.getOrThrow('INTRA_CLIENT_ID');
        const redirectUri = this.config.getOrThrow('INTRA_REDIRECT_URI');
        const stateSecret = this.config.get('INTRA_STATE_SECRET') ??
            this.config.get('JWT_ACCESS_SECRET') ??
            'dev_only_change_me';
        const state = signState(stateSecret, {
            v: 1,
            mode: m,
            next: nextPath,
            iat: Date.now(),
            nonce: base64url((0, crypto_1.randomBytes)(18)),
        });
        const authUrl = new URL('https://api.intra.42.fr/oauth/authorize');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', state);
        return res.redirect(authUrl.toString());
    }
    async callback(res, code, state) {
        const stateSecret = this.config.get('INTRA_STATE_SECRET') ??
            this.config.get('JWT_ACCESS_SECRET') ??
            'dev_only_change_me';
        const decoded = verifyState(stateSecret, String(state ?? ''));
        const m = decoded?.mode === 'signup' ? 'signup' : 'login';
        const nextPath = safeNextPath(decoded?.next);
        const frontendUrl = this.config.get('FRONTEND_URL') ?? 'http://localhost:5173';
        const fail = (reason) => {
            const u = new URL('/login', frontendUrl);
            u.searchParams.set('error', reason);
            return res.redirect(u.toString());
        };
        if (!decoded)
            return fail('intra_invalid_state');
        if (!code)
            return fail('intra_missing_code');
        if (Date.now() - Number(decoded.iat || 0) > 10 * 60 * 1000)
            return fail('intra_state_expired');
        const clientId = this.config.getOrThrow('INTRA_CLIENT_ID');
        const clientSecret = this.config.getOrThrow('INTRA_CLIENT_SECRET');
        const redirectUri = this.config.getOrThrow('INTRA_REDIRECT_URI');
        // Exchange code for token
        const form = new URLSearchParams();
        form.set('grant_type', 'authorization_code');
        form.set('client_id', clientId);
        form.set('client_secret', clientSecret);
        form.set('code', String(code));
        form.set('redirect_uri', redirectUri);
        const tok = await fetchJson('https://api.intra.42.fr/oauth/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
        });
        const accessToken = String(tok.json?.access_token ?? '');
        if (!tok.ok || !accessToken)
            return fail('intra_token_exchange_failed');
        const me = await fetchJson('https://api.intra.42.fr/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const email = String(me.json?.email ?? '').trim().toLowerCase();
        const intraLogin = String(me.json?.login ?? '').trim();
        const intraId = me.json?.id != null ? String(me.json.id) : '';
        if (!me.ok || !email)
            return fail('intra_profile_failed');
        const supabaseUrl = this.config.getOrThrow('SUPABASE_URL');
        const supabaseAnonKey = this.config.getOrThrow('SUPABASE_ANON_KEY');
        const supabaseServiceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseServiceRoleKey)
            return fail('server_missing_service_role');
        const { service } = (0, supabase_auth_1.createSupabaseClients)({
            supabaseUrl,
            supabaseAnonKey,
            supabaseServiceRoleKey,
        });
        const existing = await findAuthUserByEmail(service, email);
        const existingMethod = String(existing?.user_metadata?.signupMethod ?? '').toLowerCase();
        if (m === 'login') {
            if (!existing)
                return fail('intra_not_registered');
            if (existingMethod !== 'intra')
                return fail('email_used_by_other_method');
        }
        if (m === 'signup') {
            if (existing) {
                // Don't allow "sign up" twice.
                if (existingMethod === 'intra')
                    return fail('already_registered');
                return fail('email_used_by_other_method');
            }
            if (!existing) {
                await service.auth.admin
                    .createUser({
                    email,
                    email_confirm: true,
                    user_metadata: {
                        signupMethod: 'intra',
                        oauthSignedUp: true,
                        oauthProvider: 'intra',
                        intraLogin,
                        intraId,
                    },
                })
                    .catch(() => {
                    // If create fails, fall back to re-check and continue.
                });
            }
        }
        // Generate a magic link that redirects into the normal SPA auth callback.
        const redirectTo = new URL('/auth/callback', frontendUrl);
        redirectTo.searchParams.set('method', 'intra');
        redirectTo.searchParams.set('mode', m);
        redirectTo.searchParams.set('next', nextPath);
        const link = await service.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: {
                redirectTo: redirectTo.toString(),
            },
        });
        const actionLink = String(link.data?.properties?.action_link ?? '');
        if (!actionLink)
            return fail('intra_magiclink_failed');
        return res.redirect(actionLink);
    }
};
exports.IntraAuthController = IntraAuthController;
__decorate([
    (0, common_1.Get)('debug'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IntraAuthController.prototype, "debug", null);
__decorate([
    (0, common_1.Get)('start'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('mode')),
    __param(2, (0, common_1.Query)('next')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], IntraAuthController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('code')),
    __param(2, (0, common_1.Query)('state')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], IntraAuthController.prototype, "callback", null);
exports.IntraAuthController = IntraAuthController = __decorate([
    (0, common_1.Controller)('auth/intra'),
    __metadata("design:paramtypes", [config_1.ConfigService])
], IntraAuthController);
//# sourceMappingURL=intra-auth.controller.js.map