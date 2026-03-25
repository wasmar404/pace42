import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { createHmac, randomBytes } from 'crypto';

import { getSupabaseAdminClient } from '../../auth/supabase.auth';

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signState(secret: string, payload: any): string {
  const json = JSON.stringify(payload);
  const msg = base64url(json);
  const sig = base64url(createHmac('sha256', secret).update(msg).digest());
  return `${msg}.${sig}`;
}

function verifyState(secret: string, state: string): any | null {
  const parts = String(state || '').split('.');
  if (parts.length !== 2) return null;
  const [msg, sig] = parts;
  const expected = base64url(createHmac('sha256', secret).update(msg).digest());
  if (sig !== expected) return null;
  try {
    const json = Buffer.from(msg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function safeNextPath(next: string | undefined): string {
  const n = String(next ?? '').trim();
  if (!n) return '/home';
  if (!n.startsWith('/')) return '/home';
  if (n.startsWith('//')) return '/home';
  return n;
}

async function fetchJson(url: string, init?: any) {
  const res = await fetch(url, init);
  const text = await res.text();
  const json = (() => {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  })();
  return { ok: res.ok, status: res.status, json, text };
}

async function findAuthUserByEmail(service: any, email: string) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return null;

  for (let page = 1; page <= 10; page++) {
    const res = await service.auth.admin.listUsers({ page, perPage: 200 });
    const users = res.data?.users || [];
    for (const u of users as any[]) {
      const e = String(u?.email ?? '').trim().toLowerCase();
      if (e === needle) return u;
    }
    if (users.length < 200) break;
  }
  return null;
}

@Controller('auth/intra')
export class IntraAuthController {
  constructor(private readonly config: ConfigService) {}

  @Get('debug')
  async debug() {
    return {
      intraClientId: this.config.get<string>('INTRA_CLIENT_ID') ? 'set' : 'missing',
      intraRedirectUri: this.config.get<string>('INTRA_REDIRECT_URI') ?? null,
      frontendUrl: this.config.get<string>('FRONTEND_URL') ?? null,
      supabaseUrl: this.config.get<string>('SUPABASE_URL') ?? null,
    };
  }

  @Get('start')
  async start(
    @Res() res: Response,
    @Query('mode') mode?: string,
    @Query('next') next?: string,
  ) {
    const m = String(mode ?? '').toLowerCase() === 'signup' ? 'signup' : 'login';
    const nextPath = safeNextPath(next);

    const clientId = this.config.getOrThrow<string>('INTRA_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>('INTRA_REDIRECT_URI');
    const stateSecret =
      this.config.get<string>('INTRA_STATE_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      'dev_only_change_me';

    const state = signState(stateSecret, {
      v: 1,
      mode: m,
      next: nextPath,
      iat: Date.now(),
      nonce: base64url(randomBytes(18)),
    });

    const authUrl = new URL('https://api.intra.42.fr/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    return res.redirect(authUrl.toString());
  }

  @Get('callback')
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const stateSecret =
      this.config.get<string>('INTRA_STATE_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      'dev_only_change_me';

    const decoded = verifyState(stateSecret, String(state ?? ''));
    const m = decoded?.mode === 'signup' ? 'signup' : 'login';
    const nextPath = safeNextPath(decoded?.next);

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const fail = (reason: string) => {
      const u = new URL('/login', frontendUrl);
      u.searchParams.set('error', reason);
      return res.redirect(u.toString());
    };

    if (!decoded) return fail('intra_invalid_state');
    if (!code) return fail('intra_missing_code');
    if (Date.now() - Number(decoded.iat || 0) > 10 * 60 * 1000) return fail('intra_state_expired');

    const clientId = this.config.getOrThrow<string>('INTRA_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('INTRA_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('INTRA_REDIRECT_URI');

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
    if (!tok.ok || !accessToken) return fail('intra_token_exchange_failed');

    const me = await fetchJson('https://api.intra.42.fr/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const email = String(me.json?.email ?? '').trim().toLowerCase();
    const intraLogin = String(me.json?.login ?? '').trim();
    const intraId = me.json?.id != null ? String(me.json.id) : '';
    if (!me.ok || !email) return fail('intra_profile_failed');

    const supabaseServiceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceRoleKey) return fail('server_missing_service_role');
    const service = getSupabaseAdminClient();

    const existing = await findAuthUserByEmail(service, email);
    const existingMethod = String(existing?.user_metadata?.signupMethod ?? '').toLowerCase();

    if (m === 'login') {
      if (!existing) return fail('intra_not_registered');
      if (existingMethod !== 'intra') return fail('email_used_by_other_method');
    }

    if (m === 'signup') {
      if (existing) {
        // Don't allow "sign up" twice.
        if (existingMethod === 'intra') return fail('already_registered');
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
    if (!actionLink) return fail('intra_magiclink_failed');

    return res.redirect(actionLink);
  }
}
