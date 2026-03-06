import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseClients = {
  anon: SupabaseClient;
  service: SupabaseClient;
};

export function createSupabaseClients(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
}): SupabaseClients {
  const anon = createClient(params.supabaseUrl, params.supabaseAnonKey);

  // Service role is optional; only needed for server-side privileged actions
  // (e.g., uploading to Storage regardless of user policy).
  const serviceKey = params.supabaseServiceRoleKey ?? params.supabaseAnonKey;
  const service = createClient(params.supabaseUrl, serviceKey);

  return { anon, service };
}
