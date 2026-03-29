"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySupabaseAccessToken = verifySupabaseAccessToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const supabase_js_1 = require("@supabase/supabase-js");
let jwksClient = null;
function getJwksClient(supabaseUrl) {
    if (jwksClient)
        return jwksClient;
    jwksClient = (0, jwks_rsa_1.default)({
        jwksUri: new URL('/auth/v1/keys', supabaseUrl).toString(),
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 30,
        timeout: 8000,
    });
    return jwksClient;
}
async function verifySupabaseAccessToken(params) {
    const { token, supabaseUrl, supabaseAnonKey, supabaseJwtSecret } = params;
    const decodedHeader = jsonwebtoken_1.default.decode(token, { complete: true });
    const alg = decodedHeader?.header?.alg;
    // Preferred fast path: verify using JWKS (typically RS256) to avoid any call
    // to Supabase Auth per request (only occasional JWKS refresh).
    if (alg && alg.startsWith('RS')) {
        try {
            const client = getJwksClient(supabaseUrl);
            const getKey = (header, cb) => {
                const kid = header.kid;
                if (!kid)
                    return cb(new Error('Missing kid'));
                client.getSigningKey(kid, (err, key) => {
                    if (err || !key)
                        return cb(err || new Error('Missing signing key'));
                    const pub = key.getPublicKey?.() ?? key.publicKey ?? key.rsaPublicKey;
                    return cb(null, pub);
                });
            };
            const payload = await new Promise((resolve, reject) => {
                jsonwebtoken_1.default.verify(token, getKey, { algorithms: ['RS256', 'RS384', 'RS512'] }, (err, p) => {
                    if (err)
                        return reject(err);
                    resolve(p);
                });
            });
            const userId = typeof payload?.sub === 'string' ? payload.sub : '';
            if (!userId)
                throw new Error('Missing sub');
            const email = typeof payload?.email === 'string' ? payload.email : undefined;
            return { userId, email };
        }
        catch {
            // fall through to other strategies
        }
    }
    // Fast path: verify locally using the legacy shared secret (HS256).
    // Only works if your project is still using HS tokens.
    if (supabaseJwtSecret) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, supabaseJwtSecret, { algorithms: ['HS256'] });
            const userId = typeof payload?.sub === 'string' ? payload.sub : '';
            if (!userId)
                throw new Error('Missing sub');
            const email = typeof payload?.email === 'string' ? payload.email : undefined;
            return { userId, email };
        }
        catch {
            // fall through to Supabase Auth lookup
        }
    }
    // Compatibility path: last resort (slow). Still works even if token alg changes.
    const anon = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data.user)
        throw new Error('Invalid token');
    return { userId: data.user.id, email: data.user.email ?? undefined };
}
//# sourceMappingURL=supabase.jwt.js.map