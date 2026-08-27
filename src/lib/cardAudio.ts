import { supabase } from '@/integrations/supabase/client';
import type { AudioContentType, AudioRequest } from '../../supabase/functions/_shared/audioCore';
import {
  cleanString,
  notFoundMessage,
  requiredIdMessage,
} from '../../supabase/functions/_shared/audioCore';

export const LESSON_AUDIO_BUCKET = 'lesson-audio';
export const DEFAULT_ELEVENLABS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
export const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';

type TheoryCard = Record<string, unknown> & {
  id?: string;
  word?: string;
  sentence?: string;
  audio_url?: string;
};

type LocalAudioTarget = {
  text: string;
  previousPath: string | null;
  persist: (audioPath: string | null, voiceId?: string, modelId?: string) => Promise<void>;
};

function clonePayload(payload: Record<string, unknown>) {
  if (typeof structuredClone === 'function') return structuredClone(payload);
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

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

async function loadTheoryPayload(lessonId: string) {
  const { data: task, error } = await (supabase as any)
    .from('interactive_tasks')
    .select('id, payload_json')
    .eq('lesson_id', lessonId)
    .eq('mechanic_type', 'theory_content')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!task) throw new Error('Theory lesson not found');
  return {
    taskId: task.id as string,
    payload: clonePayload((task.payload_json || {}) as Record<string, unknown>),
  };
}

async function updateTheoryPayload(taskId: string, payload: Record<string, unknown>) {
  const { error } = await (supabase as any)
    .from('interactive_tasks')
    .update({ payload_json: payload })
    .eq('id', taskId);
  if (error) throw error;
}

function localAudioDataUrl(text: string) {
  const sampleRate = 8000;
  const seconds = 0.35;
  const samples = Math.floor(sampleRate * seconds);
  const dataSize = samples * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);

  const hash = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const freq = 330 + (hash % 180);
  for (let i = 0; i < samples; i += 1) {
    const sample = Math.sin((i / sampleRate) * Math.PI * 2 * freq) * 0.12;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

async function removeStoragePath(path: string | null) {
  if (!path || /^(https?:|data:|blob:)/.test(path)) return;
  const { error } = await supabase.storage.from(LESSON_AUDIO_BUCKET).remove([path]);
  if (error && !/not.?found|404/i.test(error.message || '')) throw error;
}

async function resolveLocalTarget(request: AudioRequest): Promise<LocalAudioTarget> {
  const { contentType, entityId, lessonId, textOverride } = request;
  if (!entityId) throw new Error(requiredIdMessage(contentType));

  if (contentType === 'dictionary_word') {
    const { data, error } = await (supabase as any)
      .from('dictionary_words')
      .select('id,word,audio_url')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(notFoundMessage(contentType));
    return {
      text: cleanString(textOverride) || cleanString(data.word),
      previousPath: cleanString(data.audio_url) || null,
      persist: async (audioPath) => {
        const { error: updateError } = await (supabase as any)
          .from('dictionary_words')
          .update({ audio_url: audioPath })
          .eq('id', entityId);
        if (updateError) throw updateError;
      },
    };
  }

  if (contentType === 'listening_task') {
    const { data, error } = await (supabase as any)
      .from('content_items')
      .select('id,type,title,file_url,teacher_comment')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.type !== 'listening') throw new Error(notFoundMessage(contentType));
    return {
      text: cleanString(textOverride) || cleanString(data.teacher_comment) || cleanString(data.title),
      previousPath: cleanString(data.file_url) || null,
      persist: async (audioPath) => {
        const { error: updateError } = await (supabase as any)
          .from('content_items')
          .update({ file_url: audioPath, file_name: audioPath ? 'generated-local-audio.wav' : null })
          .eq('id', entityId);
        if (updateError) throw updateError;
      },
    };
  }

  if (!lessonId) throw new Error('lesson id is required');
  const { taskId, payload } = await loadTheoryPayload(lessonId);

  if (contentType === 'lesson_audio_block') {
    const block = findAudioBlock(payload, entityId);
    if (!block) throw new Error(notFoundMessage(contentType));
    return {
      text: cleanString(textOverride) || cleanString(block.description) || cleanString(block.title),
      previousPath: cleanString(block.audio_url || block.audio) || null,
      persist: async (audioPath, voiceId, modelId) => {
        block.audio_url = audioPath || undefined;
        block.audio = audioPath || '';
        block.audio_voice_id = audioPath ? voiceId : undefined;
        block.audio_model_id = audioPath ? modelId : undefined;
        await updateTheoryPayload(taskId, payload);
      },
    };
  }

  const card = findCard(payload, entityId);
  if (!card) throw new Error(notFoundMessage(contentType));
  return {
    text: cleanString(textOverride) || cleanString(card.word) || cleanString(card.sentence),
    previousPath: cleanString(card.audio_url) || null,
    persist: async (audioPath, voiceId, modelId) => {
      card.audio_url = audioPath || undefined;
      card.audio_voice_id = audioPath ? voiceId : undefined;
      card.audio_model_id = audioPath ? modelId : undefined;
      await updateTheoryPayload(taskId, payload);
    },
  };
}

