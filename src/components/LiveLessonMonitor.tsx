import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Eye, Lightbulb, RefreshCw, Send, Wifi } from 'lucide-react';
import { User } from '../lib/auth';
import {
  LiveEvent, LiveSession, listLiveEvents, listLiveSessions,
  sendTeacherHint, subscribeLiveSessionEvents, subscribeLiveSessions,
} from '../lib/live';
import { Lang } from '../lib/i18n';

function formatEvent(event: LiveEvent, lang: Lang) {
  const ru = {
    lesson_opened: 'открыл урок',
    task_opened: 'перешёл к заданию',
    choice_selected: 'выбрал вариант',
    answer_correct: 'ответил правильно',
    answer_wrong: 'ошибся',
    undo: 'отменил действие',
    lesson_completed: 'завершил урок',
    teacher_hint: 'учитель отправил подсказку',
  };
  const en = {
    lesson_opened: 'opened the lesson',
    task_opened: 'opened a task',
    choice_selected: 'selected an option',
    answer_correct: 'answered correctly',
    answer_wrong: 'made a mistake',
    undo: 'undid an action',
    lesson_completed: 'completed the lesson',
    teacher_hint: 'teacher sent a hint',
  };
  const ua = {
    lesson_opened: 'відкрив урок',
    task_opened: 'перейшов до завдання',
    choice_selected: 'обрав варіант',
    answer_correct: 'відповів правильно',
    answer_wrong: 'помилився',
    undo: 'скасував дію',
    lesson_completed: 'завершив урок',
    teacher_hint: 'учитель надіслав підказку',
  };
  const dict = lang === 'en' ? en : lang === 'ua' ? ua : ru;
  return dict[event.event_type as keyof typeof dict] || event.event_type;
}

function payloadSummary(event: LiveEvent) {
  const p = event.payload_json || {};
  if (event.event_type === 'answer_wrong' && p.expected !== undefined) return `expected ${p.expected}`;
  if (event.event_type === 'choice_selected' && p.index !== undefined) return `${p.side || 'item'} #${p.index + 1}`;
  if (event.event_type === 'task_opened' && p.mechanic) return p.mechanic;
  if (event.event_type === 'teacher_hint' && p.message) return p.message;
  if (event.event_type === 'lesson_completed' && p.stars !== undefined) return `+${p.stars} stars`;
  return '';
}

