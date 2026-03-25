import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

import { createClient } from '@supabase/supabase-js';

type JwtPayload = {
  sub?: string;
  email?: string;
};

let jwksClient: ReturnType<typeof jwksRsa> | null = null;

function getJwksClient(supabaseUrl: string) {
  if (jwksClient) return jwksClient;

  jwksClient = jwksRsa({
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

export async function verifySupabaseAccessToken(params: {
  token: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseJwtSecret?: string;
}): Promise<{ userId: string; email?: string }> {
  const { token, supabaseUrl, supabaseAnonKey, supabaseJwtSecret } = params;

  const decodedHeader = jwt.decode(token, { complete: true }) as
    | { header?: { alg?: string; kid?: string } }
    | null;
  const alg = decodedHeader?.header?.alg;

  // Preferred fast path: verify using JWKS (typically RS256) to avoid any call
  // to Supabase Auth per request (only occasional JWKS refresh).
  if (alg && alg.startsWith('RS')) {
    try {
      const client = getJwksClient(supabaseUrl);

      const getKey: jwt.GetPublicKeyOrSecret = (header, cb) => {
        const kid = header.kid;
        if (!kid) return cb(new Error('Missing kid'));
        client.getSigningKey(kid, (err, key) => {
          if (err || !key) return cb(err || new Error('Missing signing key'));
          const pub = (key as any).getPublicKey?.() ?? (key as any).publicKey ?? (key as any).rsaPublicKey;
          return cb(null, pub);
        });
      };

      const payload = await new Promise<JwtPayload>((resolve, reject) => {
        jwt.verify(token, getKey, { algorithms: ['RS256', 'RS384', 'RS512'] }, (err, p) => {
          if (err) return reject(err);
          resolve(p as JwtPayload);
        });
      });

      const userId = typeof payload?.sub === 'string' ? payload.sub : '';
      if (!userId) throw new Error('Missing sub');
      const email = typeof payload?.email === 'string' ? payload.email : undefined;
      return { userId, email };
    } catch {
      // fall through to other strategies
    }
  }

  // Fast path: verify locally using the legacy shared secret (HS256).
  // Only works if your project is still using HS tokens.
  if (supabaseJwtSecret) {
    try {
      const payload = jwt.verify(token, supabaseJwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
      const userId = typeof payload?.sub === 'string' ? payload.sub : '';
      if (!userId) throw new Error('Missing sub');
      const email = typeof payload?.email === 'string' ? payload.email : undefined;
      return { userId, email };
    } catch {
      // fall through to Supabase Auth lookup
    }
  }

  // Compatibility path: last resort (slow). Still works even if token alg changes.
  const anon = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid token');
  return { userId: data.user.id, email: data.user.email ?? undefined };
}
