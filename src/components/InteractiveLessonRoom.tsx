import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, CheckCircle2, RotateCcw, Sparkles, Trophy, XCircle } from 'lucide-react';
import {
  Lesson, InteractiveTask, listTasks, markLessonComplete, signedUrlFor,
} from '../lib/workbooks';
import { MechanicType } from '../lib/mechanics';
import {
  LiveSession, abandonLiveSession, completeLiveSession, recordLiveEvent, startLiveSession,
  listLiveEvents, subscribeLiveSessionEvents, updateLiveSession,
} from '../lib/live';
import TheoryLessonView from './TheoryLessonView';

type TaskTelemetry = (eventType: string, payload?: any) => void;

const tileBase = 'min-h-14 rounded-2xl border-2 px-4 py-3 font-body font-700 text-base shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-pink-200/70';
const liveTile = 'bg-white/95 border-purple-100 text-purple-700 shadow-md shadow-purple-100/60 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-lg dark:bg-[#2b1a3d] dark:border-purple-700 dark:text-purple-100 dark:shadow-none dark:hover:border-pink-400';
const selectedTile = 'bg-gradient-to-r from-pink-400 to-purple-400 border-white text-white shadow-xl ring-4 ring-pink-200/70 dark:border-purple-200 dark:ring-purple-500/30';
const doneTile = 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-75 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200';
const wrongTile = 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse dark:bg-rose-950 dark:border-rose-700 dark:text-rose-200';

function LessonProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${i <= current ? 'w-8 bg-gradient-to-r from-pink-400 to-purple-400' : 'w-2 bg-purple-100 dark:bg-purple-800'}`}
        />
      ))}
    </div>
  );
}

// ==================== Utility: signed image ====================
function SignedImg({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let a = true; signedUrlFor(path).then(u => { if (a) setUrl(u); }); return () => { a = false; }; }, [path]);
  if (!url) return <div className={`bg-purple-100 animate-pulse ${className}`} />;
  return <img src={url} alt="" className={className} />;
}

// ==================== MATCHING ====================
function MatchingTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const pairs = payload?.pairs || [];
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [wrong, setWrong] = useState<number | null>(null);
  const [wrongLeft, setWrongLeft] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [lines, setLines] = useState<Array<{ left: number; right: number; x1: number; y1: number; x2: number; y2: number }>>([]);
  const rights = useMemo(() => {
    const arr = pairs.map((_: any, i: number) => i);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, [pairs.length]);

  const done = Object.keys(matches).length === pairs.length && pairs.length > 0;
  useEffect(() => { if (done) setTimeout(onDone, 1000); }, [done]);

  useLayoutEffect(() => {
    const draw = () => {
      const board = boardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const next = Object.entries(matches).flatMap(([leftKey, rightIdx]) => {
        const left = Number(leftKey);
        const leftEl = leftRefs.current[left];
        const rightEl = rightRefs.current[rightIdx];
        if (!leftEl || !rightEl) return [];
        const l = leftEl.getBoundingClientRect();
        const r = rightEl.getBoundingClientRect();
        return [{
          left,
          right: rightIdx,
          x1: l.right - boardRect.left - 8,
          y1: l.top + l.height / 2 - boardRect.top,
          x2: r.left - boardRect.left + 8,
          y2: r.top + r.height / 2 - boardRect.top,
        }];
      });
      setLines(next);
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [matches, pairs.length, rights]);

  const clickRight = (rightIdx: number) => {
    if (selectedLeft === null) return;
    if (matches[selectedLeft] !== undefined || Object.values(matches).includes(rightIdx)) return;
    if (rightIdx === selectedLeft) {
      onEvent('answer_correct', { mechanic: 'matching', left: selectedLeft, right: rightIdx });
      setMatches(m => ({ ...m, [selectedLeft]: rightIdx }));
      setSelectedLeft(null);
    } else {
      onEvent('answer_wrong', { mechanic: 'matching', left: selectedLeft, right: rightIdx, expected: selectedLeft });
      setWrong(rightIdx);
      setWrongLeft(selectedLeft);
      setTimeout(() => { setWrong(null); setWrongLeft(null); }, 520);
    }
  };

  const Side = ({ s }: { s: any }) => s?.image
    ? <SignedImg path={s.image} className="h-16 w-16 object-cover rounded-xl shadow-sm" />
    : <span className="font-body font-800">{s?.text}</span>;

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto flex w-fit items-center gap-2 rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-2 font-body text-sm font-800 text-emerald-600 shadow-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-5 w-5" /> Отлично! Все пары соединены
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={boardRef} className="relative grid gap-4 sm:grid-cols-2">
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="matching-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <filter id="matching-line-shadow" x="-20%" y="-80%" width="140%" height="260%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#c084fc" floodOpacity="0.35" />
          </filter>
        </defs>
        {lines.map(line => {
          const mid = Math.max(32, Math.abs(line.x2 - line.x1) / 2);
          return (
            <g key={`${line.left}-${line.right}`}>
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                d={`M ${line.x1} ${line.y1} C ${line.x1 + mid} ${line.y1}, ${line.x2 - mid} ${line.y2}, ${line.x2} ${line.y2}`}
                fill="none"
                filter="url(#matching-line-shadow)"
                stroke="url(#matching-line)"
                strokeLinecap="round"
                strokeWidth="6"
              />
              <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={line.x1} cy={line.y1} r="7" fill="#f472b6" />
              <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={line.x2} cy={line.y2} r="7" fill="#a855f7" />
            </g>
          );
        })}
      </svg>
      <div className="relative z-10 space-y-2">
        <div className="text-xs font-body font-800 uppercase tracking-wider text-purple-400">A</div>
        {pairs.map((p: any, i: number) => (
          <motion.button key={i} layout disabled={matches[i] !== undefined}
            animate={wrongLeft === i ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
            ref={el => { leftRefs.current[i] = el; }}
            onClick={() => { setSelectedLeft(i); onEvent('choice_selected', { mechanic: 'matching', side: 'left', index: i }); }}
            className={`${tileBase} w-full flex items-center justify-center gap-3 ${
              matches[i] !== undefined ? doneTile :
              wrongLeft === i ? wrongTile :
              selectedLeft === i ? selectedTile : liveTile
            }`}>
            {matches[i] !== undefined && <CheckCircle2 className="h-5 w-5 shrink-0" />}
            <Side s={p.left} />
          </motion.button>
        ))}
      </div>
      <div className="relative z-10 space-y-2">
        <div className="text-xs font-body font-800 uppercase tracking-wider text-pink-400">B</div>
        {rights.map((rightIdx: number) => (
          <motion.button key={rightIdx} layout disabled={Object.values(matches).includes(rightIdx)}
            animate={wrong === rightIdx ? { x: [0, 6, -6, 4, -4, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
            ref={el => { rightRefs.current[rightIdx] = el; }}
            onClick={() => clickRight(rightIdx)}
            className={`${tileBase} w-full flex items-center justify-center gap-3 ${
              Object.values(matches).includes(rightIdx) ? doneTile :
              wrong === rightIdx ? wrongTile : liveTile
            }`}>
            {wrong === rightIdx && <XCircle className="h-5 w-5 shrink-0" />}
            {Object.values(matches).includes(rightIdx) && <CheckCircle2 className="h-5 w-5 shrink-0" />}
            <Side s={pairs[rightIdx]?.right} />
          </motion.button>
        ))}
      </div>
      </div>
    </div>
  );
}

// ==================== WORD LEGO ====================
function WordLegoTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  // For word_lego, user builds by joining halves. We use same matching interaction visually different.
  const pairs = payload?.pairs || [];
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [built, setBuilt] = useState<{ left: number; right: number }[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [lines, setLines] = useState<Array<{ left: number; right: number; x1: number; y1: number; x2: number; y2: number }>>([]);
  const done = built.length === pairs.length && pairs.length > 0;
  useEffect(() => { if (done) setTimeout(onDone, 700); }, [done]);

  const rights = useMemo(() => {
    const arr = pairs.map((_: any, i: number) => i);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, [pairs.length]);

  const usedLefts = new Set(built.map(b => b.left));
  const usedRights = new Set(built.map(b => b.right));

  useLayoutEffect(() => {
    const draw = () => {
      const board = boardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const next = built.flatMap(({ left, right }) => {
        const leftEl = leftRefs.current[left];
        const rightEl = rightRefs.current[right];
        if (!leftEl || !rightEl) return [];
        const l = leftEl.getBoundingClientRect();
        const r = rightEl.getBoundingClientRect();
        return [{
          left,
          right,
          x1: l.right - boardRect.left - 8,
          y1: l.top + l.height / 2 - boardRect.top,
          x2: r.left - boardRect.left + 8,
          y2: r.top + r.height / 2 - boardRect.top,
        }];
      });
      setLines(next);
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [built, pairs.length, rights]);

  const clickRight = (rightIdx: number) => {
    if (selectedLeft === null) return;
    if (rightIdx === selectedLeft) {
      onEvent('answer_correct', { mechanic: 'word_lego', left: selectedLeft, right: rightIdx });
      setBuilt(b => [...b, { left: selectedLeft, right: rightIdx }]);
      setSelectedLeft(null);
    } else {
      onEvent('answer_wrong', { mechanic: 'word_lego', left: selectedLeft, right: rightIdx, expected: selectedLeft });
      setWrong(rightIdx); setTimeout(() => setWrong(null), 400);
    }
  };

  const asText = (s: any) => s?.text || '';

  return (
    <div className="space-y-4">
      {built.length > 0 && (
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950">
          <div className="mb-2 flex items-center gap-2 text-xs font-body font-800 uppercase tracking-wider text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Собрано
          </div>
          <div className="flex flex-wrap gap-2">
            {built.map((b, i) => (
              <span key={i} className="rounded-2xl border border-emerald-100 bg-white px-4 py-2 font-body font-800 text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-[#1d2b2d] dark:text-emerald-200">
                {asText(pairs[b.left]?.left)} + {asText(pairs[b.right]?.right)}
              </span>
            ))}
          </div>
        </div>
      )}
      <div ref={boardRef} className="relative grid sm:grid-cols-2 gap-3">
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="word-lego-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="55%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {lines.map(line => {
            const mid = Math.max(32, Math.abs(line.x2 - line.x1) / 2);
            return (
              <motion.path
                key={`${line.left}-${line.right}`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                d={`M ${line.x1} ${line.y1} C ${line.x1 + mid} ${line.y1}, ${line.x2 - mid} ${line.y2}, ${line.x2} ${line.y2}`}
                fill="none"
                stroke="url(#word-lego-line)"
                strokeLinecap="round"
                strokeWidth="5"
              />
            );
          })}
        </svg>
        <div className="relative z-10">
          <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-purple-400">Часть 1</div>
          <div className="flex flex-wrap gap-2">
            {pairs.map((p: any, i: number) => (
              <button key={i} disabled={usedLefts.has(i)} ref={el => { leftRefs.current[i] = el; }} onClick={() => { setSelectedLeft(i); onEvent('choice_selected', { mechanic: 'word_lego', side: 'left', index: i }); }}
                className={`${tileBase} ${usedLefts.has(i) ? doneTile : selectedLeft === i ? selectedTile : liveTile}`}>
                {asText(p.left)}
              </button>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-pink-400">Часть 2</div>
          <div className="flex flex-wrap gap-2">
            {rights.map((idx: number) => (
              <button key={idx} ref={el => { rightRefs.current[idx] = el; }} disabled={selectedLeft === null || usedRights.has(idx)} onClick={() => clickRight(idx)}
                className={`${tileBase} ${usedRights.has(idx) ? doneTile : wrong === idx ? wrongTile : liveTile} disabled:hover:translate-y-0 disabled:hover:shadow-sm`}>
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
function FillLettersTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const text: string = payload?.text || '';
  const answers: string[] = payload?.answers || [];
  const parts = text.split('___');
  const [values, setValues] = useState<string[]>(Array(answers.length).fill(''));
  const [checked, setChecked] = useState(false);

  const check = () => {
    setChecked(true);
    const ok = values.every((v, i) => v.trim().toLowerCase() === (answers[i] || '').toLowerCase());
    onEvent(ok ? 'answer_correct' : 'answer_wrong', { mechanic: 'fill_letters', values, answers });
    if (ok) setTimeout(onDone, 600);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white bg-white p-5 text-lg leading-loose text-purple-800 shadow-sm dark:border-purple-800 dark:bg-[#241632] dark:text-purple-100">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input type="text" value={values[i] || ''}
                onChange={e => { const n = [...values]; n[i] = e.target.value; setValues(n); setChecked(false); }}
                className={`mx-1 inline-block w-24 rounded-xl border-2 px-3 py-1 text-center font-body font-800 outline-none transition ${
                  checked
                    ? (values[i]?.trim().toLowerCase() === (answers[i]||'').toLowerCase() ? doneTile : wrongTile)
                    : 'bg-yellow-50 border-yellow-200 text-amber-700 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100'
                }`} />
            )}
          </span>
        ))}
      </div>
      <button onClick={check} className="rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-5 py-2.5 font-body font-800 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">Проверить</button>
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
function AnagramTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
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
    onEvent('choice_selected', { mechanic: 'anagram_unscramble', letter: tiles[i].ch, index: i });
    setTiles(t => t.map((tl, idx) => idx === i ? { ...tl, used: true } : tl));
    setPicked(p => [...p, i]);
  };
  const undo = () => {
    if (picked.length === 0) return;
    const last = picked[picked.length - 1];
    onEvent('undo', { mechanic: 'anagram_unscramble', index: last });
    setTiles(t => t.map((tl, idx) => idx === last ? { ...tl, used: false } : tl));
    setPicked(p => p.slice(0, -1));
  };

  useEffect(() => {
    if (built.length === answer.length && built.length > 0) {
      if (built.toUpperCase() === answer.toUpperCase()) {
        onEvent('answer_correct', { mechanic: 'anagram_unscramble', answer: built });
        setTimeout(onDone, 500);
      }
      else {
        onEvent('answer_wrong', { mechanic: 'anagram_unscramble', answer: built, expected: answer });
        setWrong(true); setTimeout(() => { setWrong(false); setTiles(t => t.map(x => ({ ...x, used: false }))); setPicked([]); }, 800);
      }
    }
  }, [built]);

  return (
    <div className="space-y-4 text-center">
      <div className={`inline-block min-w-[220px] rounded-3xl border-2 px-6 py-4 font-mono text-2xl font-black tracking-widest shadow-sm ${wrong ? wrongTile : 'bg-white border-white text-purple-700 dark:border-purple-800 dark:bg-[#241632] dark:text-purple-100'}`}>
        {built || '?'.repeat(answer.length)}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {tiles.map((tl, i) => (
          <button key={i} onClick={() => pick(i)} disabled={tl.used}
            className={`h-12 w-12 rounded-2xl border-2 font-mono text-xl font-black transition ${tl.used ? 'border-gray-100 bg-gray-100 text-gray-300 dark:border-purple-900 dark:bg-[#1b1128] dark:text-purple-800' : 'border-white bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 text-purple-700 shadow-md hover:-translate-y-1 hover:shadow-lg dark:border-purple-700 dark:from-purple-800 dark:via-fuchsia-800 dark:to-pink-800 dark:text-white'}`}>
            {tl.ch}
          </button>
        ))}
      </div>
      <button onClick={undo} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-body font-700 text-purple-500 shadow-sm transition hover:bg-white hover:text-purple-700 dark:bg-[#2b1a3d] dark:text-purple-200">
        <RotateCcw className="h-4 w-4" /> Убрать последнюю
      </button>
    </div>
  );
}

// ==================== ODD ONE OUT ====================
function OddOneOutTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const items: Array<{ text?: string; image?: string; is_odd?: boolean }> = payload?.items || [];
  const [wrong, setWrong] = useState<number | null>(null);
  const [correct, setCorrect] = useState<number | null>(null);

  const pick = (i: number) => {
    onEvent('choice_selected', { mechanic: 'odd_one_out', index: i });
    if (items[i]?.is_odd) {
      setCorrect(i);
      onEvent('answer_correct', { mechanic: 'odd_one_out', index: i });
      setTimeout(onDone, 700);
      return;
    }
    setWrong(i);
    onEvent('answer_wrong', { mechanic: 'odd_one_out', index: i });
    setTimeout(() => setWrong(null), 500);
  };

  if (items.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">Добавьте варианты в конструкторе.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => pick(i)}
          className={`min-h-28 rounded-3xl border-2 p-4 text-center font-body text-lg font-900 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
            correct === i ? doneTile : wrong === i ? wrongTile : liveTile
          }`}
        >
          {item.image && <SignedImg path={item.image} className="mx-auto mb-2 h-20 w-20 rounded-2xl object-cover" />}
          <span>{item.text || `Вариант ${i + 1}`}</span>
        </button>
      ))}
    </div>
  );
}

// ==================== CATEGORY SORTING ====================
function CategorySortingTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const categories: Array<{ name: string; items: Array<{ text?: string; image?: string }> }> = payload?.categories || [];
  const allItems = useMemo(() => categories.flatMap((cat, categoryIndex) =>
    (cat.items || []).map((item, itemIndex) => ({
      ...item,
      id: `${categoryIndex}-${itemIndex}`,
      categoryIndex,
    })),
  ), [categories]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Set<string>>(new Set());
  const [wrongCategory, setWrongCategory] = useState<number | null>(null);
  const selected = allItems.find(item => item.id === selectedId);

  useEffect(() => {
    if (allItems.length > 0 && placed.size === allItems.length) setTimeout(onDone, 700);
  }, [placed.size, allItems.length]);

  const chooseCategory = (categoryIndex: number) => {
    if (!selected) return;
    if (selected.categoryIndex === categoryIndex) {
      onEvent('answer_correct', { mechanic: 'category_sorting', item: selected.text, category: categories[categoryIndex]?.name });
      setPlaced(prev => new Set([...prev, selected.id]));
      setSelectedId(null);
      return;
    }
    onEvent('answer_wrong', { mechanic: 'category_sorting', item: selected.text, category: categories[categoryIndex]?.name, expected: categories[selected.categoryIndex]?.name });
    setWrongCategory(categoryIndex);
    setTimeout(() => setWrongCategory(null), 500);
  };

  if (categories.length === 0 || allItems.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">Добавьте категории и элементы в конструкторе.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-purple-400">Выбери карточку</div>
        <div className="flex flex-wrap gap-2">
          {allItems.map(item => (
            <button
              key={item.id}
              disabled={placed.has(item.id)}
              onClick={() => {
                setSelectedId(item.id);
                onEvent('choice_selected', { mechanic: 'category_sorting', item: item.text });
              }}
              className={`${tileBase} ${placed.has(item.id) ? doneTile : selectedId === item.id ? selectedTile : liveTile}`}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-pink-400">Отправь в категорию</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((cat, i) => (
            <button
              key={i}
              onClick={() => chooseCategory(i)}
              disabled={!selected}
              className={`rounded-3xl border-2 p-4 text-left font-body font-900 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60 ${
                wrongCategory === i ? wrongTile : 'border-purple-100 bg-white text-purple-700 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-100'
              }`}
            >
              <div className="text-lg">{cat.name}</div>
              <div className="mt-1 text-xs text-purple-300">{placed.size}/{allItems.length}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== CIPHER DECODER ====================
function encodeCipherAnswer(answer: string) {
  return answer.toUpperCase().split('').map(ch => {
    if (ch === ' ') return '/';
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) return String(code - 64);
    return ch;
  }).join(' ');
}

function CipherDecoderTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const answer = String(payload?.answer || '').trim();
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<'ok' | 'wrong' | null>(null);
  const check = () => {
    const ok = value.trim().toLowerCase() === answer.toLowerCase();
    setChecked(ok ? 'ok' : 'wrong');
    onEvent(ok ? 'answer_correct' : 'answer_wrong', { mechanic: 'cipher_decoder', answer: value, expected: answer });
    if (ok) setTimeout(onDone, 700);
  };

  if (!answer) {
    return <p className="text-center text-purple-500 dark:text-purple-200">Добавьте ответ для шифра в конструкторе.</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 text-center">
      <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm dark:border-purple-800 dark:bg-[#241632]">
        <div className="mb-2 text-xs font-body font-800 uppercase tracking-wider text-pink-400">Расшифруй</div>
        <div className="font-mono text-2xl font-black tracking-widest text-purple-800 dark:text-purple-100">{encodeCipherAnswer(answer)}</div>
      </div>
      <input
        value={value}
        onChange={e => { setValue(e.target.value); setChecked(null); }}
        onKeyDown={e => { if (e.key === 'Enter') check(); }}
        className={`input-magic w-full text-center text-lg font-900 ${checked === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : checked === 'wrong' ? 'border-rose-300 bg-rose-50 text-rose-600' : ''}`}
        placeholder="Напиши слово"
      />
      <button onClick={check} className="rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-5 py-2.5 font-body font-800 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
        Проверить
      </button>
    </div>
  );
}

// ==================== WORD SEARCH ====================
function normalizeSearchWord(word: string) {
  return word.trim().toUpperCase().replace(/\s+/g, '');
}

function makeWordSearchGrid(words: string[], size: number) {
  const cleanWords = words.map(normalizeSearchWord).filter(Boolean);
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
  ];
  const fits = (word: string, row: number, col: number, dr: number, dc: number) => {
    const endRow = row + dr * (word.length - 1);
    const endCol = col + dc * (word.length - 1);
    if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) return false;
    return word.split('').every((ch, i) => {
      const current = grid[row + dr * i][col + dc * i];
      return current === '' || current === ch;
    });
  };
  const place = (word: string, row: number, col: number, dr: number, dc: number) => {
    word.split('').forEach((ch, i) => { grid[row + dr * i][col + dc * i] = ch; });
  };

  cleanWords.forEach((word, wordIndex) => {
    const direction = directions[wordIndex % directions.length];
    let placed = false;
    for (let offset = 0; offset < size * size && !placed; offset++) {
      const row = (wordIndex * 3 + offset) % size;
      const col = (wordIndex * 5 + offset * 2) % size;
      if (fits(word, row, col, direction.dr, direction.dc)) {
        place(word, row, col, direction.dr, direction.dc);
        placed = true;
      }
    }
  });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!grid[row][col]) grid[row][col] = alphabet[(row * 7 + col * 11) % alphabet.length];
    }
  }
  return grid;
}

function WordSearchTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const words = Array.from(new Set((payload?.words || []).map(normalizeSearchWord).filter(Boolean)));
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
  const size = Math.max(6, Math.min(14, Math.max(Number(payload?.size) || 10, longestWord)));
  const grid = useMemo(() => makeWordSearchGrid(words, size), [words.join('|'), size]);
  const [selected, setSelected] = useState<Array<{ row: number; col: number; letter: string }>>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (words.length > 0 && found.size === words.length) setTimeout(onDone, 800);
  }, [found.size, words.length]);

  const selectedWord = selected.map(cell => cell.letter).join('');
  const selectedKeys = new Set(selected.map(cell => `${cell.row}-${cell.col}`));

  const toggleCell = (row: number, col: number) => {
    const letter = grid[row][col];
    const key = `${row}-${col}`;
    if (foundCells.has(key)) return;
    setWrong(false);
    setSelected(prev => prev.some(cell => cell.row === row && cell.col === col)
      ? prev.filter(cell => !(cell.row === row && cell.col === col))
      : [...prev, { row, col, letter }]);
    onEvent('choice_selected', { mechanic: 'word_search', row, col, letter });
  };

  const check = () => {
    const reversed = selectedWord.split('').reverse().join('');
    const matched = words.find(word => !found.has(word) && (word === selectedWord || word === reversed));
    if (!matched) {
      setWrong(true);
      onEvent('answer_wrong', { mechanic: 'word_search', answer: selectedWord, expected: words });
      setTimeout(() => setWrong(false), 500);
      return;
    }
    setFound(prev => new Set([...prev, matched]));
    setFoundCells(prev => new Set([...prev, ...selected.map(cell => `${cell.row}-${cell.col}`)]));
    setSelected([]);
    onEvent('answer_correct', { mechanic: 'word_search', word: matched });
  };

  if (words.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">Добавьте слова в конструкторе.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {words.map(word => (
          <span key={word} className={`rounded-2xl px-3 py-1 text-sm font-body font-900 ${found.has(word) ? 'bg-emerald-100 text-emerald-700 line-through' : 'bg-purple-50 text-purple-500 dark:bg-[#2b1a3d] dark:text-purple-200'}`}>
            {word}
          </span>
        ))}
      </div>
      <div className={`mx-auto grid max-w-[min(92vw,560px)] gap-1 rounded-3xl border-2 bg-white p-3 shadow-sm dark:bg-[#241632] ${wrong ? 'border-rose-300' : 'border-purple-100 dark:border-purple-700'}`}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {grid.flatMap((row, rowIndex) => row.map((letter, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const isSelected = selectedKeys.has(key);
          const isFound = foundCells.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleCell(rowIndex, colIndex)}
              className={`aspect-square rounded-xl font-mono text-sm font-black transition sm:text-base ${
                isFound ? 'bg-emerald-100 text-emerald-700' :
                isSelected ? 'bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-md' :
                'bg-purple-50 text-purple-700 hover:bg-pink-100 dark:bg-[#2b1a3d] dark:text-purple-100 dark:hover:bg-[#3a2451]'
              }`}
            >
              {letter}
            </button>
          );
        }))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="min-w-32 rounded-2xl bg-white px-4 py-2 text-center font-mono font-black text-purple-700 shadow-sm dark:bg-[#2b1a3d] dark:text-purple-100">
          {selectedWord || '...'}
        </span>
        <button onClick={check} disabled={selected.length === 0} className="rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-5 py-2.5 font-body font-800 text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50">
          Проверить
        </button>
        <button onClick={() => setSelected([])} className="rounded-2xl bg-white px-4 py-2 text-sm font-body font-800 text-purple-500 shadow-sm transition hover:bg-purple-50 dark:bg-[#2b1a3d] dark:text-purple-200">
          Очистить
        </button>
      </div>
    </div>
  );
}

