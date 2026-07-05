import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Star } from 'lucide-react';
import {
  Workbook, Unit, Lesson,
  listWorkbooks, listUnits, listLessons, getLessonProgress,
} from '../lib/workbooks';
import { canReward } from '../lib/mechanics';
import InteractiveLessonRoom from './InteractiveLessonRoom';
import { Lang, t } from '../lib/i18n';

const KIND_EMOJI: Record<string, string> = {
  theory: '📖', class_task: '👩‍🏫', homework: '✏️', practice: '🎮', checkpoint: '🏁',
};

export default function InteractiveLessonMap({ userId, hasAccess, lang = 'ru', onStarsChanged }: {
  userId: string; hasAccess: boolean; lang?: Lang; onStarsChanged?: () => void;
}) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [progress, setProgress] = useState<Record<string, { completed_at: string; stars_awarded: number }>>({});
  const [active, setActive] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const wbs = (await listWorkbooks()).filter(w => w.is_published);
    setWorkbooks(wbs);
    const u: Record<string, Unit[]> = {};
    const l: Record<string, Lesson[]> = {};
    for (const w of wbs) {
      u[w.id] = await listUnits(w.id);
      for (const un of u[w.id]) l[un.id] = await listLessons(un.id);
    }
    setUnits(u); setLessons(l);
    setProgress(await getLessonProgress(userId));
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [userId]);

  if (loading) return <div className="text-center py-16 text-purple-500">Загрузка карты…</div>;

  if (workbooks.length === 0) {
    return (
      <div className="glass rounded-3xl p-12 text-center">
        <div className="text-6xl mb-3">🗺️</div>
        <h3 className="font-display font-bold text-2xl text-purple-700 mb-2">{t(lang, 'map_empty_title')}</h3>
        <p className="font-body text-purple-400">{t(lang, 'map_empty_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {workbooks.map(wb => (
        <div key={wb.id} className="glass rounded-3xl p-6">
          <h3 className="font-display font-black text-2xl text-purple-800 mb-1">📘 {wb.title}</h3>
          {wb.description && <p className="font-body text-sm text-purple-500 mb-4">{wb.description}</p>}
          <div className="space-y-6">
            {(units[wb.id] || []).map(un => {
              const list = lessons[un.id] || [];
              // Islands unlocked linearly: first unlocked, next unlocks after previous completed
              return (
                <div key={un.id}>
                  <div className="font-display font-bold text-lg text-pink-600 mb-3">{un.emoji} {un.title}</div>
                  <div className="relative flex flex-wrap gap-4 items-center justify-center py-4">
                    {list.map((l, i) => {
                      const prev = list[i - 1];
                      const done = !!progress[l.id];
                      const unlocked = hasAccess && (i === 0 || (prev && progress[prev.id]));
                      const stars = canReward(l.type) ? l.stars_reward : 0;
                      // Zig-zag offset for playful map
                      const offset = i % 2 === 0 ? 0 : 30;
                      return (
                        <motion.button key={l.id} whileHover={unlocked ? { scale: 1.1 } : {}} whileTap={unlocked ? { scale: 0.95 } : {}}
                          onClick={() => unlocked && setActive(l)}
                          style={{ marginTop: offset }}
                          className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-xl border-4 transition ${
                            done
                              ? 'bg-gradient-to-br from-green-300 to-emerald-500 border-green-600 text-white'
                              : unlocked
                                ? 'bg-gradient-to-br from-yellow-200 via-pink-300 to-purple-400 border-white text-white hover:shadow-2xl cursor-pointer'
                                : 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed'
                          }`}>
                          <div className="text-3xl mb-1">{done ? '✅' : (unlocked ? KIND_EMOJI[l.type] || '🎯' : <Lock className="w-6 h-6" />)}</div>
                          <div className="font-display font-bold text-xs px-1 text-center leading-tight">{l.title}</div>
                          {stars > 0 && (
                            <div className={`absolute -top-2 -right-2 text-xs font-black px-2 py-0.5 rounded-full shadow ${done ? 'bg-yellow-400 text-yellow-900' : 'bg-white text-yellow-600'}`}>
                              ⭐{stars}
                            </div>
                          )}
                          <div className="absolute -bottom-5 text-[10px] font-body font-600 text-purple-500 whitespace-nowrap">#{l.lesson_number}</div>
                        </motion.button>
                      );
                    })}
                    {list.length === 0 && <p className="text-sm text-purple-400 italic">Уроки скоро появятся</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {active && (
        <InteractiveLessonRoom
          lesson={active} userId={userId}
          onExit={() => { setActive(null); refresh(); onStarsChanged?.(); }}
          onCompleted={() => { onStarsChanged?.(); }}
        />
      )}
    </div>
  );
}
