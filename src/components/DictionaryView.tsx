import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { Lang, t } from '../lib/i18n';
import { DictWord, loadDictionary } from '../lib/dictionary';
import { signedUrlFor } from '../lib/workbooks';

function FlipCard({ word, hint }: { word: DictWord; hint: string }) {
  const [flipped, setFlipped] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playAudio = async () => {
    setPlaying(true);
    try {
      if (word.audioUrl) {
        const url = await signedUrlFor(word.audioUrl);
        if (url) {
          const audio = new Audio(url);
          audio.volume = 0.95;
          audio.onended = () => setPlaying(false);
          audio.onerror = () => setPlaying(false);
          await audio.play();
          return;
        }
      }
      if ('speechSynthesis' in window && word.word) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word.word);
        utterance.lang = 'en-US';
        utterance.rate = 0.82;
        utterance.pitch = 1.08;
        utterance.onend = () => setPlaying(false);
        utterance.onerror = () => setPlaying(false);
        window.speechSynthesis.speak(utterance);
        return;
      }
    } catch {
      // Audio is an enhancement; flipping should still feel instant.
    }
    setPlaying(false);
  };
  return (
    <div
      className={`flip-card cursor-pointer h-44 ${flipped ? 'flipped' : ''}`}
      onClick={() => {
        setFlipped(f => !f);
        playAudio();
      }}
    >
      <div className="flip-card-inner">
        {/* Front */}
        <div className="flip-card-face bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 border border-pink-200 shadow-lg dark:border-purple-700 dark:from-[#2f1b42] dark:via-[#271739] dark:to-[#1c2944]">
          <span className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 text-purple-400 shadow-sm transition dark:bg-white/10 dark:text-pink-200 ${playing ? 'scale-110 text-pink-500' : ''}`}>
            <Volume2 className="h-4 w-4" />
          </span>
          <div className="text-5xl mb-2">{word.emoji}</div>
          <div className="font-display font-black text-2xl text-purple-700 break-words dark:text-purple-100">{word.word}</div>
          <div className="font-body text-[10px] uppercase tracking-wider text-purple-400 mt-2 opacity-80">{hint}</div>
        </div>
        {/* Back */}
        <div className="flip-card-face flip-card-back bg-gradient-to-br from-purple-300 via-pink-300 to-pink-400 border border-purple-300 shadow-xl text-white dark:border-purple-500/40 dark:from-purple-800 dark:via-fuchsia-800 dark:to-pink-700">
          <span className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/20 text-white shadow-sm transition ${playing ? 'scale-110 bg-white/30' : ''}`}>
            <Volume2 className="h-4 w-4" />
          </span>
          <div className="text-3xl mb-2">💡</div>
          <div className="font-display font-black text-2xl break-words">{word.translation}</div>
          <div className="font-body text-xs mt-2 opacity-90">{word.word}</div>
        </div>
      </div>
    </div>
  );
}

export default function DictionaryView({ userId, lang }: { userId: string; lang: Lang }) {
  const [words, setWords] = useState<DictWord[]>([]);
  const [mode, setMode] = useState<'lesson' | 'category'>('lesson');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadDictionary(userId).then(w => { setWords(w); setLoading(false); });
  }, [userId]);

  if (loading) {
    return <div className="glass rounded-3xl p-12 text-center text-purple-400">…</div>;
  }

  if (words.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-12 text-center">
        <div className="text-6xl mb-4">📖</div>
        <h3 className="font-display font-bold text-2xl text-purple-700 mb-2">{t(lang, 'dict_title')}</h3>
        <p className="font-body text-purple-400">{t(lang, 'dict_empty')}</p>
      </motion.div>
    );
  }

  const groupKey = (w: DictWord) =>
    mode === 'lesson'
      ? (w.lesson?.trim() || t(lang, 'dict_no_lesson'))
      : (w.category?.trim() || t(lang, 'dict_no_category'));

  const groups: Record<string, DictWord[]> = {};
  for (const w of words) {
    const k = groupKey(w);
    (groups[k] ||= []).push(w);
  }
  const groupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="glass rounded-3xl p-2 inline-flex gap-1 shadow-md">
        {([
          ['lesson', t(lang, 'dict_by_lesson'), '📚'],
          ['category', t(lang, 'dict_by_category'), '🏷️'],
        ] as const).map(([id, label, em]) => (
          <button key={id} onClick={() => setMode(id)}
            className={`px-5 py-2.5 rounded-2xl font-body font-700 text-sm transition-all ${
              mode === id
                ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg'
                : 'text-purple-600 hover:bg-pink-50'
            }`}>
            <span className="mr-1.5">{em}</span>{label}
          </button>
        ))}
      </div>

      {/* Groups */}
      {groupNames.map((name, gi) => (
        <motion.section key={name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.05 }} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`px-5 py-2.5 rounded-2xl font-display font-black text-white shadow-lg ${
              mode === 'lesson'
                ? 'bg-gradient-to-r from-purple-400 to-pink-400'
                : 'bg-gradient-to-r from-blue-400 to-teal-400'
            }`}>
              {mode === 'lesson' ? '📚 ' : '🏷️ '}{name}
            </div>
            <span className="font-body text-sm text-purple-400">{groups[name].length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {groups[name].map(w => (
              <FlipCard key={w.id} word={w} hint={t(lang, 'dict_flip_hint')} />
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
