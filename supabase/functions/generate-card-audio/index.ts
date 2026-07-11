import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type TheoryCard = Record<string, unknown> & {
  id?: string;
  word?: string;
  sentence?: string;
  audio_url?: string;
};

function findCard(payload: Record<string, unknown>, cardId: string): TheoryCard | null {
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const items = Array.isArray((block as Record<string, unknown>).items)
      ? (block as Record<string, unknown>).items as unknown[]
      : [];
    const card = items.find(item => item && typeof item === 'object' && (item as TheoryCard).id === cardId);
    if (card) return card as TheoryCard;
  }
  return null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Supabase configuration is missing' }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.slice('Bearer '.length);
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || typeof userId !== 'string') return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminRole, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (roleError) return json({ error: 'Unable to verify admin role' }, 500);
    if (!adminRole) return json({ error: 'Forbidden: admin role required' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'delete' ? 'delete' : 'generate';
    const cardId = typeof body?.card_id === 'string' ? body.card_id.trim() : '';
    const lessonId = typeof body?.lesson_id === 'string' ? body.lesson_id.trim() : '';
    if (!cardId || !lessonId) return json({ error: 'card_id and lesson_id are required' }, 400);

    const { data: task, error: taskError } = await admin
      .from('interactive_tasks')
      .select('id, payload_json')
      .eq('lesson_id', lessonId)
      .eq('mechanic_type', 'theory_content')
      .limit(1)
      .maybeSingle();
    if (taskError) return json({ error: taskError.message }, 500);
    if (!task) return json({ error: 'Theory lesson not found' }, 404);

    const payload = structuredClone((task.payload_json || {}) as Record<string, unknown>);
    const card = findCard(payload, cardId);
    if (!card) return json({ error: 'Card not found in this lesson' }, 404);
    const previousPath = typeof card.audio_url === 'string' ? card.audio_url : null;

    if (action === 'delete') {
      delete card.audio_url;
      delete card.audio_voice_id;
      delete card.audio_model_id;
      const { error: updateError } = await admin
        .from('interactive_tasks')
        .update({ payload_json: payload })
        .eq('id', task.id);
      if (updateError) return json({ error: updateError.message }, 500);
      if (previousPath && !/^(https?:|data:|blob:)/.test(previousPath)) {
        await admin.storage.from('lesson-audio').remove([previousPath]);
      }
      return json({ success: true });
    }

    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const voiceId = typeof body?.voice_id === 'string' ? body.voice_id.trim() : '';
    const modelId = typeof body?.model_id === 'string' ? body.model_id.trim() : '';
    const cardText = typeof card.word === 'string' ? card.word.trim() : typeof card.sentence === 'string' ? card.sentence.trim() : '';
    if (!text || text.length > 1000) return json({ error: 'Text must contain between 1 and 1000 characters' }, 400);
    if (text !== cardText) return json({ error: 'Text does not match the selected card' }, 400);
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(voiceId)) return json({ error: 'Invalid voice_id' }, 400);
    if (!/^[A-Za-z0-9_.-]{3,100}$/.test(modelId)) return json({ error: 'Invalid model_id' }, 400);

    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsKey) return json({ error: 'ELEVENLABS_API_KEY is not configured' }, 503);

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text, model_id: modelId }),
      },
    );
    if (!ttsResponse.ok) {
      const detail = await ttsResponse.text();
      console.error('ElevenLabs TTS failed', ttsResponse.status, detail);
      return json({ error: `ElevenLabs TTS failed (${ttsResponse.status})` }, 502);
    }

    const audio = await ttsResponse.arrayBuffer();
    if (audio.byteLength === 0) return json({ error: 'ElevenLabs returned an empty audio file' }, 502);

    const storagePath = `${lessonId}/${cardId}/${crypto.randomUUID()}.mp3`;
    const { error: uploadError } = await admin.storage
      .from('lesson-audio')
      .upload(storagePath, audio, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false });
    if (uploadError) return json({ error: uploadError.message }, 500);

    card.audio_url = storagePath;
    card.audio_voice_id = voiceId;
    card.audio_model_id = modelId;
    const { error: updateError } = await admin
      .from('interactive_tasks')
      .update({ payload_json: payload })
      .eq('id', task.id);
    if (updateError) {
      await admin.storage.from('lesson-audio').remove([storagePath]);
      return json({ error: updateError.message }, 500);
    }

    if (previousPath && previousPath !== storagePath && !/^(https?:|data:|blob:)/.test(previousPath)) {
      await admin.storage.from('lesson-audio').remove([previousPath]);
    }

    return json({ success: true, audio_url: storagePath });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error' }, 500);
  }
});
