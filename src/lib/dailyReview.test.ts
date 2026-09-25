import { describe, expect, it } from 'vitest';
import type { DictWord } from './dictionary';
import {
  answerMatches,
  buildTranslationOptions,
  buildWordOptions,
  buildReviewQueue,
  createLetterInstances,
  legacyProgress,
  newlyLearnedProgress,
  nextProgressAfterAttempt,
  normalizeReviewAnswer,
} from './dailyReview';

const word = (id: string, value = id): DictWord => ({
  id,
  userId: 'student',
  lesson: '',
  category: '',
  word: value,
  translation: `${value}-translation`,
  emoji: '✨',
});

describe('daily review domain', () => {
  it('normalizes punctuation and accepts a spoken target inside a transcript', () => {
    expect(normalizeReviewAnswer("  Elephant!  ")).toBe('elephant');
    expect(answerMatches('speaking', word('1', 'Elephant'), 'I said elephant')).toBe(true);
    expect(answerMatches('speaking', word('1', 'Elephant'), 'elegant')).toBe(false);
    expect(answerMatches('speaking', word('2', 'Schoolbag'), 'school bag')).toBe(true);
    expect(answerMatches('speaking', word('2', 'Schoolbag'), 'my school bag')).toBe(true);
    expect(answerMatches('speaking', word('2', 'Schoolbag'), 'school bad')).toBe(false);
  });

  it('builds four translation options without normalized duplicates', () => {
    const elephant = { ...word('elephant', 'Elephant'), translation: 'слон', category: 'Animals', lesson: 'Animals 1' };
    const item = { id: 'elephant:translation:0', word: elephant, exerciseType: 'translation' as const, retry: false };
    const options = buildTranslationOptions(item, [
      elephant,
      { ...word('duplicate'), translation: ' Слон  ', category: 'Animals', lesson: 'Animals 1' },
      { ...word('lion'), translation: 'Лев', category: 'Animals', lesson: 'Animals 1' },
      { ...word('tiger'), translation: 'Тигр', category: 'Animals', lesson: 'Animals 2' },
      { ...word('bear'), translation: 'Медведь', category: 'Animals', lesson: 'Animals 1' },
    ]);

    expect(options).toHaveLength(4);
    expect(new Set(options.map(normalizeReviewAnswer)).size).toBe(4);
    expect(options.filter(option => normalizeReviewAnswer(option) === 'слон')).toHaveLength(1);
  });

  it('fills a small vocabulary with same-script fallback distractors', () => {
    const elephant = { ...word('elephant', 'Elephant'), translation: 'слон' };
    const item = { id: 'elephant:translation:fallback', word: elephant, exerciseType: 'translation' as const, retry: false };
    const options = buildTranslationOptions(item, [elephant]);

    expect(options).toHaveLength(4);
    expect(options.every(option => /\p{Script=Cyrillic}/u.test(option))).toBe(true);
  });

  it('builds English word options for the picture-choice exercise', () => {
    const book = { ...word('book', 'Book'), translation: 'книга', category: 'School', lesson: 'School 1' };
    const item = { id: 'book:word_building:picture', word: book, exerciseType: 'word_building' as const, retry: false };
    const options = buildWordOptions(item, [
      book,
      { ...word('pencil', 'Pencil'), translation: 'карандаш', category: 'School', lesson: 'School 1' },
      { ...word('schoolbag', 'Schoolbag'), translation: 'школьный рюкзак', category: 'School', lesson: 'School 1' },
      { ...word('globe', 'Globe'), translation: 'глобус', category: 'School', lesson: 'School 1' },
    ]);

    expect(options).toHaveLength(4);
    expect(options).toEqual(expect.arrayContaining(['Book', 'Pencil', 'Schoolbag', 'Globe']));
    expect(options).not.toContain('книга');
  });

  it('keeps repeated letters as unique instances', () => {
    const letters = createLetterInstances('Elephant', 'review-1');
    expect(letters).toHaveLength(8);
    expect(new Set(letters.map(letter => letter.id)).size).toBe(8);
    expect(letters.filter(letter => letter.value === 'E')).toHaveLength(2);
  });

  it('selects only due learned words and caps the configured session size', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const words = Array.from({ length: 12 }, (_, index) => word(String(index)));
    const progress = new Map(words.map(item => [item.id, legacyProgress(item.id, now)]));
    progress.get('11')!.nextReviewAt = '2026-09-05T12:00:00Z';
    const queue = buildReviewQueue(words, progress, now, 6);
    expect(queue).toHaveLength(6);
    expect(queue.some(item => item.word.id === '11')).toBe(false);
    expect(queue.slice(0, 3).map(item => item.exerciseType)).toEqual(['translation', 'speaking', 'word_building']);
  });

  it('expands intervals on success and prioritizes errors', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const initial = legacyProgress('word', now);
    const success = nextProgressAfterAttempt(initial, true, 'translation', now);
    expect(success.reviewIntervalDays).toBe(3);
    expect(success.successCount).toBe(1);
    const failed = nextProgressAfterAttempt(success, false, 'word_building', now);
    expect(failed.reviewIntervalDays).toBe(1);
    expect(failed.priority).toBeGreaterThan(success.priority);
    expect(failed.errorCount).toBe(1);
  });

  it('does not schedule a newly learned word for the same day', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const learned = newlyLearnedProgress('word', now);
    expect(learned.learnedAt).toBe(now.toISOString());
    expect(learned.nextReviewAt).toBe('2026-09-03T12:00:00.000Z');
  });
});
