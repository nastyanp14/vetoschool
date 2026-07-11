import { supabase } from '@/integrations/supabase/client';

export const LESSON_AUDIO_BUCKET = 'lesson-audio';
export const DEFAULT_ELEVENLABS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
export const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';

export interface GenerateCardAudioInput {
  card_id: string;
  lesson_id: string;
  text: string;
  voice_id: string;
  model_id: string;
}

async function invokeCardAudio(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('generate-card-audio', { body });
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
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error || 'Не удалось выполнить операцию с аудио');
  return data as { success: true; audio_url?: string };
}

export async function generateCardAudio(input: GenerateCardAudioInput) {
  return invokeCardAudio({ action: 'generate', ...input });
}

export async function deleteCardAudio(cardId: string, lessonId: string) {
  return invokeCardAudio({ action: 'delete', card_id: cardId, lesson_id: lessonId });
}

export async function signedLessonAudioUrl(path: string, expiresIn = 3600) {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const { data, error } = await supabase.storage.from(LESSON_AUDIO_BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
