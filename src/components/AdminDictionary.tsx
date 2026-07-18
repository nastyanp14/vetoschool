import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Trash2, Upload, Users, Volume2, X } from 'lucide-react';
import { Lang, t } from '../lib/i18n';
import { addDictWords, deleteDictWord, DictWord, loadDictionary } from '../lib/dictionary';
import { signedUrlFor, uploadWorkbookAsset } from '../lib/workbooks';
import type { User } from '../lib/auth';

const labels = {
  ru: {
    students: 'Кому добавить слово',
    current: 'Текущему ученику',
    selected: 'Выбранным ученикам',
    audio: 'Аудио слова',
    uploadAudio: 'Загрузить аудио',
    replaceAudio: 'Заменить аудио',
    audioReady: 'Аудио прикреплено',
    removeAudio: 'Убрать аудио',
    uploadError: 'Не удалось загрузить аудио',
    saved: 'Слово добавлено',
    selectedCount: (count: number) => `${count} ученик(а)`,
  },
  en: {
    students: 'Who gets this word',
    current: 'Current student',
    selected: 'Selected students',
    audio: 'Word audio',
    uploadAudio: 'Upload audio',
    replaceAudio: 'Replace audio',
    audioReady: 'Audio attached',
    removeAudio: 'Remove audio',
    uploadError: 'Could not upload audio',
    saved: 'Word added',
    selectedCount: (count: number) => `${count} student(s)`,
  },
  ua: {
    students: 'Кому додати слово',
    current: 'Поточному учню',
    selected: 'Обраним учням',
    audio: 'Аудіо слова',
    uploadAudio: 'Завантажити аудіо',
    replaceAudio: 'Замінити аудіо',
    audioReady: 'Аудіо прикріплено',
    removeAudio: 'Прибрати аудіо',
    uploadError: 'Не вдалося завантажити аудіо',
    saved: 'Слово додано',
    selectedCount: (count: number) => `${count} учень/учні`,
  },
} as const;

async function playStoredAudio(path?: string | null) {
  if (!path) return;
  const url = await signedUrlFor(path);
  if (url) await new Audio(url).play();
}

