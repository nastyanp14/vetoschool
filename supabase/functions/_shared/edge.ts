import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/** Derives the user id from the Bearer token only. Never from the request body. */
export async function requireUser(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: json({ error: 'Unauthorized' }, 401) };
  }
  const token = authHeader.slice('Bearer '.length);
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getClaims(token);
  const sub = data?.claims?.sub as string | undefined;
  if (error || !sub) return { error: json({ error: 'Unauthorized' }, 401) };
  return { userId: sub };
}

export async function requireAdmin(req: Request): Promise<{ userId: string } | { error: Response }> {
  const auth = await requireUser(req);
  if ('error' in auth) return auth;
  const admin = serviceClient();
  const { data, error } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', auth.userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (error || !data) return { error: json({ error: 'Forbidden' }, 403) };
  return { userId: auth.userId };
}
