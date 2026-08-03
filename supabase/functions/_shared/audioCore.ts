export const audioContentTypes = ['dictionary_word', 'listening_task', 'lesson_card', 'lesson_audio_block'] as const;

export type AudioContentType = typeof audioContentTypes[number];
export type AudioAction = 'generate' | 'delete';

export type AudioRequest = {
  action: AudioAction;
  contentType: AudioContentType;
  entityId: string;
  lessonId?: string;
  voiceId?: string;
  modelId?: string;
  textOverride?: string;
};

export function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isAudioContentType(value: string): value is AudioContentType {
  return (audioContentTypes as readonly string[]).includes(value);
}

export function requiredIdMessage(contentType: AudioContentType) {
  if (contentType === 'dictionary_word') return 'dictionary word id is required';
  if (contentType === 'listening_task') return 'listening task id is required';
  if (contentType === 'lesson_audio_block') return 'lesson audio block id is required';
  return 'lesson card id is required';
}

export function notFoundMessage(contentType: AudioContentType) {
  if (contentType === 'dictionary_word') return 'Dictionary word not found';
  if (contentType === 'listening_task') return 'Listening task not found';
  if (contentType === 'lesson_audio_block') return 'Audio block not found in this lesson';
  return 'Lesson card not found in this lesson';
}

function legacyContentType(body: Record<string, unknown>) {
  if (cleanString(body.dictionary_word_id || body.word_id)) return 'dictionary_word';
  if (cleanString(body.content_item_id || body.listening_task_id)) return 'listening_task';
  if (cleanString(body.block_id || body.audio_block_id)) return 'lesson_audio_block';
  if (cleanString(body.card_id)) return 'lesson_card';
  return '';
}

function legacyEntityId(body: Record<string, unknown>, contentType: AudioContentType) {
  if (contentType === 'dictionary_word') return cleanString(body.dictionary_word_id || body.word_id);
  if (contentType === 'listening_task') return cleanString(body.content_item_id || body.listening_task_id);
  if (contentType === 'lesson_audio_block') return cleanString(body.block_id || body.audio_block_id);
  return cleanString(body.card_id);
}

export function parseAudioRequest(body: Record<string, unknown>): AudioRequest {
  const action: AudioAction = body.action === 'delete' ? 'delete' : 'generate';
  const rawContentType = cleanString(body.contentType || body.content_type) || legacyContentType(body);
  if (!isAudioContentType(rawContentType)) throw new Error('Invalid contentType');

  const entityId = cleanString(body.entityId || body.entity_id) || legacyEntityId(body, rawContentType);
  if (!entityId) throw new Error(requiredIdMessage(rawContentType));

  const lessonId = cleanString(body.lessonId || body.lesson_id);
  if ((rawContentType === 'lesson_card' || rawContentType === 'lesson_audio_block') && !lessonId) {
    throw new Error('lesson id is required');
  }

  return {
    action,
    contentType: rawContentType,
    entityId,
    lessonId: lessonId || undefined,
    voiceId: cleanString(body.voiceId || body.voice_id) || undefined,
    modelId: cleanString(body.modelId || body.model_id) || undefined,
    textOverride: cleanString(body.textOverride || body.text) || undefined,
  };
}
