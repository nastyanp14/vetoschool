import { supabase } from '@/integrations/supabase/client';

export interface DictWord {
  id: string;
  userId: string;
  lesson: string;
  category: string;
  word: string;
  translation: string;
  emoji: string;
  audioUrl?: string | null;
  createdAt?: string;
}

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
    createdAt: r.created_at,
  };
}

export async function loadDictionary(userId: string): Promise<DictWord[]> {
  const { data, error } = await supabase
    .from('dictionary_words')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return (data || []).map(rowToWord);
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
  };
  let { data, error } = await (supabase as any)
    .from('dictionary_words')
    .insert(row)
    .select()
    .single();
  if (error && /audio_url|schema cache|column/i.test(error.message || '')) {
    const { audio_url, ...legacyRow } = row;
    const retry = await (supabase as any)
      .from('dictionary_words')
      .insert(legacyRow)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) { console.error(error); return null; }
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
}