// ==================== CONNECT THE DOTS ====================
function ConnectDotsTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const points: Array<{ x: number; y: number; order: number }> = [...(payload?.points || [])].sort((a, b) => a.order - b.order);
  const [nextOrder, setNextOrder] = useState(1);
  const [wrong, setWrong] = useState<number | null>(null);
  const connected = points.filter(point => point.order < nextOrder);

  useEffect(() => {
    if (points.length > 0 && nextOrder > points.length) setTimeout(onDone, 900);
  }, [nextOrder, points.length]);

  const pick = (point: { x: number; y: number; order: number }) => {
    onEvent('choice_selected', { mechanic: 'connect_dots', order: point.order });
    if (point.order === nextOrder) {
      setNextOrder(order => order + 1);
      onEvent('answer_correct', { mechanic: 'connect_dots', order: point.order });
      return;
    }
    setWrong(point.order);
    onEvent('answer_wrong', { mechanic: 'connect_dots', order: point.order, expected: nextOrder });
    setTimeout(() => setWrong(null), 500);
  };

  if (points.length < 2) {
    return <p className="text-center text-purple-500 dark:text-purple-200">Добавьте минимум две точки в конструкторе.</p>;
  }

  const polyline = connected.map(point => `${point.x},${point.y}`).join(' ');

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-3xl rounded-3xl border border-purple-100 bg-gradient-to-br from-sky-50 via-pink-50 to-purple-50 p-4 shadow-sm dark:border-purple-700 dark:from-[#211331] dark:via-[#25123a] dark:to-[#14253d]">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[1.5rem] bg-white/80 dark:bg-[#1a1028]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            <motion.polyline
              points={polyline}
              fill="none"
              stroke="#ec4899"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              initial={false}
              animate={{ opacity: polyline ? 1 : 0 }}
            />
          </svg>
          {points.map(point => {
            const done = point.order < nextOrder;
            const current = point.order === nextOrder;
            return (
              <motion.button
                key={point.order}
                animate={wrong === point.order ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                onClick={() => pick(point)}
                className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 font-display text-lg font-black shadow-lg transition ${
                  done ? 'border-emerald-200 bg-emerald-400 text-white' :
                  wrong === point.order ? 'border-rose-200 bg-rose-400 text-white' :
                  current ? 'border-pink-200 bg-gradient-to-br from-pink-400 to-purple-400 text-white ring-4 ring-pink-100' :
                  'border-white bg-purple-100 text-purple-600 hover:scale-110 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-100'
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                {done ? <CheckCircle2 className="h-6 w-6" /> : point.order}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="text-center font-body text-sm font-800 text-purple-500 dark:text-purple-200">
        Следующая точка: #{Math.min(nextOrder, points.length)}
      </div>
    </div>
  );
}

// ==================== SPOT & COUNT ====================
function SpotAndCountTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const spots: Array<{ x: number; y: number; r: number }> = payload?.spots || [];
  const expected = Number(payload?.expected_count) || spots.length;
  const [found, setFound] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (expected > 0 && found.size >= expected) {
      onEvent('answer_correct', { mechanic: 'spot_and_count', count: found.size });
      setTimeout(onDone, 800);
    }
  }, [found.size, expected]);

  const tapSpot = (index: number) => {
    if (found.has(index)) return;
    setFound(prev => new Set([...prev, index]));
    onEvent('choice_selected', { mechanic: 'spot_and_count', index, count: found.size + 1 });
  };

  if (spots.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">Добавьте объекты для поиска в конструкторе.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="rounded-3xl bg-white px-5 py-2 font-display text-2xl font-black text-purple-800 shadow-sm dark:bg-[#2b1a3d] dark:text-purple-100">
          {found.size} / {expected}
        </div>
      </div>
      <div className="mx-auto max-w-3xl rounded-3xl border border-purple-100 bg-gradient-to-br from-sky-50 via-pink-50 to-purple-50 p-4 shadow-sm dark:border-purple-700 dark:from-[#211331] dark:via-[#25123a] dark:to-[#14253d]">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[1.5rem] bg-white/80 dark:bg-[#1a1028]">
          {payload?.background_url ? (
            <SignedImg path={payload.background_url} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,#fbcfe8,transparent_26%),radial-gradient(circle_at_75%_35%,#bfdbfe,transparent_24%),radial-gradient(circle_at_52%_78%,#ddd6fe,transparent_30%)]" />
          )}
          {spots.map((spot, i) => {
            const isFound = found.has(i);
            return (
              <motion.button
                key={i}
                onClick={() => tapSpot(i)}
                initial={false}
                animate={isFound ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 shadow-lg transition ${
                  isFound
                    ? 'border-emerald-200 bg-emerald-400/80 text-white'
                    : 'border-white bg-pink-400/20 text-white hover:bg-pink-400/40'
                }`}
                style={{
                  left: `${spot.x}%`,
                  top: `${spot.y}%`,
                  width: `${Math.max(22, spot.r * 4)}px`,
                  height: `${Math.max(22, spot.r * 4)}px`,
                }}
                aria-label={`spot ${i + 1}`}
              >
                {isFound && <CheckCircle2 className="mx-auto h-5 w-5" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== DIGITAL COLORING ====================
function DigitalColoringTask({ payload, onDone, onEvent }: { payload: any; onDone: () => void; onEvent: TaskTelemetry }) {
  const palette: Array<{ code: string; color: string }> = payload?.palette || [];
  const regions: Array<{ id: string; code: string }> = payload?.regions || [];
  const [selectedCode, setSelectedCode] = useState(palette[0]?.code || '');
  const [colored, setColored] = useState<Record<string, string>>({});
  const [wrongRegion, setWrongRegion] = useState<string | null>(null);
  const colorFor = (code: string) => palette.find(item => String(item.code) === String(code))?.color || '#f9a8d4';

  useEffect(() => {
    if (regions.length > 0 && Object.keys(colored).length === regions.length) setTimeout(onDone, 900);
  }, [colored, regions.length]);

  const paint = (region: { id: string; code: string }) => {
    onEvent('choice_selected', { mechanic: 'digital_coloring', region: region.id, selectedCode });
    if (String(selectedCode) !== String(region.code)) {
      setWrongRegion(region.id);
      onEvent('answer_wrong', { mechanic: 'digital_coloring', region: region.id, selectedCode, expected: region.code });
      setTimeout(() => setWrongRegion(null), 500);
      return;
    }
    setColored(prev => ({ ...prev, [region.id]: selectedCode }));
    onEvent('answer_correct', { mechanic: 'digital_coloring', region: region.id, code: selectedCode });
  };

  if (palette.length === 0 || regions.length === 0) {
    return <p className="text-center text-purple-500 dark:text-purple-200">Добавьте палитру и области в конструкторе.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-center gap-2">
        {palette.map(item => (
          <button
            key={item.code}
            onClick={() => setSelectedCode(String(item.code))}
            className={`flex items-center gap-2 rounded-2xl border-2 bg-white px-3 py-2 font-body text-sm font-900 text-purple-700 shadow-sm transition hover:-translate-y-0.5 dark:bg-[#2b1a3d] dark:text-purple-100 ${
              String(selectedCode) === String(item.code) ? 'border-pink-300 ring-4 ring-pink-100 dark:ring-purple-500/30' : 'border-purple-100 dark:border-purple-700'
            }`}
          >
            <span className="h-5 w-5 rounded-full border border-white shadow-sm" style={{ background: item.color }} />
            {item.code}
          </button>
        ))}
      </div>
      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        {regions.map((region, index) => {
          const paintedCode = colored[region.id];
          const painted = Boolean(paintedCode);
          return (
            <motion.button
              key={region.id}
              animate={wrongRegion === region.id ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              onClick={() => paint(region)}
              className={`aspect-square rounded-[2rem] border-4 font-display text-3xl font-black shadow-lg transition hover:-translate-y-1 ${
                wrongRegion === region.id ? 'border-rose-300 bg-rose-50 text-rose-500' :
                painted ? 'border-white text-white' :
                'border-purple-100 bg-white text-purple-300 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-500'
              }`}
              style={painted ? { background: colorFor(paintedCode) } : undefined}
            >
              {painted ? <CheckCircle2 className="mx-auto h-9 w-9" /> : region.code || index + 1}
            </motion.button>
          );
        })}
      </div>
      <div className="text-center font-body text-sm font-800 text-purple-500 dark:text-purple-200">
        Закрашено: {Object.keys(colored).length} / {regions.length}
      </div>
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
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [teacherHint, setTeacherHint] = useState<string | null>(null);
  const lastTeacherHintId = useRef<string | null>(null);
  const finishedRef = useRef<null | number>(null);
  const theoryTask = useMemo(() => tasks.find(task => task.mechanic_type === 'theory_content'), [tasks]);
  const playableTasks = useMemo(() => tasks.filter(task => task.mechanic_type !== 'theory_content'), [tasks]);
  const displayedTasks = useMemo(
    () => lesson.type === 'theory' ? (theoryTask ? [theoryTask] : []) : playableTasks,
    [lesson.type, playableTasks, theoryTask],
  );

  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);

  const showTeacherHint = (id: string, message: string) => {
    if (lastTeacherHintId.current === id) return;
    lastTeacherHintId.current = id;
    setTeacherHint(message);
    window.setTimeout(() => setTeacherHint(current => current === message ? null : current), 9000);
  };

  useEffect(() => {
    listTasks(lesson.id).then(t => { setTasks(t); setLoading(false); });
  }, [lesson.id, userId]);

  useEffect(() => {
    let alive = true;
    startLiveSession(lesson.id, userId).then(session => {
      if (!alive) return;
      setLiveSession(session);
      if (session) {
        recordLiveEvent({
          sessionId: session.id,
          lessonId: lesson.id,
          studentId: userId,
          eventType: 'lesson_opened',
          payload: { lessonTitle: lesson.title },
        });
      }
    });
    return () => { alive = false; };
  }, [lesson.id, userId]);

  useEffect(() => {
    if (!liveSession) return;
    return subscribeLiveSessionEvents(liveSession.id, event => {
      if (event.actor_role !== 'teacher' || event.event_type !== 'teacher_hint') return;
      const message = event.payload_json?.message || 'Учитель отправил подсказку';
      showTeacherHint(event.id, message);
    });
  }, [liveSession?.id]);

  useEffect(() => {
    if (!liveSession) return;
    let alive = true;
    const checkHints = async () => {
      try {
        const events = await listLiveEvents(liveSession.id);
        if (!alive) return;
        const latestHint = events.find(event => event.actor_role === 'teacher' && event.event_type === 'teacher_hint');
        if (!latestHint) return;
        const message = latestHint.payload_json?.message || 'Учитель отправил подсказку';
        showTeacherHint(latestHint.id, message);
      } catch {
        // Realtime remains primary; polling is only a quiet backup for missed hint events.
      }
    };
    checkHints();
    const interval = window.setInterval(checkHints, 2500);
    return () => { alive = false; window.clearInterval(interval); };
  }, [liveSession?.id]);

  useEffect(() => {
    if (!liveSession) return;
    const closeUnfinishedSession = () => {
      if (finishedRef.current === null) abandonLiveSession(liveSession.id);
    };
    window.addEventListener('pagehide', closeUnfinishedSession);
    return () => {
      window.removeEventListener('pagehide', closeUnfinishedSession);
    };
  }, [liveSession?.id]);

  useEffect(() => {
    const curTask = displayedTasks[idx];
    if (!liveSession || !curTask) return;
    updateLiveSession(liveSession.id, { current_task_id: curTask.id, current_task_index: idx });
    recordLiveEvent({
      sessionId: liveSession.id,
      lessonId: lesson.id,
      studentId: userId,
      eventType: 'task_opened',
      taskId: curTask.id,
      payload: { index: idx, mechanic: curTask.mechanic_type },
    });
  }, [liveSession?.id, displayedTasks, idx, lesson.id, userId]);

  const emitTaskEvent: TaskTelemetry = (eventType, payload = {}) => {
    const curTask = displayedTasks[idx];
    recordLiveEvent({
      sessionId: liveSession?.id ?? null,
      lessonId: lesson.id,
      studentId: userId,
      eventType,
      taskId: curTask?.id ?? null,
      payload,
    });
  };

  const finish = async () => {
    const stars = await markLessonComplete(userId, lesson);
    finishedRef.current = stars;
    if (liveSession) {
      await recordLiveEvent({
        sessionId: liveSession.id,
        lessonId: lesson.id,
        studentId: userId,
        eventType: 'lesson_completed',
        payload: { stars },
      });
      await completeLiveSession(liveSession.id);
    }
    setFinished(stars);
    onCompleted(stars);
  };
  const nextTask = () => {
    if (idx + 1 >= displayedTasks.length) finish();
    else setIdx(i => i + 1);
  };

  const exitLesson = async () => {
    if (liveSession && finishedRef.current === null) await abandonLiveSession(liveSession.id);
    onExit();
  };

  const cur = displayedTasks[idx];

  const room = (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-pink-50 via-violet-50 to-sky-50 dark:bg-[#150923] dark:bg-none">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-3xl border border-white bg-white px-4 py-3 shadow-sm dark:border-purple-800 dark:bg-[#211331] dark:shadow-none">
          <button onClick={exitLesson} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-body font-800 text-purple-500 transition hover:bg-purple-50 hover:text-purple-700 dark:text-purple-200 dark:hover:bg-purple-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Выйти
          </button>
          <div className="flex items-center gap-3">
            {lesson.type !== 'theory' && displayedTasks.length > 0 && finished === null && <LessonProgress current={idx} total={displayedTasks.length} />}
            <div className="rounded-2xl border border-pink-100 bg-pink-50 px-3 py-2 text-sm font-body font-800 text-pink-500 dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-pink-200">
              {finished === null && (lesson.type === 'theory' ? 'Теоретический урок' : displayedTasks.length > 0 && <>Задание {idx + 1} из {displayedTasks.length}</>)}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-start justify-center pt-6 sm:pt-10">
          <div className="w-full rounded-[2rem] border border-white bg-gradient-to-br from-white via-white to-pink-50 p-4 shadow-2xl shadow-purple-100/60 sm:p-6 lg:p-8 dark:border-purple-800 dark:bg-[#211331] dark:bg-none dark:shadow-none">
          <AnimatePresence>
            {teacherHint && finished === null && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 rounded-3xl border border-yellow-200 bg-gradient-to-r from-yellow-50 via-pink-50 to-purple-50 px-5 py-4 text-center font-body text-base font-black text-purple-800 shadow-lg shadow-yellow-100/60 dark:border-yellow-500/30 dark:from-[#35240c] dark:via-[#311536] dark:to-[#211331] dark:text-yellow-100"
              >
                <span className="mr-2">💡</span>{teacherHint}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 py-2 text-xs font-body font-800 uppercase tracking-wider text-purple-400 shadow-sm dark:border-purple-700 dark:bg-[#2b1a3d] dark:text-purple-200">
              <Sparkles className="h-4 w-4 text-pink-400" /> Vetoschool quest
            </div>
            {lesson.type !== 'theory' && <h2 className="font-display text-3xl font-black text-purple-800 sm:text-4xl dark:text-purple-100">{lesson.title}</h2>}
          </div>

          {loading && <p className="text-center text-purple-500 dark:text-purple-200">Загрузка…</p>}
          {!loading && displayedTasks.length === 0 && (
            <div className="text-center py-8">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-purple-300" />
              <p className="font-body font-bold text-purple-500 dark:text-purple-200">{lesson.type === 'theory' ? 'Материал теоретического урока пока не добавлен.' : 'В этом уроке пока нет заданий.'}</p>
              <button onClick={exitLesson} className="mt-4 rounded-2xl bg-purple-500 px-5 py-2 text-white shadow-lg">Назад к карте</button>
            </div>
          )}
          {!loading && lesson.type === 'theory' && theoryTask && finished === null && (
            <div className="space-y-6">
              <TheoryLessonView content={theoryTask.payload_json} fallbackTitle={lesson.title} />
              <div className="flex justify-center border-t border-purple-100 pt-6 dark:border-purple-700">
                <button onClick={finish} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-6 py-3 font-display text-sm font-black text-white shadow-xl shadow-pink-200/50 transition hover:-translate-y-0.5 hover:shadow-2xl dark:shadow-none">
                  <CheckCircle2 className="h-5 w-5" /> Я изучил(а) материал
                </button>
              </div>
            </div>
          )}
          {!loading && lesson.type !== 'theory' && cur && finished === null && (
            <AnimatePresence mode="wait">
              <motion.div key={cur.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                {cur.mechanic_type === 'matching' && <MatchingTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'word_lego' && <WordLegoTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'fill_letters' && <FillLettersTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'anagram_unscramble' && <AnagramTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'odd_one_out' && <OddOneOutTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'category_sorting' && <CategorySortingTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'cipher_decoder' && <CipherDecoderTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'word_search' && <WordSearchTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'connect_dots' && <ConnectDotsTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'spot_and_count' && <SpotAndCountTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {cur.mechanic_type === 'digital_coloring' && <DigitalColoringTask payload={cur.payload_json} onDone={nextTask} onEvent={emitTaskEvent} />}
                {!['matching','word_lego','fill_letters','anagram_unscramble','odd_one_out','category_sorting','cipher_decoder','word_search','connect_dots','spot_and_count','digital_coloring'].includes(cur.mechanic_type) && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">🚧</div>
                    <p className="text-purple-500 dark:text-purple-200">Механика «{cur.mechanic_type}» ещё в разработке.</p>
                    <button onClick={nextTask} className="mt-4 rounded-2xl bg-purple-500 px-5 py-2 text-white shadow-lg">Пропустить</button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
          {finished !== null && (
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 text-yellow-500 shadow-xl">
                <Trophy className="h-10 w-10" />
              </div>
              <h3 className="font-display font-black text-3xl text-purple-800 mb-2 dark:text-purple-100">Урок пройден!</h3>
              {finished > 0
                ? <p className="text-yellow-600 font-body font-bold text-xl">+{finished} ⭐</p>
                : <p className="text-purple-500 font-body dark:text-purple-200">Отличная работа!</p>}
              <button onClick={exitLesson} className="mt-5 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-6 py-2.5 font-body font-800 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">На карту</button>
            </motion.div>
          )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? room : createPortal(room, document.body);
}
