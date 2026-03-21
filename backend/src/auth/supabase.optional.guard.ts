import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifySupabaseAccessToken } from './supabase.jwt';
import type { SupabaseRequestAuth, SupabaseRequestUser } from './supabase.guard';
import { readBearerToken } from './supabase.guard';

@Injectable()
export class OptionalSupabaseAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = readBearerToken(context);
    if (!token) return true;

    try {
      const decoded = await verifySupabaseAccessToken({
        token,
        supabaseUrl: this.config.getOrThrow<string>('SUPABASE_URL'),
        supabaseAnonKey: this.config.getOrThrow<string>('SUPABASE_ANON_KEY'),
      });

      const req = context.switchToHttp().getRequest();
      req.user = { userId: decoded.userId, email: decoded.email } satisfies SupabaseRequestUser;
      req.supabaseAuth = { accessToken: token } satisfies SupabaseRequestAuth;
    } catch {
      // optional guard: ignore invalid token
    }

    return true;
  }
}