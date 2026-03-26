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
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = readBearerToken(context);
    if (!token) throw new UnauthorizedException('Missing Bearer token');

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
