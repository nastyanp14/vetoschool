import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getCurrentUser, getUsers, loadAllUsers } from '../lib/auth';
import { ensureStudentContent, getStudentRating, ContentItem, loadStudentContent } from '../lib/content';
import { getStudentSchedule, loadStudentSchedule } from '../lib/schedule';
import { Lang } from '../lib/i18n';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string, locale: string) {
  try { return new Date(date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return date; }
}

function StarRow({ value, size = 'text-lg' }: { value: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={`${size} ${s <= value ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  );
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

// ─── Radial progress ring ─────────────────────────────────────────────────────

function RadialRing({
  percent, color, size = 100, stroke = 10, label, sub,
}: {
  percent: number; color: string; size?: number; stroke?: number; label: string; sub: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE4FF" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-black text-xl text-purple-700">{percent}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="font-body font-600 text-sm text-purple-700">{label}</div>
        <div className="font-body text-xs text-purple-400">{sub}</div>
      </div>
    </div>
  );
}

// ─── Bar chart (star ratings over time) ──────────────────────────────────────

function BarChart({ items, locale, emptyMsg }: { items: ContentItem[]; locale: string; emptyMsg: string }) {
  const graded = items.filter(i => i.starRating && i.starRating > 0);
  if (graded.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">📊</div>
        <p className="font-body text-sm text-purple-400">{emptyMsg}</p>
      </div>
    );
  }

  const maxH = 140;
  const barW = Math.min(60, Math.floor(560 / graded.length) - 12);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 min-w-fit px-2 pb-2" style={{ height: maxH + 60 }}>
        {graded.map((hw, i) => {
          const stars = hw.starRating || 0;
          const barH = (stars / 5) * maxH;
          const colors = ['#FF8DC7', '#C8B3FF', '#7EC8FF', '#7EFFC8', '#FFD47E'];
          const color = colors[i % colors.length];
          return (
            <div key={hw.id} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: barW }}>
              {/* Stars label on top */}
              <div className="font-display font-black text-sm text-purple-700">{stars}★</div>
              {/* Bar */}
              <div className="relative flex items-end" style={{ height: maxH }}>
                <motion.div
                  className="rounded-t-2xl w-full"
                  style={{ width: barW, background: `linear-gradient(180deg, ${color}, ${color}88)` }}
                  initial={{ height: 0 }}
                  animate={{ height: barH }}
                  transition={{ delay: i * 0.1 + 0.2, duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
                />
              </div>
              {/* Label */}
              <div className="font-body text-xs text-purple-500 text-center leading-tight" style={{ maxWidth: barW }}>
                {hw.title.replace(/Home Task \d+:\s*/i, '').replace(/🎨|✨|🔢|🧸|📝|🎮|🎧|📚|✏️/g, '').trim().slice(0, 14)}
              </div>
            </div>
          );
        })}
      </div>
      {/* Y-axis labels */}
      <div className="flex justify-between font-body text-xs text-purple-300 mt-1 px-2">
        <span>0★</span><span>1★</span><span>2★</span><span>3★</span><span>4★</span><span>5★</span>
      </div>
    </div>
  );
}

// ─── Progress timeline ────────────────────────────────────────────────────────

function Timeline({ items, locale, typeColors }: { items: ContentItem[]; locale: string; typeColors: Record<string, string> }) {
  const unlocked = items.filter(i => i.unlocked);
  if (unlocked.length === 0) return null;
  return (
    <div className="relative pl-6">
      {/* vertical line */}
      <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-pink-200 via-purple-200 to-blue-200 rounded-full" />
      <div className="space-y-3">
        {unlocked.map((item, i) => (
          <motion.div key={item.id}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
            className="flex items-start gap-3">
            {/* dot */}
            <div className="absolute left-0 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-md flex-shrink-0"
              style={{ background: typeColors[item.type] || '#C8B3FF', marginTop: 2 }}>
              <span style={{ fontSize: 9 }}>{item.emoji}</span>
            </div>
            <div className="bg-white/70 rounded-2xl border border-purple-50 p-3 flex-1 ml-2">
              <div className="font-body font-600 text-purple-700 text-sm">{item.title}</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {item.scheduledDate && (
                  <span className="font-body text-xs text-blue-400">🗓 {item.scheduledDate} {item.scheduledTime}</span>
                )}
                {item.dueDate && (
                  <span className="font-body text-xs text-purple-400">📅 {fmt(item.dueDate, locale)}</span>
                )}
                {item.starRating && item.starRating > 0 && <StarRow value={item.starRating} size="text-sm" />}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Section block ────────────────────────────────────────────────────────────

function SectionBlock({ title, items, locale, emptyMsg }: {
  title: string; items: ContentItem[]; locale: string; emptyMsg: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="glass rounded-3xl p-6">
      <h3 className="font-display font-bold text-lg text-purple-700 mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <motion.div key={item.id}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className={`flex items-center gap-3 p-3 rounded-2xl border ${
              item.unlocked ? 'bg-white/70 border-purple-100' : 'bg-gray-50/80 border-gray-100'
            }`}>
            <span className="text-2xl flex-shrink-0">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className={`font-body font-600 text-sm truncate ${item.unlocked ? 'text-purple-700' : 'text-gray-400'}`}>
                {item.title}
              </div>
              {item.dueDate && <div className="font-body text-xs text-purple-400 mt-0.5">📅 {fmt(item.dueDate, locale)}</div>}
              {item.scheduledDate && <div className="font-body text-xs text-blue-400 mt-0.5">🗓 {item.scheduledDate} {item.scheduledTime}</div>}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`text-xs px-2.5 py-1 rounded-full font-body font-600 ${
                item.unlocked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {item.unlocked ? '🔓' : '🔒'}
              </span>
              {item.type === 'homework' && item.starRating && item.starRating > 0 && (
                <StarRow value={item.starRating} size="text-sm" />
              )}
              {item.type === 'homework' && (!item.starRating || item.starRating === 0) && item.unlocked && (
                <span className="text-xs text-purple-300 font-body">{emptyMsg}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Analytics({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const admin = getCurrentUser();

  const [student, setStudent] = useState(() => getUsers().find(u => u.id === userId) || null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [schedule, setSchedule] = useState<ReturnType<typeof getStudentSchedule>>([]);
  const [rating, setRating] = useState({ avg: 0, count: 0 });

  const locale = lang === 'ru' ? 'ru-RU' : lang === 'ua' ? 'uk-UA' : 'en-GB';

  useEffect(() => {
    if (!admin || admin.role !== 'admin') { navigate('/login'); return; }
    if (!userId) { navigate('/admin'); return; }
    (async () => {
      const users = await loadAllUsers();
      const found = users.find(u => u.id === userId);
      if (!found) { navigate('/admin'); return; }
      setStudent(found);
      const [items, slots] = await Promise.all([loadStudentContent(userId), loadStudentSchedule(userId)]);
      setContent(items);
      setSchedule(slots);
      setRating(getStudentRating(userId));
    })();
  }, [userId, admin, navigate]);

  if (!student) return null;

  const lessons   = content.filter(i => i.type === 'lesson');
  const homework  = content.filter(i => i.type === 'homework');
  const practice  = content.filter(i => i.type === 'practice');
  const grammar   = content.filter(i => i.type === 'grammar');
  const listening = content.filter(i => i.type === 'listening');

  const gradedHW = homework.filter(i => i.starRating && i.starRating > 0);
  const totalUnlocked = content.filter(i => i.unlocked).length;
  const unlockedLessons = lessons.filter(i => i.unlocked).length;

  const typeColors: Record<string, string> = {
    lesson: '#FF8DC7', homework: '#C8B3FF', practice: '#7EC8FF',
    grammar: '#FFD47E', listening: '#7EFFC8',
  };

  const labels = {
    ru: {
      back: '← Назад в панель',
      analytics: 'Аналитика ученика',
      joined: 'Зарегистрирован',
      active: '🟢 Активен', pending: '🟡 Ожидает',
      unlocked: 'Открыто', rating: 'Рейтинг',
      graded: 'ДЗ оценено', scheduled: 'Занятий',
      of: 'из',
      progressTitle: '📈 Прогресс по разделам',
      chartTitle: '📊 График успеваемости (оценки за ДЗ)',
      timelineTitle: '🗓 Хронология открытых материалов',
      hwTitle: '⭐ Оценки за домашние задания',
      allContentTitle: '📚 Все материалы',
      scheduleTitle: '📅 Расписание занятий',
      lessonsLbl: 'Уроки', hwLbl: 'Домашние задания',
      practiceLbl: 'Практика', grammarLbl: 'Грамматика', listeningLbl: 'Аудирование',
      empty: 'Нет данных', noGraded: 'Оценок пока нет', noSchedule: 'Расписание не назначено',
      notGraded: 'не оценено', basedOn: 'на основе', grades: 'оценок',
      lessonsSection: '📚 Уроки', hwSection: '✏️ Домашние задания',
      practiceSection: '🎮 Практика', grammarSection: '📝 Грамматика', listeningSection: '🎧 Аудирование',
    },
    en: {
      back: '← Back to panel',
      analytics: 'Student Analytics',
      joined: 'Registered',
      active: '🟢 Active', pending: '🟡 Pending',
      unlocked: 'Unlocked', rating: 'Rating',
      graded: 'HW graded', scheduled: 'Lessons',
      of: 'of',
      progressTitle: '📈 Progress by section',
      chartTitle: '📊 Performance chart (HW grades)',
      timelineTitle: '🗓 Unlocked materials timeline',
      hwTitle: '⭐ Homework grades',
      allContentTitle: '📚 All materials',
      scheduleTitle: '📅 Schedule',
      lessonsLbl: 'Lessons', hwLbl: 'Homework',
      practiceLbl: 'Practice', grammarLbl: 'Grammar', listeningLbl: 'Listening',
      empty: 'No data', noGraded: 'No grades yet', noSchedule: 'No schedule assigned',
      notGraded: 'not graded', basedOn: 'based on', grades: 'grades',
      lessonsSection: '📚 Lessons', hwSection: '✏️ Homework',
      practiceSection: '🎮 Practice', grammarSection: '📝 Grammar', listeningSection: '🎧 Listening',
    },
    ua: {
      back: '← Назад до панелі',
      analytics: 'Аналітика учня',
      joined: 'Зареєстровано',
      active: '🟢 Активний', pending: '🟡 Очікує',
      unlocked: 'Відкрито', rating: 'Рейтинг',
      graded: 'ДЗ оцінено', scheduled: 'Занять',
      of: 'з',
      progressTitle: '📈 Прогрес за розділами',
      chartTitle: '📊 Графік успішності (оцінки за ДЗ)',
      timelineTitle: '🗓 Хронологія відкритих матеріалів',
      hwTitle: '⭐ Оцінки за домашні завдання',
      allContentTitle: '📚 Всі матеріали',
      scheduleTitle: '📅 Розклад занять',
      lessonsLbl: 'Уроки', hwLbl: 'Домашні завдання',
      practiceLbl: 'Практика', grammarLbl: 'Граматика', listeningLbl: 'Аудіювання',
      empty: 'Немає даних', noGraded: 'Оцінок поки немає', noSchedule: 'Розклад не призначено',
      notGraded: 'не оцінено', basedOn: 'на основі', grades: 'оцінок',
      lessonsSection: '📚 Уроки', hwSection: '✏️ Домашні завдання',
      practiceSection: '🎮 Практика', grammarSection: '📝 Граматика', listeningSection: '🎧 Аудіювання',
    },
  };
  const lbl = labels[lang] || labels.ru;

  const progressSections = [
    { label: lbl.lessonsLbl, done: lessons.filter(i => i.unlocked).length, total: lessons.length, color: typeColors.lesson },
    { label: lbl.hwLbl, done: homework.filter(i => i.unlocked).length, total: homework.length, color: typeColors.homework },
    { label: lbl.practiceLbl, done: practice.filter(i => i.unlocked).length, total: practice.length, color: typeColors.practice },
    { label: lbl.grammarLbl, done: grammar.filter(i => i.unlocked).length, total: grammar.length, color: typeColors.grammar },
    { label: lbl.listeningLbl, done: listening.filter(i => i.unlocked).length, total: listening.length, color: typeColors.listening },
  ].filter(s => s.total > 0);

  const overallPct = pct(totalUnlocked, content.length);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #F5F0FF 0%, #FFF0F6 50%, #F0F8FF 100%)' }}>

      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-purple-100" style={{ boxShadow: '0 4px 20px rgba(150,100,200,0.1)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-display font-black text-xl bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Vetoschool</span>
          </Link>
          <Link to="/admin" className="flex items-center gap-2 text-sm font-body font-600 text-purple-500 hover:text-pink-500 transition-colors">
            {lbl.back}
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 md:p-8 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #A87EFF 0%, #FF8DC7 60%, #7EC8FF 100%)' }}>
          <div className="absolute inset-0 opacity-10">
            {[...Array(14)].map((_, i) => (
              <div key={i} className="absolute text-xl" style={{ left: `${(i * 7.3) % 100}%`, top: `${(i * 8.1) % 100}%` }}>✨</div>
            ))}
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-white/25 flex items-center justify-center font-display font-black text-white text-4xl shadow-xl flex-shrink-0">
              {student.name[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="font-display font-black text-3xl">{student.name}</h1>
                <span className={`text-xs px-3 py-1 rounded-full font-body font-600 ${student.hasAccess ? 'bg-green-200/60 text-green-900' : 'bg-yellow-200/60 text-yellow-900'}`}>
                  {student.hasAccess ? lbl.active : lbl.pending}
                </span>
              </div>
              <p className="font-body text-white/80 text-sm">{student.email}</p>
              <p className="font-body text-white/60 text-xs mt-0.5">{lbl.joined}: {fmt(student.joinedAt, locale)}</p>
              {rating.avg > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <StarRow value={Math.round(rating.avg)} />
                  <span className="font-display font-bold text-white text-sm">{rating.avg}/5</span>
                  <span className="font-body text-white/60 text-xs">({lbl.basedOn} {rating.count} {lbl.grades})</span>
                </div>
              )}
            </div>
            {/* Overall ring */}
            <div className="hidden sm:block flex-shrink-0">
              <RadialRing
                percent={overallPct}
                color="#fff"
                size={110}
                stroke={10}
                label={lbl.unlocked}
                sub={`${totalUnlocked} ${lbl.of} ${content.length}`}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Stat cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { emoji: '📂', label: lbl.unlocked, value: `${totalUnlocked}/${content.length}`, color: 'bg-gradient-to-br from-pink-100 to-rose-100 border border-pink-200' },
            { emoji: '⭐', label: lbl.rating, value: rating.avg > 0 ? `${rating.avg}★` : '—', color: 'bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-200' },
            { emoji: '✏️', label: lbl.graded, value: `${gradedHW.length}/${homework.length}`, color: 'bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200' },
            { emoji: '📅', label: lbl.scheduled, value: `${schedule.length}`, color: 'bg-gradient-to-br from-blue-100 to-cyan-100 border border-blue-200' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
              className={`${s.color} rounded-3xl p-5 card-hover`}>
              <div className="text-3xl mb-2">{s.emoji}</div>
              <div className="font-display font-black text-2xl text-purple-700">{s.value}</div>
              <div className="font-body text-xs text-purple-500 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Progress rings grid ───────────────────────────────────────────── */}
        {progressSections.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="glass rounded-3xl p-6">
            <h2 className="font-display font-bold text-xl text-purple-700 mb-6">{lbl.progressTitle}</h2>

            {/* Rings */}
            <div className="flex flex-wrap justify-center gap-8 mb-8">
              {progressSections.map((sec, i) => (
                <motion.div key={sec.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 + 0.2 }}>
                  <RadialRing
                    percent={pct(sec.done, sec.total)}
                    color={sec.color}
                    size={100}
                    stroke={9}
                    label={sec.label}
                    sub={`${sec.done} ${lbl.of} ${sec.total}`}
                  />
                </motion.div>
              ))}
            </div>

            {/* Bar progress */}
            <div className="space-y-3">
              {progressSections.map((sec, i) => (
                <div key={sec.label + 'bar'}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-body font-600 text-sm text-purple-600">{sec.label}</span>
                    <span className="font-display font-bold text-sm text-purple-700">
                      {sec.done} {lbl.of} {sec.total}
                      <span className="text-purple-400 font-body ml-1">({pct(sec.done, sec.total)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 bg-purple-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${sec.color}, ${sec.color}88)` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct(sec.done, sec.total)}%` }}
                      transition={{ delay: i * 0.1 + 0.4, duration: 1.2, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Bar chart: HW grades ──────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass rounded-3xl p-6">
          <h2 className="font-display font-bold text-xl text-purple-700 mb-4">{lbl.chartTitle}</h2>
          <BarChart items={homework} locale={locale} emptyMsg={lbl.noGraded} />
        </motion.div>

        {/* ── HW grades list ────────────────────────────────────────────────── */}
        {gradedHW.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass rounded-3xl p-6">
            <h2 className="font-display font-bold text-xl text-purple-700 mb-4">{lbl.hwTitle}</h2>
            <div className="space-y-3">
              {gradedHW.map((hw, i) => (
                <motion.div key={hw.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl border border-yellow-100">
                  <span className="text-2xl">{hw.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-body font-600 text-purple-700 text-sm truncate">{hw.title}</div>
                    {hw.dueDate && <div className="font-body text-xs text-purple-400">{fmt(hw.dueDate, locale)}</div>}
                  </div>
                  <StarRow value={hw.starRating!} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Timeline ──────────────────────────────────────────────────────── */}
        {content.some(i => i.unlocked) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="glass rounded-3xl p-6">
            <h2 className="font-display font-bold text-xl text-purple-700 mb-5">{lbl.timelineTitle}</h2>
            <Timeline items={content} locale={locale} typeColors={typeColors} />
          </motion.div>
        )}

        {/* ── All content sections ──────────────────────────────────────────── */}
        <AnimatePresence>
          {[
            { title: lbl.lessonsSection, items: lessons },
            { title: lbl.hwSection, items: homework },
            { title: lbl.practiceSection, items: practice },
            { title: lbl.grammarSection, items: grammar },
            { title: lbl.listeningSection, items: listening },
          ].map((sec, i) => sec.items.length > 0 && (
            <motion.div key={sec.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
              <SectionBlock title={sec.title} items={sec.items} locale={locale} emptyMsg={lbl.notGraded} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ── Schedule ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="glass rounded-3xl p-6">
          <h2 className="font-display font-bold text-xl text-purple-700 mb-4">{lbl.scheduleTitle}</h2>
          {schedule.length === 0 ? (
            <p className="font-body text-sm text-purple-400 text-center py-4">{lbl.noSchedule}</p>
          ) : (
            <div className="space-y-3">
              {schedule.map((slot, i) => (
                <motion.div key={slot.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl border border-pink-100">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-purple-400 flex flex-col items-center justify-center text-white font-display font-black flex-shrink-0">
                    <span style={{ fontSize: 9 }}>{slot.day.slice(0, 3)}</span>
                    <span className="text-base leading-none">{slot.time.split(':')[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-body font-600 text-purple-700 text-sm">{slot.topic}</div>
                    <div className="font-body text-xs text-purple-400">{slot.day} · {slot.time}</div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-pink-100 text-pink-600 font-body font-600">
                    {lang === 'ru' ? 'Урок' : lang === 'ua' ? 'Урок' : 'Lesson'}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
