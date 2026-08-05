import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, getUsers, grantAccess, revokeAccess, deleteUser, logout, loadAllUsers, friendlyActionError, User, AccessStatus, PaymentStatus } from '../lib/auth';
import { getStudentSchedule, saveStudentSchedule, loadStudentSchedule, setSlotConducted, deleteScheduleSlot, ScheduleSlot, isActiveScheduleSlot, scheduleSlotTimeValue } from '../lib/schedule';
import { ensureStudentContent, saveStudentContent, loadStudentContent, ContentItem, ContentType, getStudentRating, fileToDataUrl, uploadContentFile, deleteContentItem, deleteModule, isGradedContentType } from '../lib/content';
import { Lang, t } from '../lib/i18n';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { BarChart3, BookOpen, CalendarPlus, CheckCircle2, Loader2, RefreshCw, Search, Trash2, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { subscribe } from '../lib/storage';
import ThemeToggle from '../components/ThemeToggle';
import AdminDictionary from '../components/AdminDictionary';
import WorkbookBuilder from '../components/WorkbookBuilder';
import LiveLessonMonitor from '../components/LiveLessonMonitor';
import TrialLessonsAdmin from '../components/TrialLessonsAdmin';
import TeachersAdmin from '../components/TeachersAdmin';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { giftStars, loadStarProfile, awardStars, findAvatar } from '../lib/stars';
import { DEFAULT_ELEVENLABS_MODEL_ID, DEFAULT_ELEVENLABS_VOICE_ID, deleteListeningTaskAudio, generateListeningTaskAudio } from '../lib/cardAudio';
import {
  LessonStatus,
  LessonType,
  LessonBlockKind,
  listTeacherDirectory,
  saveTeacherLesson,
  deleteTeacherLesson,
  syncLessonBlockContentForStudents,
  StudentGroup,
  TeacherDirectoryItem,
  TeacherLessonPlanBlockInput,
} from '../lib/teachers';
import { listWorkbooks, listUnits, listLessons, Workbook, Unit, Lesson } from '../lib/workbooks';
import { pricingPlanNameKeys, type PricingPlanId } from '../lib/pricingCurrency';
import {
  buildSubscriptionRows,
  canAccessSubscriptionAdmin,
  filterSubscriptionRows,
  validateLessonAdjustmentInput,
  type SubscriptionFilters,
} from '../lib/adminSubscriptions';
import { activeSubscriptionStatus, billingStatusClass, billingStatusLabel, hasConfirmedStripePayment } from '../lib/subscriptionStatus';

// Small inline avatar that shows the equipped emoji avatar or the name initial
function UserAvatar({ user, size = 'md' }: { user: { name: string; avatarId?: string | null }; size?: 'sm' | 'md' | 'lg' }) {
  const a = findAvatar(user.avatarId);
  const cls = size === 'lg' ? 'w-14 h-14 text-2xl rounded-2xl' : size === 'sm' ? 'w-8 h-8 text-sm rounded-full' : 'w-9 h-9 text-sm rounded-full';
  const emojiSize = size === 'lg' ? '2rem' : size === 'sm' ? '1.25rem' : '1.4rem';
  return (
    <div className={`${cls} bg-gradient-to-br from-pink-300 to-purple-400 flex items-center justify-center font-display font-black text-white shadow-sm flex-shrink-0 overflow-hidden`}>
      {a ? <span style={{ fontSize: emojiSize, lineHeight: 1 }}>{a.emoji}</span> : user.name[0].toUpperCase()}
    </div>
  );
}

const DAYS_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

type Section = 'students' | 'studentCenter' | 'subscriptions' | 'teachers' | 'content' | 'schedule' | 'trialLessons' | 'workbooks' | 'live' | 'teacherReports';
type ContentTargetMode = 'current' | 'all' | 'selected';
type StripePaymentRow = {
  id: string;
  user_id: string;
  amount_total: number | null;
  currency: string | null;
  event_type: string;
  plan_id: string;
  lesson_format: string;
  lessons_total: number;
  paid_at: string;
  created_at: string;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  stripe_subscription_id: string;
};
type StripePaymentFailureRow = {
  id: string;
  user_id: string;
  amount_due: number | null;
  currency: string | null;
  status: string;
  failure_reason: string | null;
  created_at: string;
  stripe_invoice_id: string;
  stripe_subscription_id: string;
};
type StripeRefundRow = {
  id: string;
  user_id: string;
  stripe_payment_id: string;
  stripe_refund_id: string;
  amount: number;
  currency: string;
  refund_type: 'full' | 'partial';
  reason: string;
  status: string;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
};

// ---- Helpers ----
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button"
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => onChange(s)}
          className={`text-3xl transition-transform hover:scale-110 ${s <= (hover || value) ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
      ))}
    </div>
  );
}

function DeleteModal({ name, onConfirm, onCancel, lang, busy = false }: { name: string; onConfirm: () => void; onCancel: () => void; lang: Lang; busy?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(80,40,120,0.5)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
        className="glass rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
        <div className="text-5xl mb-4">🗑️</div>
        <h3 className="font-display font-black text-2xl text-purple-700 mb-2">{t(lang,'admin_delete_title')}</h3>
        <p className="font-body text-purple-500 text-sm mb-6">
          {t(lang,'admin_delete_confirm')} <span className="font-700 text-purple-700">{name}</span> {t(lang,'admin_delete_warning')}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} disabled={busy} className="btn-outline px-6 py-3 font-display font-bold text-sm disabled:opacity-60">{t(lang,'admin_cancel')}</button>
          <button onClick={onConfirm} disabled={busy} className="px-6 py-3 bg-gradient-to-r from-red-400 to-pink-500 text-white font-display font-bold text-sm rounded-full hover:scale-105 transition-transform shadow-lg disabled:opacity-60 disabled:hover:scale-100">
            {busy ? '...' : t(lang,'admin_do_delete')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- Student Profile Modal ----
function StudentProfileModal({ user, users, lang, onClose, onCredentialsSaved, onOpenAnalytics }: {
  user: User; users: User[]; lang: Lang; onClose: () => void; onCredentialsSaved: (msg: string) => void; onOpenAnalytics: () => void;
}) {
  const [, force] = useState(0);
  const [tab, setTab] = useState<'profile' | 'dict'>('profile');
  const [starBalance, setStarBalance] = useState(0);
  const [bonusInput, setBonusInput] = useState('');
  const [bonusBusy, setBonusBusy] = useState(false);
  const [bonusMsg, setBonusMsg] = useState('');
  useEffect(() => {
    Promise.all([loadStudentContent(user.id), loadStudentSchedule(user.id)]).then(() => force(n => n + 1));
    loadStarProfile(user.id).then(p => setStarBalance(p.starBalance));
  }, [user.id]);

  const handleGiftStars = async () => {
    const amount = parseInt(bonusInput, 10);
    if (!amount || amount <= 0) return;
    setBonusBusy(true);
    try {
      const p = await loadStarProfile(user.id);
      await giftStars(user.id, amount, p.starBalance, p.totalEarned, p.pendingCelebration);
      setStarBalance(p.starBalance + amount);
      setBonusInput('');
      setBonusMsg(t(lang, 'admin_bonus_done'));
      setTimeout(() => setBonusMsg(''), 3000);
    } finally { setBonusBusy(false); }
  };
  const content = ensureStudentContent(user.id);
  const schedule = getStudentSchedule(user.id);
  const { avg, count } = getStudentRating(user.id);
  const lessons = content.filter(i => i.type === 'lesson');
  const homework = content.filter(i => i.type === 'homework');
  const practice = content.filter(i => i.type === 'practice');
  const grammar = content.filter(i => i.type === 'grammar');
  const listening = content.filter(i => i.type === 'listening');
  const unlockedCount = content.filter(i => i.unlocked).length;
  const gradedItems = content.filter(h => isGradedContentType(h.type) && h.starRating && h.starRating > 0);

  const typeColor: Record<string, string> = {
    lesson: 'bg-pink-100 text-pink-600', homework: 'bg-purple-100 text-purple-600',
    practice: 'bg-blue-100 text-blue-600', grammar: 'bg-yellow-100 text-yellow-600', listening: 'bg-green-100 text-green-600',
    checkpoint: 'bg-orange-100 text-orange-600',
  };
  const typeEmoji: Record<string, string> = { lesson: '📚', homework: '✏️', practice: '🎮', grammar: '📝', listening: '🎧', checkpoint: '🏁' };

  const labels = {
    ru: { content: 'Контент', rating: 'Оценка', graded: 'Оценено', schedule: 'Расписание',
          basedOn: 'на основе', grades: 'оценок', lessons: '📚 Уроки', homework: '✏️ Домашние задания',
          practice: '🎮 Практика', grammar: '📝 Грамматика', listening: '🎧 Аудирование',
          scheduleTitle: '📅 Расписание', openDash: '📊 Аналитика ученика',
          editCreds: '🔑 Изменить логин / пароль', emailLabel: 'Email (логин)', passLabel: 'Новый пароль',
          confirmLabel: 'Подтвердить пароль', saveBtn: 'Сохранить', cancelBtn: 'Отмена',
          passHint: 'Оставьте пустым, если не меняете пароль', active: '🟢 Активен', pending: '🟡 Ожидает',
          showPass: 'Показать', hidePass: 'Скрыть', due: 'До:' },
    en: { content: 'Content', rating: 'Rating', graded: 'Graded', schedule: 'Schedule',
          basedOn: 'based on', grades: 'grades', lessons: '📚 Lessons', homework: '✏️ Homework',
          practice: '🎮 Practice', grammar: '📝 Grammar', listening: '🎧 Listening',
          scheduleTitle: '📅 Schedule', openDash: '📊 Student Analytics',
          editCreds: '🔑 Change login / password', emailLabel: 'Email (login)', passLabel: 'New password',
          confirmLabel: 'Confirm password', saveBtn: 'Save', cancelBtn: 'Cancel',
          passHint: 'Leave empty to keep current password', active: '🟢 Active', pending: '🟡 Pending',
          showPass: 'Show', hidePass: 'Hide', due: 'Due:' },
    ua: { content: 'Контент', rating: 'Оцінка', graded: 'Оцінено', schedule: 'Розклад',
          basedOn: 'на основі', grades: 'оцінок', lessons: '📚 Уроки', homework: '✏️ Домашні завдання',
          practice: '🎮 Практика', grammar: '📝 Граматика', listening: '🎧 Аудіювання',
          scheduleTitle: '📅 Розклад', openDash: '📊 Аналітика учня',
          editCreds: '🔑 Змінити логін / пароль', emailLabel: 'Email (логін)', passLabel: 'Новий пароль',
          confirmLabel: 'Підтвердити пароль', saveBtn: 'Зберегти', cancelBtn: 'Скасувати',
          passHint: 'Залиште порожнім, якщо не змінюєте пароль', active: '🟢 Активний', pending: '🟡 Очікує',
          showPass: 'Показати', hidePass: 'Сховати', due: 'До:' },
  };
  const lbl = labels[lang] || labels.ru;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(60,20,100,0.6)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.88, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 40 }}
        className="glass rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 glass rounded-t-3xl px-6 pt-6 pb-4 border-b border-purple-100 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar user={user} size="lg" />
              <div>
                <h2 className="font-display font-black text-2xl text-purple-700">{user.name}</h2>
                <p className="font-body text-sm text-purple-400">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-body font-600 ${user.hasAccess ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                    {user.hasAccess ? lbl.active : lbl.pending}
                  </span>
                  {avg > 0 && (
                    <div className="flex gap-0.5 items-center">
                      {[1,2,3,4,5].map(s => <span key={s} className={`text-sm ${s <= Math.round(avg) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
                      <span className="font-body text-xs text-purple-400 ml-1">{avg}/5</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-purple-400 hover:text-pink-500 text-3xl leading-none">×</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Tabs: Profile / Dictionary */}
          <div className="flex gap-2">
            {([
              ['profile', lang === 'en' ? '👤 Profile' : lang === 'ua' ? '👤 Профіль' : '👤 Профиль'],
              ['dict', t(lang, 'dict_tab')],
            ] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-4 py-2 rounded-2xl font-body font-700 text-sm transition-all ${
                  tab === id ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg' : 'bg-white/60 text-purple-600 hover:bg-pink-50'
                }`}>{label}</button>
            ))}
          </div>

          {tab === 'dict' ? (
            <AdminDictionary userId={user.id} users={users} lang={lang} />
          ) : (<>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: lbl.content, value: `${unlockedCount}/${content.length}`, emoji: '📂', color: 'from-pink-100 to-rose-100', border: 'border-pink-200' },
              { label: lbl.rating, value: avg > 0 ? `${avg}★` : '—', emoji: '⭐', color: 'from-yellow-100 to-amber-100', border: 'border-yellow-200' },
              { label: lbl.graded, value: `${gradedItems.length}/${content.filter(i => isGradedContentType(i.type)).length}`, emoji: '✏️', color: 'from-purple-100 to-violet-100', border: 'border-purple-200' },
              { label: lbl.schedule, value: `${schedule.length}`, emoji: '📅', color: 'from-blue-100 to-cyan-100', border: 'border-blue-200' },
            ].map(s => (
              <div key={s.label} className={`bg-gradient-to-br ${s.color} border ${s.border} rounded-2xl p-3 text-center`}>
                <div className="text-2xl mb-1">{s.emoji}</div>
                <div className="font-display font-black text-xl text-purple-700">{s.value}</div>
                <div className="font-body text-xs text-purple-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Rating */}
          {avg > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl p-4 border border-yellow-100 flex items-center gap-4">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => <span key={s} className={`text-3xl ${s <= Math.round(avg) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
              </div>
              <div>
                <div className="font-display font-black text-2xl text-purple-700">{avg} / 5</div>
                <div className="font-body text-xs text-purple-400">{lbl.basedOn} {count} {lbl.grades}</div>
              </div>
            </div>
          )}

          {/* ---- ACCESS STATUS ---- */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100 p-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-display font-bold text-purple-700 flex items-center gap-2">
                {user.hasAccess ? '🟢' : '🟡'} {lang === 'en' ? 'Access' : lang === 'ua' ? 'Доступ' : 'Доступ'}
              </div>
              <p className="font-body text-xs text-purple-400 mt-0.5">
                {lang === 'en' ? 'Read-only status. Stripe and audited manual overrides control access.' :
                 lang === 'ua' ? 'Статус тільки для читання. Доступ керується Stripe або аудитованим ручним доступом.' :
                 'Статус только для чтения. Доступом управляет Stripe или ручной доступ с аудитом.'}
              </p>
            </div>
            <span className={`rounded-2xl border px-3 py-2 font-body text-xs font-800 ${user.hasAccess ? 'border-green-200 bg-green-50 text-green-700' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}>
              {user.hasAccess ? lbl.active : lbl.pending}
            </span>
          </div>

          {/* ---- GIFT BONUS STARS ---- */}
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border border-yellow-200 p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-display font-bold text-purple-700 flex items-center gap-2">
                  {t(lang, 'admin_bonus_stars')}
                </div>
                <p className="font-body text-xs text-purple-400 mt-0.5">⭐ {starBalance} {t(lang, 'shop_stars')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input type="number" min={1} max={500} value={bonusInput} onChange={e => setBonusInput(e.target.value)}
                placeholder={t(lang, 'admin_bonus_amount')}
                className="input-magic flex-1" />
              <button onClick={handleGiftStars} disabled={bonusBusy || !bonusInput}
                className="btn-magic px-5 py-3 text-white font-display font-bold text-sm whitespace-nowrap disabled:opacity-50">
                {t(lang, 'admin_bonus_grant')}
              </button>
            </div>
            {bonusMsg && <p className="font-body text-xs text-green-600 mt-2 font-700">{bonusMsg}</p>}
          </div>

          {/* Content by type */}
          {[
            { items: lessons, label: lbl.lessons },
            { items: homework, label: lbl.homework },
            { items: practice, label: lbl.practice },
            { items: grammar, label: lbl.grammar },
            { items: listening, label: lbl.listening },
          ].filter(g => g.items.length > 0).map(group => (
            <div key={group.label}>
              <h4 className="font-display font-bold text-purple-700 mb-2">{group.label}</h4>
              <div className="space-y-2">
                {group.items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white/70 rounded-2xl border border-purple-50">
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-body font-600 text-purple-700 text-sm truncate">{item.title}</div>
                      {item.dueDate && <div className="font-body text-xs text-purple-400">{lbl.due} {new Date(item.dueDate).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU', { day: 'numeric', month: 'long' })}</div>}
                      {item.scheduledDate && <div className="font-body text-xs text-blue-400">🗓 {item.scheduledDate} {item.scheduledTime}</div>}
                      {item.starRating && item.starRating > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {[1,2,3,4,5].map(s => <span key={s} className={`text-xs ${s <= item.starRating! ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-body font-600 ${typeColor[item.type]}`}>{typeEmoji[item.type]}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-body font-600 ${item.unlocked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {item.unlocked ? '🔓' : '🔒'}
                      </span>
                      {item.fileName && <span className="text-xs text-purple-400">📎</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Schedule — show only upcoming lessons in the profile card */}
          {(() => {
            const upcoming = schedule.filter(isActiveScheduleSlot).sort((a, b) => scheduleSlotTimeValue(a) - scheduleSlotTimeValue(b));
            if (upcoming.length === 0) return null;
            return (
              <div>
                <h4 className="font-display font-bold text-purple-700 mb-2">{lbl.scheduleTitle}</h4>
                <div className="space-y-2">
                  {upcoming.map(slot => (
                    <div key={slot.id} className="flex items-center gap-3 p-3 bg-white/70 rounded-2xl border border-blue-100">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-purple-400 flex flex-col items-center justify-center text-white font-display font-black flex-shrink-0">
                        <span style={{ fontSize: 9 }}>{slot.day.slice(0,3)}</span>
                        <span className="text-sm">{slot.time.split(':')[0]}</span>
                      </div>
                      <div>
                        <div className="font-body font-600 text-purple-700 text-sm">{slot.topic}</div>
                        <div className="font-body text-xs text-purple-400">{slot.day} · {slot.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Analytics CTA */}
          <button
            onClick={onOpenAnalytics}
            className="btn-magic w-full px-6 py-4 text-white font-display font-bold flex items-center justify-center gap-2">
            <span className="text-xl">📊</span>
            <span>{lbl.openDash}</span>
          </button>
          </>)}

        </div>
      </motion.div>
    </motion.div>

  );
}

function FileBtn({ id, accept, label, onFile }: { id: string; accept?: string; label: string; onFile: (d: string, n: string) => void }) {
  return (
    <div>
      <input type="file" id={id} accept={accept || 'image/*,application/pdf,.doc,.docx,.ppt,.pptx,audio/*'}
        className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          const d = await fileToDataUrl(f); onFile(d, f.name);
          (e.target as HTMLInputElement).value = '';
        }} />
      <label htmlFor={id} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-100 to-purple-100 border border-pink-200 rounded-2xl cursor-pointer hover:from-pink-200 hover:to-purple-200 transition-all font-body font-600 text-purple-700 text-sm">
        📎 {label}
      </label>
    </div>
  );
}

const teacherFlowText = {
  ru: {
    teacher: 'Учитель', group: 'Группа', student: 'Ученик', date: 'Дата', time: 'Время', duration: 'Длительность', format: 'Формат', topic: 'Тема', status: 'Статус',
    unit: 'Unit', lesson: 'Lesson', blocks: 'Блоки урока', materials: 'Материалы', allLessons: 'Общее расписание', editLesson: 'Редактировать урок',
    scheduleTitle: 'Назначить урок учителю', scheduleHint: 'Урок появится в Teacher Panel только у выбранного учителя.', saveLesson: 'Сохранить урок', savedLesson: 'Урок назначен учителю',
    studentsCenter: 'Центр учеников', studentsCenterHint: 'Быстрый доступ ко всей информации об ученике школы.', allStudents: 'Все ученики', search: 'Поиск ученика', openAnalytics: 'Открыть аналитику',
    basic: 'Основная информация', learning: 'Обучение', calendar: 'Расписание', tariff: 'Тариф', noData: 'Не указано', attendance: 'Посещаемость',
    completedLessons: 'Пройденные уроки', plannedLessons: 'Запланированные уроки', homeworkRating: 'Средняя оценка ДЗ', lessonRating: 'Средняя оценка уроков',
    reports: 'Заметки и результаты', notes: 'Заметки Visible to Admin', results: 'Результаты уроков', markRead: 'Отметить прочитанной', read: 'Прочитано', empty: 'Данных пока нет',
    online: 'Онлайн', offline: 'Офлайн', minutes: 'мин', selectTeacher: 'Выберите учителя', selectTarget: 'Выберите группу или ученика',
    noGroups: 'У учителя пока нет групп. Создайте группу во вкладке Учителя.', noStudents: 'У учителя пока нет индивидуальных учеников.', noWorkbooks: 'Воркбуки пока не созданы.', noUnits: 'В этом воркбуке пока нет Unit.', noLessons: 'В этом Unit пока нет Lesson.',
    deleteLesson: 'Удалить урок', deleteConfirm: 'Удалить выбранный урок?',
  },
  ua: {
    teacher: 'Учитель', group: 'Група', student: 'Учень', date: 'Дата', time: 'Час', duration: 'Тривалість', format: 'Формат', topic: 'Тема', status: 'Статус',
    unit: 'Unit', lesson: 'Lesson', blocks: 'Блоки уроку', materials: 'Матеріали', allLessons: 'Загальний розклад', editLesson: 'Редагувати урок',
    scheduleTitle: 'Призначити урок учителю', scheduleHint: 'Урок зʼявиться в Teacher Panel тільки у вибраного вчителя.', saveLesson: 'Зберегти урок', savedLesson: 'Урок призначено учителю',
    studentsCenter: 'Центр учнів', studentsCenterHint: 'Швидкий доступ до всієї інформації про учня школи.', allStudents: 'Усі учні', search: 'Пошук учня', openAnalytics: 'Відкрити аналітику',
    basic: 'Основна інформація', learning: 'Навчання', calendar: 'Розклад', tariff: 'Тариф', noData: 'Не вказано', attendance: 'Відвідуваність',
    completedLessons: 'Пройдені уроки', plannedLessons: 'Заплановані уроки', homeworkRating: 'Середня оцінка ДЗ', lessonRating: 'Середня оцінка уроків',
    reports: 'Нотатки й результати', notes: 'Нотатки Visible to Admin', results: 'Результати уроків', markRead: 'Позначити прочитаною', read: 'Прочитано', empty: 'Даних поки немає',
    online: 'Онлайн', offline: 'Офлайн', minutes: 'хв', selectTeacher: 'Оберіть учителя', selectTarget: 'Оберіть групу або учня',
    noGroups: 'В учителя поки немає груп. Створіть групу у вкладці Учителі.', noStudents: 'В учителя поки немає індивідуальних учнів.', noWorkbooks: 'Воркбуки поки не створені.', noUnits: 'У цьому воркбуку поки немає Unit.', noLessons: 'У цьому Unit поки немає Lesson.',
    deleteLesson: 'Видалити урок', deleteConfirm: 'Видалити вибраний урок?',
  },
  en: {
    teacher: 'Teacher', group: 'Group', student: 'Student', date: 'Date', time: 'Time', duration: 'Duration', format: 'Format', topic: 'Topic', status: 'Status',
    unit: 'Unit', lesson: 'Lesson', blocks: 'Lesson blocks', materials: 'Materials', allLessons: 'Global schedule', editLesson: 'Edit lesson',
    scheduleTitle: 'Assign Teacher Lesson', scheduleHint: 'The lesson appears only in the selected teacher panel.', saveLesson: 'Save lesson', savedLesson: 'Lesson assigned to teacher',
    studentsCenter: 'Student Center', studentsCenterHint: 'Fast access to all school student information.', allStudents: 'All students', search: 'Student search', openAnalytics: 'Open analytics',
    basic: 'Basic info', learning: 'Learning', calendar: 'Schedule', tariff: 'Plan', noData: 'Not specified', attendance: 'Attendance',
    completedLessons: 'Completed lessons', plannedLessons: 'Planned lessons', homeworkRating: 'Avg homework rating', lessonRating: 'Avg lesson rating',
    reports: 'Notes and Results', notes: 'Visible to Admin notes', results: 'Lesson results', markRead: 'Mark read', read: 'Read', empty: 'No data yet',
    online: 'Online', offline: 'Offline', minutes: 'min', selectTeacher: 'Choose teacher', selectTarget: 'Choose group or student',
    noGroups: 'This teacher has no groups yet. Create a group in Teachers.', noStudents: 'This teacher has no individual students yet.', noWorkbooks: 'No workbooks yet.', noUnits: 'No Units in this workbook yet.', noLessons: 'No Lessons in this Unit yet.',
    deleteLesson: 'Delete lesson', deleteConfirm: 'Delete the selected lesson?',
  },
};

function teacherName(teacher?: TeacherDirectoryItem | null) {
  return teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() || teacher.email : '';
}

function isoDay(date: string) {
  if (!date) return 'Monday';
  const index = new Date(`${date}T00:00:00`).getDay();
  return DAYS_EN[index === 0 ? 6 : index - 1];
}

function SelectEmpty({ text }: { text: string }) {
  return <div className="px-3 py-2 font-body text-sm text-purple-300">{text}</div>;
}

function findStudentGroup(groups: StudentGroup[], studentId: string) {
  return groups.find(group => group.studentIds.includes(studentId)) || null;
}

const lessonBlockOptions: Array<{ kind: LessonBlockKind; label: string; lessonType: string; emoji: string }> = [
  { kind: 'theory', label: 'Theory', lessonType: 'theory', emoji: '📘' },
  { kind: 'class_task', label: 'Lesson Tasks', lessonType: 'class_task', emoji: '🧩' },
  { kind: 'homework', label: 'Homework', lessonType: 'homework', emoji: '📚' },
  { kind: 'practice', label: 'Practice', lessonType: 'practice', emoji: '🎯' },
  { kind: 'grammar', label: 'Grammar', lessonType: 'grammar', emoji: '📝' },
  { kind: 'listening', label: 'Listening', lessonType: 'listening', emoji: '🎧' },
  { kind: 'checkpoint', label: 'Unit Checkpoint', lessonType: 'checkpoint', emoji: '🏁' },
];

type BlockDraft = Record<LessonBlockKind, { enabled: boolean; sourceLessonId: string; materialTitle: string; materialUrl: string; adminNote: string; materialMode: 'file_link' | 'interactive' }>;

function emptyBlockDraft(): BlockDraft {
  return lessonBlockOptions.reduce((acc, block) => ({
    ...acc,
    [block.kind]: { enabled: false, sourceLessonId: '', materialTitle: '', materialUrl: '', adminNote: '', materialMode: 'file_link' },
  }), {} as BlockDraft);
}

function TeacherLessonPlanner({ lang, users, onToast }: { lang: Lang; users: User[]; onToast: (msg: string, type?: 'success' | 'error') => void }) {
  const labels = teacherFlowText[lang] || teacherFlowText.ru;
  const formRef = useRef<HTMLDivElement | null>(null);
  const [teachers, setTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [scheduleRows, setScheduleRows] = useState<any[]>([]);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [targetMode, setTargetMode] = useState<'group' | 'student'>('group');
  const [groupId, setGroupId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [workbookId, setWorkbookId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [sourceLessonId, setSourceLessonId] = useState('');
  const [blocks, setBlocks] = useState<BlockDraft>(() => emptyBlockDraft());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('15:00');
  const [duration, setDuration] = useState(50);
  const [format, setFormat] = useState<'online' | 'offline'>('online');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<LessonStatus>('scheduled');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const refreshSchedule = async () => {
    const { data, error } = await (supabase as any)
      .from('schedules')
      .select('*, lesson_plan_blocks(*)')
      .order('scheduled_date', { ascending: false })
      .order('time', { ascending: true });
    if (error) throw error;
    setScheduleRows(data || []);
  };

  useEffect(() => {
    Promise.all([listTeacherDirectory(users), listWorkbooks(), refreshSchedule()]).then(([directory, workbookRows]) => {
      setTeachers(directory.teachers);
      setGroups(directory.groups);
      setWorkbooks(workbookRows);
    }).catch(error => onToast(friendlyActionError(error), 'error'));
  }, [onToast, users]);

  useEffect(() => {
    if (!workbookId) {
      setUnits([]);
      setUnitId('');
      return;
    }
    listUnits(workbookId).then(setUnits).catch(error => onToast(friendlyActionError(error), 'error'));
  }, [onToast, workbookId]);

  useEffect(() => {
    if (!unitId) {
      setLessons([]);
      setSourceLessonId('');
      return;
    }
    listLessons(unitId).then(setLessons).catch(error => onToast(friendlyActionError(error), 'error'));
  }, [onToast, unitId]);

  const selectedTeacher = teachers.find(teacher => teacher.id === teacherId) || null;
  const assignedGroups = selectedTeacher ? groups.filter(group => selectedTeacher.assignedGroupIds.includes(group.id) || group.teacherId === selectedTeacher.id) : [];
  const assignedStudents = users.filter(user => selectedTeacher?.assignedStudentIds.includes(user.id));
  const selectedLesson = lessons.find(lesson => lesson.id === sourceLessonId) || null;

  const handleSave = async () => {
    if (!selectedTeacher) return onToast(labels.selectTeacher, 'error');
    const group = groups.find(item => item.id === groupId) || null;
    const targetStudentId = targetMode === 'group' ? group?.studentIds[0] : studentId;
    if (!targetStudentId) return onToast(labels.selectTarget, 'error');
    const assignedBlocks: TeacherLessonPlanBlockInput[] = lessonBlockOptions
      .filter(option => blocks[option.kind]?.enabled)
      .map((option, index) => {
        const draft = blocks[option.kind];
        const blockLesson = lessons.find(lesson => lesson.id === draft.sourceLessonId);
        const effectiveSourceLessonId = draft.sourceLessonId || (draft.materialMode === 'interactive' ? sourceLessonId : '');
        const effectiveLesson = blockLesson || lessons.find(lesson => lesson.id === effectiveSourceLessonId);
        return {
          blockKind: option.kind,
          sourceLessonId: effectiveSourceLessonId || null,
          materialTitle: draft.materialTitle || effectiveLesson?.title || option.label,
          materialUrl: draft.materialUrl || null,
          adminNote: draft.adminNote || '',
          materialMode: draft.materialMode,
          position: index,
        };
      });
    setSaving(true);
    try {
      const savedLesson = await saveTeacherLesson({
        id: editingLessonId || undefined,
        teacherId: selectedTeacher.id,
        studentId: targetStudentId,
        groupId: targetMode === 'group' ? groupId : null,
        sourceLessonId: sourceLessonId || assignedBlocks[0]?.sourceLessonId || null,
        date,
        day: isoDay(date),
        time,
        title: topic || selectedLesson?.title || group?.name || users.find(user => user.id === targetStudentId)?.name || 'Lesson',
        type: (targetMode === 'group' ? 'group' : 'individual') as LessonType,
        status,
        durationMinutes: duration,
        room: format === 'offline' ? 'Offline' : null,
        onlineUrl: format === 'online' ? 'online' : null,
        comment: `${format === 'online' ? labels.online : labels.offline} · ${duration} ${labels.minutes}`,
        assignedBlocks,
      });
      await syncLessonBlockContentForStudents({
        lessonId: savedLesson.id,
        teacherId: selectedTeacher.id,
        studentIds: targetMode === 'group' ? (group?.studentIds || []) : [targetStudentId],
        date,
        time,
        blocks: assignedBlocks,
      });
      await refreshSchedule();
      setEditingLessonId(null);
      setTopic('');
      setBlocks(emptyBlockDraft());
      onToast(`✅ ${labels.savedLesson}`);
    } catch (error) {
      onToast(friendlyActionError(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const editLesson = async (row: any) => {
    setEditingLessonId(row.id);
    setTeacherId(row.teacher_id || '');
    setTargetMode(row.group_id ? 'group' : 'student');
    setGroupId(row.group_id || '');
    setStudentId(row.user_id || '');
    setDate(row.scheduled_date || new Date().toISOString().slice(0, 10));
    setTime(row.time || '15:00');
    setDuration(row.duration_minutes || 50);
    setStatus((row.lesson_status || 'scheduled') as LessonStatus);
    setFormat(row.online_url ? 'online' : 'offline');
    setTopic(row.topic || '');
    setSourceLessonId(row.source_lesson_id || '');
    const nextBlocks = emptyBlockDraft();
    ((row.lesson_plan_blocks as any[]) || []).forEach((block: any) => {
      const kind = block.block_kind as LessonBlockKind;
      if (!nextBlocks[kind]) return;
      nextBlocks[kind] = {
        enabled: true,
        sourceLessonId: block.source_lesson_id || '',
        materialTitle: block.material_title || '',
        materialUrl: block.material_url || '',
        adminNote: block.admin_note || '',
        materialMode: block.material_mode === 'interactive' ? 'interactive' : 'file_link',
      };
    });
    setBlocks(nextBlocks);
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    onToast(labels.editLesson);
  };

  const confirmDeleteLesson = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await deleteTeacherLesson(deleteTarget.id);
      if (editingLessonId === deleteTarget.id) {
        setEditingLessonId(null);
        setBlocks(emptyBlockDraft());
        setTopic('');
      }
      await refreshSchedule();
      setDeleteTarget(null);
      onToast(`🗑️ ${labels.deleteLesson}`);
    } catch (error) {
      onToast(friendlyActionError(error), 'error');
    } finally {
      setDeleteSaving(false);
    }
  };

  const updateBlock = (kind: LessonBlockKind, patch: Partial<BlockDraft[LessonBlockKind]>) => {
    setBlocks(prev => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  };

  return (
    <div className="space-y-6">
    <div ref={formRef} className="glass rounded-3xl p-6 scroll-mt-24">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl bg-pink-100 p-3 text-pink-500"><CalendarPlus className="h-5 w-5" /></div>
        <div>
          <h3 className="font-display font-bold text-xl text-purple-700">{editingLessonId ? labels.editLesson : labels.scheduleTitle}</h3>
          <p className="font-body text-sm text-purple-400">{labels.scheduleHint}</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="font-body text-sm font-700 text-purple-600">{labels.teacher}
          <Select value={teacherId || undefined} onValueChange={value => { setTeacherId(value); setGroupId(''); setStudentId(''); }}>
            <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.selectTeacher} /></SelectTrigger>
            <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{teachers.length ? teachers.map(teacher => <SelectItem key={teacher.id} value={teacher.id}>{teacherName(teacher)}</SelectItem>) : <SelectEmpty text={labels.empty} />}</SelectContent>
          </Select>
        </label>
        <label className="font-body text-sm font-700 text-purple-600">{labels.group} / {labels.student}
          <div className="mt-2 flex rounded-2xl bg-white/70 p-1">
            {(['group', 'student'] as const).map(mode => <button key={mode} type="button" onClick={() => { setTargetMode(mode); setGroupId(''); setStudentId(''); }} className={`flex-1 rounded-xl px-3 py-2 text-xs font-800 transition ${targetMode === mode ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow' : 'text-purple-500 hover:bg-pink-50'}`}>{mode === 'group' ? labels.group : labels.student}</button>)}
          </div>
        </label>
        {targetMode === 'group' ? (
          <label className="font-body text-sm font-700 text-purple-600">{labels.group}
            <Select value={groupId || undefined} onValueChange={setGroupId}>
              <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.group} /></SelectTrigger>
              <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{assignedGroups.length ? assignedGroups.map(group => <SelectItem key={group.id} value={group.id}>{group.name} · {group.studentIds.length}</SelectItem>) : <SelectEmpty text={selectedTeacher ? labels.noGroups : labels.selectTeacher} />}</SelectContent>
            </Select>
          </label>
        ) : (
          <label className="font-body text-sm font-700 text-purple-600">{labels.student}
            <Select value={studentId || undefined} onValueChange={setStudentId}>
              <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.student} /></SelectTrigger>
              <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{assignedStudents.length ? assignedStudents.map(student => <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>) : <SelectEmpty text={selectedTeacher ? labels.noStudents : labels.selectTeacher} />}</SelectContent>
            </Select>
          </label>
        )}
        <label className="font-body text-sm font-700 text-purple-600">{labels.date}<input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-magic mt-2" /></label>
        <label className="font-body text-sm font-700 text-purple-600">{labels.time}<input type="time" value={time} onChange={e => setTime(e.target.value)} className="input-magic mt-2" /></label>
        <label className="font-body text-sm font-700 text-purple-600">{labels.duration}<input type="number" min={15} step={5} value={duration} onChange={e => setDuration(Number(e.target.value) || 50)} className="input-magic mt-2" /></label>
        <label className="font-body text-sm font-700 text-purple-600">{labels.format}
          <Select value={format} onValueChange={value => setFormat(value as 'online' | 'offline')}>
            <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95"><SelectItem value="online">{labels.online}</SelectItem><SelectItem value="offline">{labels.offline}</SelectItem></SelectContent>
          </Select>
        </label>
        <label className="font-body text-sm font-700 text-purple-600">{labels.status}
          <Select value={status} onValueChange={value => setStatus(value as LessonStatus)}>
            <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{(['scheduled', 'upcoming', 'ready', 'in_progress', 'completed', 'cancelled', 'rescheduled'] as LessonStatus[]).map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="font-body text-sm font-700 text-purple-600 lg:col-span-2">{labels.topic}<input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Colors, Family, Unit 1..." className="input-magic mt-2" /></label>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="font-body text-sm font-700 text-purple-600">Workbook
          <Select value={workbookId || undefined} onValueChange={value => { setWorkbookId(value); setUnitId(''); setSourceLessonId(''); }}>
            <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder="Workbook" /></SelectTrigger>
            <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{workbooks.length ? workbooks.map(workbook => <SelectItem key={workbook.id} value={workbook.id}>{workbook.title}</SelectItem>) : <SelectEmpty text={labels.noWorkbooks} />}</SelectContent>
          </Select>
        </label>
        <label className="font-body text-sm font-700 text-purple-600">{labels.unit}
          <Select value={unitId || undefined} onValueChange={value => { setUnitId(value); setSourceLessonId(''); }}>
            <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.unit} /></SelectTrigger>
            <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{units.length ? units.map(unit => <SelectItem key={unit.id} value={unit.id}>{unit.unit_number}. {unit.title}</SelectItem>) : <SelectEmpty text={workbookId ? labels.noUnits : 'Workbook'} />}</SelectContent>
          </Select>
        </label>
        <label className="font-body text-sm font-700 text-purple-600">{labels.lesson}
          <Select value={sourceLessonId || undefined} onValueChange={value => { setSourceLessonId(value); const lesson = lessons.find(item => item.id === value); if (lesson && !topic) setTopic(lesson.title); }}>
            <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.lesson} /></SelectTrigger>
            <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{lessons.length ? lessons.map(lesson => <SelectItem key={lesson.id} value={lesson.id}>{lesson.lesson_number}. {lesson.title} · {lesson.type}</SelectItem>) : <SelectEmpty text={unitId ? labels.noLessons : labels.unit} />}</SelectContent>
          </Select>
        </label>
      </div>
      <div className="mt-5">
        <h4 className="mb-3 font-display font-bold text-purple-700">{labels.blocks}</h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lessonBlockOptions.map(option => {
            const draft = blocks[option.kind];
            const matchingLessons = lessons.filter(lesson => lesson.type === option.lessonType);
            const sourceOptions = matchingLessons.length ? matchingLessons : lessons;
            return (
              <div key={option.kind} className={`rounded-3xl border p-4 transition-all ${draft.enabled ? 'border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50 shadow-[0_14px_34px_rgba(236,72,153,0.12)]' : 'border-purple-100 bg-white/70 hover:border-pink-100 hover:bg-white'}`}>
                <label className="flex items-center gap-3 font-body text-sm font-900 text-purple-700">
                  <span className={`grid h-9 w-9 place-items-center rounded-2xl ${draft.enabled ? 'bg-gradient-to-br from-pink-400 to-purple-400 text-white' : 'bg-purple-50 text-purple-500'}`}>{option.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <input type="checkbox" checked={draft.enabled} onChange={event => updateBlock(option.kind, { enabled: event.target.checked })} className="h-5 w-5 accent-pink-500" />
                </label>
                <div className="mt-3 grid grid-cols-2 rounded-2xl bg-white/75 p-1">
                  <button
                    type="button"
                    onClick={() => updateBlock(option.kind, { enabled: true, materialMode: 'file_link' })}
                    className={`rounded-xl px-2 py-2 font-body text-[11px] font-900 transition ${draft.enabled && draft.materialMode === 'file_link' ? 'bg-white text-purple-700 shadow-sm' : 'text-purple-300 hover:text-purple-500'}`}
                  >
                    {lang === 'en' ? 'Link' : lang === 'ua' ? 'Посилання' : 'Ссылка'}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateBlock(option.kind, { enabled: true, materialMode: 'interactive', materialUrl: '' })}
                    className={`rounded-xl px-2 py-2 font-body text-[11px] font-900 transition ${draft.enabled && draft.materialMode === 'interactive' ? 'bg-gradient-to-r from-blue-100 to-pink-100 text-blue-600 shadow-sm' : 'text-purple-300 hover:text-purple-500'}`}
                  >
                    {lang === 'en' ? 'Interactive' : lang === 'ua' ? 'Інтерактив' : 'Интерактив'}
                  </button>
                </div>
                {draft.enabled && (
                  <div className="mt-3 space-y-2">
                    <Select value={draft.sourceLessonId || undefined} onValueChange={value => updateBlock(option.kind, { sourceLessonId: value, materialTitle: lessons.find(lesson => lesson.id === value)?.title || draft.materialTitle })}>
                      <SelectTrigger className="input-magic h-auto text-xs"><SelectValue placeholder={draft.materialMode === 'interactive' ? (lang === 'en' ? 'Interactive lesson' : lang === 'ua' ? 'Інтерактивний урок' : 'Интерактивный урок') : labels.lesson} /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{sourceOptions.length ? sourceOptions.map(lesson => <SelectItem key={lesson.id} value={lesson.id}>{lesson.title}</SelectItem>) : <SelectEmpty text={labels.noLessons} />}</SelectContent>
                    </Select>
                    <input value={draft.materialTitle} onChange={event => updateBlock(option.kind, { materialTitle: event.target.value })} placeholder={labels.materials} className="input-magic text-xs" />
                    {draft.materialMode === 'file_link' ? (
                      <input value={draft.materialUrl} onChange={event => updateBlock(option.kind, { materialUrl: event.target.value })} placeholder="https://..." className="input-magic text-xs" />
                    ) : (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-3 py-2 font-body text-[11px] font-800 text-blue-500">
                        {lang === 'en'
                          ? 'The student will open this as an interactive assignment. The result will return to the teacher automatically.'
                          : lang === 'ua'
                            ? 'Учень відкриє це як інтерактивне завдання. Результат автоматично повернеться вчителю.'
                            : 'Ученик откроет это как интерактивное задание. Результат автоматически вернётся учителю.'}
                      </div>
                    )}
                    <textarea value={draft.adminNote} onChange={event => updateBlock(option.kind, { adminNote: event.target.value })} placeholder={lang === 'en' ? 'Admin note' : lang === 'ua' ? 'Нотатка адміністратора' : 'Заметка администратора'} className="input-magic min-h-16 text-xs" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-magic inline-flex items-center gap-2 px-6 py-3 text-white font-display font-bold disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />{saving ? '...' : labels.saveLesson}</button>
        {editingLessonId && <button onClick={() => { setEditingLessonId(null); setBlocks(emptyBlockDraft()); setTopic(''); }} className="btn-outline px-5 py-3 font-display font-bold text-sm">{t(lang, 'admin_cancel_btn')}</button>}
      </div>
    </div>

    <div className="glass rounded-3xl p-6">
      <h3 className="mb-4 font-display font-bold text-xl text-purple-700">{labels.allLessons}</h3>
      <div className="space-y-3">
        {scheduleRows.map(row => {
          const teacher = teachers.find(item => item.id === row.teacher_id);
          const group = groups.find(item => item.id === row.group_id);
          const student = users.find(item => item.id === row.user_id);
          return (
            <div key={row.id} className="rounded-2xl border border-purple-100 bg-white/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-display font-bold text-purple-700">{row.topic || labels.noData}</div>
                  <div className="font-body text-xs text-purple-400">{teacherName(teacher)} · {group?.name || student?.name || labels.noData} · {row.scheduled_date || row.day} {row.time}</div>
                  <div className="mt-1 font-body text-xs text-purple-300">{row.lesson_status} · {row.lesson_type} · {(row.lesson_plan_blocks || []).length} {labels.blocks}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => editLesson(row)} className="rounded-xl bg-purple-100 px-3 py-2 font-body text-xs font-800 text-purple-600 hover:bg-purple-200">{labels.editLesson}</button>
                  <button onClick={() => setDeleteTarget(row)} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 font-body text-xs font-800 text-red-500 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" />{labels.deleteLesson}</button>
                </div>
              </div>
            </div>
          );
        })}
        {scheduleRows.length === 0 && <div className="rounded-2xl bg-white/60 p-5 font-body text-purple-300">{labels.empty}</div>}
      </div>
    </div>
    <AnimatePresence>
      {deleteTarget && (
        <ConfirmActionModal
          title={labels.deleteLesson}
          message={labels.deleteConfirm}
          confirmLabel={labels.deleteLesson}
          cancelLabel={t(lang, 'admin_cancel')}
          onConfirm={confirmDeleteLesson}
          onCancel={() => setDeleteTarget(null)}
          busy={deleteSaving}
        />
      )}
    </AnimatePresence>
    </div>
  );
}

function TeacherContentPlanner({ lang, users, onToast }: { lang: Lang; users: User[]; onToast: (msg: string, type?: 'success' | 'error') => void }) {
  const labels = teacherFlowText[lang] || teacherFlowText.ru;
  const [teachers, setTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [targetMode, setTargetMode] = useState<'group' | 'student'>('group');
  const [groupId, setGroupId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [materialMode, setMaterialMode] = useState<'file_link' | 'interactive'>('file_link');
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [workbookId, setWorkbookId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [interactiveLessonId, setInteractiveLessonId] = useState('');
  const [blocks, setBlocks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const blockOptions: Array<{ id: string; label: string; type: ContentType; emoji: string }> = [
    { id: 'theory', label: 'Theory', type: 'lesson', emoji: '📘' },
    { id: 'lesson_tasks', label: 'Lesson Tasks', type: 'practice', emoji: '🧩' },
    { id: 'homework', label: 'Homework', type: 'homework', emoji: '📚' },
    { id: 'practice', label: 'Practice', type: 'practice', emoji: '🎮' },
    { id: 'grammar', label: 'Grammar', type: 'grammar', emoji: '📝' },
    { id: 'listening', label: 'Listening', type: 'listening', emoji: '🎧' },
    { id: 'checkpoint', label: 'Unit Checkpoint', type: 'checkpoint', emoji: '🏁' },
  ];

  useEffect(() => {
    Promise.all([listTeacherDirectory(users), listWorkbooks()]).then(([data, workbookRows]) => {
      setTeachers(data.teachers);
      setGroups(data.groups);
      setWorkbooks(workbookRows);
    }).catch(error => onToast(friendlyActionError(error), 'error'));
  }, [onToast, users]);

  useEffect(() => {
    if (!workbookId) {
      setUnits([]);
      setUnitId('');
      setInteractiveLessonId('');
      return;
    }
    listUnits(workbookId).then(setUnits).catch(error => onToast(friendlyActionError(error), 'error'));
  }, [onToast, workbookId]);

  useEffect(() => {
    if (!unitId) {
      setLessons([]);
      setInteractiveLessonId('');
      return;
    }
    listLessons(unitId).then(setLessons).catch(error => onToast(friendlyActionError(error), 'error'));
  }, [onToast, unitId]);

  const selectedTeacher = teachers.find(teacher => teacher.id === teacherId) || null;
  const teacherGroups = selectedTeacher ? groups.filter(group => selectedTeacher.assignedGroupIds.includes(group.id) || group.teacherId === selectedTeacher.id) : [];
  const teacherStudents = users.filter(user => selectedTeacher?.assignedStudentIds.includes(user.id));
  const selectedGroup = groups.find(group => group.id === groupId) || null;
  const selectedStudentIds = targetMode === 'group' ? (selectedGroup?.studentIds || []) : (studentId ? [studentId] : []);

  const toggleBlock = (id: string) => setBlocks(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  const handleSave = async () => {
    if (!selectedTeacher) return onToast(labels.selectTeacher, 'error');
    if (selectedStudentIds.length === 0 || blocks.length === 0) return onToast(labels.selectTarget, 'error');
    if (materialMode === 'interactive' && !interactiveLessonId) return onToast(labels.noLessons, 'error');
    const selectedBlocks = blockOptions.filter(item => blocks.includes(item.id));
    const interactiveLesson = lessons.find(item => item.id === interactiveLessonId) || null;
    setSaving(true);
    try {
      for (const targetStudentId of selectedStudentIds) {
        const current = await loadStudentContent(targetStudentId);
        const createdAt = Date.now();
        const nextItems: ContentItem[] = selectedBlocks.map(block => ({
          id: crypto.randomUUID(),
          userId: targetStudentId,
          moduleId: `admin-${createdAt}-${block.id}`,
          type: block.type,
          title: `${title || selectedGroup?.name || users.find(user => user.id === targetStudentId)?.name || labels.topic} · ${block.label}`,
          emoji: block.emoji,
          externalLink: materialMode === 'file_link' ? link || null : null,
          interactiveLessonId: materialMode === 'interactive' ? interactiveLessonId : null,
          materialMode,
          studentResult: materialMode === 'interactive' ? `Interactive: ${interactiveLesson?.title || block.label}` : null,
          unlocked: true,
        }));
        await saveStudentContent(targetStudentId, [...current, ...nextItems]);
      }
      setTitle('');
      setLink('');
      setMaterialMode('file_link');
      setInteractiveLessonId('');
      onToast(`✅ ${lang === 'en' ? 'Content assigned' : lang === 'ua' ? 'Контент призначено' : 'Контент назначен'}`);
    } catch (error) {
      onToast(friendlyActionError(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-6 mb-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl bg-purple-100 p-3 text-purple-500"><BookOpen className="h-5 w-5" /></div>
        <div>
          <h3 className="font-display font-bold text-xl text-purple-700">{lang === 'en' ? 'Assign learning blocks' : lang === 'ua' ? 'Призначити навчальні блоки' : 'Назначить учебные блоки'}</h3>
          <p className="font-body text-sm text-purple-400">{lang === 'en' ? 'Only selected blocks are created and stay closed until opened for the lesson.' : lang === 'ua' ? 'Створюються тільки вибрані блоки, вони залишаються закритими до відкриття на уроці.' : 'Создаются только выбранные блоки, они остаются закрытыми до открытия на уроке.'}</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="font-body text-sm font-700 text-purple-600">{labels.teacher}
          <Select value={teacherId || undefined} onValueChange={value => { setTeacherId(value); setGroupId(''); setStudentId(''); }}>
            <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.selectTeacher} /></SelectTrigger>
            <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{teachers.length ? teachers.map(teacher => <SelectItem key={teacher.id} value={teacher.id}>{teacherName(teacher)}</SelectItem>) : <SelectEmpty text={labels.empty} />}</SelectContent>
          </Select>
        </label>
        <label className="font-body text-sm font-700 text-purple-600">{labels.group} / {labels.student}
          <div className="mt-2 flex rounded-2xl bg-white/70 p-1">
            {(['group', 'student'] as const).map(mode => <button key={mode} type="button" onClick={() => { setTargetMode(mode); setGroupId(''); setStudentId(''); }} className={`flex-1 rounded-xl px-3 py-2 text-xs font-800 transition ${targetMode === mode ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow' : 'text-purple-500 hover:bg-pink-50'}`}>{mode === 'group' ? labels.group : labels.student}</button>)}
          </div>
        </label>
        {targetMode === 'group' ? (
          <label className="font-body text-sm font-700 text-purple-600">{labels.group}
            <Select value={groupId || undefined} onValueChange={setGroupId}>
              <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.group} /></SelectTrigger>
              <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{teacherGroups.length ? teacherGroups.map(group => <SelectItem key={group.id} value={group.id}>{group.name} · {group.studentIds.length}</SelectItem>) : <SelectEmpty text={selectedTeacher ? labels.noGroups : labels.selectTeacher} />}</SelectContent>
            </Select>
          </label>
        ) : (
          <label className="font-body text-sm font-700 text-purple-600">{labels.student}
            <Select value={studentId || undefined} onValueChange={setStudentId}>
              <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.student} /></SelectTrigger>
              <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{teacherStudents.length ? teacherStudents.map(student => <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>) : <SelectEmpty text={selectedTeacher ? labels.noStudents : labels.selectTeacher} />}</SelectContent>
            </Select>
          </label>
        )}
        <label className="font-body text-sm font-700 text-purple-600">{labels.topic}<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Family, Colors, Unit 1..." className="input-magic mt-2" /></label>
        <div className="font-body text-sm font-700 text-purple-600">
          {lang === 'en' ? 'Material type' : lang === 'ua' ? 'Тип матеріалу' : 'Тип материала'}
          <div className="mt-2 grid grid-cols-2 rounded-2xl bg-white/70 p-1">
            <button
              type="button"
              onClick={() => setMaterialMode('file_link')}
              className={`rounded-xl px-3 py-2 text-xs font-900 transition ${materialMode === 'file_link' ? 'bg-white text-purple-700 shadow-sm' : 'text-purple-400 hover:bg-pink-50'}`}
            >
              {lang === 'en' ? 'File / link' : lang === 'ua' ? 'Файл / посилання' : 'Файл / ссылка'}
            </button>
            <button
              type="button"
              onClick={() => { setMaterialMode('interactive'); setLink(''); }}
              className={`rounded-xl px-3 py-2 text-xs font-900 transition ${materialMode === 'interactive' ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow' : 'text-purple-400 hover:bg-pink-50'}`}
            >
              {lang === 'en' ? 'Interactive' : lang === 'ua' ? 'Інтерактив' : 'Интерактив'}
            </button>
          </div>
        </div>
        {materialMode === 'file_link' ? (
          <label className="font-body text-sm font-700 text-purple-600">Material link<input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." className="input-magic mt-2" /></label>
        ) : (
          <div className="grid gap-3 lg:col-span-2 lg:grid-cols-3">
            <label className="font-body text-sm font-700 text-purple-600">Workbook
              <Select value={workbookId || undefined} onValueChange={value => { setWorkbookId(value); setUnitId(''); setInteractiveLessonId(''); }}>
                <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder="Workbook" /></SelectTrigger>
                <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{workbooks.length ? workbooks.map(workbook => <SelectItem key={workbook.id} value={workbook.id}>{workbook.title}</SelectItem>) : <SelectEmpty text={labels.noWorkbooks} />}</SelectContent>
              </Select>
            </label>
            <label className="font-body text-sm font-700 text-purple-600">{labels.unit}
              <Select value={unitId || undefined} onValueChange={value => { setUnitId(value); setInteractiveLessonId(''); }}>
                <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.unit} /></SelectTrigger>
                <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{units.length ? units.map(unit => <SelectItem key={unit.id} value={unit.id}>{unit.unit_number}. {unit.title}</SelectItem>) : <SelectEmpty text={workbookId ? labels.noUnits : 'Workbook'} />}</SelectContent>
              </Select>
            </label>
            <label className="font-body text-sm font-700 text-purple-600">{labels.lesson}
              <Select value={interactiveLessonId || undefined} onValueChange={setInteractiveLessonId}>
                <SelectTrigger className="input-magic mt-2 h-auto"><SelectValue placeholder={labels.lesson} /></SelectTrigger>
                <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">{lessons.length ? lessons.map(lesson => <SelectItem key={lesson.id} value={lesson.id}>{lesson.lesson_number}. {lesson.title} · {lesson.type}</SelectItem>) : <SelectEmpty text={unitId ? labels.noLessons : labels.unit} />}</SelectContent>
              </Select>
            </label>
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {blockOptions.map(block => {
          const checked = blocks.includes(block.id);
          return (
            <button key={block.id} type="button" onClick={() => toggleBlock(block.id)}
              className={`rounded-2xl border px-3 py-3 text-left font-body text-sm font-800 transition hover:-translate-y-0.5 ${checked ? 'border-pink-200 bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 shadow-md' : 'border-purple-100 bg-white/70 text-purple-400'}`}>
              <span className="mr-2">{block.emoji}</span>{block.label}
            </button>
          );
        })}
      </div>
      <button onClick={handleSave} disabled={saving} className="btn-magic mt-5 px-6 py-3 text-white font-display font-bold disabled:opacity-60">{saving ? '...' : (lang === 'en' ? 'Assign blocks' : lang === 'ua' ? 'Призначити блоки' : 'Назначить блоки')}</button>
    </div>
  );
}

function SchoolStudentCenter({ lang, users }: { lang: Lang; users: User[] }) {
  const labels = teacherFlowText[lang] || teacherFlowText.ru;
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(users[0]?.id || '');
  const [content, setContent] = useState<ContentItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);

  useEffect(() => { listTeacherDirectory(users).then(data => { setTeachers(data.teachers); setGroups(data.groups); }).catch(console.error); }, [users]);
  useEffect(() => { if (!selectedId && users[0]?.id) setSelectedId(users[0].id); }, [selectedId, users]);
  useEffect(() => { if (selectedId) Promise.all([loadStudentContent(selectedId), loadStudentSchedule(selectedId)]).then(([c, s]) => { setContent(c); setSchedule(s); }); }, [selectedId]);

  const filtered = users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()));
  const selected = users.find(user => user.id === selectedId) || filtered[0] || null;
  const group = selected ? findStudentGroup(groups, selected.id) : null;
  const teacher = selected ? teachers.find(item => item.assignedStudentIds.includes(selected.id) || (group && item.assignedGroupIds.includes(group.id))) : null;
  const homework = content.filter(item => item.type === 'homework');
  const sortedSchedule = [...schedule].sort((a, b) => scheduleSlotTimeValue(a) - scheduleSlotTimeValue(b));
  const activeSchedule = sortedSchedule.filter(isActiveScheduleSlot);
  const completedSchedule = sortedSchedule.filter(item => item.isConducted || item.status === 'completed');
  const completedLessons = completedSchedule.length;
  const plannedLessons = activeSchedule.length;
  const attendance = schedule.length ? Math.round((completedLessons / schedule.length) * 100) : 0;
  const homeworkGrades = homework.map(item => item.starRating || 0).filter(Boolean);
  const lessonGrades = content.filter(item => item.type === 'lesson').map(item => item.starRating || 0).filter(Boolean);
  const homeworkRating = homeworkGrades.length ? (homeworkGrades.reduce((sum, item) => sum + item, 0) / homeworkGrades.length).toFixed(1) : labels.noData;
  const lessonRating = lessonGrades.length ? (lessonGrades.reduce((sum, item) => sum + item, 0) / lessonGrades.length).toFixed(1) : labels.noData;
  const homeworkCompletion = homework.length ? Math.round((homeworkGrades.length / homework.length) * 100) : 0;
  const nextLesson = activeSchedule[0];
  const lastLesson = [...completedSchedule].reverse()[0];
  const card = (label: string, value: string | number) => <div className="rounded-2xl border border-purple-100 bg-white/70 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="font-body text-xs font-800 uppercase tracking-wider text-purple-300">{label}</div><div className="mt-2 font-display text-2xl font-black text-purple-700">{value}</div></div>;

  return (
    <motion.div key="student-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><div className="font-body text-xs font-800 uppercase tracking-wider text-pink-400">School Student Center</div><h2 className="font-display font-black text-3xl text-purple-700">{labels.studentsCenter}</h2><p className="font-body text-sm text-purple-400">{labels.studentsCenterHint}</p></div>
          <div className="relative w-full md:max-w-md"><Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-purple-300" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={labels.search} className="input-magic" style={{ paddingLeft: 56 }} /></div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.34fr_0.66fr]">
        <aside className="glass rounded-3xl p-5"><h3 className="mb-4 font-display font-bold text-purple-700">{labels.allStudents}</h3><div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
          {filtered.map(student => <button key={student.id} onClick={() => setSelectedId(student.id)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 ${selected?.id === student.id ? 'border-pink-200 bg-pink-50 text-purple-700 shadow-md' : 'border-purple-100 bg-white/60 text-purple-500 hover:bg-white'}`}><UserAvatar user={student} /><span className="min-w-0 flex-1"><span className="block truncate font-body font-800">{student.name}</span><span className="block truncate font-body text-xs text-purple-300">{student.email}</span></span></button>)}
        </div></aside>
        {selected && <div className="space-y-6">
          <section className="glass overflow-hidden rounded-3xl">
            <div className="flex flex-col gap-5 border-b border-purple-100 bg-white/35 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4"><UserAvatar user={selected} size="lg" /><div><div className="font-body text-xs font-800 uppercase tracking-wider text-pink-400">{labels.basic}</div><h2 className="font-display font-black text-3xl text-purple-700">{selected.name}</h2><p className="font-body text-sm text-purple-400">{selected.email} · {group?.name || labels.noData}</p></div></div>
              <button onClick={() => navigate(`/analytics/${selected.id}`)} className="btn-magic inline-flex items-center justify-center gap-2 px-5 py-3 text-white font-display font-bold"><BarChart3 className="h-4 w-4" />{labels.openAnalytics}</button>
            </div>
            <div className="grid gap-3 p-6 md:grid-cols-3">{card(labels.group, group?.name || labels.noData)}{card(labels.teacher, teacherName(teacher) || labels.noData)}{card('Status', selected.accessStatus || labels.noData)}{card('Unit', group?.currentUnit || labels.noData)}{card('Lesson', group?.currentLesson || nextLesson?.topic || labels.noData)}{card('Next', nextLesson ? `${nextLesson.day} · ${nextLesson.time}` : labels.noData)}</div>
          </section>
          <section className="grid gap-4 md:grid-cols-4">{card(labels.attendance, `${attendance}%`)}{card(labels.completedLessons, completedLessons)}{card(labels.plannedLessons, plannedLessons)}{card(labels.homeworkRating, homeworkRating)}</section>
          <section className="grid gap-6 xl:grid-cols-3">
            <div className="glass rounded-3xl p-6"><h3 className="font-display font-bold text-xl text-purple-700">{labels.attendance}</h3><div className="mt-5 h-3 rounded-full bg-purple-100"><div className="h-full rounded-full bg-gradient-to-r from-green-300 to-teal-300" style={{ width: `${attendance}%` }} /></div><div className="mt-4 font-display text-3xl font-black text-green-600">{attendance}%</div></div>
            <div className="glass rounded-3xl p-6"><h3 className="font-display font-bold text-xl text-purple-700">Homework</h3><div className="mt-5 h-3 rounded-full bg-purple-100"><div className="h-full rounded-full bg-gradient-to-r from-pink-300 to-purple-300" style={{ width: `${homeworkCompletion}%` }} /></div><div className="mt-4 font-display text-3xl font-black text-pink-500">{homeworkCompletion}%</div></div>
            <div className="glass rounded-3xl p-6"><h3 className="font-display font-bold text-xl text-purple-700">Activity</h3><div className="mt-5 flex h-28 items-end gap-2 rounded-2xl bg-white/60 p-3">{schedule.slice(-7).map((item, index) => <div key={`${item.id}-${index}`} className={`flex-1 rounded-t-xl ${item.isConducted ? 'bg-gradient-to-t from-green-300 to-teal-200' : 'bg-gradient-to-t from-pink-200 to-purple-200'}`} style={{ height: `${item.isConducted ? 88 : 42}%` }} />)}{schedule.length === 0 && <div className="m-auto font-body text-sm text-purple-300">{labels.empty}</div>}</div></div>
          </section>
          <section className="grid gap-6 xl:grid-cols-2">
            <div className="glass rounded-3xl p-6"><h3 className="mb-4 font-display font-bold text-xl text-purple-700">{labels.calendar}</h3><div className="space-y-2">{activeSchedule.map(slot => <div key={slot.id} className="rounded-2xl bg-white/70 p-4 font-body text-sm text-purple-500"><div className="font-800 text-purple-700">{slot.topic || labels.noData}</div><div>{slot.day} · {slot.time} · {labels.plannedLessons}</div><div className="text-xs text-purple-300">{labels.group}: {group?.name || labels.noData} · {labels.teacher}: {teacherName(teacher) || labels.noData}</div></div>)}{activeSchedule.length === 0 && <div className="rounded-2xl bg-white/60 p-4 text-purple-300">{labels.empty}</div>}</div></div>
            <div className="glass rounded-3xl p-6"><h3 className="mb-4 font-display font-bold text-xl text-purple-700">{labels.learning}</h3><div className="grid gap-3 sm:grid-cols-2">{card(labels.lessonRating, lessonRating)}{card('Unit Checkpoints', content.filter(item => item.type === 'checkpoint').length)}{card('Last lesson', lastLesson ? `${lastLesson.day} · ${lastLesson.time}` : labels.noData)}{card(labels.tariff, selected.paymentStatus || labels.noData)}</div></div>
          </section>
        </div>}
      </div>
    </motion.div>
  );
}

function AdminTeacherReports({ lang, users }: { lang: Lang; users: User[] }) {
  const labels = teacherFlowText[lang] || teacherFlowText.ru;
  const [teachers, setTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [notes, setNotes] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => JSON.parse(localStorage.getItem('admin:teacher-notes-read') || '[]'));

  useEffect(() => {
    listTeacherDirectory(users).then(async directory => {
      setTeachers(directory.teachers);
      setGroups(directory.groups);
      const [{ data: noteRows }, { data: resultRows }] = await Promise.all([
        (supabase as any).from('teacher_student_notes').select('*').eq('visible_to_admin', true).order('created_at', { ascending: false }),
        (supabase as any).from('lesson_results').select('*, schedules(*)').order('created_at', { ascending: false }),
      ]);
      const lessonIds = ((resultRows as any[]) || []).map(row => row.lesson_id).filter(Boolean);
      const [{ data: attendanceRows }, { data: gradeRows }] = lessonIds.length
        ? await Promise.all([
            (supabase as any).from('lesson_attendance').select('*').in('lesson_id', lessonIds),
            (supabase as any).from('grades').select('*').in('lesson_id', lessonIds),
          ])
        : [{ data: [] }, { data: [] }];
      setNotes(noteRows || []);
      setResults(((resultRows as any[]) || []).map(result => ({
        ...result,
        attendance_rows: ((attendanceRows as any[]) || []).filter(row => row.lesson_id === result.lesson_id),
        grade_rows: ((gradeRows as any[]) || []).filter(row => row.lesson_id === result.lesson_id),
      })));
    }).catch(console.error);
  }, [users]);

  const markRead = (id: string) => {
    const next = Array.from(new Set([...readIds, id]));
    setReadIds(next);
    localStorage.setItem('admin:teacher-notes-read', JSON.stringify(next));
  };
  const noteMatches = (note: any) => (teacherFilter === 'all' || note.teacher_id === teacherFilter) && (studentFilter === 'all' || note.student_id === studentFilter) && (groupFilter === 'all' || (note.target_type === 'group' && note.target_id === groupFilter));
  const resultMatches = (result: any) => {
    const schedule = result.schedules || {};
    return (teacherFilter === 'all' || result.teacher_id === teacherFilter) && (studentFilter === 'all' || schedule.user_id === studentFilter) && (groupFilter === 'all' || schedule.group_id === groupFilter);
  };

  return (
    <motion.div key="teacher-reports" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="glass rounded-3xl p-6"><h2 className="font-display font-black text-3xl text-purple-700">{labels.reports}</h2><div className="mt-5 grid gap-3 md:grid-cols-3">
        <Select value={teacherFilter} onValueChange={setTeacherFilter}><SelectTrigger className="input-magic h-auto"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95"><SelectItem value="all">{labels.teacher}: all</SelectItem>{teachers.map(teacher => <SelectItem key={teacher.id} value={teacher.id}>{teacherName(teacher)}</SelectItem>)}</SelectContent></Select>
        <Select value={groupFilter} onValueChange={setGroupFilter}><SelectTrigger className="input-magic h-auto"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95"><SelectItem value="all">{labels.group}: all</SelectItem>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent></Select>
        <Select value={studentFilter} onValueChange={setStudentFilter}><SelectTrigger className="input-magic h-auto"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95"><SelectItem value="all">{labels.student}: all</SelectItem>{users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select>
      </div></div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="glass rounded-3xl p-6"><h3 className="mb-4 font-display font-bold text-xl text-purple-700">{labels.notes}</h3><div className="space-y-3">
          {notes.filter(noteMatches).map(note => { const teacher = teachers.find(item => item.id === note.teacher_id); const student = users.find(item => item.id === note.student_id); const isRead = readIds.includes(note.id); return <div key={note.id} className={`rounded-2xl border p-4 ${isRead ? 'border-green-100 bg-green-50/60' : 'border-pink-100 bg-white/70'}`}><div className="font-body text-xs text-purple-300">{teacherName(teacher)} · {student?.name || note.target_type} · {new Date(note.created_at).toLocaleDateString()}</div><p className="mt-2 font-body text-sm text-purple-600">{note.text}</p><button onClick={() => markRead(note.id)} className="mt-3 rounded-xl bg-purple-100 px-3 py-1.5 font-body text-xs font-800 text-purple-600">{isRead ? labels.read : labels.markRead}</button></div>; })}
          {notes.filter(noteMatches).length === 0 && <div className="rounded-2xl bg-white/60 p-5 font-body text-purple-300">{labels.empty}</div>}
        </div></section>
        <section className="glass rounded-3xl p-6"><h3 className="mb-4 font-display font-bold text-xl text-purple-700">{labels.results}</h3><div className="space-y-3">
          {results.filter(resultMatches).map(result => { const schedule = result.schedules || {}; const teacher = teachers.find(item => item.id === result.teacher_id); const group = groups.find(item => item.id === schedule.group_id); const student = users.find(item => item.id === schedule.user_id); return <div key={result.id} className="rounded-2xl border border-purple-100 bg-white/70 p-4"><div className="font-display font-bold text-purple-700">{schedule.topic || labels.noData}</div><div className="font-body text-xs text-purple-300">{group?.name || student?.name || labels.noData} · {teacherName(teacher)} · {schedule.scheduled_date || schedule.day} {schedule.time}</div><div className="mt-3 grid gap-2 font-body text-sm text-purple-500"><div><span className="font-800 text-purple-700">Результат:</span> {result.summary || labels.noData}</div><div><span className="font-800 text-purple-700">Комментарий:</span> {result.teacher_comment || labels.noData}</div><div><span className="font-800 text-purple-700">Домашнее задание:</span> {result.homework_brief || labels.noData}</div><div><span className="font-800 text-purple-700">Перенести дальше:</span> {result.carry_over_to_next_lesson || labels.noData}</div><div><span className="font-800 text-purple-700">Для администратора:</span> {result.admin_note || labels.noData}</div></div><div className="mt-3 flex flex-wrap gap-2">{(result.attendance_rows || []).map((row: any) => <span key={row.id} className="rounded-full bg-blue-50 px-3 py-1 font-body text-xs font-800 text-blue-600">{users.find(user => user.id === row.student_id)?.name || labels.student}: {row.status}</span>)}{(result.grade_rows || []).map((row: any) => <span key={row.id} className="rounded-full bg-amber-50 px-3 py-1 font-body text-xs font-800 text-amber-700">{users.find(user => user.id === row.user_id)?.name || labels.student}: {row.score}/5</span>)}</div></div>; })}
          {results.filter(resultMatches).length === 0 && <div className="rounded-2xl bg-white/60 p-5 font-body text-purple-300">{labels.empty}</div>}
        </div></section>
      </div>
    </motion.div>
  );
}

export default function Admin({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const handleSetLang = (l: Lang) => { setLang(l); };
  const currentUser = getCurrentUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeSection, setActiveSection] = useState<Section>('students');
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [profileTarget, setProfileTarget] = useState<User | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [subscriptionFilters, setSubscriptionFilters] = useState<SubscriptionFilters>({
    query: '',
    planId: 'all',
    lessonFormat: 'all',
    subscriptionStatus: 'all',
    paymentStatus: 'all',
  });
  const [subscriptionPayments, setSubscriptionPayments] = useState<StripePaymentRow[]>([]);
  const [subscriptionFailures, setSubscriptionFailures] = useState<StripePaymentFailureRow[]>([]);
  const [subscriptionRefunds, setSubscriptionRefunds] = useState<StripeRefundRow[]>([]);
  const [selectedSubscriptionUserId, setSelectedSubscriptionUserId] = useState<string | null>(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState<User | null>(null);
  const [adjustmentLessons, setAdjustmentLessons] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [refundTarget, setRefundTarget] = useState<{ payment: StripePaymentRow; student: User } | null>(null);
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSaving, setRefundSaving] = useState(false);

  // Schedule
  const [schedUserId, setSchedUserId] = useState('');
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [slotDeleteTarget, setSlotDeleteTarget] = useState<ScheduleSlot | null>(null);
  const [slotDeleteSaving, setSlotDeleteSaving] = useState(false);

  // Content
  const [contentUserId, setContentUserId] = useState('');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [listeningAudioBusyId, setListeningAudioBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editSchedDate, setEditSchedDate] = useState('');
  const [editSchedTime, setEditSchedTime] = useState('');
  const [editStars, setEditStars] = useState(0);
  const [editFileDataUrl, setEditFileDataUrl] = useState('');
  const [editFileName, setEditFileName] = useState('');
  const [editExternalLink, setEditExternalLink] = useState('');
  const [editTargetMode, setEditTargetMode] = useState<ContentTargetMode>('current');
  const [editSelectedIds, setEditSelectedIds] = useState<string[]>([]);
  const [contentTargetMode, setContentTargetMode] = useState<ContentTargetMode>('current');
  const [contentSelectedIds, setContentSelectedIds] = useState<string[]>([]);
  const [contentSaving, setContentSaving] = useState(false);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null);
  const [confirmDeleteModule, setConfirmDeleteModule] = useState<string | null>(null);

  const handleDeleteItem = async (itemId: string) => {
    if (confirmDeleteItem !== itemId) {
      setConfirmDeleteItem(itemId);
      setTimeout(() => setConfirmDeleteItem(c => c === itemId ? null : c), 3000);
      return;
    }
    await deleteContentItem(contentUserId, itemId);
    const fresh = await loadStudentContent(contentUserId);
    setContentItems(fresh);
    setConfirmDeleteItem(null);
    showToast('🗑️ ' + t(lang,'admin_do_delete'));
  };
  const handleDeleteModule = async (moduleId: string) => {
    if (confirmDeleteModule !== moduleId) {
      setConfirmDeleteModule(moduleId);
      setTimeout(() => setConfirmDeleteModule(c => c === moduleId ? null : c), 3000);
      return;
    }
    await deleteModule(contentUserId, moduleId);
    const fresh = await loadStudentContent(contentUserId);
    setContentItems(fresh);
    setConfirmDeleteModule(null);
    showToast('🗑️ ' + t(lang,'admin_do_delete'));
  };

  // New module
  const [showNewModule, setShowNewModule] = useState(false);
  const [newModTitle, setNewModTitle] = useState({ lesson:'', homework:'', practice:'' });
  const [newModEmoji, setNewModEmoji] = useState({ lesson:'📚', homework:'✏️', practice:'🎮' });
  const [newModFile, setNewModFile] = useState({ lesson:'', homework:'', practice:'' });
  const [newModFileName, setNewModFileName] = useState({ lesson:'', homework:'', practice:'' });
  const [newModLink, setNewModLink] = useState({ lesson:'', homework:'', practice:'' });
  const [newModDue, setNewModDue] = useState('');
  const [newModSchedLesson, setNewModSchedLesson] = useState({ date:'', time:'' });
  const [newModSchedPractice, setNewModSchedPractice] = useState({ date:'', time:'' });
  const [newModSchedHW, setNewModSchedHW] = useState({ date:'', time:'' });

  // New grammar/listening
  const [showNewExtra, setShowNewExtra] = useState(false);
  const [newExtraType, setNewExtraType] = useState<'grammar'|'listening'|'checkpoint'>('grammar');
  const [newExtraTitle, setNewExtraTitle] = useState('');
  const [newExtraEmoji, setNewExtraEmoji] = useState('📝');
  const [newExtraFile, setNewExtraFile] = useState('');
  const [newExtraFileName, setNewExtraFileName] = useState('');
  const [newExtraLink, setNewExtraLink] = useState('');
  const [newExtraSchedDate, setNewExtraSchedDate] = useState('');
  const [newExtraSchedTime, setNewExtraSchedTime] = useState('');

  const refreshSubscriptionHistory = async () => {
    const [paymentsResult, failuresResult, refundsResult] = await Promise.all([
      supabase
        .from('stripe_payments')
        .select('id,user_id,amount_total,currency,event_type,plan_id,lesson_format,lessons_total,paid_at,created_at,stripe_invoice_id,stripe_payment_intent_id,stripe_charge_id,stripe_subscription_id')
        .order('created_at', { ascending: false }),
      supabase
        .from('stripe_payment_failures')
        .select('id,user_id,amount_due,currency,status,failure_reason,created_at,stripe_invoice_id,stripe_subscription_id')
        .order('created_at', { ascending: false }),
      supabase
        .from('stripe_refunds')
        .select('id,user_id,stripe_payment_id,stripe_refund_id,amount,currency,refund_type,reason,status,created_by_admin_id,created_at,updated_at')
        .order('created_at', { ascending: false }),
    ]);

    if (paymentsResult.error) throw paymentsResult.error;
    if (failuresResult.error) throw failuresResult.error;
    if (refundsResult.error) throw refundsResult.error;

    setSubscriptionPayments((paymentsResult.data || []) as StripePaymentRow[]);
    setSubscriptionFailures((failuresResult.data || []) as StripePaymentFailureRow[]);
    setSubscriptionRefunds((refundsResult.data || []) as StripeRefundRow[]);
  };

  
  useEffect(() => {
    if (!canAccessSubscriptionAdmin(currentUser)) { navigate('/login'); return; }
    loadAllUsers().then(refreshUsers);
    refreshSubscriptionHistory().catch(error => {
      console.error(error);
      showToast(friendlyActionError(error), 'error');
    });
    const unsub = subscribe(refreshUsers);
    return () => { unsub(); };
  }, [currentUser, navigate]);
  useEffect(() => { if (schedUserId) loadStudentSchedule(schedUserId).then(setSlots); else setSlots([]); }, [schedUserId]);
  useEffect(() => { if (contentUserId) loadStudentContent(contentUserId).then(setContentItems); else setContentItems([]); }, [contentUserId]);

  const refreshUsers = () => setUsers(getUsers().filter(u => u.role === 'student'));
  const refreshUsersFromServer = async () => {
    const fresh = await loadAllUsers();
    setUsers(fresh.filter(u => u.role === 'student'));
  };
  const showToast = (msg: string, type: 'success'|'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), type === 'error' ? 5200 : 3000); };

  const runStudentAction = async (uid: string, action: () => Promise<void>, success: string, type: 'success'|'error' = 'success') => {
    setSavingUserId(uid);
    try {
      await action();
      await refreshUsersFromServer();
      showToast(success, type);
    } catch (error) {
      console.error(error);
      showToast(friendlyActionError(error), 'error');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleGrant = (uid: string, name: string) => runStudentAction(uid, () => grantAccess(uid), `✅ ${name}`);
  const handleRevoke = (uid: string, name: string) => runStudentAction(uid, () => revokeAccess(uid), `🔒 ${name}`, 'error');
  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await deleteUser(deleteTarget.id);
      await refreshUsersFromServer();
      if (schedUserId === deleteTarget.id) setSchedUserId('');
      if (contentUserId === deleteTarget.id) setContentUserId('');
      showToast(`🗑️ ${deleteTarget.name}`);
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      showToast(`${deleteFailedText}: ${friendlyActionError(error)}`, 'error');
    } finally {
      setDeleteSaving(false);
    }
  };
  const handleLogout = async () => { await logout(); navigate('/'); };

  // Schedule
  const addSlot = () => setSlots(p => [...p, { id: crypto.randomUUID(), day:'Monday', time:'15:00', topic:'', isConducted: false }]);
  const updateSlot = (id: string, f: keyof ScheduleSlot, v: string | boolean) => setSlots(p => p.map(s => s.id === id ? { ...s, [f]: v } as ScheduleSlot : s));
  const removeSlot = async () => {
    if (!slotDeleteTarget) return;
    setSlotDeleteSaving(true);
    setSlots(p => p.filter(s => s.id !== slotDeleteTarget.id));
    try {
      await deleteScheduleSlot(slotDeleteTarget.id, schedUserId);
      if (schedUserId) {
        const fresh = await loadStudentSchedule(schedUserId);
        setSlots(fresh);
      }
      setSlotDeleteTarget(null);
      showToast(`🗑️ ${t(lang,'admin_remove')}`);
    } catch (error) {
      console.error(error);
      showToast(friendlyActionError(error), 'error');
      if (schedUserId) loadStudentSchedule(schedUserId).then(setSlots);
    } finally {
      setSlotDeleteSaving(false);
    }
  };
  const saveSchedule = async () => {
    if (!schedUserId) return;
    await saveStudentSchedule(schedUserId, slots);
    const fresh = await loadStudentSchedule(schedUserId);
    setSlots(fresh);
    showToast(t(lang,'admin_schedule_saved'));
  };
  const toggleConducted = async (slot: ScheduleSlot) => {
    const next = !slot.isConducted;
    setSlots(p => p.map(s => s.id === slot.id ? { ...s, isConducted: next } : s));
    try {
      await setSlotConducted(slot.id, next, schedUserId);
      await loadStudentSchedule(schedUserId);
    } catch (e) {
      console.error(e);
      setSlots(p => p.map(s => s.id === slot.id ? { ...s, isConducted: !next } : s));
    }
  };

  // Content
  const toggleUnlock = async (itemId: string, cur: boolean) => {
    const updated = contentItems.map(i => i.id === itemId ? { ...i, unlocked: !cur } : i);
    setContentItems(updated); await saveStudentContent(contentUserId, updated);
    showToast(cur ? '🔒 Закрыто' : '✅ Открыто!');
  };
  const generateListeningAudio = async (item: ContentItem) => {
    setListeningAudioBusyId(item.id);
    try {
      await generateListeningTaskAudio({
        content_item_id: item.id,
        text: item.title,
        voice_id: DEFAULT_ELEVENLABS_VOICE_ID,
        model_id: DEFAULT_ELEVENLABS_MODEL_ID,
      });
      await refreshCurrentContent();
      showToast(lang === 'en' ? 'Listening audio generated' : lang === 'ua' ? 'Аудіо аудіювання згенеровано' : 'Аудио аудирования сгенерировано');
    } catch (error) {
      showToast(friendlyActionError(error), 'error');
    } finally {
      setListeningAudioBusyId(null);
    }
  };
  const deleteListeningAudio = async (item: ContentItem) => {
    setListeningAudioBusyId(item.id);
    try {
      await deleteListeningTaskAudio(item.id);
      await refreshCurrentContent();
      showToast(lang === 'en' ? 'Listening audio deleted' : lang === 'ua' ? 'Аудіо аудіювання видалено' : 'Аудио аудирования удалено');
    } catch (error) {
      showToast(friendlyActionError(error), 'error');
    } finally {
      setListeningAudioBusyId(null);
    }
  };
  const startEdit = (item: ContentItem) => {
    setEditingId(item.id); setEditTitle(item.title); setEditEmoji(item.emoji);
    setEditDueDate(item.dueDate||''); setEditSchedDate(item.scheduledDate||''); setEditSchedTime(item.scheduledTime||'');
    setEditStars(item.starRating||0); setEditFileDataUrl(item.fileDataUrl||''); setEditFileName(item.fileName||'');
    setEditExternalLink(item.externalLink||'');
    setEditTargetMode('current'); setEditSelectedIds([]);
  };

  const contentTargetText = {
    ru: {
      title: 'Кому выставить',
      editTitle: 'Применить изменения',
      current: 'Текущему ученику',
      all: 'Всем ученикам',
      selected: 'Выбранным',
      selectedHint: 'Выберите учеников',
      empty: 'Выберите хотя бы одного ученика',
      savedFor: 'Сохранено для учеников',
    },
    en: {
      title: 'Assign to',
      editTitle: 'Apply changes',
      current: 'Current student',
      all: 'All students',
      selected: 'Selected',
      selectedHint: 'Choose students',
      empty: 'Choose at least one student',
      savedFor: 'Saved for students',
    },
    ua: {
      title: 'Кому виставити',
      editTitle: 'Застосувати зміни',
      current: 'Поточному учню',
      all: 'Усім учням',
      selected: 'Обраним',
      selectedHint: 'Оберіть учнів',
      empty: 'Оберіть хоча б одного учня',
      savedFor: 'Збережено для учнів',
    },
  }[lang];

  const targetIdsFor = (mode: ContentTargetMode, selectedIds: string[]) => {
    const allowed = new Set(users.map(u => u.id));
    if (mode === 'all') return users.map(u => u.id);
    if (mode === 'selected') return Array.from(new Set(selectedIds.filter(id => allowed.has(id))));
    return contentUserId ? [contentUserId] : [];
  };

  const refreshCurrentContent = async () => {
    if (!contentUserId) {
      setContentItems([]);
      return;
    }
    const fresh = await loadStudentContent(contentUserId);
    setContentItems(fresh);
  };

  const renderContentTargetPicker = (
    title: string,
    mode: ContentTargetMode,
    setMode: (mode: ContentTargetMode) => void,
    selectedIds: string[],
    setSelectedIds: (ids: string[]) => void,
  ) => {
    const toggle = (id: string) => {
      setSelectedIds(selectedIds.includes(id)
        ? selectedIds.filter(selectedId => selectedId !== id)
        : [...selectedIds, id]);
    };

    return (
      <div className="rounded-2xl border border-purple-100 bg-white/80 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="font-body text-xs font-800 uppercase tracking-wider text-purple-500">{title}</div>
          <div className="flex flex-wrap gap-1 rounded-2xl bg-purple-50 p-1">
            {(['current', 'all', 'selected'] as ContentTargetMode[]).map(targetMode => (
              <button
                key={targetMode}
                type="button"
                onClick={() => setMode(targetMode)}
                className={`rounded-xl px-3 py-1.5 text-xs font-body font-800 transition ${mode === targetMode ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-sm' : 'text-purple-500 hover:bg-white'}`}
              >
                {contentTargetText[targetMode]}
              </button>
            ))}
          </div>
        </div>
        {mode === 'selected' && (
          <div className="space-y-2">
            <div className="font-body text-xs font-600 text-purple-400">{contentTargetText.selectedHint}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {users.map(user => {
                const checked = selectedIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 transition ${checked ? 'border-green-200 bg-green-50 text-green-700' : 'border-purple-100 bg-white text-purple-500 hover:border-pink-200 hover:bg-pink-50'}`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(user.id)} className="h-4 w-4 accent-pink-400" />
                    <span className="min-w-0">
                      <span className="block truncate font-body text-sm font-700">{user.name}</span>
                      <span className="block truncate font-body text-xs text-purple-300">{user.email}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const saveEdit = async (itemId: string, type: ContentType) => {
    const prev = contentItems.find(i => i.id === itemId);
    if (!prev) return;
    const targetIds = targetIdsFor(editTargetMode, editSelectedIds);
    if (targetIds.length === 0) {
      showToast(contentTargetText.empty, 'error');
      return;
    }

    const isGradedType = isGradedContentType(type);
    const willBeGraded = isGradedType && editStars > 0;

    setContentSaving(true);
    try {
      for (const targetId of targetIds) {
        const targetContent = targetId === contentUserId ? contentItems : await loadStudentContent(targetId);
        const targetPrev = targetId === contentUserId
          ? targetContent.find(i => i.id === itemId)
          : targetContent.find(i => i.moduleId === prev.moduleId && i.type === prev.type)
            || targetContent.find(i => i.type === prev.type && i.title === prev.title);
        const wasGraded = !!(targetPrev?.starRating && targetPrev.starRating > 0);
        const nextItem: ContentItem = {
          ...(targetPrev || prev),
          id: targetPrev?.id || crypto.randomUUID(),
          userId: targetId,
          moduleId: targetPrev?.moduleId || prev.moduleId,
          title: editTitle,
          emoji: editEmoji,
          dueDate: editDueDate || null,
          scheduledDate: editSchedDate || null,
          scheduledTime: editSchedTime || null,
          fileDataUrl: editFileDataUrl || null,
          fileName: editFileName || null,
          fileUrl: editFileDataUrl || null,
          externalLink: editExternalLink || null,
          starRating: isGradedType ? editStars : targetPrev?.starRating,
        };
        const updated = targetPrev
          ? targetContent.map(i => i.id === targetPrev.id ? nextItem : i)
          : [...targetContent, nextItem];
        await saveStudentContent(targetId, updated);
        if (isGradedType && willBeGraded && !wasGraded) {
          const awardedStars = Math.max(1, Math.min(5, editStars));
          try { await awardStars(targetId, awardedStars); }
          catch (e) { console.error('awardStars failed', e); }
        }
      }

      await refreshCurrentContent();
      setEditingId(null);
      showToast(`${t(lang,'admin_content_saved')} · ${contentTargetText.savedFor}: ${targetIds.length}`);
    } catch (error) {
      console.error(error);
      showToast(friendlyActionError(error), 'error');
    } finally {
      setContentSaving(false);
    }
  };

  const getNextModuleIdFor = (items: ContentItem[]) => {
    const nums = items.map(i => parseInt(i.moduleId.replace('module-',''))||0);
    return `module-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  };
  const addModule = async () => {
    const targetIds = targetIdsFor(contentTargetMode, contentSelectedIds);
    if (targetIds.length === 0) {
      showToast(contentTargetText.empty, 'error');
      return;
    }

    setContentSaving(true);
    try {
      for (const targetId of targetIds) {
        const baseItems = targetId === contentUserId ? contentItems : await loadStudentContent(targetId);
        const moduleId = getNextModuleIdFor(baseItems);
        const num = moduleId.replace('module-','');
        const newItems: ContentItem[] = [
          { id: crypto.randomUUID(), userId: targetId, moduleId, type:'lesson',   title:newModTitle.lesson   ||`Lesson ${num}`,    emoji:newModEmoji.lesson,   fileUrl:newModFile.lesson   || null, fileDataUrl:newModFile.lesson   || null, fileName:newModFileName.lesson   || null, externalLink:newModLink.lesson   ||null, scheduledDate:newModSchedLesson.date   || null, scheduledTime:newModSchedLesson.time   || null, unlocked:false },
          { id: crypto.randomUUID(), userId: targetId, moduleId, type:'homework', title:newModTitle.homework ||`Home Task ${num}`, emoji:newModEmoji.homework, fileUrl:newModFile.homework || null, fileDataUrl:newModFile.homework || null, fileName:newModFileName.homework || null, externalLink:newModLink.homework ||null, dueDate:newModDue || null, scheduledDate:newModSchedHW.date || null, scheduledTime:newModSchedHW.time || null, unlocked:false },
          { id: crypto.randomUUID(), userId: targetId, moduleId, type:'practice', title:newModTitle.practice ||`Practice ${num}`,  emoji:newModEmoji.practice, fileUrl:newModFile.practice || null, fileDataUrl:newModFile.practice || null, fileName:newModFileName.practice || null, externalLink:newModLink.practice ||null, scheduledDate:newModSchedPractice.date || null, scheduledTime:newModSchedPractice.time || null, unlocked:false },
        ];
        await saveStudentContent(targetId, [...baseItems, ...newItems]);
      }

      await refreshCurrentContent();
      setShowNewModule(false); setNewModTitle({lesson:'',homework:'',practice:''}); setNewModEmoji({lesson:'📚',homework:'✏️',practice:'🎮'});
      setNewModFile({lesson:'',homework:'',practice:''}); setNewModFileName({lesson:'',homework:'',practice:''}); setNewModLink({lesson:'',homework:'',practice:''}); setNewModDue('');
      setNewModSchedLesson({date:'',time:''}); setNewModSchedPractice({date:'',time:''}); setNewModSchedHW({date:'',time:''});
      showToast(`✅ ${t(lang,'admin_module')} · ${contentTargetText.savedFor}: ${targetIds.length}`);
    } catch (error) {
      console.error(error);
      showToast(friendlyActionError(error), 'error');
    } finally {
      setContentSaving(false);
    }
  };
  const addExtra = async () => {
    const targetIds = targetIdsFor(contentTargetMode, contentSelectedIds);
    if (targetIds.length === 0) {
      showToast(contentTargetText.empty, 'error');
      return;
    }

    setContentSaving(true);
    try {
      for (const targetId of targetIds) {
        const baseItems = targetId === contentUserId ? contentItems : await loadStudentContent(targetId);
        const existingCount = baseItems.filter(i => i.type === newExtraType).length + 1;
        const extraModuleId = `${newExtraType}-${Date.now()}-${targetId.slice(0, 8)}`;
        const defaultTitle = newExtraType === 'grammar' ? `Grammar ${existingCount}`
          : newExtraType === 'listening' ? `Listening ${existingCount}`
          : `Unit Checkpoint ${existingCount}`;
        const newItem: ContentItem = { id: crypto.randomUUID(), userId: targetId, moduleId:extraModuleId, type:newExtraType, title:newExtraTitle||defaultTitle, emoji:newExtraEmoji, fileUrl:newExtraFile || null, fileDataUrl:newExtraFile || null, fileName:newExtraFileName || null, externalLink:newExtraLink||null, scheduledDate:newExtraSchedDate || null, scheduledTime:newExtraSchedTime || null, unlocked:false };
        await saveStudentContent(targetId, [...baseItems, newItem]);
      }

      await refreshCurrentContent();
      setShowNewExtra(false); setNewExtraTitle(''); setNewExtraFile(''); setNewExtraFileName(''); setNewExtraLink(''); setNewExtraSchedDate(''); setNewExtraSchedTime('');
      const toastKey = newExtraType === 'grammar' ? 'dash_grammar' : newExtraType === 'listening' ? 'dash_listening' : 'dash_checkpoint';
      showToast(`✅ ${t(lang, toastKey)} · ${contentTargetText.savedFor}: ${targetIds.length}`);
    } catch (error) {
      console.error(error);
      showToast(friendlyActionError(error), 'error');
    } finally {
      setContentSaving(false);
    }
  };

  const filtered = users.filter(u => {
    const ms = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const mf = filter==='all' ? true : filter==='active' ? u.hasAccess : !u.hasAccess;
    return ms && mf;
  });
  const totalStudents = users.length;
  const activeStudents = users.filter(u => u.hasAccess).length;
  const pendingStudents = users.filter(u => !u.hasAccess).length;

  if (!canAccessSubscriptionAdmin(currentUser)) return null;

  // Sort modules: regular modules first (by number), then grammar/listening by type+count
  const moduleIds = [...new Set(contentItems.map(i => i.moduleId))].sort((a, b) => {
    const isRegA = a.startsWith('module-');
    const isRegB = b.startsWith('module-');
    if (isRegA && isRegB) return (parseInt(a.replace('module-',''))||0) - (parseInt(b.replace('module-',''))||0);
    if (isRegA) return -1;
    if (isRegB) return 1;
    return a.localeCompare(b);
  });

  // Build sequential index per type-prefix so "grammar-1777..." shows as "Грамматика 1"
  const moduleSeqMap = (() => {
    const counters: Record<string, number> = {};
    const map: Record<string, number> = {};
    for (const mid of moduleIds) {
      const prefix = mid.startsWith('grammar-') ? 'grammar'
        : mid.startsWith('listening-') ? 'listening'
        : mid.startsWith('checkpoint-') ? 'checkpoint'
        : null;
      if (prefix) {
        counters[prefix] = (counters[prefix] || 0) + 1;
        map[mid] = counters[prefix];
      }
    }
    return map;
  })();

  // Human-readable module header
  const getModuleLabel = (moduleId: string): { badge: string; title: string; isExtra: boolean } => {
    if (moduleId.startsWith('module-')) {
      const n = moduleId.replace('module-', '');
      return { badge: n, title: `${t(lang,'admin_module')} ${n}`, isExtra: false };
    }
    if (moduleId.startsWith('grammar-')) {
      const n = moduleSeqMap[moduleId] ?? moduleId.replace('grammar-', '');
      const label = lang === 'en' ? 'Grammar' : lang === 'ua' ? 'Граматика' : 'Грамматика';
      return { badge: String(n), title: `${label} ${n}`, isExtra: true };
    }
    if (moduleId.startsWith('listening-')) {
      const n = moduleSeqMap[moduleId] ?? moduleId.replace('listening-', '');
      const label = lang === 'en' ? 'Listening' : lang === 'ua' ? 'Аудіювання' : 'Аудирование';
      return { badge: String(n), title: `${label} ${n}`, isExtra: true };
    }
    if (moduleId.startsWith('checkpoint-')) {
      const n = moduleSeqMap[moduleId] ?? moduleId.replace('checkpoint-', '');
      return { badge: String(n), title: `Unit Checkpoint ${n}`, isExtra: true };
    }
    return { badge: '?', title: moduleId, isExtra: false };
  };

  const typeLabel = (type: ContentType) =>
    type === 'lesson' ? `📚 ${t(lang,'admin_lesson')}` :
    type === 'homework' ? `✏️ ${t(lang,'admin_homework')}` :
    type === 'practice' ? `🎮 ${t(lang,'admin_practice')}` :
    type === 'grammar' ? `📝 ${t(lang,'dash_grammar')}` :
    type === 'checkpoint' ? `🏁 ${t(lang,'dash_checkpoint')}` :
    `🎧 ${t(lang,'dash_listening')}`;

  const typeBadge = (type: ContentType) =>
    type === 'lesson' ? 'bg-pink-100 text-pink-600' :
    type === 'homework' ? 'bg-purple-100 text-purple-600' :
    type === 'practice' ? 'bg-blue-100 text-blue-600' :
    type === 'grammar' ? 'bg-yellow-100 text-yellow-600' :
    type === 'checkpoint' ? 'bg-orange-100 text-orange-600' :
    'bg-green-100 text-green-600';

  const langs: Lang[] = ['ru','en','ua'];
  const linkLabel = lang === 'en' ? 'Attach link' : lang === 'ua' ? 'Прикріпити посилання' : 'Прикрепить ссылку';
  const linkPlaceholder = lang === 'en' ? 'https://example.com' : 'https://...';
  const paymentHeader = lang === 'en' ? 'Payment' : lang === 'ua' ? 'Оплата' : 'Оплата';
  const accessHeader = lang === 'en' ? 'Access' : lang === 'ua' ? 'Доступ' : 'Доступ';
  const deleteFailedText = lang === 'en' ? 'Could not delete student' : lang === 'ua' ? 'Не вдалося видалити учня' : 'Не удалось удалить ученика';
  const accessLabels: Record<AccessStatus, string> = {
    pending: lang === 'en' ? '🟡 Pending' : lang === 'ua' ? '🟡 Очікує' : '🟡 Ожидает',
    active: lang === 'en' ? '🟢 Active' : lang === 'ua' ? '🟢 Активний' : '🟢 Активен',
    suspended: lang === 'en' ? '🟠 Suspended' : lang === 'ua' ? '🟠 Призупинено' : '🟠 Приостановлен',
    cancelled: lang === 'en' ? '⚫ Cancelled' : lang === 'ua' ? '⚫ Скасовано' : '⚫ Отменён',
  };
  const paymentLabels: Record<PaymentStatus, string> = {
    unpaid: lang === 'en' ? '🔴 Unpaid' : lang === 'ua' ? '🔴 Не оплачено' : '🔴 Не оплачено',
    pending_review: lang === 'en' ? '🔵 Review' : lang === 'ua' ? '🔵 Перевірка' : '🔵 Проверка',
    paid: lang === 'en' ? '💚 Paid' : lang === 'ua' ? '💚 Оплачено' : '💚 Оплачено',
    refunded: lang === 'en' ? '↩️ Refunded' : lang === 'ua' ? '↩️ Повернено' : '↩️ Возврат',
    failed: lang === 'en' ? '⚠️ Payment problem' : lang === 'ua' ? '⚠️ Проблема з оплатою' : '⚠️ Проблема с оплатой',
  };
  const accessClasses: Record<AccessStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    active: 'bg-green-100 text-green-700 border-green-200',
    suspended: 'bg-orange-100 text-orange-700 border-orange-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  const paymentClasses: Record<PaymentStatus, string> = {
    unpaid: 'bg-red-100 text-red-500 border-red-200',
    pending_review: 'bg-blue-100 text-blue-500 border-blue-200',
    paid: 'bg-green-100 text-green-700 border-green-200',
    refunded: 'bg-purple-100 text-purple-600 border-purple-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
  };
  const paymentFailedLabel = lang === 'en' ? 'Failed charge' : lang === 'ua' ? 'Невдале списання' : 'Неуспешное списание';
  const updatePaymentMethodLabel = lang === 'en' ? 'Update payment method' : lang === 'ua' ? 'Оновити спосіб оплати' : 'Обновить способ оплаты';
  const paidPeriodEndLabel = lang === 'en' ? 'Paid period ends' : lang === 'ua' ? 'Оплачений період до' : 'Оплаченный период до';
  const hasSubscriptionPaymentProblem = (student: User) => (
    activeSubscriptionStatus({
      paymentStatus: student.paymentStatus,
      subscriptionStatus: student.subscriptionStatus,
      stripeCustomerId: student.stripeCustomerId,
      stripeSubscriptionId: student.stripeSubscriptionId,
      cancelAtPeriodEnd: student.cancelAtPeriodEnd,
      manualAccessOverride: student.manualAccessOverride,
      accessStatus: student.accessStatus,
    }) === 'payment_failed'
  );
  const subscriptionStatusLabel = (student: User) => {
    return billingStatusLabel(activeSubscriptionStatus({
      paymentStatus: student.paymentStatus,
      subscriptionStatus: student.subscriptionStatus,
      stripeCustomerId: student.stripeCustomerId,
      stripeSubscriptionId: student.stripeSubscriptionId,
      cancelAtPeriodEnd: student.cancelAtPeriodEnd,
      manualAccessOverride: student.manualAccessOverride,
      accessStatus: student.accessStatus,
    }), lang);
  };
  const formatBillingLine = (student: User) => {
    const planId = student.planId && student.planId in pricingPlanNameKeys ? student.planId as PricingPlanId : null;
    const planName = planId ? t(lang, pricingPlanNameKeys[planId]) : student.planId;
    const formatName = student.lessonFormat === 'individual'
      ? (lang === 'en' ? 'Individual' : lang === 'ua' ? 'Індивідуально' : 'Индивидуально')
      : student.lessonFormat === 'group'
        ? (lang === 'en' ? 'Group' : lang === 'ua' ? 'Група' : 'Группа')
        : '';
    const lessons = student.lessonsTotal || student.lessonsRemaining
      ? `${student.lessonsRemaining ?? 0}/${student.lessonsTotal ?? 0}`
      : '';
    const next = student.nextPaymentDate
      ? new Date(student.nextPaymentDate).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU')
      : '';
    const billingKind = activeSubscriptionStatus({
      paymentStatus: student.paymentStatus,
      subscriptionStatus: student.subscriptionStatus,
      stripeCustomerId: student.stripeCustomerId,
      stripeSubscriptionId: student.stripeSubscriptionId,
      cancelAtPeriodEnd: student.cancelAtPeriodEnd,
      manualAccessOverride: student.manualAccessOverride,
      accessStatus: student.accessStatus,
    });
    const status = billingKind === 'manual_access' ? '' : billingStatusLabel(billingKind, lang);
    const periodEnd = (student.cancelAtPeriodEnd || student.subscriptionStatus === 'canceled') && student.currentPeriodEnd
      ? `${paidPeriodEndLabel}: ${new Date(student.currentPeriodEnd).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU')}`
      : '';
    return [status, planName, formatName, lessons, periodEnd || next].filter(Boolean).join(' · ');
  };
  const formatPaymentFailedLine = (student: User) => (
    student.paymentFailedAt
      ? `${paymentFailedLabel}: ${new Date(student.paymentFailedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU')}`
      : ''
  );
  const statusPillBase = 'inline-flex min-h-9 min-w-[156px] items-center justify-center rounded-2xl border px-3 py-2 font-body text-xs font-700 shadow-sm';
  const formatDate = (value?: string | null) => value
    ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU')
    : '—';
  const formatPeriod = (start?: string | null, end?: string | null) => (
    start || end ? `${formatDate(start)} - ${formatDate(end)}` : '—'
  );
  const formatPlanLabel = (planId?: string | null) => {
    const knownPlanId = planId && planId in pricingPlanNameKeys ? planId as PricingPlanId : null;
    return knownPlanId ? t(lang, pricingPlanNameKeys[knownPlanId]) : planId || '—';
  };
  const formatLessonFormatLabel = (format?: string | null) => (
    format === 'individual'
      ? (lang === 'en' ? 'Individual' : lang === 'ua' ? 'Individual' : 'Individual')
      : format === 'group'
        ? (lang === 'en' ? 'Group' : lang === 'ua' ? 'Group' : 'Group')
        : '—'
  );
  const formatSubscriptionStatusOption = (status?: string | null) => {
    if (!status) return '—';
    if (status === 'active' || status === 'trialing') return lang === 'en' ? 'Active' : lang === 'ua' ? 'Активна' : 'Активна';
    if (status === 'past_due' || status === 'unpaid' || status === 'incomplete_expired') return paymentLabels.failed;
    if (status === 'canceled') return lang === 'en' ? 'Canceled' : lang === 'ua' ? 'Скасована' : 'Отменена';
    return status;
  };
  const formatMoney = (amount?: number | null, currency?: string | null) => {
    if (amount == null) return '—';
    const units = amount / 100;
    return `${units.toLocaleString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU')} ${(currency || '').toUpperCase()}`;
  };
  const moneyToMinorUnits = (value: string) => {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return null;
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return null;
    return Math.round((numeric + Number.EPSILON) * 100);
  };
  const refundSummaryForPayment = (payment: StripePaymentRow) => {
    const refunds = subscriptionRefunds.filter(refund => refund.stripe_payment_id === payment.id);
    const refundedAmount = refunds.reduce((sum, refund) => sum + refund.amount, 0);
    const paymentAmount = payment.amount_total ?? 0;
    const lastRefund = refunds[0] || null;
    const availableAmount = Math.max(0, paymentAmount - refundedAmount);
    const state = refundedAmount <= 0
      ? 'none'
      : paymentAmount > 0 && refundedAmount >= paymentAmount
        ? 'full'
        : 'partial';

    return {
      refunds,
      refundedAmount,
      availableAmount,
      lastRefund,
      state,
    };
  };
  const refundStatusLabel = (summary: ReturnType<typeof refundSummaryForPayment>) => {
    if (summary.state === 'full') return lang === 'en' ? 'Fully refunded' : lang === 'ua' ? 'Повністю повернено' : 'Полностью возвращён';
    if (summary.state === 'partial') return lang === 'en' ? 'Partially refunded' : lang === 'ua' ? 'Частково повернено' : 'Частично возвращён';
    return lang === 'en' ? 'No refund issued' : lang === 'ua' ? 'Повернення не оформлялось' : 'Возврат не оформлялся';
  };
  const openRefundModal = (payment: StripePaymentRow, student: User) => {
    const summary = refundSummaryForPayment(payment);
    setRefundTarget({ payment, student });
    setRefundType('full');
    setRefundAmount((summary.availableAmount / 100).toFixed(2));
    setRefundReason('');
  };
  const submitRefund = async () => {
    if (!refundTarget) return;

    const summary = refundSummaryForPayment(refundTarget.payment);
    const amount = refundType === 'full' ? summary.availableAmount : moneyToMinorUnits(refundAmount);
    if (!amount || amount <= 0) {
      showToast(lang === 'en' ? 'Enter a valid refund amount' : lang === 'ua' ? 'Введіть коректну суму повернення' : 'Введите корректную сумму возврата', 'error');
      return;
    }
    if (amount > summary.availableAmount) {
      showToast(lang === 'en' ? 'Refund amount exceeds available amount' : lang === 'ua' ? 'Сума повернення більша за доступну' : 'Сумма возврата больше доступной', 'error');
      return;
    }
    if (refundReason.trim().length < 6) {
      showToast(lang === 'en' ? 'Refund reason is required' : lang === 'ua' ? 'Потрібно вказати причину повернення' : 'Нужно указать причину возврата', 'error');
      return;
    }

    setRefundSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('admin_auth_required');

      const { data: payload, error } = await supabase.functions.invoke<{ error?: string }>('create-refund', {
        body: {
          stripePaymentId: refundTarget.payment.id,
          refundType,
          amount,
          reason: refundReason.trim(),
          idempotencyKey: crypto.randomUUID(),
        },
      });

      if (error) {
        let functionError = payload?.error || '';
        const context = (error as { context?: Response }).context;
        if (!functionError && context?.json) {
          const body = await context.clone().json().catch(() => null) as { error?: string } | null;
          functionError = body?.error || '';
        }
        throw new Error(functionError || error.message || 'refund_failed');
      }

      await refreshSubscriptionHistory();
      setRefundTarget(null);
      showToast(lang === 'en' ? 'Refund created. Adjust lessons manually if needed.' : lang === 'ua' ? 'Повернення створено. За потреби скоригуйте уроки вручну.' : 'Возврат создан. При необходимости скорректируйте уроки вручную.');
    } catch (error) {
      console.error(error);
      showToast(friendlyActionError(error), 'error');
    } finally {
      setRefundSaving(false);
    }
  };
  const lastSuccessfulPaymentByUser = subscriptionPayments.reduce((map, payment) => {
    if (!map.has(payment.user_id)) map.set(payment.user_id, payment.paid_at || payment.created_at);
    return map;
  }, new Map<string, string | null>());
  const lastFailedPaymentByUser = subscriptionFailures.reduce((map, failure) => {
    if (!map.has(failure.user_id)) map.set(failure.user_id, failure.created_at);
    return map;
  }, new Map<string, string | null>());
  const subscriptionRows = buildSubscriptionRows(users, lastSuccessfulPaymentByUser, lastFailedPaymentByUser);
  const filteredSubscriptions = filterSubscriptionRows(subscriptionRows, subscriptionFilters);
  const selectedSubscriptionRow = selectedSubscriptionUserId
    ? subscriptionRows.find(row => row.user.id === selectedSubscriptionUserId) || null
    : null;
  const selectedSubscriptionPayments = selectedSubscriptionRow
    ? subscriptionPayments.filter(payment => payment.user_id === selectedSubscriptionRow.user.id)
    : [];
  const selectedSubscriptionFailures = selectedSubscriptionRow
    ? subscriptionFailures.filter(failure => failure.user_id === selectedSubscriptionRow.user.id)
    : [];
  const subscriptionPlanOptions = Array.from(new Set(subscriptionRows.map(row => row.planId).filter(Boolean))).sort();
  const subscriptionFormatOptions = Array.from(new Set(subscriptionRows.map(row => row.lessonFormat).filter(Boolean))).sort();
  const subscriptionStatusOptions = Array.from(new Set(subscriptionRows.map(row => row.subscriptionStatus).filter(Boolean))).sort();
  const subscriptionPaymentStatusOptions = Array.from(new Set(subscriptionRows.map(row => row.paymentStatus).filter(Boolean))).sort();
  const setSubscriptionFilter = (key: keyof SubscriptionFilters, value: string) => {
    setSubscriptionFilters(prev => ({ ...prev, [key]: value }));
  };
  const copyStripeId = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(lang === 'en' ? 'Stripe ID copied' : lang === 'ua' ? 'Stripe ID скопійовано' : 'Stripe ID скопирован');
    } catch (error) {
      console.error(error);
      showToast(lang === 'en' ? 'Could not copy Stripe ID' : lang === 'ua' ? 'Не вдалося скопіювати Stripe ID' : 'Не удалось скопировать Stripe ID', 'error');
    }
  };
  const openStripeSubscription = (subscriptionId?: string | null) => {
    if (!subscriptionId) return;
    window.open(`https://dashboard.stripe.com/test/subscriptions/${encodeURIComponent(subscriptionId)}`, '_blank', 'noopener,noreferrer');
  };
  const openStripeCustomer = (customerId?: string | null) => {
    if (!customerId) return;
    window.open(`https://dashboard.stripe.com/test/customers/${encodeURIComponent(customerId)}`, '_blank', 'noopener,noreferrer');
  };
  const openLessonAdjustment = (student: User) => {
    setAdjustmentTarget(student);
    setAdjustmentLessons(String(student.lessonsRemaining ?? 0));
    setAdjustmentReason('');
  };
  const saveLessonAdjustment = async () => {
    if (!adjustmentTarget) return;
    const nextLessons = Number(adjustmentLessons);
    const validationError = validateLessonAdjustmentInput(nextLessons, adjustmentReason);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    setAdjustmentSaving(true);
    try {
      const { error } = await supabase.rpc('adjust_subscription_lessons_remaining', {
        p_user_id: adjustmentTarget.id,
        p_new_lessons_remaining: nextLessons,
        p_reason: adjustmentReason.trim(),
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;

      await refreshUsersFromServer();
      setAdjustmentTarget(null);
      showToast(lang === 'en' ? 'Lesson balance updated' : lang === 'ua' ? 'Залишок уроків оновлено' : 'Остаток уроков обновлён');
    } catch (error) {
      console.error(error);
      showToast(friendlyActionError(error), 'error');
    } finally {
      setAdjustmentSaving(false);
    }
  };

  return (
    <div className="min-h-screen page-bg-admin">

      <AnimatePresence>
        {deleteTarget && <DeleteModal name={deleteTarget.name} onConfirm={doDelete} onCancel={() => setDeleteTarget(null)} lang={lang} busy={deleteSaving} />}
      </AnimatePresence>

      <AnimatePresence>
        {slotDeleteTarget && (
          <ConfirmActionModal
            title={lang === 'en' ? 'Delete schedule slot' : lang === 'ua' ? 'Видалити слот розкладу' : 'Удалить слот расписания'}
            message={`${slotDeleteTarget.topic || (lang === 'en' ? 'Schedule' : lang === 'ua' ? 'Розклад' : 'Расписание')} · ${slotDeleteTarget.day} ${slotDeleteTarget.time}`}
            confirmLabel={t(lang, 'admin_remove')}
            cancelLabel={t(lang, 'admin_cancel')}
            onConfirm={removeSlot}
            onCancel={() => setSlotDeleteTarget(null)}
            busy={slotDeleteSaving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profileTarget && (
          <StudentProfileModal
            user={profileTarget}
            users={users}
            lang={lang}
            onClose={() => setProfileTarget(null)}
            onCredentialsSaved={(msg) => { showToast(msg); setProfileTarget(null); refreshUsers(); }}
            onOpenAnalytics={() => { const id = profileTarget.id; setProfileTarget(null); navigate(`/analytics/${id}`); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adjustmentTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(60,20,100,0.55)', backdropFilter: 'blur(10px)' }}
            onClick={() => !adjustmentSaving && setAdjustmentTarget(null)}>
            <motion.div initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 24 }}
              className="glass w-full max-w-lg rounded-3xl p-6 shadow-2xl"
              onClick={event => event.stopPropagation()}>
              <div className="mb-5">
                <div className="font-body text-xs font-800 uppercase tracking-wider text-purple-400">
                  {lang === 'en' ? 'Lesson adjustment' : lang === 'ua' ? 'Корекція уроків' : 'Корректировка уроков'}
                </div>
                <h3 className="mt-1 font-display text-2xl font-black text-purple-700">{adjustmentTarget.name}</h3>
                <p className="font-body text-sm text-purple-400">
                  {lang === 'en' ? 'Current balance' : lang === 'ua' ? 'Поточний залишок' : 'Текущий остаток'}: {adjustmentTarget.lessonsRemaining ?? 0}
                </p>
              </div>
              <label className="mb-3 block">
                <span className="mb-1 block font-body text-xs font-800 text-purple-500">
                  {lang === 'en' ? 'New lessons remaining' : lang === 'ua' ? 'Новий залишок уроків' : 'Новый остаток уроков'}
                </span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={adjustmentLessons}
                  onChange={event => setAdjustmentLessons(event.target.value)}
                  className="input-magic w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-body text-xs font-800 text-purple-500">
                  {lang === 'en' ? 'Reason, required' : lang === 'ua' ? 'Причина, обовʼязково' : 'Причина, обязательно'}
                </span>
                <textarea
                  value={adjustmentReason}
                  onChange={event => setAdjustmentReason(event.target.value)}
                  className="input-magic min-h-24 w-full resize-none"
                  placeholder={lang === 'en' ? 'Why is the balance changed?' : lang === 'ua' ? 'Чому змінюється залишок?' : 'Почему меняется остаток?'}
                />
              </label>
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 font-body text-xs font-700 text-amber-700">
                {lang === 'en'
                  ? 'The change will be saved to the audit log.'
                  : lang === 'ua'
                    ? 'Зміна буде записана в audit log.'
                    : 'Изменение будет записано в audit log.'}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button disabled={adjustmentSaving} onClick={() => setAdjustmentTarget(null)} className="btn-outline px-5 py-2.5 font-display text-sm font-bold disabled:opacity-60">
                  {t(lang, 'admin_cancel')}
                </button>
                <button disabled={adjustmentSaving} onClick={saveLessonAdjustment} className="rounded-full bg-gradient-to-r from-pink-400 to-purple-400 px-5 py-2.5 font-display text-sm font-bold text-white shadow-lg disabled:opacity-60">
                  {adjustmentSaving ? '...' : (lang === 'en' ? 'Confirm' : lang === 'ua' ? 'Підтвердити' : 'Подтвердить')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {refundTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(60,20,100,0.55)', backdropFilter: 'blur(10px)' }}
            onClick={() => !refundSaving && setRefundTarget(null)}>
            <motion.div initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 24 }}
              className="glass w-full max-w-xl rounded-3xl p-6 shadow-2xl"
              onClick={event => event.stopPropagation()}>
              {(() => {
                const summary = refundSummaryForPayment(refundTarget.payment);
                const planLabel = formatPlanLabel(refundTarget.payment.plan_id);
                return (
                  <>
                    <div className="mb-5">
                      <div className="font-body text-xs font-800 uppercase tracking-wider text-purple-400">
                        {lang === 'en' ? 'Stripe refund' : lang === 'ua' ? 'Stripe повернення' : 'Stripe возврат'}
                      </div>
                      <h3 className="mt-1 font-display text-2xl font-black text-purple-700">
                        {lang === 'en' ? 'Issue refund' : lang === 'ua' ? 'Оформити повернення' : 'Оформить возврат'}
                      </h3>
                    </div>

                    <div className="grid gap-2 rounded-2xl bg-white/65 p-4 font-body text-sm font-700 text-purple-500">
                      <div>{lang === 'en' ? 'Student' : lang === 'ua' ? 'Учень' : 'Ученик'}: <span className="font-900 text-purple-700">{refundTarget.student.name}</span></div>
                      <div>{lang === 'en' ? 'Plan' : lang === 'ua' ? 'Тариф' : 'Тариф'}: <span className="font-900 text-purple-700">{planLabel}</span></div>
                      <div>{lang === 'en' ? 'Payment amount' : lang === 'ua' ? 'Сума платежу' : 'Сумма платежа'}: <span className="font-900 text-purple-700">{formatMoney(refundTarget.payment.amount_total, refundTarget.payment.currency)}</span></div>
                      <div>{lang === 'en' ? 'Payment date' : lang === 'ua' ? 'Дата платежу' : 'Дата платежа'}: {formatDate(refundTarget.payment.paid_at)}</div>
                      <div className="break-all">Stripe payment/invoice ID: {refundTarget.payment.stripe_payment_intent_id || refundTarget.payment.stripe_invoice_id || '—'}</div>
                      <div>{lang === 'en' ? 'Available to refund' : lang === 'ua' ? 'Доступно для повернення' : 'Доступно для возврата'}: <span className="font-900 text-green-700">{formatMoney(summary.availableAmount, refundTarget.payment.currency)}</span></div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {(['full', 'partial'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRefundType(type)}
                          className={`rounded-2xl border px-4 py-3 text-left font-body text-sm font-800 transition ${refundType === type ? 'border-purple-200 bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg' : 'border-purple-100 bg-white/70 text-purple-600 hover:bg-pink-50'}`}
                        >
                          {type === 'full'
                            ? (lang === 'en' ? 'Full refund' : lang === 'ua' ? 'Повне повернення' : 'Полный возврат')
                            : (lang === 'en' ? 'Partial refund' : lang === 'ua' ? 'Часткове повернення' : 'Частичный возврат')}
                        </button>
                      ))}
                    </div>

                    {refundType === 'partial' && (
                      <label className="mt-4 block">
                        <span className="mb-1 block font-body text-xs font-800 text-purple-500">
                          {lang === 'en' ? 'Refund amount' : lang === 'ua' ? 'Сума повернення' : 'Сумма возврата'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={refundAmount}
                          onChange={event => setRefundAmount(event.target.value)}
                          className="input-magic w-full"
                        />
                      </label>
                    )}

                    <label className="mt-4 block">
                      <span className="mb-1 block font-body text-xs font-800 text-purple-500">
                        {lang === 'en' ? 'Reason, required' : lang === 'ua' ? 'Причина, обовʼязково' : 'Причина, обязательно'}
                      </span>
                      <textarea
                        value={refundReason}
                        onChange={event => setRefundReason(event.target.value)}
                        className="input-magic min-h-24 w-full resize-none"
                        placeholder={lang === 'en' ? 'Why is this payment refunded?' : lang === 'ua' ? 'Чому оформлюється повернення?' : 'Почему оформляется возврат?'}
                      />
                    </label>

                    <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 font-body text-xs font-700 text-amber-700">
                      {lang === 'en'
                        ? 'Lessons are not changed automatically. Use lesson adjustment after the refund if needed.'
                        : lang === 'ua'
                          ? 'Уроки не змінюються автоматично. За потреби використайте ручну корекцію після повернення.'
                          : 'Уроки не меняются автоматически. При необходимости используйте ручную корректировку после возврата.'}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                      <button disabled={refundSaving} onClick={() => setRefundTarget(null)} className="btn-outline px-5 py-2.5 font-display text-sm font-bold disabled:opacity-60">
                        {t(lang, 'admin_cancel')}
                      </button>
                      <button disabled={refundSaving || summary.availableAmount <= 0} onClick={submitRefund} className="rounded-full bg-gradient-to-r from-red-400 to-pink-400 px-5 py-2.5 font-display text-sm font-bold text-white shadow-lg disabled:opacity-60">
                        {refundSaving ? '...' : (lang === 'en' ? 'Issue refund' : lang === 'ua' ? 'Оформити повернення' : 'Оформить возврат')}
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-50, x:'-50%' }} animate={{ opacity:1, y:0, x:'-50%' }} exit={{ opacity:0, y:-50, x:'-50%' }}
            className={`fixed top-6 left-1/2 z-50 px-6 py-3 rounded-2xl font-body font-600 text-white shadow-2xl ${toast.type==='success'?'bg-gradient-to-r from-green-400 to-teal-400':'bg-gradient-to-r from-red-400 to-pink-400'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-purple-100" style={{ boxShadow:'0 4px 20px rgba(150,100,200,0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-display font-black text-xl bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Vetoschool</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex gap-1 bg-white/60 rounded-full px-1 py-1">
              {langs.map(l => (
                <button key={l} onClick={() => handleSetLang(l)}
                  className={`px-2.5 py-1 rounded-full text-xs font-body font-700 uppercase transition-all ${lang===l?'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow':'text-purple-500 hover:text-purple-700'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-purple-100 px-3 py-1.5 rounded-full">
              <span>👑</span>
              <span className="font-body font-600 text-purple-700 text-sm">Admin</span>
            </div>
            <button onClick={handleLogout} className="text-xs text-purple-400 hover:text-pink-500 font-body">{t(lang,'nav_logout')}</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome banner */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          className="rounded-3xl p-6 md:p-8 mb-6 text-white relative overflow-hidden"
          style={{ background:'linear-gradient(135deg,#A87EFF 0%,#FF8DC7 100%)' }}>
          <div className="absolute inset-0 opacity-10">
            {[...Array(12)].map((_,i) => <div key={i} className="absolute text-xl" style={{ left:`${(i*8.5)%100}%`, top:`${(i*9.1)%100}%` }}>✨</div>)}
          </div>
          <div className="relative z-10">
            <h1 className="font-display font-black text-2xl md:text-3xl mb-1">{t(lang,'admin_title')}</h1>
            <p className="font-body text-white/80">{t(lang,'admin_sub')}</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label:t(lang,'admin_total'), value:totalStudents, emoji:'👥', color:'from-purple-100 to-violet-100', border:'border-purple-200' },
            { label:t(lang,'admin_active'), value:activeStudents, emoji:'🟢', color:'from-green-100 to-teal-100', border:'border-green-200' },
            { label:t(lang,'admin_pending'), value:pendingStudents, emoji:'🟡', color:'from-yellow-100 to-amber-100', border:'border-yellow-200' },
          ].map((s,i) => (
            <motion.div key={s.label} initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:i*0.1 }}
              className={`bg-gradient-to-br ${s.color} border ${s.border} rounded-3xl p-4 md:p-5 text-center card-hover`}>
              <div className="text-3xl mb-1">{s.emoji}</div>
              <div className="font-display font-black text-3xl text-purple-700">{s.value}</div>
              <div className="font-body text-xs text-purple-500 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Section tabs */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[
            { id:'students' as Section, label:t(lang,'admin_students_tab') },
            { id:'studentCenter' as Section, label:lang === 'en' ? '🏫 Student Center' : lang === 'ua' ? '🏫 Центр учнів' : '🏫 Центр учеников' },
            { id:'subscriptions' as Section, label:lang === 'en' ? 'Subscriptions' : lang === 'ua' ? 'Підписки' : 'Подписки' },
            { id:'teachers' as Section, label:lang === 'en' ? 'Teachers' : lang === 'ua' ? 'Учителі' : 'Учителя' },
            { id:'content' as Section, label:t(lang,'admin_content_tab') },
            { id:'schedule' as Section, label:t(lang,'admin_schedule_tab') },
            { id:'teacherReports' as Section, label:lang === 'en' ? '📝 Reports' : lang === 'ua' ? '📝 Звіти' : '📝 Отчёты' },
            { id:'trialLessons' as Section, label:lang === 'en' ? 'Trial Lessons' : lang === 'ua' ? 'Пробні уроки' : 'Пробные уроки' },
            { id:'workbooks' as Section, label:t(lang,'admin_workbooks_tab') },
            { id:'live' as Section, label:lang === 'en' ? '📡 Live' : lang === 'ua' ? '📡 Live-уроки' : '📡 Live-уроки' },
          ].map(sec => (
            <button key={sec.id} onClick={() => setActiveSection(sec.id)}
              className={`px-6 py-2.5 rounded-2xl font-body font-600 text-sm transition-all ${activeSection===sec.id?'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg':'glass text-purple-600 hover:bg-pink-50'}`}>
              {sec.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ===== STUDENTS ===== */}
          {activeSection === 'students' && (
            <motion.div key="students" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}>
              <div className="glass rounded-3xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder={t(lang,'admin_search')} value={search} onChange={e => setSearch(e.target.value)} className="input-magic flex-1" />
                <div className="flex gap-2">
                  {(['all','active','pending'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-2xl font-body font-600 text-sm transition-all ${filter===f?'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg':'bg-white/60 text-purple-600 hover:bg-pink-50'}`}>
                      {f==='all' ? t(lang,'admin_all_label') : f==='active' ? t(lang,'admin_active_label') : t(lang,'admin_pending_label')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass rounded-3xl overflow-hidden mb-6 border border-white/70 shadow-xl">
                {filtered.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-4">🤔</div>
                    <p className="font-display font-bold text-purple-600 text-xl">{t(lang,'admin_no_students')}</p>
                    <p className="font-body text-purple-400 mt-2">{t(lang,'admin_no_students_desc')}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-purple-100 bg-white/35">
                          {[t(lang,'admin_student'), accessHeader, paymentHeader, t(lang,'admin_actions')].map(h => (
                            <th key={h} className="text-left px-4 md:px-6 py-4 font-display font-bold text-purple-600 text-sm">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {filtered.map((user, i) => {
                            const { avg } = getStudentRating(user.id);
                            return (
                              <motion.tr key={user.id} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}
                                transition={{ delay:i*0.05 }} className="border-b border-purple-50 bg-white/20 hover:bg-pink-50/60 transition-colors">
                                <td className="px-4 md:px-6 py-4 min-w-[260px]">
                                  <div className="flex items-center gap-3">
                                    <UserAvatar user={user} />
                                    <div className="min-w-0">
                                      <div className="font-body font-700 text-purple-700 text-sm">{user.name}</div>
                                      <div className="font-body text-xs text-purple-400 truncate max-w-[210px]">{user.email}</div>
                                      <div className="font-body text-[11px] text-pink-400">
                                        {new Date(user.joinedAt).toLocaleDateString(lang==='en'?'en-GB':lang==='ua'?'uk-UA':'ru-RU', { day:'numeric', month:'short', year:'numeric' })}
                                      </div>
                                      {avg > 0 && (
                                        <div className="flex gap-0.5 mt-0.5">
                                          {[1,2,3,4,5].map(s => <span key={s} className={`text-xs ${s<=Math.round(avg)?'text-yellow-400':'text-gray-200'}`}>★</span>)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 md:px-6 py-4 min-w-[190px]">
                                  <span className={`${statusPillBase} ${accessClasses[user.accessStatus]}`}>
                                    {savingUserId === user.id ? '...' : accessLabels[user.accessStatus]}
                                  </span>
                                  {formatBillingLine(user) && (
                                    <div className="mt-2 max-w-[210px] rounded-2xl border border-purple-100 bg-white/55 px-3 py-2 font-body text-[11px] font-700 leading-snug text-purple-400">
                                      {formatBillingLine(user)}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 md:px-6 py-4 min-w-[190px]">
                                  <span className={`${statusPillBase} ${paymentClasses[user.paymentStatus]}`}>
                                    {savingUserId === user.id ? '...' : paymentLabels[user.paymentStatus]}
                                  </span>
                                  {hasSubscriptionPaymentProblem(user) && (
                                    <div className="mt-2 max-w-[210px] rounded-2xl border border-red-100 bg-red-50/70 px-3 py-2 font-body text-[11px] font-700 leading-snug text-red-500">
                                      {formatPaymentFailedLine(user) || paymentLabels.failed}
                                      <button
                                        type="button"
                                        disabled
                                        className="mt-2 block rounded-full border border-red-200 bg-white/70 px-3 py-1.5 font-display text-[11px] font-bold text-red-500 opacity-75"
                                      >
                                        {updatePaymentMethodLabel}
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 md:px-6 py-4 min-w-[190px]">
                                  <div className="flex items-center gap-2">
                                    {user.hasAccess
                                      ? <button disabled={savingUserId === user.id} onClick={() => handleRevoke(user.id, user.name)} className="text-xs bg-red-100 text-red-500 hover:bg-red-200 px-3 py-2 rounded-2xl font-body font-700 transition-colors whitespace-nowrap disabled:opacity-60">{savingUserId === user.id ? '...' : t(lang,'admin_take')}</button>
                                      : <button disabled={savingUserId === user.id} onClick={() => handleGrant(user.id, user.name)} className="text-xs bg-green-100 text-green-600 hover:bg-green-200 px-3 py-2 rounded-2xl font-body font-700 transition-colors whitespace-nowrap disabled:opacity-60">{savingUserId === user.id ? '...' : t(lang,'admin_give')}</button>
                                    }
                                    <button onClick={() => setDeleteTarget(user)}
                                      disabled={savingUserId === user.id || deleteSaving}
                                      className="w-9 h-9 flex items-center justify-center bg-pink-50 hover:bg-red-100 text-pink-400 hover:text-red-500 rounded-2xl transition-colors text-base disabled:opacity-60" title={t(lang,'admin_delete_title')}>
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid gap-4">
                <div className="glass rounded-3xl p-6">
                  <h3 className="font-display font-bold text-lg text-purple-700 mb-3">{t(lang,'admin_overview')}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-sm text-purple-500">{t(lang,'admin_activation_label')}</span>
                      <span className="font-display font-bold text-purple-700">{totalStudents>0?Math.round((activeStudents/totalStudents)*100):0}%</span>
                    </div>
                    <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-500" style={{ width:`${totalStudents>0?(activeStudents/totalStudents)*100:0}%` }} />
                    </div>
                    <p className="font-body text-xs text-purple-400">{activeStudents} {t(lang,'admin_students_have')} {totalStudents} {t(lang,'admin_students_access')}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'subscriptions' && (
            <motion.div key="subscriptions" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} className="space-y-5">
              <div className="glass rounded-3xl p-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-black text-purple-700">
                      {lang === 'en' ? 'Subscription management' : lang === 'ua' ? 'Керування підписками' : 'Управление подписками'}
                    </h2>
                    <p className="font-body text-sm font-600 text-purple-400">
                      {lang === 'en' ? 'Profiles, Stripe payments and webhook status in one compact view.' : lang === 'ua' ? 'Профілі, Stripe-оплати та статуси webhook в одному компактному розділі.' : 'Профили, Stripe-оплаты и статусы webhook в одном компактном разделе.'}
                    </p>
                  </div>
                  <button onClick={() => refreshSubscriptionHistory().then(() => showToast(lang === 'en' ? 'Payment history refreshed' : lang === 'ua' ? 'Історію платежів оновлено' : 'История платежей обновлена')).catch(error => { console.error(error); showToast(friendlyActionError(error), 'error'); })} className="rounded-2xl bg-white/70 px-4 py-2 font-body text-xs font-800 text-purple-600 shadow-sm hover:bg-pink-50">
                    {lang === 'en' ? 'Refresh payments' : lang === 'ua' ? 'Оновити платежі' : 'Обновить платежи'}
                  </button>
                </div>

                <div className="grid gap-3 lg:grid-cols-5">
                  <input
                    type="text"
                    value={subscriptionFilters.query}
                    onChange={event => setSubscriptionFilter('query', event.target.value)}
                    placeholder={lang === 'en' ? 'Search by name or email' : lang === 'ua' ? 'Пошук за імʼям або email' : 'Поиск по имени или email'}
                    className="input-magic lg:col-span-2"
                  />
                  <Select value={subscriptionFilters.planId} onValueChange={value => setSubscriptionFilter('planId', value)}>
                    <SelectTrigger className="input-magic h-auto"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">
                      <SelectItem value="all">{lang === 'en' ? 'All plans' : lang === 'ua' ? 'Усі тарифи' : 'Все тарифы'}</SelectItem>
                      {subscriptionPlanOptions.map(planId => <SelectItem key={planId} value={planId}>{formatPlanLabel(planId)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={subscriptionFilters.lessonFormat} onValueChange={value => setSubscriptionFilter('lessonFormat', value)}>
                    <SelectTrigger className="input-magic h-auto"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">
                      <SelectItem value="all">{lang === 'en' ? 'All formats' : lang === 'ua' ? 'Усі формати' : 'Все форматы'}</SelectItem>
                      {subscriptionFormatOptions.map(format => <SelectItem key={format} value={format}>{formatLessonFormatLabel(format)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={subscriptionFilters.paymentStatus} onValueChange={value => setSubscriptionFilter('paymentStatus', value)}>
                    <SelectTrigger className="input-magic h-auto"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">
                      <SelectItem value="all">{lang === 'en' ? 'All payments' : lang === 'ua' ? 'Усі оплати' : 'Все оплаты'}</SelectItem>
                      {subscriptionPaymentStatusOptions.map(status => <SelectItem key={status} value={status}>{paymentLabels[status as PaymentStatus] || status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-5">
                  <Select value={subscriptionFilters.subscriptionStatus} onValueChange={value => setSubscriptionFilter('subscriptionStatus', value)}>
                    <SelectTrigger className="input-magic h-auto"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95">
                      <SelectItem value="all">{lang === 'en' ? 'All subscription statuses' : lang === 'ua' ? 'Усі статуси підписки' : 'Все статусы подписки'}</SelectItem>
                      {subscriptionStatusOptions.map(status => <SelectItem key={status} value={status}>{formatSubscriptionStatusOption(status)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="glass overflow-hidden rounded-3xl border border-white/70 shadow-xl">
                {filteredSubscriptions.length === 0 ? (
                  <div className="px-6 py-12 text-center font-display text-lg font-bold text-purple-500">
                    {lang === 'en' ? 'No subscriptions found' : lang === 'ua' ? 'Підписки не знайдено' : 'Подписки не найдены'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-purple-100 bg-white/35">
                          {[
                            lang === 'en' ? 'Student' : lang === 'ua' ? 'Учень' : 'Ученик',
                            lang === 'en' ? 'Plan' : lang === 'ua' ? 'Тариф' : 'Тариф',
                            lang === 'en' ? 'Status' : lang === 'ua' ? 'Статус' : 'Статус',
                            lang === 'en' ? 'Lessons' : lang === 'ua' ? 'Уроки' : 'Уроки',
                            lang === 'en' ? 'Period' : lang === 'ua' ? 'Період' : 'Период',
                            lang === 'en' ? 'Last payments' : lang === 'ua' ? 'Останні платежі' : 'Последние платежи',
                            t(lang, 'admin_actions'),
                          ].map(header => (
                            <th key={header} className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wide text-purple-500">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubscriptions.map(row => {
                          const student = row.user;
                          return (
                            <tr key={student.id} className="border-b border-purple-50 bg-white/20 align-top hover:bg-pink-50/60">
                              <td className="min-w-[230px] px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <UserAvatar user={student} />
                                  <div className="min-w-0">
                                    <div className="truncate font-body text-sm font-800 text-purple-700">{student.name}</div>
                                    <div className="truncate font-body text-xs text-purple-400">{student.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="min-w-[170px] px-4 py-4 font-body text-xs font-700 text-purple-500">
                                <div className="text-sm font-800 text-purple-700">{formatPlanLabel(student.planId)}</div>
                                <div>{formatLessonFormatLabel(student.lessonFormat)}</div>
                              </td>
                              <td className="min-w-[190px] px-4 py-4">
                                <div className={`inline-flex rounded-2xl border px-3 py-1.5 font-body text-xs font-800 ${billingStatusClass(activeSubscriptionStatus({ paymentStatus: student.paymentStatus, subscriptionStatus: student.subscriptionStatus, stripeCustomerId: student.stripeCustomerId, stripeSubscriptionId: student.stripeSubscriptionId, cancelAtPeriodEnd: student.cancelAtPeriodEnd, manualAccessOverride: student.manualAccessOverride, accessStatus: student.accessStatus }))}`}>
                                  {subscriptionStatusLabel(student)}
                                </div>
                                <div className="mt-2 font-body text-xs font-700 text-purple-400">
                                  {hasConfirmedStripePayment({ paymentStatus: student.paymentStatus, stripeCustomerId: student.stripeCustomerId, stripeSubscriptionId: student.stripeSubscriptionId })
                                    ? paymentLabels.paid
                                    : student.paymentStatus === 'failed'
                                      ? paymentLabels.failed
                                      : lang === 'en' ? 'No confirmed Stripe payment' : lang === 'ua' ? 'Немає підтвердженої Stripe-оплати' : 'Нет подтверждённой Stripe-оплаты'}
                                </div>
                                <div className="mt-1 font-body text-[11px] font-700 text-purple-300">
                                  {lang === 'en' ? 'Ends at period end' : lang === 'ua' ? 'Скасується в кінці періоду' : 'Отменится в конце периода'}: {student.cancelAtPeriodEnd ? (lang === 'en' ? 'yes' : lang === 'ua' ? 'так' : 'да') : (lang === 'en' ? 'no' : lang === 'ua' ? 'ні' : 'нет')}
                                </div>
                              </td>
                              <td className="min-w-[120px] px-4 py-4 font-display text-xl font-black text-purple-700">
                                {student.lessonsRemaining ?? 0}/{student.lessonsTotal ?? 0}
                              </td>
                              <td className="min-w-[210px] px-4 py-4 font-body text-xs font-700 text-purple-500">
                                <div>{formatPeriod(student.currentPeriodStart, student.currentPeriodEnd)}</div>
                                <div className="mt-1 text-purple-300">{lang === 'en' ? 'Next' : lang === 'ua' ? 'Наступний' : 'Следующий'}: {formatDate(student.nextPaymentDate)}</div>
                                {(student.cancelAtPeriodEnd || student.subscriptionStatus === 'canceled') && (
                                  <div className="mt-1 text-amber-700">{paidPeriodEndLabel}: {formatDate(student.currentPeriodEnd)}</div>
                                )}
                              </td>
                              <td className="min-w-[180px] px-4 py-4 font-body text-xs font-700 text-purple-500">
                                <div>{lang === 'en' ? 'Paid' : lang === 'ua' ? 'Оплачено' : 'Оплачено'}: {formatDate(row.lastSuccessfulPaymentAt)}</div>
                                <div className="mt-1 text-red-500">{paymentFailedLabel}: {formatDate(row.lastFailedPaymentAt)}</div>
                              </td>
                              <td className="min-w-[250px] px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <button onClick={() => setProfileTarget(student)} className="rounded-2xl bg-white/70 px-3 py-2 font-body text-xs font-800 text-purple-600 hover:bg-pink-50">
                                    {lang === 'en' ? 'Profile' : lang === 'ua' ? 'Профіль' : 'Профиль'}
                                  </button>
                                  <button onClick={() => setSelectedSubscriptionUserId(student.id)} className="rounded-2xl bg-purple-100 px-3 py-2 font-body text-xs font-800 text-purple-700 hover:bg-purple-200">
                                    {lang === 'en' ? 'History' : lang === 'ua' ? 'Історія' : 'История'}
                                  </button>
                                  <button onClick={() => openLessonAdjustment(student)} className="rounded-2xl bg-green-100 px-3 py-2 font-body text-xs font-800 text-green-700 hover:bg-green-200">
                                    {lang === 'en' ? 'Adjust lessons' : lang === 'ua' ? 'Корекція уроків' : 'Корректировать уроки'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedSubscriptionRow && (
                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <section className="glass rounded-3xl p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-black text-purple-700">{selectedSubscriptionRow.user.name}</h3>
                        <p className="font-body text-xs text-purple-400">{selectedSubscriptionRow.user.email}</p>
                      </div>
                      <button onClick={() => setSelectedSubscriptionUserId(null)} className="rounded-full bg-white/70 px-3 py-1 font-body text-xs font-800 text-purple-400 hover:text-pink-500">x</button>
                    </div>
                    <div className="grid gap-3 font-body text-xs font-700 text-purple-500">
                      {[
                        ['Stripe customer ID', selectedSubscriptionRow.user.stripeCustomerId],
                        ['Stripe subscription ID', selectedSubscriptionRow.user.stripeSubscriptionId],
                        ['Stripe price ID', selectedSubscriptionRow.user.stripePriceId],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-purple-100 bg-white/60 p-3">
                          <div className="mb-1 text-purple-300">{label}</div>
                          <div className="break-all text-purple-700">{value || '—'}</div>
                          {value && <button onClick={() => copyStripeId(value)} className="mt-2 rounded-xl bg-purple-100 px-3 py-1.5 text-[11px] font-800 text-purple-600 hover:bg-purple-200">{lang === 'en' ? 'Copy' : lang === 'ua' ? 'Копіювати' : 'Копировать'}</button>}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-2 rounded-2xl bg-white/60 p-4 font-body text-sm font-700 text-purple-500">
                      <div>{lang === 'en' ? 'Current lesson balance' : lang === 'ua' ? 'Поточний залишок уроків' : 'Текущий остаток уроков'}: <span className="font-black text-purple-700">{selectedSubscriptionRow.user.lessonsRemaining ?? 0}/{selectedSubscriptionRow.user.lessonsTotal ?? 0}</span></div>
                      <div>{lang === 'en' ? 'Period' : lang === 'ua' ? 'Період' : 'Период'}: {formatPeriod(selectedSubscriptionRow.user.currentPeriodStart, selectedSubscriptionRow.user.currentPeriodEnd)}</div>
                      <div>{lang === 'en' ? 'Cancellation status' : lang === 'ua' ? 'Статус скасування' : 'Статус отмены'}: {selectedSubscriptionRow.user.cancelAtPeriodEnd ? subscriptionStatusLabel(selectedSubscriptionRow.user) : (selectedSubscriptionRow.user.subscriptionStatus === 'canceled' ? subscriptionStatusLabel(selectedSubscriptionRow.user) : '—')}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setProfileTarget(selectedSubscriptionRow.user)} className="rounded-2xl bg-white/70 px-3 py-2 font-body text-xs font-800 text-purple-600 hover:bg-pink-50">
                        {lang === 'en' ? 'Open profile' : lang === 'ua' ? 'Відкрити профіль' : 'Открыть профиль'}
                      </button>
                      <button disabled={!selectedSubscriptionRow.user.stripeCustomerId} onClick={() => openStripeCustomer(selectedSubscriptionRow.user.stripeCustomerId)} className="rounded-2xl bg-purple-100 px-3 py-2 font-body text-xs font-800 text-purple-700 hover:bg-purple-200 disabled:opacity-50">
                        Open Stripe customer
                      </button>
                      <button disabled={!selectedSubscriptionRow.user.stripeSubscriptionId} onClick={() => openStripeSubscription(selectedSubscriptionRow.user.stripeSubscriptionId)} className="rounded-2xl bg-purple-100 px-3 py-2 font-body text-xs font-800 text-purple-700 hover:bg-purple-200 disabled:opacity-50">
                        Stripe subscription
                      </button>
                    </div>
                  </section>

                  <section className="glass rounded-3xl p-5">
                    <h3 className="mb-4 font-display text-xl font-black text-purple-700">
                      {lang === 'en' ? 'Payment history' : lang === 'ua' ? 'Історія платежів' : 'История платежей'}
                    </h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <h4 className="mb-2 font-body text-xs font-900 uppercase tracking-wide text-green-600">
                          {lang === 'en' ? 'Successful payments' : lang === 'ua' ? 'Успішні оплати' : 'Успешные оплаты'}
                        </h4>
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                          {selectedSubscriptionPayments.length === 0 ? <div className="rounded-2xl bg-white/60 p-4 font-body text-sm text-purple-300">—</div> : selectedSubscriptionPayments.map(payment => {
                            const refundSummary = refundSummaryForPayment(payment);
                            return (
                              <div key={payment.id} className="rounded-2xl border border-green-100 bg-green-50/60 p-3 font-body text-xs font-700 text-green-700">
                                <div className="font-900">{formatDate(payment.paid_at)} · {formatMoney(payment.amount_total, payment.currency)}</div>
                                <div className="mt-1 text-green-600">{formatPlanLabel(payment.plan_id)} · {formatLessonFormatLabel(payment.lesson_format)} · {payment.lessons_total}</div>
                                <div className="mt-1 break-all text-green-500">invoice: {payment.stripe_invoice_id || '—'}</div>
                                <div className={`mt-3 rounded-2xl border px-3 py-2 ${refundSummary.state === 'none' ? 'border-purple-100 bg-white/65 text-purple-400' : refundSummary.state === 'full' ? 'border-purple-100 bg-purple-50 text-purple-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                                  <div className="font-900">{refundStatusLabel(refundSummary)}</div>
                                  {refundSummary.refundedAmount > 0 && (
                                    <div className="mt-1">
                                      {formatMoney(refundSummary.refundedAmount, payment.currency)}
                                      {refundSummary.lastRefund ? ` · ${formatDate(refundSummary.lastRefund.created_at)} · ${refundSummary.lastRefund.status}` : ''}
                                    </div>
                                  )}
                                  {refundSummary.lastRefund?.reason && (
                                    <div className="mt-1 text-[11px]">{refundSummary.lastRefund.reason}</div>
                                  )}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    disabled={refundSummary.availableAmount <= 0}
                                    onClick={() => selectedSubscriptionRow && openRefundModal(payment, selectedSubscriptionRow.user)}
                                    className="rounded-xl bg-red-100 px-3 py-1.5 font-body text-[11px] font-900 text-red-600 hover:bg-red-200 disabled:opacity-50"
                                  >
                                    {lang === 'en' ? 'Issue refund' : lang === 'ua' ? 'Оформити повернення' : 'Оформить возврат'}
                                  </button>
                                  {refundSummary.refundedAmount > 0 && selectedSubscriptionRow && (
                                    <button onClick={() => openLessonAdjustment(selectedSubscriptionRow.user)} className="rounded-xl bg-green-100 px-3 py-1.5 font-body text-[11px] font-900 text-green-700 hover:bg-green-200">
                                      {lang === 'en' ? 'Adjust lesson balance' : lang === 'ua' ? 'Скоригувати залишок уроків' : 'Скорректировать остаток уроков'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-2 font-body text-xs font-900 uppercase tracking-wide text-red-600">
                          {lang === 'en' ? 'Failed payments' : lang === 'ua' ? 'Неуспішні оплати' : 'Неуспешные оплаты'}
                        </h4>
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                          {selectedSubscriptionFailures.length === 0 ? <div className="rounded-2xl bg-white/60 p-4 font-body text-sm text-purple-300">—</div> : selectedSubscriptionFailures.map(failure => (
                            <div key={failure.id} className="rounded-2xl border border-red-100 bg-red-50/70 p-3 font-body text-xs font-700 text-red-600">
                              <div className="font-900">{formatDate(failure.created_at)} · {formatMoney(failure.amount_due, failure.currency)}</div>
                              <div className="mt-1">{lang === 'en' ? 'Status' : lang === 'ua' ? 'Статус' : 'Статус'}: {failure.status}</div>
                              <div className="mt-1 break-all text-red-400">invoice: {failure.stripe_invoice_id}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'studentCenter' && (
            <SchoolStudentCenter lang={lang} users={users} />
          )}

          {/* ===== TEACHERS ===== */}
          {activeSection === 'teachers' && (
            <TeachersAdmin lang={lang} students={users} onToast={showToast} />
          )}

          {/* ===== CONTENT & GRADES ===== */}
          {activeSection === 'content' && (
            <motion.div key="content" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}>
              <TeacherContentPlanner lang={lang} users={users} onToast={showToast} />
              <div className="glass rounded-3xl p-6 mb-6">
                <h3 className="font-display font-bold text-xl text-purple-700 mb-1">{t(lang,'admin_content_title')}</h3>
                <p className="font-body text-sm text-purple-400 mb-6">{t(lang,'admin_content_desc')}</p>

                <div className="mb-6">
                  <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang,'admin_select_student')}</label>
                  <Select value={contentUserId || undefined} onValueChange={v => { setContentUserId(v); setEditingId(null); setShowNewModule(false); setShowNewExtra(false); }}>
                    <SelectTrigger className="input-magic h-auto"><SelectValue placeholder={`— ${t(lang,'admin_select_student')} —`} /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95 backdrop-blur">
                      {users.map(u => <SelectItem key={u.id} value={u.id} className="rounded-xl font-body">{u.name} ({u.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {!contentUserId && (
                  <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-white via-pink-50/60 to-purple-50/70 p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">📂</span>
                      <div>
                        <h4 className="font-display text-xl font-black text-purple-700">
                          {lang === 'en' ? 'Choose a student' : lang === 'ua' ? 'Оберіть учня' : 'Выберите ученика'}
                        </h4>
                        <p className="mt-1 font-body text-sm font-600 text-purple-400">
                          {lang === 'en'
                            ? 'Select a student to view content, grades and progress. Empty values are hidden until a student is selected.'
                            : lang === 'ua'
                              ? 'Оберіть учня, щоб переглянути контент, оцінки та прогрес. Порожні значення приховані до вибору учня.'
                              : 'Выберите ученика, чтобы увидеть контент, оценки и прогресс. Пустые значения не показываются как реальные данные.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {contentUserId && (
                  <AnimatePresence>
                    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
                      {/* Modules list */}
                      <div className="space-y-6 mb-6">
                        {moduleIds.map(moduleId => {
                          const items = contentItems.filter(i => i.moduleId === moduleId);
                          const { badge, title: modTitle, isExtra } = getModuleLabel(moduleId);
                          const bgClass = isExtra
                            ? moduleId.startsWith('grammar-')
                              ? 'bg-gradient-to-br from-yellow-50 to-amber-50/60 border-yellow-100'
                              : 'bg-gradient-to-br from-green-50 to-teal-50/60 border-green-100'
                            : 'bg-white/60 border-purple-100';
                          const badgeClass = isExtra
                            ? moduleId.startsWith('grammar-')
                              ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                              : 'bg-gradient-to-br from-green-400 to-teal-500'
                            : 'bg-gradient-to-br from-pink-400 to-purple-400';
                          return (
                            <div key={moduleId} className={`rounded-3xl p-5 border ${bgClass}`}>
                              <div className="flex items-center justify-between mb-4 gap-3">
                                <h4 className="font-display font-bold text-purple-700 text-lg flex items-center gap-2">
                                  <span className={`w-9 h-9 rounded-full text-white flex items-center justify-center font-black text-sm flex-shrink-0 ${badgeClass}`}>
                                    {badge}
                                  </span>
                                  {modTitle}
                                </h4>
                                <button
                                  onClick={() => handleDeleteModule(moduleId)}
                                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-body font-600 transition-all whitespace-nowrap ${confirmDeleteModule===moduleId?'bg-red-500 text-white shadow-lg':'glass text-red-500 hover:bg-red-50 border border-red-100'}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {confirmDeleteModule===moduleId
                                    ? (lang==='en'?'Sure?':lang==='ua'?'Впевнені?':'Уверены?')
                                    : (lang==='en'?'Delete block':lang==='ua'?'Видалити блок':'Удалить блок')}
                                </button>
                              </div>
                              <div className="space-y-3">
                                {items.map(item => (
                                  <div key={item.id} className="bg-white rounded-2xl p-4 border border-purple-50 shadow-sm">
                                    <div className="flex items-start gap-3 mb-2">
                                      <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-body font-600 ${typeBadge(item.type)}`}>{typeLabel(item.type)}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-body font-600 ${item.unlocked?'bg-green-100 text-green-600':'bg-gray-100 text-gray-500'}`}>
                                            {item.unlocked ? t(lang,'admin_unlocked_label') : t(lang,'admin_locked_label')}
                                          </span>
                                        </div>
                                        <p className="font-body font-600 text-purple-700 text-sm">{item.title}</p>
                                        {item.fileName && <p className="font-body text-xs text-purple-400 truncate mt-0.5">📎 {item.fileName}</p>}
                                        {item.dueDate && <p className="font-body text-xs text-purple-400 mt-0.5">📅 {t(lang,'dash_due')} {new Date(item.dueDate).toLocaleDateString(lang==='en'?'en-GB':lang==='ua'?'uk-UA':'ru-RU')}</p>}
                                        {item.scheduledDate && <p className="font-body text-xs text-blue-400 mt-0.5">🗓 {item.scheduledDate} {item.scheduledTime}</p>}
                                        {item.type === 'listening' && (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            <button onClick={() => generateListeningAudio(item)} disabled={listeningAudioBusyId === item.id}
                                              className="inline-flex items-center gap-1.5 rounded-xl bg-pink-50 px-3 py-1.5 font-body text-xs font-800 text-pink-600 transition hover:bg-pink-100 disabled:opacity-60">
                                              {listeningAudioBusyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.fileUrl ? <RefreshCw className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
                                              {item.fileUrl ? (lang === 'en' ? 'Regenerate audio' : lang === 'ua' ? 'Перегенерувати аудіо' : 'Перегенерировать аудио') : (lang === 'en' ? 'Generate audio' : lang === 'ua' ? 'Згенерувати аудіо' : 'Сгенерировать аудио')}
                                            </button>
                                            {item.fileUrl && (
                                              <button onClick={() => deleteListeningAudio(item)} disabled={listeningAudioBusyId === item.id}
                                                className="rounded-xl border border-red-100 bg-white px-3 py-1.5 font-body text-xs font-800 text-red-400 transition hover:bg-red-50 disabled:opacity-60">
                                                {lang === 'en' ? 'Delete audio' : lang === 'ua' ? 'Видалити аудіо' : 'Удалить аудио'}
                                              </button>
                                            )}
                                          </div>
                                        )}
                                        {item.starRating && item.starRating > 0 && (
                                          <div className="flex gap-0.5 mt-1">{[1,2,3,4,5].map(s => <span key={s} className={`text-sm ${s<=item.starRating!?'text-yellow-400':'text-gray-200'}`}>★</span>)}</div>
                                        )}
                                      </div>
                                      <div className="flex gap-2 flex-shrink-0">
                                        <button onClick={() => toggleUnlock(item.id, item.unlocked)}
                                          className={`text-xs px-3 py-1.5 rounded-xl font-body font-600 transition-colors whitespace-nowrap ${item.unlocked?'bg-red-100 text-red-500 hover:bg-red-200':'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                                          {item.unlocked ? t(lang,'admin_close_btn') : t(lang,'admin_open_btn')}
                                        </button>
                                        <button onClick={() => editingId===item.id ? setEditingId(null) : startEdit(item)}
                                          className="text-xs bg-purple-100 text-purple-600 hover:bg-purple-200 px-3 py-1.5 rounded-xl font-body font-600 transition-colors">
                                          ✏️
                                        </button>
                                        <button onClick={() => handleDeleteItem(item.id)}
                                          title={lang==='en'?'Delete':lang==='ua'?'Видалити':'Удалить'}
                                          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl font-body font-600 transition-all ${confirmDeleteItem===item.id?'bg-red-500 text-white shadow':'bg-red-50 text-red-500 hover:bg-red-100 border border-red-100'}`}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                          {confirmDeleteItem===item.id && <span>{lang==='en'?'Sure?':lang==='ua'?'Впевнені?':'Уверены?'}</span>}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Inline editor */}
                                    <AnimatePresence>
                                      {editingId === item.id && (
                                        <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                                          className="border-t border-purple-100 pt-4 space-y-3">
                                          {renderContentTargetPicker(contentTargetText.editTitle, editTargetMode, setEditTargetMode, editSelectedIds, setEditSelectedIds)}
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_title_label')}</label>
                                              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input-magic text-sm py-2" />
                                            </div>
                                            <div>
                                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_emoji_label')}</label>
                                              <input type="text" value={editEmoji} onChange={e => setEditEmoji(e.target.value)} className="input-magic text-sm py-2" maxLength={4} />
                                            </div>
                                          </div>
                                          {item.type === 'homework' && (
                                            <div>
                                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_due_label')}</label>
                                              <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="input-magic text-sm py-2" />
                                            </div>
                                          )}
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_date_label')}</label>
                                              <input type="date" value={editSchedDate} onChange={e => setEditSchedDate(e.target.value)} className="input-magic text-sm py-2" />
                                            </div>
                                            <div>
                                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_time_label')}</label>
                                              <input type="time" value={editSchedTime} onChange={e => setEditSchedTime(e.target.value)} className="input-magic text-sm py-2" />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="font-body text-xs text-purple-500 font-600 mb-2 block">
                                              {item.type==='listening' ? t(lang,'admin_file_audio_label') : t(lang,'admin_file_label')}
                                            </label>
                                            <div className="space-y-2">
                                              <FileBtn id={`edit-${item.id}`}
                                                accept={item.type==='listening'?'audio/*,image/*,application/pdf':'image/*,application/pdf,.doc,.docx,.ppt,.pptx,audio/*'}
                                                label={item.type==='listening' ? t(lang,'admin_attach_audio_btn') : t(lang,'admin_attach_btn')}
                                                onFile={(d,n) => { setEditFileDataUrl(d); setEditFileName(n); }} />
                                              {editFileName && (
                                                <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
                                                  <span className="text-green-500 text-sm">✅</span>
                                                  <span className="font-body text-xs text-green-700 truncate">{editFileName}</span>
                                                  <button onClick={() => { setEditFileDataUrl(''); setEditFileName(''); }} className="text-red-400 hover:text-red-600 ml-auto text-xs">×</button>
                                                </div>
                                              )}
                                            </div>
                                            <input type="url" value={editExternalLink} onChange={e => setEditExternalLink(e.target.value)} placeholder={`🔗 ${linkPlaceholder}`}
                                              className="input-magic text-sm py-2 mt-2" />
                                          </div>
                                          {isGradedContentType(item.type) && (
                                            <div>
                                              <label className="font-body text-xs text-purple-500 font-600 mb-2 block">{t(lang,'admin_stars_label')}</label>
                                              <StarPicker value={editStars} onChange={setEditStars} />
                                            </div>
                                          )}
                                          <div className="flex gap-2">
                                            <button onClick={() => saveEdit(item.id, item.type)} disabled={contentSaving} className="btn-magic px-5 py-2 text-white text-sm font-display font-bold disabled:opacity-60">{contentSaving ? '...' : t(lang,'admin_save_changes')}</button>
                                            <button onClick={() => setEditingId(null)} disabled={contentSaving} className="btn-outline px-5 py-2 text-sm font-display font-bold disabled:opacity-60">{t(lang,'admin_cancel_btn')}</button>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add buttons */}
                      {!showNewModule && !showNewExtra && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button onClick={() => setShowNewModule(true)}
                            className="flex-1 py-4 rounded-3xl border-2 border-dashed border-purple-200 text-purple-500 font-display font-bold hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition-all text-sm">
                            {t(lang,'admin_add_module_btn')}
                          </button>
                          <button onClick={() => { setNewExtraType('grammar'); setNewExtraEmoji('📝'); setShowNewExtra(true); }}
                            className="flex-1 py-4 rounded-3xl border-2 border-dashed border-yellow-200 text-yellow-600 font-display font-bold hover:border-yellow-400 hover:bg-yellow-50 transition-all text-sm">
                            {t(lang,'admin_add_grammar_btn')}
                          </button>
                          <button onClick={() => { setNewExtraType('listening'); setNewExtraEmoji('🎧'); setShowNewExtra(true); }}
                            className="flex-1 py-4 rounded-3xl border-2 border-dashed border-green-200 text-green-600 font-display font-bold hover:border-green-400 hover:bg-green-50 transition-all text-sm">
                            {t(lang,'admin_add_listening_btn')}
                          </button>
                          <button onClick={() => { setNewExtraType('checkpoint'); setNewExtraEmoji('🏁'); setShowNewExtra(true); }}
                            className="flex-1 py-4 rounded-3xl border-2 border-dashed border-orange-200 text-orange-600 font-display font-bold hover:border-orange-400 hover:bg-orange-50 transition-all text-sm">
                            {t(lang,'admin_add_checkpoint_btn')}
                          </button>
                        </div>
                      )}

                      {/* New grammar/listening form */}
                      <AnimatePresence>
                        {showNewExtra && (
                          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
                            className={`rounded-3xl p-6 border mt-4 ${
                              newExtraType==='grammar' ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200'
                              : newExtraType==='listening' ? 'bg-gradient-to-br from-green-50 to-teal-50 border-green-200'
                              : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                            }`}>
                            <h4 className="font-display font-bold text-xl text-purple-700 mb-5">
                              {newExtraType==='grammar' ? t(lang,'admin_new_grammar_title')
                                : newExtraType==='listening' ? t(lang,'admin_new_listening_title')
                                : t(lang,'admin_new_checkpoint_title')}
                            </h4>
                            <div className="mb-4">
                              {renderContentTargetPicker(contentTargetText.title, contentTargetMode, setContentTargetMode, contentSelectedIds, setContentSelectedIds)}
                            </div>
                            <div className="bg-white rounded-2xl p-4 border border-purple-100 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_title_label')}</label>
                                  <input type="text" value={newExtraTitle} onChange={e => setNewExtraTitle(e.target.value)} className="input-magic text-sm py-2" />
                                </div>
                                <div>
                                  <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_emoji_label')}</label>
                                  <input type="text" value={newExtraEmoji} onChange={e => setNewExtraEmoji(e.target.value)} className="input-magic text-sm py-2" maxLength={4} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_date_label')}</label>
                                  <input type="date" value={newExtraSchedDate} onChange={e => setNewExtraSchedDate(e.target.value)} className="input-magic text-sm py-2" />
                                </div>
                                <div>
                                  <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_time_label')}</label>
                                  <input type="time" value={newExtraSchedTime} onChange={e => setNewExtraSchedTime(e.target.value)} className="input-magic text-sm py-2" />
                                </div>
                              </div>
                              <div>
                                <label className="font-body text-xs text-purple-500 font-600 mb-2 block">
                                  {newExtraType==='listening' ? t(lang,'admin_file_audio_label') : t(lang,'admin_file_label')}
                                </label>
                                <div className="space-y-2">
                                  <FileBtn id="extra-file-upload"
                                    accept={newExtraType==='listening'?'audio/*,image/*,application/pdf':'image/*,application/pdf,.doc,.docx'}
                                    label={newExtraType==='listening' ? t(lang,'admin_attach_audio_btn') : t(lang,'admin_attach_btn')}
                                    onFile={(d,n) => { setNewExtraFile(d); setNewExtraFileName(n); }} />
                                  {newExtraFileName && (
                                    <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-1.5">
                                      <span className="text-green-500 text-xs">✅</span>
                                      <span className="font-body text-xs text-green-700 truncate">{newExtraFileName}</span>
                                      <button onClick={() => { setNewExtraFile(''); setNewExtraFileName(''); }} className="text-red-400 ml-auto text-xs">×</button>
                                    </div>
                                  )}
                                </div>
                                <input type="url" value={newExtraLink} onChange={e => setNewExtraLink(e.target.value)} placeholder={`🔗 ${linkLabel}`}
                                  className="input-magic text-sm py-2 mt-2" />
                              </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                              <button onClick={addExtra} disabled={contentSaving} className="btn-magic px-6 py-3 text-white font-display font-bold disabled:opacity-60">{contentSaving ? '...' : t(lang,'admin_add_btn')}</button>
                              <button onClick={() => setShowNewExtra(false)} disabled={contentSaving} className="btn-outline px-6 py-3 font-display font-bold disabled:opacity-60">{t(lang,'admin_cancel_btn')}</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* New module form */}
                      <AnimatePresence>
                        {showNewModule && (
                          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
                            className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-6 border border-pink-200 mt-4">
                            <h4 className="font-display font-bold text-xl text-purple-700 mb-5">{t(lang,'admin_new_module_title')}</h4>
                            <div className="mb-4">
                              {renderContentTargetPicker(contentTargetText.title, contentTargetMode, setContentTargetMode, contentSelectedIds, setContentSelectedIds)}
                            </div>
                            {(['lesson','homework','practice'] as const).map(type => {
                              const icons = { lesson:'📚', homework:'✏️', practice:'🎮' };
                              const labelKey = { lesson:'admin_lesson' as const, homework:'admin_homework' as const, practice:'admin_practice' as const };
                              return (
                                <div key={type} className="bg-white rounded-2xl p-4 mb-4 border border-purple-100">
                                  <h5 className="font-display font-bold text-purple-600 mb-3">{icons[type]} {t(lang, labelKey[type])}</h5>
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                      <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_title_label')}</label>
                                      <input type="text" value={newModTitle[type]} onChange={e => setNewModTitle(p => ({ ...p, [type]:e.target.value }))} className="input-magic text-sm py-2" />
                                    </div>
                                    <div>
                                      <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_emoji_label')}</label>
                                      <input type="text" value={newModEmoji[type]} onChange={e => setNewModEmoji(p => ({ ...p, [type]:e.target.value }))} className="input-magic text-sm py-2" maxLength={4} />
                                    </div>
                                  </div>
                                  {type === 'homework' && (
                                    <div className="mb-3">
                                      <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_due_label')}</label>
                                      <input type="date" value={newModDue} onChange={e => setNewModDue(e.target.value)} className="input-magic text-sm py-2" />
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                      <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_date_label')}</label>
                                      <input type="date"
                                        value={type==='lesson'?newModSchedLesson.date:type==='practice'?newModSchedPractice.date:newModSchedHW.date}
                                        onChange={e => { if(type==='lesson') setNewModSchedLesson(p=>({...p,date:e.target.value})); else if(type==='practice') setNewModSchedPractice(p=>({...p,date:e.target.value})); else setNewModSchedHW(p=>({...p,date:e.target.value})); }}
                                        className="input-magic text-sm py-2" />
                                    </div>
                                    <div>
                                      <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_time_label')}</label>
                                      <input type="time"
                                        value={type==='lesson'?newModSchedLesson.time:type==='practice'?newModSchedPractice.time:newModSchedHW.time}
                                        onChange={e => { if(type==='lesson') setNewModSchedLesson(p=>({...p,time:e.target.value})); else if(type==='practice') setNewModSchedPractice(p=>({...p,time:e.target.value})); else setNewModSchedHW(p=>({...p,time:e.target.value})); }}
                                        className="input-magic text-sm py-2" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="font-body text-xs text-purple-500 font-600 mb-2 block">{t(lang,'admin_file_label')}</label>
                                    <div className="space-y-2">
                                      <FileBtn id={`new-mod-${type}-${contentUserId}`}
                                        accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,audio/*"
                                        label={t(lang,'admin_attach_btn')}
                                        onFile={(d,n) => { setNewModFile(p=>({...p,[type]:d})); setNewModFileName(p=>({...p,[type]:n})); }} />
                                      {newModFileName[type] && (
                                        <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-1.5">
                                          <span className="text-green-500 text-xs">✅</span>
                                          <span className="font-body text-xs text-green-700 truncate">{newModFileName[type]}</span>
                                        </div>
                                      )}
                                    </div>
                                    <input type="url" value={newModLink[type]} onChange={e => setNewModLink(p => ({ ...p, [type]: e.target.value }))} placeholder={`🔗 ${linkLabel}`}
                                      className="input-magic text-sm py-2 mt-2" />
                                  </div>
                                </div>
                              );
                            })}
                            <div className="flex gap-3 mt-4">
                              <button onClick={addModule} disabled={contentSaving} className="btn-magic px-6 py-3 text-white font-display font-bold disabled:opacity-60">{contentSaving ? '...' : t(lang,'admin_create_module')}</button>
                              <button onClick={() => setShowNewModule(false)} disabled={contentSaving} className="btn-outline px-6 py-3 font-display font-bold disabled:opacity-60">{t(lang,'admin_cancel_btn')}</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* All students overview */}
              {users.length > 0 && (
                <div className="glass rounded-3xl p-6">
                  <h3 className="font-display font-bold text-lg text-purple-700 mb-4">{t(lang,'admin_all_students')}</h3>
                  <div className="space-y-3">
                    {users.map(u => {
                      const items = ensureStudentContent(u.id);
                      const unlocked = items.filter(i => i.unlocked).length;
                      const { avg } = getStudentRating(u.id);
                      return (
                        <div key={u.id} className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl">
                          <UserAvatar user={u} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="font-body font-600 text-purple-700 text-sm">{u.name}</div>
                            <div className="font-body text-xs text-purple-400">{unlocked}/{items.length} {t(lang,'admin_unlocked_of')}{avg>0?` · ⭐ ${avg}`:''}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setContentUserId(u.id); setEditingId(null); }}
                              className="text-xs bg-purple-100 text-purple-600 hover:bg-purple-200 px-3 py-1.5 rounded-xl font-body font-600 transition-colors">
                              {t(lang,'admin_edit_btn')}
                            </button>
                            <button onClick={() => setProfileTarget(u)}
                              className="text-xs bg-pink-100 text-pink-600 hover:bg-pink-200 px-3 py-1.5 rounded-xl font-body font-600 transition-colors">
                              {t(lang,'admin_profile_btn')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ===== SCHEDULE ===== */}
          {activeSection === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}>
              <TeacherLessonPlanner lang={lang} users={users} onToast={showToast} />
              <div className="glass rounded-3xl p-6 mb-6">
                <h3 className="font-display font-bold text-xl text-purple-700 mb-1">{t(lang,'admin_schedule_title')}</h3>
                <p className="font-body text-sm text-purple-400 mb-6">{t(lang,'admin_schedule_desc')}</p>
                <div className="mb-6">
                  <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang,'admin_select_student')}</label>
                  <Select value={schedUserId || undefined} onValueChange={v => setSchedUserId(v)}>
                    <SelectTrigger className="input-magic h-auto"><SelectValue placeholder={`— ${t(lang,'admin_select_student')} —`} /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95 backdrop-blur">
                      {users.map(u => <SelectItem key={u.id} value={u.id} className="rounded-xl font-body">{u.name} ({u.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {schedUserId && (
                  <AnimatePresence>
                    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
                      {(() => {
                        const upcoming = slots.filter(s => !s.isConducted);
                        const conducted = slots.filter(s => s.isConducted);
                        const renderRow = (slot: ScheduleSlot, i: number) => (
                          <motion.div key={slot.id} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.05 }}
                            className={`flex flex-col sm:flex-row gap-3 p-4 rounded-2xl border ${slot.isConducted ? 'bg-green-50/70 border-green-200' : 'bg-white/70 border-purple-100'}`}>
                            <div className="flex items-center sm:items-end pt-1 sm:pt-0">
                              <label className="inline-flex items-center gap-2 cursor-pointer select-none" title={t(lang,'sched_conducted_label')}>
                                <input type="checkbox" checked={slot.isConducted} onChange={() => toggleConducted(slot)}
                                  className="w-5 h-5 accent-green-500 cursor-pointer" />
                                <span className="font-body text-xs text-purple-500 sm:hidden">{t(lang,'sched_conducted_label')}</span>
                              </label>
                            </div>
                            <div className="flex-1">
                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_day')}</label>
                              <Select value={slot.day} onValueChange={v => updateSlot(slot.id,'day',v)}>
                                <SelectTrigger className="input-magic h-auto text-sm py-2"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-2xl border-2 border-purple-200 bg-white/95 backdrop-blur">
                                  {DAYS_EN.map(d => <SelectItem key={d} value={d} className="rounded-xl font-body">{d}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-full sm:w-32">
                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_time')}</label>
                              <input type="time" value={slot.time} onChange={e => updateSlot(slot.id,'time',e.target.value)} className="input-magic text-sm py-2" />
                            </div>
                            <div className="flex-1">
                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_topic')}</label>
                              <input type="text" value={slot.topic} onChange={e => updateSlot(slot.id,'topic',e.target.value)} placeholder="Colors & Shapes" className="input-magic text-sm py-2" />
                            </div>
                            <div className="flex items-end">
                              <button onClick={() => setSlotDeleteTarget(slot)} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-sm font-body font-600 transition-colors">{t(lang,'admin_remove')}</button>
                            </div>
                          </motion.div>
                        );
                        return (
                          <>
                            <div className="mb-5">
                              <h4 className="font-display font-bold text-purple-700 mb-2">📅 {t(lang,'sched_upcoming')} <span className="text-xs text-purple-400 font-body font-600">({upcoming.length})</span></h4>
                              <div className="space-y-3">
                                {upcoming.length === 0 && (
                                  <div className="text-center py-6 bg-purple-50 rounded-2xl">
                                    <p className="font-body text-purple-400 text-sm">{t(lang,'admin_no_slots')}</p>
                                  </div>
                                )}
                                {upcoming.map((s, i) => renderRow(s, i))}
                              </div>
                            </div>
                            {conducted.length > 0 && (
                              <details className="mb-4 group" open>
                                <summary className="cursor-pointer list-none">
                                  <h4 className="font-display font-bold text-green-700 mb-2 inline-flex items-center gap-2">
                                    <span className="transition-transform group-open:rotate-90">▶</span>
                                    ✅ {t(lang,'sched_conducted')} <span className="text-xs text-green-500 font-body font-600">({conducted.length})</span>
                                  </h4>
                                </summary>
                                <div className="space-y-3 mt-2">
                                  {conducted.map((s, i) => renderRow(s, i))}
                                </div>
                              </details>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex gap-3">
                        <button onClick={addSlot} className="btn-outline px-5 py-2.5 text-sm font-display font-bold">{t(lang,'admin_add_slot')}</button>
                        <button onClick={saveSchedule} className="btn-magic px-6 py-2.5 text-white text-sm font-display font-bold">{t(lang,'admin_save_schedule')}</button>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {users.length > 0 && (
                <div className="glass rounded-3xl p-6">
                  <h3 className="font-display font-bold text-lg text-purple-700 mb-4">{t(lang,'admin_all_schedules')}</h3>
                  <div className="space-y-3">
                    {users.map(u => {
                      const sched = getStudentSchedule(u.id);
                      return (
                        <div key={u.id} className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl">
                          <UserAvatar user={u} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="font-body font-600 text-purple-700 text-sm">{u.name}</div>
                            <div className="font-body text-xs text-purple-400">
                              {sched.length===0 ? t(lang,'admin_sched_none') : `${sched.length} ${t(lang,'admin_lessons_count')}`}
                            </div>
                          </div>
                          <button onClick={() => setSchedUserId(u.id)}
                            className="text-xs bg-purple-100 text-purple-600 hover:bg-purple-200 px-3 py-1.5 rounded-xl font-body font-600 transition-colors">
                            {t(lang,'admin_edit_btn')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'teacherReports' && (
            <AdminTeacherReports lang={lang} users={users} />
          )}

          {/* ===== TRIAL LESSONS ===== */}
          {activeSection === 'trialLessons' && (
            <TrialLessonsAdmin lang={lang} />
          )}

          {/* ===== WORKBOOKS ===== */}
          {activeSection === 'workbooks' && (
            <motion.div key="workbooks" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}>
              <WorkbookBuilder lang={lang} students={users} />
            </motion.div>
          )}

          {/* ===== LIVE LESSONS ===== */}
          {activeSection === 'live' && (
            <motion.div key="live" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}>
              <LiveLessonMonitor users={users} lang={lang} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