export default function AdminDictionary({ userId, lang, users = [] }: { userId: string; lang: Lang; users?: User[] }) {
  const copy = labels[lang] || labels.ru;
  const [words, setWords] = useState<DictWord[]>([]);
  const [lesson, setLesson] = useState('');
  const [category, setCategory] = useState('');
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([userId]);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const studentOptions = users.length > 0 ? users.filter(user => user.role !== 'admin') : [];
  const refresh = () => loadDictionary(userId).then(setWords);

  useEffect(() => { refresh(); }, [userId]);
  useEffect(() => { setSelectedIds([userId]); }, [userId]);

  const toggleStudent = (id: string) => {
    setSelectedIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]);
  };

  const handleAudioUpload = async (file?: File) => {
    if (!file) return;
    setUploadingAudio(true);
    const path = await uploadWorkbookAsset(file);
    setUploadingAudio(false);
    if (!path) return;
    setAudioUrl(path);
  };

  const handleAdd = async () => {
    if (!word.trim() || !translation.trim() || selectedIds.length === 0) return;
    setSaving(true);
    await addDictWords(selectedIds, {
      lesson: lesson.trim(),
      category: category.trim(),
      word: word.trim(),
      translation: translation.trim(),
      emoji: emoji.trim() || '✨',
      audioUrl,
    });
    setWord('');
    setTranslation('');
    setEmoji('✨');
    setAudioUrl(null);
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
      <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50 to-purple-50 p-4 dark:border-purple-700 dark:from-[#241331] dark:to-[#1b1028]">
        <h4 className="mb-3 font-display text-xl font-bold text-purple-700 dark:text-purple-100">{t(lang, 'dict_add_title')}</h4>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-body text-xs font-600 text-purple-500 dark:text-purple-200">{t(lang, 'dict_lesson_field')}</label>
            <input value={lesson} onChange={e => setLesson(e.target.value)} placeholder="Lesson 1" className="input-magic py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block font-body text-xs font-600 text-purple-500 dark:text-purple-200">{t(lang, 'dict_category_field')}</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Animals" className="input-magic py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block font-body text-xs font-600 text-purple-500 dark:text-purple-200">{t(lang, 'dict_word_field')}</label>
            <input value={word} onChange={e => setWord(e.target.value)} placeholder="Cow" className="input-magic py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block font-body text-xs font-600 text-purple-500 dark:text-purple-200">{t(lang, 'dict_translation_field')}</label>
            <input value={translation} onChange={e => setTranslation(e.target.value)} placeholder="Корова" className="input-magic py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block font-body text-xs font-600 text-purple-500 dark:text-purple-200">{t(lang, 'dict_emoji_field')}</label>
            <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={8} className="input-magic py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block font-body text-xs font-600 text-purple-500 dark:text-purple-200">{copy.audio}</label>
            <div className="flex gap-2">
              <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-purple-100 bg-white px-3 py-2 font-body text-xs font-black text-purple-500 transition hover:border-pink-200 hover:bg-pink-50 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100">
                <Upload className={`h-4 w-4 ${uploadingAudio ? 'animate-bounce' : ''}`} />
                {uploadingAudio ? '...' : audioUrl ? copy.replaceAudio : copy.uploadAudio}
                <input type="file" accept="audio/*" className="hidden" onChange={e => handleAudioUpload(e.target.files?.[0])} />
              </label>
              {audioUrl && (
                <>
                  <button type="button" onClick={() => playStoredAudio(audioUrl)} className="rounded-2xl bg-purple-100 p-2 text-purple-600 transition hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100" title={copy.audioReady}>
                    <Volume2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setAudioUrl(null)} className="rounded-2xl bg-red-50 p-2 text-red-500 transition hover:bg-red-100" title={copy.removeAudio}>
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {studentOptions.length > 1 && (
          <div className="mb-3 rounded-2xl border border-purple-100 bg-white/70 p-3 dark:border-purple-700 dark:bg-white/5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 font-body text-xs font-black uppercase tracking-wider text-purple-500 dark:text-purple-200">
                <Users className="h-4 w-4" /> {copy.students}
              </div>
              <span className="rounded-full bg-pink-100 px-3 py-1 text-[11px] font-black text-pink-500 dark:bg-pink-500/15 dark:text-pink-100">{copy.selectedCount(selectedIds.length)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {studentOptions.map(student => {
                const checked = selectedIds.includes(student.id);
                return (
                  <button key={student.id} type="button" onClick={() => toggleStudent(student.id)}
                    className={`flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${checked ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-purple-100 bg-white text-purple-500 hover:bg-pink-50 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100'}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border ${checked ? 'border-emerald-300 bg-emerald-400 text-white' : 'border-purple-200 bg-white dark:bg-white/10'}`}>
                      {checked && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-body text-sm font-bold">{student.name}</span>
                      <span className="block truncate font-body text-[11px] opacity-70">{student.email}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button onClick={handleAdd} disabled={saving || !word.trim() || !translation.trim() || selectedIds.length === 0}
          className="btn-magic w-full py-3 font-display text-sm font-bold text-white disabled:opacity-50">
          {saving ? '...' : t(lang, 'dict_add_btn')}
        </button>
      </div>

      {words.length === 0 ? (
        <p className="py-6 text-center font-body text-sm text-purple-400">{t(lang, 'dict_empty')}</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence>
            {words.map(w => (
              <motion.div key={w.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3 rounded-2xl border border-purple-50 bg-white/70 p-3 dark:border-purple-700 dark:bg-[#241331]">
                <span className="text-2xl">{w.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold text-purple-700 dark:text-purple-100">{w.word} <span className="font-body font-600 text-purple-400">— {w.translation}</span></div>
                  <div className="flex flex-wrap gap-x-3 font-body text-xs text-purple-400 dark:text-purple-200">
                    {w.lesson && <span>📚 {w.lesson}</span>}
                    {w.category && <span>🏷️ {w.category}</span>}
                    {w.audioUrl && <span>🔊 audio</span>}
                  </div>
                </div>
                {w.audioUrl && (
                  <button onClick={() => playStoredAudio(w.audioUrl)} className="rounded-xl bg-purple-50 p-2 text-purple-500 transition hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-100">
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => handleDelete(w.id)}
                  className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-body text-xs font-600 transition-all ${
                    confirmDel === w.id ? 'bg-red-500 text-white shadow' : 'border border-red-100 bg-red-50 text-red-500 hover:bg-red-100'
                  }`}>
                  <Trash2 className="h-3.5 w-3.5" />
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
