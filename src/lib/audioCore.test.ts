import { describe, expect, it } from 'vitest';
import { notFoundMessage, parseAudioRequest } from '../../supabase/functions/_shared/audioCore';

describe('audio request contract', () => {
  it('keeps the four production audio targets explicit', () => {
    expect(parseAudioRequest({ contentType: 'dictionary_word', entityId: 'word_1' })).toMatchObject({
      contentType: 'dictionary_word',
      entityId: 'word_1',
    });
    expect(parseAudioRequest({ contentType: 'listening_task', entityId: 'listen_1' })).toMatchObject({
      contentType: 'listening_task',
      entityId: 'listen_1',
    });
    expect(parseAudioRequest({ contentType: 'lesson_card', entityId: 'card_1', lessonId: 'lesson_1' })).toMatchObject({
      contentType: 'lesson_card',
      entityId: 'card_1',
      lessonId: 'lesson_1',
    });
    expect(parseAudioRequest({ contentType: 'lesson_audio_block', entityId: 'audio_1', lessonId: 'lesson_1' })).toMatchObject({
      contentType: 'lesson_audio_block',
      entityId: 'audio_1',
      lessonId: 'lesson_1',
    });
  });

  it('keeps legacy non-card ids mapped to their original content types', () => {
    expect(parseAudioRequest({ dictionary_word_id: 'word_legacy' }).contentType).toBe('dictionary_word');
    expect(parseAudioRequest({ content_item_id: 'listen_legacy' }).contentType).toBe('listening_task');
    expect(parseAudioRequest({ block_id: 'block_legacy', lesson_id: 'lesson_1' }).contentType).toBe('lesson_audio_block');
    expect(parseAudioRequest({ card_id: 'card_legacy', lesson_id: 'lesson_1' }).contentType).toBe('lesson_card');
  });

  it('does not default unknown payloads to lesson cards', () => {
    expect(() => parseAudioRequest({ id: 'unknown' })).toThrow('Invalid contentType');
    expect(() => parseAudioRequest({ contentType: 'lesson_audio_block', entityId: 'block_1' })).toThrow('lesson id is required');
  });

  it('uses content-specific not found messages', () => {
    expect(notFoundMessage('dictionary_word')).toBe('Dictionary word not found');
    expect(notFoundMessage('listening_task')).toBe('Listening task not found');
    expect(notFoundMessage('lesson_audio_block')).toBe('Audio block not found in this lesson');
    expect(notFoundMessage('lesson_card')).toBe('Lesson card not found in this lesson');
  });
});
