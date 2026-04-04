import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

export function toPublicUrl(internalUrl: string): string {
  const internal = process.env.SUPABASE_URL;
  const pub = process.env.SUPABASE_PUBLIC_URL;
  if (!internal || !pub || internal === pub) return internalUrl;
  return internalUrl.replace(internal, pub);
}

let _admin: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  _admin = createClient(url, key);
  return _admin;
}
