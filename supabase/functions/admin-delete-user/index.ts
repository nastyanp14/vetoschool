import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const ANON = Deno.env.get('SUPABASE_ANON_KEY');
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !ANON || !SERVICE) {
      return json({ error: 'Edge Function is missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.' }, 500);
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !authData.user?.id) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', authData.user.id);
    if (!roles?.some((r: { role: string }) => r.role === 'admin')) {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;
    if (typeof userId !== 'string' || userId.length < 10) {
      return json({ error: 'Invalid userId' }, 400);
    }

    const cleanupTables = [
      ['telegram_notifications', 'student_id'],
      ['telegram_link_tokens', 'student_id'],
      ['student_parent_links', 'student_id'],
      ['lesson_live_events', 'student_id'],
      ['lesson_live_sessions', 'student_id'],
      ['lesson_progress', 'user_id'],
      ['workbook_assignments', 'user_id'],
      ['student_group_members', 'user_id'],
      ['grades', 'user_id'],
      ['schedules', 'user_id'],
      ['content_items', 'user_id'],
    ] as const;

    for (const [table, column] of cleanupTables) {
      const { error: cleanupError } = await admin.from(table).delete().eq(column, userId);
      if (cleanupError && cleanupError.code !== '42P01' && cleanupError.code !== '42703') {
        return json({ error: `Unable to clean ${table}: ${cleanupError.message}` }, 500);
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return json({ error: delErr.message }, 500);
    }

    // Best-effort cleanup for profile/role rows in projects without full cascades.
    await admin.from('user_roles').delete().eq('user_id', userId);
    await admin.from('profiles').delete().eq('id', userId);

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
