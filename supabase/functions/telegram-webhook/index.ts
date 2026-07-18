import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sendpulse-signature',
};

const encoder = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function valueAt(body: any, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], body);
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '';
}

function language(body: any) {
  const raw = valueAt(body, [
    'language',
    'lang',
    'contact.language',
    'contact.lang',
    'variables.language',
    'variables.lang',
    'answers.language',
  ]).toLowerCase();
  if (raw.includes('uk') || raw.includes('ua') || raw.includes('укр')) return 'ua';
  if (raw.includes('en') || raw.includes('англ')) return 'en';
  return 'ru';
}

function extractStartToken(body: any) {
  const explicit = valueAt(body, ['link_token', 'start_param', 'payload.token', 'variables.link_token', 'variables.start_param', 'command.args']);
  if (explicit) return explicit;
  const text = valueAt(body, ['text', 'message.text', 'data.text', 'last_message.text', 'event.text']);
  const match = text.match(/(?:\/start|start)\s+([A-Za-z0-9_-]+)/i) || text.match(/link[_-]?([A-Fa-f0-9]{32,})/);
  return match?.[1] || '';
}

function extractSetting(body: any) {
  const raw = valueAt(body, ['notification_setting', 'setting', 'payload.setting', 'variables.notification_setting']).toLowerCase();
  const text = valueAt(body, ['text', 'message.text', 'data.text', 'event.text']).toLowerCase();
  const source = raw || text;
  const enabledRaw = valueAt(body, ['enabled', 'payload.enabled', 'variables.enabled']).toLowerCase();
  const enabled = enabledRaw ? ['1', 'true', 'on', 'yes', 'да', 'так'].includes(enabledRaw) : !source.includes('_off') && !source.includes('off') && !source.includes('выкл') && !source.includes('вимк');
  if (source.includes('reminder') || source.includes('напомин') || source.includes('нагад')) return { column: 'notify_lesson_reminders', enabled };
  if (source.includes('homework') || source.includes('домаш')) return { column: 'notify_homework', enabled };
  if (source.includes('grade') || source.includes('оцен') || source.includes('оцін')) return { column: 'notify_grades', enabled };
  if (source.includes('schedule') || source.includes('перен') || source.includes('cancel') || source.includes('скас') || source.includes('отмен')) return { column: 'notify_schedule_changes', enabled };
  return null;
}

async function upsertParent(admin: any, body: any) {
  const sendpulseContactId = valueAt(body, ['contact.id', 'contact_id', 'subscriber.id', 'subscriber_id', 'contactId']);
  const telegramChatId = valueAt(body, ['telegram.chat_id', 'chat.id', 'chat_id', 'message.chat.id', 'contact.telegram_chat_id']);
  const telegramUserId = valueAt(body, ['telegram.user_id', 'from.id', 'message.from.id', 'user.id', 'telegram_id']);
  const telegramUsername = valueAt(body, ['telegram.username', 'from.username', 'message.from.username', 'username', 'contact.username']);
  const parentName = valueAt(body, ['parent_name', 'contact.name', 'subscriber.name', 'from.first_name', 'message.from.first_name']);
  const lang = language(body);

  if (!sendpulseContactId && !telegramChatId && !telegramUserId) {
    throw new Error('Webhook does not contain SendPulse contact id or Telegram chat id');
  }

  const identityColumn = sendpulseContactId ? 'sendpulse_contact_id' : telegramChatId ? 'telegram_chat_id' : 'telegram_user_id';
  const identityValue = sendpulseContactId || telegramChatId || telegramUserId;
  const payload = {
    sendpulse_contact_id: sendpulseContactId || null,
    telegram_chat_id: telegramChatId || null,
    telegram_user_id: telegramUserId || null,
    telegram_username: telegramUsername || null,
    parent_name: parentName || null,
    language: lang,
  };

  const { data: existing } = await admin.from('telegram_parent_accounts').select('*').eq(identityColumn, identityValue).maybeSingle();
  if (existing) {
    const { data, error } = await admin.from('telegram_parent_accounts').update(payload).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin.from('telegram_parent_accounts').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

async function linkByToken(admin: any, token: string, parent: any) {
  const tokenHash = await sha256(token);
  const { data: link, error } = await admin
    .from('telegram_link_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!link) return { linked: false, reason: 'expired_or_used' };

  const { error: relError } = await admin
    .from('student_parent_links')
    .upsert({ student_id: link.student_id, parent_id: parent.id }, { onConflict: 'student_id,parent_id' });
  if (relError) throw relError;

  const { error: usedError } = await admin
    .from('telegram_link_tokens')
    .update({ used_at: new Date().toISOString(), used_by_parent_id: parent.id })
    .eq('id', link.id);
  if (usedError) throw usedError;

  return { linked: true, studentId: link.student_id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const webhookSecret = Deno.env.get('SENDPULSE_WEBHOOK_SECRET');
    if (webhookSecret && req.headers.get('x-webhook-secret') !== webhookSecret && req.headers.get('Authorization') !== `Bearer ${webhookSecret}`) {
      return json({ error: 'Forbidden' }, 403);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE);
    const body = await req.json().catch(() => ({}));
    const parent = await upsertParent(admin, body);
    const token = extractStartToken(body);
    const setting = extractSetting(body);
    const result: Record<string, unknown> = { success: true, parentId: parent.id };

    if (token) {
      result.link = await linkByToken(admin, token, parent);
    }

    if (setting) {
      const { error } = await admin.from('telegram_parent_accounts').update({ [setting.column]: setting.enabled }).eq('id', parent.id);
      if (error) throw error;
      result.setting = setting;
    }

    return json(result);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
