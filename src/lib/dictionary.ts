import { supabase } from '@/integrations/supabase/client';
import { cachedQuery, invalidateQueryCache, QUERY_LIMITS } from './queryCache';

export interface DictWord {
  id: string;
  userId: string;
  lesson: string;
  category: string;
  word: string;
  translation: string;
  emoji: string;
  audioUrl?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
}

const DICTIONARY_COLUMNS = 'id,user_id,lesson,category,word,translation,emoji,audio_url,image_url,created_at';

function rowToWord(r: any): DictWord {
  return {
    id: r.id,
    userId: r.user_id,
    lesson: r.lesson || '',
    category: r.category || '',
    word: r.word,
    translation: r.translation,
    emoji: r.emoji || '✨',
    audioUrl: r.audio_url || null,
    imageUrl: r.image_url || null,
    createdAt: r.created_at,
  };
}

export async function loadDictionary(userId: string): Promise<DictWord[]> {
  return cachedQuery(`postgrest:dictionary:${userId}`, 60_000, async () => {
    const { data, error } = await (supabase as any)
      .from('dictionary_words')
      .select(DICTIONARY_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(QUERY_LIMITS.userList);
    if (error) { console.error(error); return []; }
    return (data || []).map(rowToWord);
  });
}

export async function addDictWord(input: Omit<DictWord, 'id' | 'createdAt'>): Promise<DictWord | null> {
  const row = {
    user_id: input.userId,
    lesson: input.lesson || '',
    category: input.category || '',
    word: input.word,
    translation: input.translation,
    emoji: input.emoji || '✨',
    audio_url: input.audioUrl || null,
    image_url: input.imageUrl || null,
  };
  let { data, error } = await (supabase as any)
    .from('dictionary_words')
    .insert(row)
    .select(DICTIONARY_COLUMNS)
    .single();
  if (error && /image_url|schema cache|column/i.test(error.message || '')) {
    const { image_url, ...legacyRow } = row;
    const retry = await (supabase as any)
      .from('dictionary_words')
      .insert(legacyRow)
      .select('id,user_id,lesson,category,word,translation,emoji,audio_url,created_at')
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error && /audio_url|schema cache|column/i.test(error.message || '')) {
    const { audio_url, image_url, ...legacyRow } = row;
    const retry = await (supabase as any)
      .from('dictionary_words')
      .insert(legacyRow)
      .select('id,user_id,lesson,category,word,translation,emoji,created_at')
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) { console.error(error); return null; }
  invalidateQueryCache(`postgrest:dictionary:${input.userId}`);
  return rowToWord(data);
}

export async function addDictWords(userIds: string[], input: Omit<DictWord, 'id' | 'createdAt' | 'userId'>): Promise<DictWord[]> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const created: DictWord[] = [];
  for (const userId of uniqueIds) {
    const word = await addDictWord({ ...input, userId });
    if (word) created.push(word);
  }
  return created;
}

export async function deleteDictWord(id: string): Promise<void> {
  const { error } = await supabase.from('dictionary_words').delete().eq('id', id);
  if (error) console.error(error);
  invalidateQueryCache('postgrest:dictionary:');
}
