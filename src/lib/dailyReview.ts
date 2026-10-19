/* eslint-disable @typescript-eslint/no-explicit-any -- new Supabase tables/RPCs are accessed before generated types are refreshed */
import { supabase } from '@/integrations/supabase/client';
import type { DictWord } from './dictionary';

export type ReviewExerciseType = 'translation' | 'speaking' | 'word_building';
export type ReviewSessionKind = 'daily' | 'difficult';

export interface DictionaryReviewProgress {
  wordId: string;
  learnedAt: string;
  lastReviewedAt: string | null;
  nextReviewAt: string;
  reviewIntervalDays: number;
  successCount: number;
  errorCount: number;
  mastery: number;
  priority: number;
  lastExerciseType: ReviewExerciseType | null;
}

export interface ReviewItem {
  id: string;
  word: DictWord;
  exerciseType: ReviewExerciseType;
  retry: boolean;
}

export interface ReviewSessionHandle {
  id: string;
  persistent: boolean;
  localDay: string;
}

export interface ReviewAttemptResult {
  correct: boolean;
  persisted: boolean;
}

export interface ReviewCompletionResult {
  starsAwarded: number;
  alreadyCompleted: boolean;
  persisted: boolean;
}

export const DEFAULT_REVIEW_SESSION_SIZE = 10;
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
export const EXERCISE_ORDER: ReviewExerciseType[] = ['translation', 'speaking', 'word_building'];

const localProgressKey = (userId: string) => `dictionary-review-progress:${userId}`;
const localReviewDaysKey = (userId: string) => `dictionary-review-days:${userId}`;

function isMissingReviewInfrastructure(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || '');
  return /dictionary_(?:word_progress|review_sessions)|submit_dictionary_review_answer|start_dictionary_review_session|schema cache|does not exist|404/i.test(message);
}

export function normalizeReviewAnswer(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const CYRILLIC_FALLBACK_TRANSLATIONS = ['банан', 'лимон', 'тигр', 'телефон', 'метро', 'шоколад', 'спорт', 'музей'];
const LATIN_FALLBACK_TRANSLATIONS = ['lion', 'tiger', 'bear', 'apple', 'book', 'house', 'pencil', 'school'];
const CYRILLIC_FALLBACK_WORDS = ['кіт', 'пес', 'дім', 'книга', 'школа', 'мʼяч', 'сонце', 'дерево'];
const LATIN_FALLBACK_WORDS = ['Cat', 'Dog', 'House', 'Book', 'School', 'Ball', 'Sun', 'Tree'];

export function buildTranslationOptions(item: ReviewItem, words: DictWord[], optionCount = 4) {
  const normalizedCorrect = normalizeReviewAnswer(item.word.translation);
  const seen = new Set([normalizedCorrect]);
  const distractors: string[] = [];
  const candidates = words
    .filter(word => word.id !== item.word.id)
    .sort((left, right) => {
      const leftAffinity = Number(left.category === item.word.category) * 2 + Number(left.lesson === item.word.lesson);
      const rightAffinity = Number(right.category === item.word.category) * 2 + Number(right.lesson === item.word.lesson);
      return rightAffinity - leftAffinity;
    })
    .map(word => word.translation);

  const fallbackTranslations = /\p{Script=Cyrillic}/u.test(item.word.translation)
    ? CYRILLIC_FALLBACK_TRANSLATIONS
    : LATIN_FALLBACK_TRANSLATIONS;

  for (const translation of [...candidates, ...fallbackTranslations]) {
    const normalized = normalizeReviewAnswer(translation);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    distractors.push(translation.trim().replace(/\s+/g, ' '));
    if (distractors.length >= optionCount - 1) break;
  }

  return shuffled([item.word.translation.trim(), ...distractors].slice(0, optionCount), item.id);
}

export function buildWordOptions(item: ReviewItem, words: DictWord[], optionCount = 4) {
  const normalizedCorrect = normalizeReviewAnswer(item.word.word);
  const seen = new Set([normalizedCorrect]);
  const distractors: string[] = [];
  const candidates = words
    .filter(word => word.id !== item.word.id)
    .sort((left, right) => {
      const leftAffinity = Number(left.category === item.word.category) * 2 + Number(left.lesson === item.word.lesson);
      const rightAffinity = Number(right.category === item.word.category) * 2 + Number(right.lesson === item.word.lesson);
      return rightAffinity - leftAffinity;
    })
    .map(word => word.word);
  const fallbackWords = /\p{Script=Cyrillic}/u.test(item.word.word) ? CYRILLIC_FALLBACK_WORDS : LATIN_FALLBACK_WORDS;

  for (const word of [...candidates, ...fallbackWords]) {
    const normalized = normalizeReviewAnswer(word);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    distractors.push(word.trim().replace(/\s+/g, ' '));
    if (distractors.length >= optionCount - 1) break;
  }

  return shuffled([item.word.word.trim(), ...distractors].slice(0, optionCount), `${item.id}:picture`);
}

export function answerMatches(exerciseType: ReviewExerciseType, word: DictWord, answer: string) {
  const normalized = normalizeReviewAnswer(answer);
  const target = normalizeReviewAnswer(exerciseType === 'translation' ? word.translation : word.word);
  if (!normalized || !target) return false;
  if (exerciseType === 'speaking') {
    if (normalized === target || normalized.split(' ').includes(target)) return true;
    const compactTarget = target.replaceAll(' ', '');
    const answerParts = normalized.split(' ');
    for (let start = 0; start < answerParts.length; start += 1) {
      let compactCandidate = '';
      for (let end = start; end < answerParts.length; end += 1) {
        compactCandidate += answerParts[end];
        if (compactCandidate === compactTarget) return true;
        if (compactCandidate.length >= compactTarget.length) break;
      }
    }
    return false;
  }
  return normalized === target;
}

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function legacyProgress(wordId: string, now = new Date()): DictionaryReviewProgress {
  return {
    wordId,
    learnedAt: new Date(now.getTime() - 86_400_000).toISOString(),
    lastReviewedAt: null,
    nextReviewAt: now.toISOString(),
    reviewIntervalDays: 1,
    successCount: 0,
    errorCount: 0,
    mastery: 0,
    priority: 0,
    lastExerciseType: null,
  };
}

export function newlyLearnedProgress(wordId: string, now = new Date()): DictionaryReviewProgress {
  return {
    ...legacyProgress(wordId, now),
    learnedAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + REVIEW_INTERVALS_DAYS[0] * 86_400_000).toISOString(),
  };
}

