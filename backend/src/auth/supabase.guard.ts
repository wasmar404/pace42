import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { verifySupabaseAccessToken } from './supabase.jwt';

export type SupabaseRequestUser = {
  userId: string;
  email?: string;
};

export type SupabaseRequestAuth = {
  accessToken: string;
};

function readBearerToken(ctx: ExecutionContext): string | null {
  const req = ctx.switchToHttp().getRequest();
  const header = (req.headers?.authorization ?? req.headers?.Authorization) as string | undefined;
  if (!header) return null;
  const [kind, token] = header.split(' ');
  if (kind !== 'Bearer' || !token) return null;
  return token;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly tokenCache = new Map<string, { userId: string; email?: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  private cacheGet(token: string) {
    const v = this.tokenCache.get(token);
    if (!v) return null;
    if (Date.now() > v.expiresAt) {
      this.tokenCache.delete(token);
      return null;
    }
    return v;
  }

  private cacheSet(token: string, userId: string, email?: string) {
    // Small, short-lived cache to avoid repeated network calls to Supabase Auth.
    // Tokens can be revoked server-side; keep TTL short.
    const TTL_MS = 60_000;
    const MAX = 500;

    this.tokenCache.set(token, { userId, email, expiresAt: Date.now() + TTL_MS });
    if (this.tokenCache.size <= MAX) return;
    const firstKey = this.tokenCache.keys().next().value as string | undefined;
    if (firstKey) this.tokenCache.delete(firstKey);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = readBearerToken(context);
    if (!token) throw new UnauthorizedException('Missing Bearer token');

    const cached = this.cacheGet(token);
    if (cached) {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: cached.userId, email: cached.email } satisfies SupabaseRequestUser;
      req.supabaseAuth = { accessToken: token } satisfies SupabaseRequestAuth;
      return true;
    }

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const supabaseJwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET');

    let decoded: { userId: string; email?: string };
    try {
      decoded = await verifySupabaseAccessToken({
        token,
        supabaseUrl,
        supabaseAnonKey,
        supabaseJwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    this.cacheSet(token, decoded.userId, decoded.email);

    const req = context.switchToHttp().getRequest();
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    } satisfies SupabaseRequestUser;

    req.supabaseAuth = {
      accessToken: token,
    } satisfies SupabaseRequestAuth;

    return true;
  }
}
