import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createSupabaseClients } from './supabase.auth';
import type { SupabaseRequestAuth, SupabaseRequestUser } from './supabase.guard';

function readBearerToken(ctx: ExecutionContext): string | null {
  const req = ctx.switchToHttp().getRequest();
  const header = (req.headers?.authorization ?? req.headers?.Authorization) as string | undefined;
  if (!header) return null;
  const [kind, token] = header.split(' ');
  if (kind !== 'Bearer' || !token) return null;
  return token;
}

@Injectable()
export class OptionalSupabaseAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = readBearerToken(context);
    if (!token) return true;

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const supabaseAnonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const { anon } = createSupabaseClients({ supabaseUrl, supabaseAnonKey });

    const { data, error } = await anon.auth.getUser(token);
    if (error || !data.user) return true;

    const req = context.switchToHttp().getRequest();
    req.user = {
      userId: data.user.id,
      email: data.user.email ?? undefined,
    } satisfies SupabaseRequestUser;
    req.supabaseAuth = {
      accessToken: token,
    } satisfies SupabaseRequestAuth;

    return true;
  }
}
