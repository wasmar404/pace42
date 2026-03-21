import { supabase } from './supabase.auth';
export async function verifySupabaseAccessToken(params: {
  token: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}): Promise<{ userId: string; email?: string }> {
  const { supabaseUrl, supabaseAnonKey, token } = params;

  const  anon  = supabase;
  const { data, error } = await anon.auth.getUser(token);

  if (error || !data.user) throw new Error('Invalid token');

  return {
    userId: data.user.id,
    email: data.user.email ?? undefined,
  };
}