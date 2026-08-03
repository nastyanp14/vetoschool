import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import type { AudioContentType } from '../_shared/audioCore.ts';
import {
  cleanString,
  notFoundMessage,
  parseAudioRequest,
  requiredIdMessage,
} from '../_shared/audioCore.ts';

const AUDIO_BUCKET = 'lesson-audio';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';

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

type AudioTarget = {
  id: string;
  text: string;
  previousPath: string | null;
  persist: (audioPath: string | null, voiceId?: string, modelId?: string) => Promise<void>;
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

function findAudioBlock(payload: Record<string, unknown>, blockId: string) {
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
  return blocks.find(block => (
    block
    && typeof block === 'object'
    && (block as Record<string, unknown>).id === blockId
    && (block as Record<string, unknown>).type === 'audio'
  )) as Record<string, unknown> | undefined;
}

async function loadTheoryPayload(admin: any, lessonId: string) {
  const { data: task, error } = await admin
    .from('interactive_tasks')
    .select('id, payload_json')
    .eq('lesson_id', lessonId)
    .eq('mechanic_type', 'theory_content')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error('Theory lesson not found');
  return {
    taskId: task.id,
    payload: structuredClone((task.payload_json || {}) as Record<string, unknown>),
  };
}

async function updateTheoryPayload(admin: any, taskId: string, payload: Record<string, unknown>) {
  const { error } = await admin.from('interactive_tasks').update({ payload_json: payload }).eq('id', taskId);
  if (error) throw new Error(error.message);
}

async function resolveTarget(admin: any, body: Record<string, unknown>, contentType: AudioContentType): Promise<AudioTarget> {
  if (contentType === 'dictionary_word') {
    const id = cleanString(body.entityId || body.entity_id || body.dictionary_word_id || body.word_id);
    if (!id) throw new Error(requiredIdMessage(contentType));
    const { data, error } = await admin.from('dictionary_words').select('id,word,audio_url').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(notFoundMessage(contentType));
    const text = cleanString(body.textOverride || body.text) || cleanString(data.word);
    return {
      id,
      text,
      previousPath: cleanString(data.audio_url) || null,
      persist: async (audioPath) => {
        const { error: updateError } = await admin.from('dictionary_words').update({ audio_url: audioPath }).eq('id', id);
        if (updateError) throw new Error(updateError.message);
      },
    };
  }

  if (contentType === 'listening_task') {
    const id = cleanString(body.entityId || body.entity_id || body.content_item_id || body.listening_task_id);
    if (!id) throw new Error(requiredIdMessage(contentType));
    const { data, error } = await admin.from('content_items').select('id,type,title,file_url,teacher_comment').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.type !== 'listening') throw new Error(notFoundMessage(contentType));
    const text = cleanString(body.textOverride || body.text) || cleanString(data.teacher_comment) || cleanString(data.title);
    return {
      id,
      text,
      previousPath: cleanString(data.file_url) || null,
      persist: async (audioPath) => {
        const { error: updateError } = await admin.from('content_items').update({
          file_url: audioPath,
          file_name: audioPath ? 'generated-listening.mp3' : null,
        }).eq('id', id);
        if (updateError) throw new Error(updateError.message);
      },
    };
  }

  const lessonId = cleanString(body.lessonId || body.lesson_id);
  if (!lessonId) throw new Error('lesson id is required');
  const { taskId, payload } = await loadTheoryPayload(admin, lessonId);

  if (contentType === 'lesson_audio_block') {
    const blockId = cleanString(body.entityId || body.entity_id || body.block_id || body.audio_block_id);
    if (!blockId) throw new Error(requiredIdMessage(contentType));
    const block = findAudioBlock(payload, blockId);
    if (!block) throw new Error(notFoundMessage(contentType));
    const text = cleanString(body.textOverride || body.text) || cleanString(block.description) || cleanString(block.title);
    return {
      id: `${lessonId}/${blockId}`,
      text,
      previousPath: cleanString(block.audio_url || block.audio) || null,
      persist: async (audioPath, voiceId, modelId) => {
        block.audio_url = audioPath || undefined;
        block.audio = audioPath || '';
        block.audio_voice_id = audioPath ? voiceId : undefined;
        block.audio_model_id = audioPath ? modelId : undefined;
        await updateTheoryPayload(admin, taskId, payload);
      },
    };
  }

  const cardId = cleanString(body.entityId || body.entity_id || body.card_id);
  if (!cardId) throw new Error(requiredIdMessage(contentType));
  const card = findCard(payload, cardId);
  if (!card) throw new Error(notFoundMessage(contentType));
  const text = cleanString(body.textOverride || body.text) || cleanString(card.word) || cleanString(card.sentence);
  return {
    id: `${lessonId}/${cardId}`,
    text,
      previousPath: cleanString(card.audio_url) || null,
    persist: async (audioPath, voiceId, modelId) => {
      card.audio_url = audioPath || undefined;
      card.audio_voice_id = audioPath ? voiceId : undefined;
      card.audio_model_id = audioPath ? modelId : undefined;
      await updateTheoryPayload(admin, taskId, payload);
    },
  };
}

