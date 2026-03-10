import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function fetchWithTimeout(timeoutMs: number): typeof fetch {
  return async (input: any, init?: any) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const merged = {
        ...(init ?? {}),
        signal: init?.signal ?? controller.signal,
      };
      return await fetch(input, merged);
    } finally {
      clearTimeout(t);
    }
  };
}

type SupabaseClients = {
  anon: SupabaseClient;
  service: SupabaseClient;
};

export function createSupabaseClients(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
}): SupabaseClients {
  // Note: Storage uploads and Edge Function calls can legitimately take longer
  // than a few seconds (especially on slow networks or larger files).
  const timeoutMs = Number(process.env.SUPABASE_HTTP_TIMEOUT_MS ?? 60000);

  const anon = createClient(params.supabaseUrl, params.supabaseAnonKey, {
    global: { fetch: fetchWithTimeout(timeoutMs) },
  });

  // Service role is optional; only needed for server-side privileged actions
  // (e.g., uploading to Storage regardless of user policy).
  const serviceKey = params.supabaseServiceRoleKey ?? params.supabaseAnonKey;
  const service = createClient(params.supabaseUrl, serviceKey, {
    global: { fetch: fetchWithTimeout(timeoutMs) },
  });

  return { anon, service };
}
