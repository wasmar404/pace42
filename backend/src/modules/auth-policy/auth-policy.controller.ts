import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { getSupabaseAdminClient } from '../../auth/supabase.auth';

@Controller('auth')
export class AuthPolicyController {
  constructor(private readonly config: ConfigService) {}

  private async adminClient() {
    const supabaseServiceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceRoleKey) return { service: null as any, supabaseServiceRoleKey };
    return { service: getSupabaseAdminClient(), supabaseServiceRoleKey };
  }

  // Best-effort cleanup when OAuth signup is not allowed.
  @Post('reject-oauth')
  @UseGuards(SupabaseAuthGuard)
  async rejectOauth(
    @CurrentUser() user: { userId: string },
    @Body() _body?: { reason?: string },
  ) {
    const { service, supabaseServiceRoleKey } = await this.adminClient();

    try {
      if (supabaseServiceRoleKey) {
        await service.auth.admin.deleteUser(user.userId);
      }
    } catch {
      // ignore - user may already be gone
    }

    return { ok: true };
  }

  @Post('policy/enforce')
  @UseGuards(SupabaseAuthGuard)
  async enforce(
    @CurrentUser() reqUser: { userId: string },
    @Body() body?: { mode?: string; method?: string },
  ) {
    const mode = String(body?.mode ?? 'login').toLowerCase() === 'signup' ? 'signup' : 'login';
    const method = String(body?.method ?? '').toLowerCase();
    const { service, supabaseServiceRoleKey } = await this.adminClient();

    if (!supabaseServiceRoleKey) {
      // Without service role we can't enforce safely.
      return { ok: true };
    }

    if (!service) return { ok: true };

    const { data, error } = await service.auth.admin.getUserById(reqUser.userId);
    if (error || !data?.user) throw new ForbiddenException('Auth policy check failed');
    const user = data.user as any;

    const createdAtMs = Date.parse(String(user.created_at ?? ''));
    const ageMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : Number.POSITIVE_INFINITY;

    const identityProviders: string[] = Array.isArray(user.identities)
      ? Array.from(
          new Set(
            (user.identities as any[])
              .map((i) => String(i?.provider ?? '').toLowerCase())
              .filter(Boolean),
          ),
        )
      : [];

    const providers: string[] = identityProviders.length
      ? identityProviders
      : Array.isArray(user.app_metadata?.providers)
          ? (user.app_metadata.providers as any[]).map((p) => String(p ?? '').toLowerCase()).filter(Boolean)
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
        await service.auth.admin.deleteUser(reqUser.userId).catch(() => {});
      }
      throw new ForbiddenException('This email cannot use both Google and password login.');
    }

    // Disallow duplicate emails across auth users (OAuth + password).
    if (email) {
      let matches = 0;
      for (let page = 1; page <= 5; page++) {
        const res = await service.auth.admin.listUsers({ page, perPage: 200 });
        const users = res.data?.users || [];
        for (const u of users as any[]) {
          if (String(u?.email ?? '').trim().toLowerCase() === email) matches++;
        }
        if (users.length < 200) break;
        if (matches > 1) break;
      }

      if (matches > 1) {
        if (ageMs < 15 * 60 * 1000) {
          await service.auth.admin.deleteUser(reqUser.userId).catch(() => {});
        }
        throw new ForbiddenException('This email is already used by another sign-in method.');
      }
    }

    const meta = (user.user_metadata ?? {}) as any;
    const oauthSignedUp = meta.oauthSignedUp === true;
    const oauthProvider = String(meta.oauthProvider ?? '').toLowerCase();

    // Prevent users from using the signup flow again for an existing account.
    // We can't stop Supabase from redirecting back, but we can block app access and
    // force them to use the login flow.
    if (mode === 'signup') {
      const tooOldForSignup = ageMs > 60 * 60 * 1000; // 60 minutes
      const alreadySignedUpWithThisMethod = oauthSignedUp && (!oauthProvider || oauthProvider === method);
      if (alreadySignedUpWithThisMethod || tooOldForSignup) {
        throw new ForbiddenException('Account already exists. Please log in instead of signing up again.');
      }
    }

    if (hasGoogle) {
      if (mode === 'signup') {
        if (!oauthSignedUp) {
          await service.auth.admin.updateUserById(reqUser.userId, {
            user_metadata: { ...meta, oauthSignedUp: true, oauthProvider: 'google' },
          }).catch(() => {});
        }
      } else {
        // login mode
        if (!oauthSignedUp) {
          // Allow older existing accounts (grandfather) and mark them.
          if (ageMs > 15 * 60 * 1000) {
            await service.auth.admin.updateUserById(reqUser.userId, {
              user_metadata: { ...meta, oauthSignedUp: true, oauthProvider: 'google' },
            }).catch(() => {});
          } else {
            await service.auth.admin.deleteUser(reqUser.userId).catch(() => {});
            throw new ForbiddenException('Google login is only allowed for accounts that signed up with Google.');
          }
        }
      }
    }

    return { ok: true };
  }
}