async function requireEducator(admin: any, userId: string) {
  const { data, error } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'teacher'])
    .limit(1);
  if (error) throw new Error('Unable to verify educator role');
  if (!data?.length) throw new Error('Forbidden: educator role required');
}

async function generateElevenLabsAudio(text: string, voiceId: string, modelId: string, apiKey: string) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: modelId }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    console.error('ElevenLabs TTS failed', response.status, detail);
    let reason = detail.trim();
    try {
      const parsed = JSON.parse(detail) as { detail?: unknown; message?: string; error?: string };
      if (typeof parsed.detail === 'string') reason = parsed.detail;
      else if (parsed.detail && typeof parsed.detail === 'object') {
        const nested = parsed.detail as { status?: string; message?: string };
        reason = [nested.status, nested.message].filter(Boolean).join(': ');
      } else if (parsed.message || parsed.error) {
        reason = parsed.message || parsed.error || reason;
      }
    } catch {
      // Keep the plain provider response.
    }
    throw new Error(`ElevenLabs TTS failed (${response.status})${reason ? `: ${reason}` : ''}`);
  }
  const audio = await response.arrayBuffer();
  if (audio.byteLength === 0) throw new Error('ElevenLabs returned an empty audio file');
  return audio;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Supabase configuration is missing' }, 500);

    const token = authHeader.slice('Bearer '.length);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    const userId = authData.user?.id;
    if (authError || typeof userId !== 'string') return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      await requireEducator(admin, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Forbidden';
      return json({ error: message }, message.startsWith('Forbidden') ? 403 : 500);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    let audioRequest;
    try {
      audioRequest = parseAudioRequest(body);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid audio request' }, 400);
    }
    const contentTypeValue = audioRequest.contentType;

    const target = await resolveTarget(admin, body, contentTypeValue);
    if (audioRequest.action === 'delete') {
      if (target.previousPath && !/^(https?:|data:|blob:)/.test(target.previousPath)) {
        const { error: removeError } = await admin.storage.from(AUDIO_BUCKET).remove([target.previousPath]);
        if (removeError && !/not.?found|404/i.test(removeError.message || '')) {
          return json({ error: removeError.message }, 500);
        }
      }
      await target.persist(null);
      return json({ success: true });
    }

    const text = target.text;
    if (!text || text.length > 3000) return json({ error: 'Text must contain between 1 and 3000 characters' }, 400);
    const voiceId = audioRequest.voiceId || DEFAULT_VOICE_ID;
    const modelId = audioRequest.modelId || DEFAULT_MODEL_ID;
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(voiceId)) return json({ error: 'Invalid voice_id' }, 400);
    if (!/^[A-Za-z0-9_.-]{3,100}$/.test(modelId)) return json({ error: 'Invalid model_id' }, 400);

    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsKey) return json({ error: 'ELEVENLABS_API_KEY is not configured' }, 503);

    const audio = await generateElevenLabsAudio(text, voiceId, modelId, elevenLabsKey);
    const storagePath = `${contentTypeValue}/${target.id}/${crypto.randomUUID()}.mp3`.replace(/\/+/g, '/');
    const { error: uploadError } = await admin.storage
      .from(AUDIO_BUCKET)
      .upload(storagePath, audio, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false });
    if (uploadError) return json({ error: uploadError.message }, 500);

    try {
      await target.persist(storagePath, voiceId, modelId);
    } catch (error) {
      await admin.storage.from(AUDIO_BUCKET).remove([storagePath]);
      throw error;
    }

    if (target.previousPath && target.previousPath !== storagePath && !/^(https?:|data:|blob:)/.test(target.previousPath)) {
      await admin.storage.from(AUDIO_BUCKET).remove([target.previousPath]);
    }

    return json({ success: true, audio_url: storagePath, content_type: contentTypeValue });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error' }, 500);
  }
});
