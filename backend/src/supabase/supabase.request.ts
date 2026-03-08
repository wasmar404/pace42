import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';

export function createSupabaseForRequest(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  req: Request;
}): SupabaseClient {
  const accessToken = (params.req as any)?.supabaseAuth?.accessToken as string | undefined;
  if (!accessToken) {
    return createClient(params.supabaseUrl, params.supabaseAnonKey);
  }

  return createClient(params.supabaseUrl, params.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function readBearerFromHeaders(req: Request): string | null {
  const header = (req.headers?.authorization ?? (req.headers as any)?.Authorization) as string | undefined;
  if (!header) return null;
  const [kind, token] = header.split(' ');
  if (kind !== 'Bearer' || !token) return null;
  return token;
}