async function localAudioFlow(request: AudioRequest) {
  const target = await resolveLocalTarget(request);
  if (request.action === 'delete') {
    await removeStoragePath(target.previousPath);
    await target.persist(null);
    return { success: true as const };
  }

  const text = target.text;
  if (!text || text.length > 3000) throw new Error('Text must contain between 1 and 3000 characters');
  const audioUrl = localAudioDataUrl(text);
  await target.persist(
    audioUrl,
    request.voiceId || DEFAULT_ELEVENLABS_VOICE_ID,
    request.modelId || DEFAULT_ELEVENLABS_MODEL_ID,
  );
  await removeStoragePath(target.previousPath);
  return { success: true as const, audio_url: audioUrl };
}

async function remoteAudioFlow(request: AudioRequest) {
  const { data, error } = await supabase.functions.invoke('generate-card-audio', { body: edgeAudioBody(request) });
  if (error) {
    let message = error.message || 'Не удалось выполнить операцию с аудио';
    try {
      const response = (error as { context?: Response }).context;
      if (response) {
        const detail = await response.json();
        if (detail?.error) message = detail.error;
      }
    } catch {
      // Keep the original Functions error when the response has no JSON body.
    }
    if (/failed to send|fetch failed|function not found/i.test(message)) {
      message = 'Edge Function generate-card-audio ещё не развернута в Lovable Cloud';
    }
    throw new Error(friendlyAudioError(message));
  }
  if (!data?.success) throw new Error(friendlyAudioError(data?.error || 'Не удалось выполнить операцию с аудио'));
  return data as { success: true; audio_url?: string };
}

function friendlyAudioError(message: string) {
  if (/ElevenLabs TTS failed \(402\)|\b402\b/i.test(message)) {
    return 'ElevenLabs отклонил генерацию (402). Чаще всего Edge Function использует API key от другого ElevenLabs-аккаунта/workspace, где этот voice ID недоступен, либо у этого ключа нет оплаченного TTS-доступа. Старое аудио не заменено.';
  }
  if (/ElevenLabs TTS failed \(401\)|ElevenLabs TTS failed \(403\)|\b401\b|\b403\b/i.test(message)) {
    return 'ElevenLabs отклонил генерацию: проверьте ELEVENLABS_API_KEY и доступ этого API key к выбранному voice ID. Старое аудио не заменено.';
  }
  if (/Invalid voice_id/i.test(message)) {
    return 'Voice ID выглядит неверно. Вставьте полный ID голоса из ElevenLabs, без пробелов.';
  }
  return message;
}

function shouldUseLocalAudioProvider() {
  return import.meta.env.VITE_AUDIO_PROVIDER === 'local';
}

async function runAudioFlow(request: AudioRequest) {
  return shouldUseLocalAudioProvider() ? localAudioFlow(request) : remoteAudioFlow(request);
}

function audioRequest(contentType: AudioContentType, entityId: string, input: Partial<AudioRequest> = {}): AudioRequest {
  return {
    action: input.action || 'generate',
    contentType,
    entityId,
    lessonId: input.lessonId,
    voiceId: input.voiceId,
    modelId: input.modelId,
    textOverride: input.textOverride,
  };
}

