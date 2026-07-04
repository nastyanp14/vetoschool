import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
  Lesson, InteractiveTask, listTasks, markLessonComplete, signedUrlFor,
} from '../lib/workbooks';
import { MechanicType } from '../lib/mechanics';

// ==================== Utility: signed image ====================
function SignedImg({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let a = true; signedUrlFor(path).then(u => { if (a) setUrl(u); }); return () => { a = false; }; }, [path]);
  if (!url) return <div className={`bg-purple-100 animate-pulse ${className}`} />;
  return <img src={url} alt="" className={className} />;
}

// ==================== MATCHING ====================
function MatchingTask({ payload, onDone }: { payload: any; onDone: () => void }) {
  const pairs = payload?.pairs || [];
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [wrong, setWrong] = useState<number | null>(null);
  const rights = useMemo(() => {
    const arr = pairs.map((_: any, i: number) => i);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, [pairs.length]);

  const done = Object.keys(matches).length === pairs.length && pairs.length > 0;
  useEffect(() => { if (done) setTimeout(onDone, 700); }, [done]);

  const clickRight = (rightIdx: number) => {
    if (selectedLeft === null) return;
    if (rightIdx === selectedLeft) {
      setMatches(m => ({ ...m, [selectedLeft]: rightIdx }));
      setSelectedLeft(null);
    } else {
      setWrong(rightIdx);
      setTimeout(() => setWrong(null), 400);
    }
  };

  const Side = ({ s }: { s: any }) => s?.image
    ? <SignedImg path={s.image} className="w-14 h-14 object-cover rounded-lg" />
    : <span className="font-body font-600 text-purple-800">{s?.text}</span>;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        {pairs.map((p: any, i: number) => (
          <button key={i} disabled={matches[i] !== undefined}
            onClick={() => setSelectedLeft(i)}
            className={`w-full flex items-center gap-2 p-3 rounded-2xl border-2 transition ${
              matches[i] !== undefined ? 'bg-green-100 border-green-300 opacity-60' :
              selectedLeft === i ? 'bg-purple-200 border-purple-500 shadow-lg scale-105' : 'bg-white/70 border-purple-200 hover:border-purple-400'
            }`}>
            <Side s={p.left} />
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {rights.map((rightIdx: number) => (
          <button key={rightIdx} disabled={Object.values(matches).includes(rightIdx)}
            onClick={() => clickRight(rightIdx)}
            className={`w-full flex items-center gap-2 p-3 rounded-2xl border-2 transition ${
              Object.values(matches).includes(rightIdx) ? 'bg-green-100 border-green-300 opacity-60' :
              wrong === rightIdx ? 'bg-red-100 border-red-400 animate-pulse' : 'bg-white/70 border-pink-200 hover:border-pink-400'
            }`}>
            <Side s={pairs[rightIdx]?.right} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== WORD LEGO ====================
function WordLegoTask({ payload, onDone }: { payload: any; onDone: () => void }) {
  // For word_lego, user builds by joining halves. We use same matching interaction visually different.
  const pairs = payload?.pairs || [];
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [built, setBuilt] = useState<{ left: number; right: number }[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const done = built.length === pairs.length && pairs.length > 0;
  useEffect(() => { if (done) setTimeout(onDone, 700); }, [done]);

  const rights = useMemo(() => {
    const arr = pairs.map((_: any, i: number) => i);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, [pairs.length]);

  const usedLefts = new Set(built.map(b => b.left));
  const usedRights = new Set(built.map(b => b.right));

  const clickRight = (rightIdx: number) => {
    if (selectedLeft === null) return;
    if (rightIdx === selectedLeft) {
      setBuilt(b => [...b, { left: selectedLeft, right: rightIdx }]);
      setSelectedLeft(null);
    } else { setWrong(rightIdx); setTimeout(() => setWrong(null), 400); }
  };

  const asText = (s: any) => s?.text || '';

  return (
    <div className="space-y-4">
      {built.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
          <div className="text-xs text-green-700 mb-1 font-600">✅ Собрано:</div>
          <div className="flex flex-wrap gap-2">
            {built.map((b, i) => <span key={i} className="bg-white px-3 py-1 rounded-xl border border-green-300 font-body font-600 text-green-800">{asText(pairs[b.left]?.left)} + {asText(pairs[b.right]?.right)}</span>)}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-purple-500 mb-1 font-600">Часть 1</div>
          <div className="flex flex-wrap gap-2">
            {pairs.map((p: any, i: number) => !usedLefts.has(i) && (
              <button key={i} onClick={() => setSelectedLeft(i)}
                className={`px-3 py-2 rounded-xl border-2 font-body font-600 transition ${selectedLeft === i ? 'bg-purple-500 text-white border-purple-700 shadow' : 'bg-white/80 border-purple-200 text-purple-700 hover:border-purple-400'}`}>
                {asText(p.left)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-pink-500 mb-1 font-600">Часть 2</div>
          <div className="flex flex-wrap gap-2">
            {rights.map((idx: number) => !usedRights.has(idx) && (
              <button key={idx} disabled={selectedLeft === null} onClick={() => clickRight(idx)}
                className={`px-3 py-2 rounded-xl border-2 font-body font-600 transition ${wrong === idx ? 'bg-red-200 border-red-400' : 'bg-white/80 border-pink-200 text-pink-700 hover:border-pink-400'} disabled:opacity-40`}>
                {asText(pairs[idx]?.right)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== FILL LETTERS ====================
function FillLettersTask({ payload, onDone }: { payload: any; onDone: () => void }) {
  const text: string = payload?.text || '';
  const answers: string[] = payload?.answers || [];
  const parts = text.split('___');
  const [values, setValues] = useState<string[]>(Array(answers.length).fill(''));
  const [checked, setChecked] = useState(false);

  const check = () => {
    setChecked(true);
    const ok = values.every((v, i) => v.trim().toLowerCase() === (answers[i] || '').toLowerCase());
    if (ok) setTimeout(onDone, 600);
  };

  return (
    <div className="space-y-4">
      <div className="text-lg font-body text-purple-800 leading-loose bg-white/70 rounded-2xl p-4 border border-purple-100">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input type="text" value={values[i] || ''}
                onChange={e => { const n = [...values]; n[i] = e.target.value; setValues(n); setChecked(false); }}
                className={`inline-block mx-1 px-2 py-0.5 rounded-lg border-b-2 w-24 text-center font-600 outline-none ${
                  checked
                    ? (values[i]?.trim().toLowerCase() === (answers[i]||'').toLowerCase() ? 'bg-green-100 border-green-500 text-green-800' : 'bg-red-100 border-red-500 text-red-800')
                    : 'bg-yellow-50 border-yellow-400 focus:border-yellow-600'
                }`} />
            )}
          </span>
        ))}
      </div>
      <button onClick={check} className="bg-gradient-to-r from-pink-400 to-purple-400 text-white px-5 py-2 rounded-2xl font-body font-600 shadow-lg">Проверить</button>
    </div>
  );
}

// ==================== ANAGRAM ====================
function shuffleStr(s: string) {
  const arr = s.split('');
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  const joined = arr.join('');
  return joined.toUpperCase() === s.toUpperCase() ? shuffleStr(s) : joined;
}
function AnagramTask({ payload, onDone }: { payload: any; onDone: () => void }) {
  const answer: string = (payload?.answer || '').trim();
  const [tiles, setTiles] = useState<{ ch: string; used: boolean }[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    setTiles(shuffleStr(answer).split('').map(ch => ({ ch, used: false })));
    setPicked([]); setWrong(false);
  }, [answer]);

  const built = picked.map(i => tiles[i]?.ch || '').join('');

  const pick = (i: number) => {
    if (tiles[i].used) return;
    setTiles(t => t.map((tl, idx) => idx === i ? { ...tl, used: true } : tl));
    setPicked(p => [...p, i]);
  };
  const undo = () => {
    if (picked.length === 0) return;
    const last = picked[picked.length - 1];
    setTiles(t => t.map((tl, idx) => idx === last ? { ...tl, used: false } : tl));
    setPicked(p => p.slice(0, -1));
  };

  useEffect(() => {
    if (built.length === answer.length && built.length > 0) {
      if (built.toUpperCase() === answer.toUpperCase()) setTimeout(onDone, 500);
      else { setWrong(true); setTimeout(() => { setWrong(false); setTiles(t => t.map(x => ({ ...x, used: false }))); setPicked([]); }, 800); }
    }
  }, [built]);

  return (
    <div className="space-y-4 text-center">
      <div className={`inline-block min-w-[200px] px-4 py-3 rounded-2xl border-2 tracking-widest font-mono text-2xl font-bold ${wrong ? 'bg-red-100 border-red-400 text-red-700' : 'bg-white/80 border-purple-200 text-purple-700'}`}>
        {built || '?'.repeat(answer.length)}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {tiles.map((tl, i) => (
          <button key={i} onClick={() => pick(i)} disabled={tl.used}
            className={`w-12 h-12 rounded-xl font-mono font-black text-xl border-2 transition ${tl.used ? 'opacity-30 bg-gray-100 border-gray-200' : 'bg-gradient-to-br from-yellow-100 to-orange-100 border-orange-300 text-orange-700 hover:scale-110 shadow'}`}>
            {tl.ch}
          </button>
        ))}
      </div>
      <button onClick={undo} className="text-sm text-purple-500 hover:text-purple-700">↩ Убрать последнюю</button>
    </div>
  );
}

// ==================== ROOM ====================
export default function InteractiveLessonRoom({
  lesson, userId, onExit, onCompleted,
}: {
  lesson: Lesson;
  userId: string;
  onExit: () => void;
  onCompleted: (starsAwarded: number) => void;
}) {
  const [tasks, setTasks] = useState<InteractiveTask[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState<null | number>(null); // stars awarded

  useEffect(() => {
    listTasks(lesson.id).then(t => { setTasks(t); setLoading(false); });
    // Realtime presence channel (placeholder – ready for future sync)
    const channel = supabase.channel(`lesson-${lesson.id}`, { config: { presence: { key: userId } } })
      .on('presence', { event: 'sync' }, () => { /* no-op */ })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lesson.id, userId]);

  const finish = async () => {
    const stars = await markLessonComplete(userId, lesson);
    setFinished(stars);
    onCompleted(stars);
  };
  const nextTask = () => {
    if (idx + 1 >= tasks.length) finish();
    else setIdx(i => i + 1);
  };

  const cur = tasks[idx];

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-900 via-pink-900 to-orange-900 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 sm:p-8 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onExit} className="text-white/80 hover:text-white text-sm">← Выйти</button>
          <div className="text-white font-body text-sm">
            {tasks.length > 0 && !finished && <>Задание <b>{idx + 1}</b> из <b>{tasks.length}</b></>}
          </div>
        </div>
        <div className="glass rounded-3xl p-6 shadow-2xl bg-white/95">
          <h2 className="font-display font-black text-2xl text-purple-800 mb-4 text-center">{lesson.title}</h2>

          {loading && <p className="text-center text-purple-500">Загрузка…</p>}
          {!loading && tasks.length === 0 && (
            <div className="text-center py-8">
              <div className="text-5xl mb-2">🤷</div>
              <p className="text-purple-500">В этом уроке пока нет заданий.</p>
              <button onClick={onExit} className="mt-4 bg-purple-500 text-white px-5 py-2 rounded-2xl">Назад к карте</button>
            </div>
          )}
          {!loading && cur && finished === null && (
            <AnimatePresence mode="wait">
              <motion.div key={cur.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {cur.mechanic_type === 'matching' && <MatchingTask payload={cur.payload_json} onDone={nextTask} />}
                {cur.mechanic_type === 'word_lego' && <WordLegoTask payload={cur.payload_json} onDone={nextTask} />}
                {cur.mechanic_type === 'fill_letters' && <FillLettersTask payload={cur.payload_json} onDone={nextTask} />}
                {cur.mechanic_type === 'anagram_unscramble' && <AnagramTask payload={cur.payload_json} onDone={nextTask} />}
                {!['matching','word_lego','fill_letters','anagram_unscramble'].includes(cur.mechanic_type) && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">🚧</div>
                    <p className="text-purple-500">Механика «{cur.mechanic_type}» ещё в разработке.</p>
                    <button onClick={nextTask} className="mt-4 bg-purple-500 text-white px-5 py-2 rounded-2xl">Пропустить</button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
          {finished !== null && (
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
              <div className="text-6xl mb-3">🎉</div>
              <h3 className="font-display font-black text-3xl text-purple-800 mb-2">Урок пройден!</h3>
              {finished > 0
                ? <p className="text-yellow-600 font-body font-bold text-xl">+{finished} ⭐</p>
                : <p className="text-purple-500 font-body">Отличная работа!</p>}
              <button onClick={onExit} className="mt-4 bg-gradient-to-r from-pink-400 to-purple-400 text-white px-6 py-2.5 rounded-2xl font-body font-600 shadow-lg">На карту</button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
