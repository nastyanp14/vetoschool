import { supabase } from '@/integrations/supabase/client';

export interface DictWord {
  id: string;
  userId: string;
  lesson: string;
  category: string;
  word: string;
  translation: string;
  emoji: string;
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
  const { data, error } = await supabase
    .from('dictionary_words')
    .insert({
      user_id: input.userId,
      lesson: input.lesson || '',
      category: input.category || '',
      word: input.word,
      translation: input.translation,
      emoji: input.emoji || '✨',
    })
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return rowToWord(data);
}

export async function deleteDictWord(id: string): Promise<void> {
  const { error } = await supabase.from('dictionary_words').delete().eq('id', id);
  if (error) console.error(error);
}