export default function LiveLessonMonitor({ users, lang = 'ru' }: { users: User[]; lang?: Lang }) {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [sending, setSending] = useState(false);

  const copy = {
    ru: {
      title: 'Live-уроки',
      desc: 'Здесь видно, что ребёнок делает в интерактивном уроке прямо сейчас.',
      active: 'Активные сессии',
      events: 'Журнал действий',
      noSessions: 'Пока никто не проходит интерактивный урок.',
      noEvents: 'Событий пока нет.',
      refresh: 'Обновить',
      hint: 'Подсказка ребёнку',
      hintPlaceholder: 'Например: попробуй соединить первую карточку с правильным словом',
      send: 'Отправить',
      needsDb: 'Live-режим ждёт доступ к таблицам Supabase. Если SQL уже применён, обновите страницу или проверьте политики доступа.',
    },
    en: {
      title: 'Live lessons',
      desc: 'See what a child is doing in an interactive lesson right now.',
      active: 'Active sessions',
      events: 'Activity log',
      noSessions: 'No one is taking an interactive lesson yet.',
      noEvents: 'No events yet.',
      refresh: 'Refresh',
      hint: 'Hint for the child',
      hintPlaceholder: 'For example: try matching the first card with the correct word',
      send: 'Send',
      needsDb: 'Live mode is waiting for Supabase table access. If SQL is already applied, refresh the page or check access policies.',
    },
    ua: {
      title: 'Live-уроки',
      desc: 'Тут видно, що дитина робить в інтерактивному уроці просто зараз.',
      active: 'Активні сесії',
      events: 'Журнал дій',
      noSessions: 'Поки ніхто не проходить інтерактивний урок.',
      noEvents: 'Подій поки немає.',
      refresh: 'Оновити',
      hint: 'Підказка дитині',
      hintPlaceholder: 'Наприклад: спробуй зʼєднати першу картку з правильним словом',
      send: 'Надіслати',
      needsDb: 'Live-режим очікує доступ до таблиць Supabase. Якщо SQL уже застосовано, оновіть сторінку або перевірте правила доступу.',
    },
  }[lang];

  const activeSessions = useMemo(
    () => sessions.filter(session => session.status === 'active'),
    [sessions],
  );

  const activeSession = useMemo(
    () => activeSessions.find(session => session.id === activeSessionId) || activeSessions[0] || null,
    [activeSessionId, activeSessions],
  );

  const loadSessions = async () => {
    try {
      setError('');
      const list = await listLiveSessions();
      setSessions(list);
      const firstActive = list.find(session => session.status === 'active');
      if (!firstActive) setActiveSessionId(null);
      else if (!activeSessionId || !list.some(session => session.id === activeSessionId && session.status === 'active')) {
        setActiveSessionId(firstActive.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message ? `${copy.needsDb} (${message})` : copy.needsDb);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (sessionId: string) => {
    try {
      setEvents(await listLiveEvents(sessionId));
    } catch {
      setEvents([]);
    }
  };

  useEffect(() => {
    loadSessions();
    const interval = window.setInterval(loadSessions, 3000);
    const unsubscribe = subscribeLiveSessions(loadSessions);
    return () => { window.clearInterval(interval); unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!activeSession) {
      setEvents([]);
      return;
    }
    loadEvents(activeSession.id);
    const interval = window.setInterval(() => loadEvents(activeSession.id), 2500);
    const unsubscribe = subscribeLiveSessionEvents(activeSession.id, event => {
      setEvents(prev => [event, ...prev.filter(item => item.id !== event.id)].slice(0, 80));
    });
    return () => { window.clearInterval(interval); unsubscribe(); };
  }, [activeSession?.id]);

  const sendHint = async () => {
    if (!activeSession || !hint.trim()) return;
    setSending(true);
    try {
      await sendTeacherHint(activeSession, hint.trim());
      setHint('');
      await loadEvents(activeSession.id);
    } finally {
      setSending(false);
    }
  };

  const nameFor = (session: LiveSession) => {
    const fromUsers = users.find(user => user.id === session.student_id);
    return session.student_name || fromUsers?.name || 'Student';
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[2rem] border border-purple-100 bg-white shadow-xl shadow-purple-100/60">
        <div className="relative bg-gradient-to-r from-white via-pink-50 to-sky-50 p-6 dark:from-[#25123a] dark:via-[#2a1441] dark:to-[#14253d]">
        <div className="mb-3 inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-1.5 text-xs font-body font-800 uppercase tracking-wider text-pink-500 shadow-sm dark:bg-white/10 dark:text-pink-200">
          <Wifi className="h-4 w-4" /> Realtime
        </div>
        <h3 className="font-display text-4xl font-black text-purple-800 dark:text-purple-100">{copy.title}</h3>
        <p className="mt-1 max-w-2xl font-body text-sm font-700 text-purple-400 dark:text-purple-200">{copy.desc}</p>
        <div className="absolute right-6 top-6 hidden rounded-3xl bg-white/70 px-5 py-3 shadow-sm backdrop-blur sm:block dark:bg-white/10">
          <div className="font-display text-3xl font-black text-purple-800 dark:text-purple-100">{activeSessions.length}</div>
          <div className="font-body text-xs font-800 uppercase tracking-wider text-purple-400">{copy.active}</div>
        </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 font-body text-sm font-700 text-yellow-800">
          <div className="mb-3">{error}</div>
          <button onClick={loadSessions} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-800 text-yellow-700 shadow-sm transition hover:bg-yellow-100">
            <RefreshCw className="h-4 w-4" /> {copy.refresh}
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-xl shadow-purple-100/50">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="font-display text-xl font-black text-purple-700">{copy.active}</h4>
              <button onClick={loadSessions} className="rounded-2xl bg-purple-100 p-2 text-purple-500 transition hover:bg-purple-200" title={copy.refresh}>
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {loading ? (
              <p className="font-body text-sm text-purple-400">...</p>
            ) : activeSessions.length === 0 ? (
              <p className="rounded-2xl bg-purple-50 p-5 text-center font-body text-sm font-700 text-purple-400">{copy.noSessions}</p>
            ) : (
              <div className="space-y-2">
                {activeSessions.map(session => {
                  const active = activeSession?.id === session.id;
                  return (
                    <button key={session.id} onClick={() => setActiveSessionId(session.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50 shadow-sm' : 'border-purple-100 bg-white hover:border-pink-200 hover:bg-pink-50/50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-body text-sm font-800 text-purple-700">{nameFor(session)}</div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-body font-800 ${session.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="mt-1 font-body text-xs text-purple-400">{session.lesson_title || session.lesson_id}</div>
                      <div className="mt-2 font-body text-[11px] text-purple-300">
                        {new Date(session.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-xl shadow-purple-100/50">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <h4 className="font-display text-xl font-black text-purple-700">{copy.hint}</h4>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={hint} onChange={e => setHint(e.target.value)} disabled={!activeSession}
                  placeholder={copy.hintPlaceholder}
                  className="input-magic flex-1 text-sm" />
                <button onClick={sendHint} disabled={!activeSession || !hint.trim() || sending}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-5 py-2.5 font-body text-sm font-800 text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-50">
                  <Send className="h-4 w-4" /> {copy.send}
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-xl shadow-purple-100/50">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-pink-400" />
                <h4 className="font-display text-xl font-black text-purple-700">{copy.events}</h4>
              </div>
              {events.length === 0 ? (
                <p className="rounded-2xl bg-purple-50 p-5 text-center font-body text-sm text-purple-400">{copy.noEvents}</p>
              ) : (
                <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {events.map(event => (
                    <motion.div key={event.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`rounded-2xl border p-3 ${event.actor_role === 'teacher' ? 'border-yellow-200 bg-yellow-50' : event.event_type === 'answer_wrong' ? 'border-rose-200 bg-rose-50' : event.event_type === 'answer_correct' ? 'border-emerald-200 bg-emerald-50' : 'border-purple-100 bg-white/80'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Eye className="mt-0.5 h-4 w-4 text-purple-400" />
                          <div>
                            <div className="font-body text-sm font-800 text-purple-700">{formatEvent(event, lang)}</div>
                            {payloadSummary(event) && <div className="font-body text-xs text-purple-400">{payloadSummary(event)}</div>}
                          </div>
                        </div>
                        <div className="shrink-0 font-body text-[11px] text-purple-300">
                          {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