function edgeAudioBody(request: AudioRequest) {
  const body: Record<string, unknown> = {
    ...request,
    content_type: request.contentType,
    entity_id: request.entityId,
    lesson_id: request.lessonId,
    voice_id: request.voiceId,
    model_id: request.modelId,
    text: request.textOverride,
  };
  if (request.contentType === 'dictionary_word') body.dictionary_word_id = request.entityId;
  if (request.contentType === 'listening_task') body.content_item_id = request.entityId;
  if (request.contentType === 'lesson_audio_block') body.block_id = request.entityId;
  if (request.contentType === 'lesson_card') body.card_id = request.entityId;
  return body;
}

export interface GenerateCardAudioInput {
  card_id: string;
  lesson_id: string;
  text: string;
  voice_id: string;
  model_id: string;
}

export async function generateCardAudio(input: GenerateCardAudioInput) {
  return runAudioFlow(audioRequest('lesson_card', input.card_id, {
    lessonId: input.lesson_id,
    textOverride: input.text,
    voiceId: input.voice_id,
    modelId: input.model_id,
  }));
}

export async function deleteCardAudio(cardId: string, lessonId: string) {
  return runAudioFlow(audioRequest('lesson_card', cardId, { action: 'delete', lessonId }));
}

export async function generateDictionaryWordAudio(input: { dictionary_word_id: string; text?: string; voice_id: string; model_id: string }) {
  return runAudioFlow(audioRequest('dictionary_word', input.dictionary_word_id, {
    textOverride: input.text,
    voiceId: input.voice_id,
    modelId: input.model_id,
  }));
}

export async function deleteDictionaryWordAudio(dictionaryWordId: string) {
  return runAudioFlow(audioRequest('dictionary_word', dictionaryWordId, { action: 'delete' }));
}

export async function generateListeningTaskAudio(input: { content_item_id: string; text?: string; voice_id: string; model_id: string }) {
  return runAudioFlow(audioRequest('listening_task', input.content_item_id, {
    textOverride: input.text,
    voiceId: input.voice_id,
    modelId: input.model_id,
  }));
}

export async function deleteListeningTaskAudio(contentItemId: string) {
  return runAudioFlow(audioRequest('listening_task', contentItemId, { action: 'delete' }));
}

export async function generateLessonAudioBlock(input: { lesson_id: string; block_id: string; text?: string; voice_id: string; model_id: string }) {
  return runAudioFlow(audioRequest('lesson_audio_block', input.block_id, {
    lessonId: input.lesson_id,
    textOverride: input.text,
    voiceId: input.voice_id,
    modelId: input.model_id,
  }));
}

export async function deleteLessonAudioBlock(lessonId: string, blockId: string) {
  return runAudioFlow(audioRequest('lesson_audio_block', blockId, { action: 'delete', lessonId }));
}

export const WORKBOOK_AUDIO_FALLBACK_BUCKET = 'workbook-assets';

function normalizeAudioStoragePath(path: string, bucket: string) {
  const raw = String(path || '').trim().replace(/^\/+/, '');
  const prefix = `${bucket.toLowerCase()}/`;
  return raw.toLowerCase().startsWith(prefix) ? raw.slice(prefix.length) : raw;
}

/**
 * Audio may live in two buckets:
 *  - `lesson-audio`: audio generated by the TTS pipeline,
 *  - `workbook-assets`: legacy/manually uploaded audio (dictionary words, workbook cards).
 * We sign against the generated bucket first and transparently fall back to the workbook
 * bucket, so no existing rows need to be rewritten.
 */
export async function signedLessonAudioUrl(path: string, expiresIn = 3600) {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/.test(path)) return path;

  const buckets = [LESSON_AUDIO_BUCKET, WORKBOOK_AUDIO_FALLBACK_BUCKET];
  for (const bucket of buckets) {
    const relative = normalizeAudioStoragePath(path, bucket);
    if (!relative) continue;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(relative, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return null;
}