export function nextProgressAfterAttempt(progress: DictionaryReviewProgress, correct: boolean, exerciseType: ReviewExerciseType, now = new Date()): DictionaryReviewProgress {
  if (!correct) {
    return {
      ...progress,
      lastReviewedAt: now.toISOString(),
      nextReviewAt: new Date(now.getTime() + REVIEW_INTERVALS_DAYS[0] * 86_400_000).toISOString(),
      reviewIntervalDays: REVIEW_INTERVALS_DAYS[0],
      errorCount: progress.errorCount + 1,
      mastery: Math.max(0, progress.mastery - 15),
      priority: Math.min(99, progress.priority + 2),
      lastExerciseType: exerciseType,
    };
  }
  const successCount = progress.successCount + 1;
  const intervalIndex = Math.min(successCount, REVIEW_INTERVALS_DAYS.length - 1);
  const reviewIntervalDays = REVIEW_INTERVALS_DAYS[intervalIndex];
  return {
    ...progress,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + reviewIntervalDays * 86_400_000).toISOString(),
    reviewIntervalDays,
    successCount,
    mastery: Math.min(100, progress.mastery + 20),
    priority: Math.max(0, progress.priority - 1),
    lastExerciseType: exerciseType,
  };
}

function seededNumber(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffled<T>(items: T[], seed: string): T[] {
  const result = [...items];
  let state = seededNumber(seed) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createLetterInstances(word: string, itemId: string) {
  const letters = Array.from(word.toLocaleUpperCase()).filter(character => /[\p{L}\p{N}]/u.test(character));
  return shuffled(
    letters.map((value, index) => ({ id: `${itemId}:${index}:${value.codePointAt(0)}`, value })),
    itemId,
  );
}

function exerciseFor(index: number, previous: ReviewExerciseType | null): ReviewExerciseType {
  const preferred = EXERCISE_ORDER[index % EXERCISE_ORDER.length];
  if (preferred !== previous) return preferred;
  return EXERCISE_ORDER[(EXERCISE_ORDER.indexOf(preferred) + 1) % EXERCISE_ORDER.length];
}

export function buildReviewQueue(
  words: DictWord[],
  progressByWordId: Map<string, DictionaryReviewProgress>,
  now = new Date(),
  sessionSize = DEFAULT_REVIEW_SESSION_SIZE,
): ReviewItem[] {
  const due = words
    .filter(word => {
      const progress = progressByWordId.get(word.id);
      return progress && new Date(progress.nextReviewAt).getTime() <= now.getTime();
    })
    .sort((left, right) => {
      const a = progressByWordId.get(left.id)!;
      const b = progressByWordId.get(right.id)!;
      return b.priority - a.priority
        || b.errorCount - a.errorCount
        || new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
        || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(1, sessionSize));

  let previous: ReviewExerciseType | null = null;
  return due.map((word, index) => {
    const stored = progressByWordId.get(word.id)?.lastExerciseType || null;
    const exerciseType = exerciseFor(index, stored === previous ? stored : previous);
    previous = exerciseType;
    return { id: `${word.id}:${exerciseType}:0`, word, exerciseType, retry: false };
  });
}

export function alternateExercise(current: ReviewExerciseType, queueIndex: number) {
  const offset = current === 'translation' ? 1 : current === 'speaking' ? 2 : 1;
  return EXERCISE_ORDER[(queueIndex + offset) % EXERCISE_ORDER.length] === current
    ? EXERCISE_ORDER[(EXERCISE_ORDER.indexOf(current) + 1) % EXERCISE_ORDER.length]
    : EXERCISE_ORDER[(queueIndex + offset) % EXERCISE_ORDER.length];
}

function readLocalProgress(userId: string): DictionaryReviewProgress[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(localProgressKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalProgress(userId: string, progress: DictionaryReviewProgress[]) {
  localStorage.setItem(localProgressKey(userId), JSON.stringify(progress));
}

export async function loadReviewProgress(userId: string, learnedWordIds: string[], localOnly = false) {
  const localRows = readLocalProgress(userId);
  const localById = new Map(localRows.map(row => [row.wordId, row]));
  const now = new Date();
  learnedWordIds.forEach(wordId => {
    if (!localById.has(wordId)) localById.set(wordId, legacyProgress(wordId, now));
  });
  const fallbackRows = [...localById.values()].filter(row => learnedWordIds.includes(row.wordId));
  if (localOnly) {
    writeLocalProgress(userId, fallbackRows);
    return { rows: fallbackRows, persistent: false };
  }

  const { data, error } = await (supabase as any)
    .from('dictionary_word_progress')
    .select('word_id,learned_at,last_reviewed_at,next_review_at,review_interval_days,success_count,error_count,mastery,priority,last_exercise_type')
    .eq('user_id', userId);
  if (error) {
    if (!isMissingReviewInfrastructure(error)) console.error('daily review progress unavailable', error);
    writeLocalProgress(userId, fallbackRows);
    return { rows: fallbackRows, persistent: false };
  }
  const rows: DictionaryReviewProgress[] = (data || []).map((row: any) => ({
    wordId: row.word_id,
    learnedAt: row.learned_at,
    lastReviewedAt: row.last_reviewed_at,
    nextReviewAt: row.next_review_at,
    reviewIntervalDays: Number(row.review_interval_days || 1),
    successCount: Number(row.success_count || 0),
    errorCount: Number(row.error_count || 0),
    mastery: Number(row.mastery || 0),
    priority: Number(row.priority || 0),
    lastExerciseType: row.last_exercise_type || null,
  }));
  const serverIds = new Set(rows.map(row => row.wordId));
  const legacyIds = learnedWordIds.filter(wordId => !serverIds.has(wordId));
  if (legacyIds.length) {
    const imported = legacyIds.map(wordId => {
      const local = localById.get(wordId) || legacyProgress(wordId, now);
      return { user_id: userId, word_id: wordId, learned_at: local.learnedAt, next_review_at: local.nextReviewAt };
    });
    const { error: importError } = await (supabase as any).from('dictionary_word_progress').upsert(imported, { onConflict: 'user_id,word_id' });
    if (!importError) rows.push(...legacyIds.map(wordId => localById.get(wordId) || legacyProgress(wordId, now)));
  }
  writeLocalProgress(userId, rows);
  return { rows, persistent: true };
}

export async function setDictionaryWordLearned(userId: string, wordId: string, learned: boolean, localOnly = false) {
  const localRows = readLocalProgress(userId).filter(row => row.wordId !== wordId);
  if (learned) localRows.push(newlyLearnedProgress(wordId));
  writeLocalProgress(userId, localRows);
  if (localOnly) return false;
  const request = learned
    ? (supabase as any).from('dictionary_word_progress').upsert({ user_id: userId, word_id: wordId }, { onConflict: 'user_id,word_id' })
    : (supabase as any).from('dictionary_word_progress').delete().eq('user_id', userId).eq('word_id', wordId);
  const { error } = await request;
  if (error && !isMissingReviewInfrastructure(error)) console.error('dictionary learning status was not persisted', error);
  return !error;
}

export async function startDictionaryWordLearning(userId: string, wordId: string, localOnly = false) {
  const localRows = readLocalProgress(userId);
  const existing = localRows.find(row => row.wordId === wordId);
  const progress = existing || legacyProgress(wordId);
  if (!existing) writeLocalProgress(userId, [...localRows, progress]);
  if (localOnly) return progress;

  const startedAt = new Date().toISOString();
  const firstReviewAt = new Date(Date.now() - 60_000).toISOString();
  const { error } = await (supabase as any).from('dictionary_word_progress').upsert({
    user_id: userId,
    word_id: wordId,
    learned_at: startedAt,
    next_review_at: firstReviewAt,
  }, { onConflict: 'user_id,word_id', ignoreDuplicates: true });
  if (error && !isMissingReviewInfrastructure(error)) console.error('dictionary word learning was not persisted', error);
  return progress;
}

export async function startReviewSession(userId: string, kind: ReviewSessionKind, localOnly = false): Promise<ReviewSessionHandle> {
  const localDay = localDayKey();
  const nonce = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  if (!localOnly) {
    const { data, error } = await (supabase as any).rpc('start_dictionary_review_session', {
      _client_nonce: nonce,
      _session_kind: kind,
      _local_day: localDay,
    });
    if (!error && data) return { id: String(data), persistent: true, localDay };
    if (error && !isMissingReviewInfrastructure(error)) console.error('daily review session was not persisted', error);
  }
  return { id: `local:${nonce}`, persistent: false, localDay };
}

export async function submitReviewAnswer(
  session: ReviewSessionHandle,
  item: ReviewItem,
  answer: string,
  userId: string,
): Promise<ReviewAttemptResult> {
  if (session.persistent) {
    const { data, error } = await (supabase as any).rpc('submit_dictionary_review_answer', {
      _session_id: session.id,
      _word_id: item.word.id,
      _exercise_type: item.exerciseType,
      _answer: answer,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) return { correct: Boolean(row.is_correct), persisted: true };
    if (error && !isMissingReviewInfrastructure(error)) console.error('daily review answer was not persisted', error);
  }
  const localRows = readLocalProgress(userId);
  const byId = new Map(localRows.map(row => [row.wordId, row]));
  const current = byId.get(item.word.id) || legacyProgress(item.word.id);
  const correct = answerMatches(item.exerciseType, item.word, answer);
  byId.set(item.word.id, nextProgressAfterAttempt(current, correct, item.exerciseType));
  writeLocalProgress(userId, [...byId.values()]);
  return { correct, persisted: false };
}

export async function completeReviewSession(session: ReviewSessionHandle, preview = false): Promise<ReviewCompletionResult> {
  if (session.persistent) {
    const { data, error } = await (supabase as any).rpc('complete_dictionary_review_session', { _session_id: session.id });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) return { starsAwarded: Number(row.stars_awarded || 0), alreadyCompleted: Boolean(row.already_completed), persisted: true };
    if (error && !isMissingReviewInfrastructure(error)) console.error('daily review completion was not persisted', error);
  }
  return { starsAwarded: 0, alreadyCompleted: false, persisted: false };
}

export async function loadReviewDays(userId: string, localOnly = false) {
  const fallback = loadLocalReviewDays(userId);
  if (localOnly) return fallback;
  const { data, error } = await (supabase as any)
    .from('dictionary_review_sessions')
    .select('local_day')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('local_day', { ascending: false })
    .limit(400);
  if (error) {
    if (!isMissingReviewInfrastructure(error)) console.error('daily review streak was not loaded', error);
    return fallback;
  }
  const days = new Set<string>((data || []).map((row: any) => String(row.local_day)));
  localStorage.setItem(localReviewDaysKey(userId), JSON.stringify([...days]));
  return days;
}

export function loadLocalReviewDays(userId: string) {
  try {
    const values = JSON.parse(localStorage.getItem(localReviewDaysKey(userId)) || '[]');
    return new Set<string>(Array.isArray(values) ? values : []);
  } catch {
    return new Set<string>();
  }
}

export function recordLocalReviewDay(userId: string, day = localDayKey()) {
  const days = loadLocalReviewDays(userId);
  days.add(day);
  const recent = [...days].sort().slice(-400);
  localStorage.setItem(localReviewDaysKey(userId), JSON.stringify(recent));
  return new Set(recent);
}
