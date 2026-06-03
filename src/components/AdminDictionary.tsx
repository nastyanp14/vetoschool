import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Lang, t } from '../lib/i18n';
import { addDictWord, deleteDictWord, DictWord, loadDictionary } from '../lib/dictionary';

export default function AdminDictionary({ userId, lang }: { userId: string; lang: Lang }) {
  const [words, setWords] = useState<DictWord[]>([]);
  const [lesson, setLesson] = useState('');
  const [category, setCategory] = useState('');
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const refresh = () => loadDictionary(userId).then(setWords);
  useEffect(() => { refresh(); }, [userId]);

  const handleAdd = async () => {
    if (!word.trim() || !translation.trim()) return;
    setSaving(true);
    await addDictWord({
      userId,
      lesson: lesson.trim(),
      category: category.trim(),
      word: word.trim(),
      translation: translation.trim(),
      emoji: emoji.trim() || '✨',
    });
    setWord(''); setTranslation(''); setEmoji('✨');
    setSaving(false);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (confirmDel !== id) {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel(c => c === id ? null : c), 3000);
      return;
    }
    await deleteDictWord(id);
    setConfirmDel(null);
    refresh();
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 p-4">
        <h4 className="font-display font-bold text-purple-700 mb-3">{t(lang, 'dict_add_title')}</h4>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang, 'dict_lesson_field')}</label>
            <input value={lesson} onChange={e => setLesson(e.target.value)} placeholder="Lesson 1" className="input-magic text-sm py-2" />
          </div>
          <div>
            <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang, 'dict_category_field')}</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Animals" className="input-magic text-sm py-2" />
          </div>
          <div>
            <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang, 'dict_word_field')}</label>
            <input value={word} onChange={e => setWord(e.target.value)} placeholder="Cow" className="input-magic text-sm py-2" />
          </div>
          <div>
            <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang, 'dict_translation_field')}</label>
            <input value={translation} onChange={e => setTranslation(e.target.value)} placeholder="Корова" className="input-magic text-sm py-2" />
          </div>
          <div>
            <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang, 'dict_emoji_field')}</label>
            <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} className="input-magic text-sm py-2" />
          </div>
        </div>
        <button onClick={handleAdd} disabled={saving || !word.trim() || !translation.trim()}
          className="btn-magic w-full py-3 text-white font-display font-bold text-sm disabled:opacity-50">
          {t(lang, 'dict_add_btn')}
        </button>
      </div>

      {/* Words list */}
      {words.length === 0 ? (
        <p className="text-center font-body text-sm text-purple-400 py-6">{t(lang, 'dict_empty')}</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          <AnimatePresence>
            {words.map(w => (
              <motion.div key={w.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3 p-3 bg-white/70 rounded-2xl border border-purple-50">
                <span className="text-2xl">{w.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-purple-700 text-sm">{w.word} <span className="text-purple-400 font-body font-600">— {w.translation}</span></div>
                  <div className="font-body text-xs text-purple-400 flex flex-wrap gap-x-3">
                    {w.lesson && <span>📚 {w.lesson}</span>}
                    {w.category && <span>🏷️ {w.category}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(w.id)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl font-body font-600 transition-all ${
                    confirmDel === w.id ? 'bg-red-500 text-white shadow' : 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-100'
                  }`}>
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmDel === w.id && <span>{lang === 'en' ? 'Sure?' : lang === 'ua' ? 'Впевнені?' : 'Уверены?'}</span>}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
