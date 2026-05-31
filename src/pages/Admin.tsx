import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, getUsers, grantAccess, revokeAccess, deleteUser, logout, loadAllUsers, setAccess, User } from '../lib/auth';
import { getStudentSchedule, saveStudentSchedule, loadStudentSchedule, ScheduleSlot } from '../lib/schedule';
import { ensureStudentContent, saveStudentContent, loadStudentContent, ContentItem, ContentType, getStudentRating, fileToDataUrl, uploadContentFile, deleteContentItem, deleteModule } from '../lib/content';
import { Lang, t } from '../lib/i18n';
import { Switch } from '@/components/ui/switch';
import { Trash2 } from 'lucide-react';
import { subscribe } from '../lib/storage';

const DAYS_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

type Section = 'students' | 'content' | 'schedule';

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

function DeleteModal({ name, onConfirm, onCancel, lang }: { name: string; onConfirm: () => void; onCancel: () => void; lang: Lang }) {
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
          <button onClick={onCancel} className="btn-outline px-6 py-3 font-display font-bold text-sm">{t(lang,'admin_cancel')}</button>
          <button onClick={onConfirm} className="px-6 py-3 bg-gradient-to-r from-red-400 to-pink-500 text-white font-display font-bold text-sm rounded-full hover:scale-105 transition-transform shadow-lg">
            {t(lang,'admin_do_delete')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- Student Profile Modal ----
function StudentProfileModal({ user, lang, onClose, onCredentialsSaved, onOpenAnalytics }: {
  user: User; lang: Lang; onClose: () => void; onCredentialsSaved: (msg: string) => void; onOpenAnalytics: () => void;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    Promise.all([loadStudentContent(user.id), loadStudentSchedule(user.id)]).then(() => force(n => n + 1));
  }, [user.id]);
  const content = ensureStudentContent(user.id);
  const schedule = getStudentSchedule(user.id);
  const { avg, count } = getStudentRating(user.id);
  const lessons = content.filter(i => i.type === 'lesson');
  const homework = content.filter(i => i.type === 'homework');
  const practice = content.filter(i => i.type === 'practice');
  const grammar = content.filter(i => i.type === 'grammar');
  const listening = content.filter(i => i.type === 'listening');
  const unlockedCount = content.filter(i => i.unlocked).length;
  const gradedHW = homework.filter(h => h.starRating && h.starRating > 0);

  // Access toggle
  const [accessSaving, setAccessSaving] = useState(false);
  const handleToggleAccess = async (next: boolean) => {
    setAccessSaving(true);
    try { await setAccess(user.id, next); onCredentialsSaved(next ? `✅ Доступ выдан: ${user.name}` : `🔒 Доступ закрыт: ${user.name}`); }
    finally { setAccessSaving(false); }
  };

  const typeColor: Record<string, string> = {
    lesson: 'bg-pink-100 text-pink-600', homework: 'bg-purple-100 text-purple-600',
    practice: 'bg-blue-100 text-blue-600', grammar: 'bg-yellow-100 text-yellow-600', listening: 'bg-green-100 text-green-600',
  };
  const typeEmoji: Record<string, string> = { lesson: '📚', homework: '✏️', practice: '🎮', grammar: '📝', listening: '🎧' };

  const labels = {
    ru: { content: 'Контент', rating: 'Оценка', graded: 'ДЗ проверено', schedule: 'Расписание',
          basedOn: 'на основе', grades: 'оценок', lessons: '📚 Уроки', homework: '✏️ Домашние задания',
          practice: '🎮 Практика', grammar: '📝 Грамматика', listening: '🎧 Аудирование',
          scheduleTitle: '📅 Расписание', openDash: '📊 Аналитика ученика',
          editCreds: '🔑 Изменить логин / пароль', emailLabel: 'Email (логин)', passLabel: 'Новый пароль',
          confirmLabel: 'Подтвердить пароль', saveBtn: 'Сохранить', cancelBtn: 'Отмена',
          passHint: 'Оставьте пустым, если не меняете пароль', active: '🟢 Активен', pending: '🟡 Ожидает',
          showPass: 'Показать', hidePass: 'Скрыть', due: 'До:' },
    en: { content: 'Content', rating: 'Rating', graded: 'HW graded', schedule: 'Schedule',
          basedOn: 'based on', grades: 'grades', lessons: '📚 Lessons', homework: '✏️ Homework',
          practice: '🎮 Practice', grammar: '📝 Grammar', listening: '🎧 Listening',
          scheduleTitle: '📅 Schedule', openDash: '📊 Student Analytics',
          editCreds: '🔑 Change login / password', emailLabel: 'Email (login)', passLabel: 'New password',
          confirmLabel: 'Confirm password', saveBtn: 'Save', cancelBtn: 'Cancel',
          passHint: 'Leave empty to keep current password', active: '🟢 Active', pending: '🟡 Pending',
          showPass: 'Show', hidePass: 'Hide', due: 'Due:' },
    ua: { content: 'Контент', rating: 'Оцінка', graded: 'ДЗ перевірено', schedule: 'Розклад',
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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-300 to-purple-400 flex items-center justify-center font-display font-black text-white text-2xl shadow-lg">
                {user.name[0].toUpperCase()}
              </div>
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
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: lbl.content, value: `${unlockedCount}/${content.length}`, emoji: '📂', color: 'from-pink-100 to-rose-100', border: 'border-pink-200' },
              { label: lbl.rating, value: avg > 0 ? `${avg}★` : '—', emoji: '⭐', color: 'from-yellow-100 to-amber-100', border: 'border-yellow-200' },
              { label: lbl.graded, value: `${gradedHW.length}/${homework.length}`, emoji: '✏️', color: 'from-purple-100 to-violet-100', border: 'border-purple-200' },
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

          {/* ---- ACCESS TOGGLE ---- */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100 p-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-display font-bold text-purple-700 flex items-center gap-2">
                {user.hasAccess ? '🟢' : '🟡'} {lang === 'en' ? 'Access' : lang === 'ua' ? 'Доступ' : 'Доступ'}
              </div>
              <p className="font-body text-xs text-purple-400 mt-0.5">
                {lang === 'en' ? 'Toggle to grant or revoke access for this student.' :
                 lang === 'ua' ? 'Перемкніть, щоб надати або забрати доступ.' :
                 'Переключите, чтобы выдать или забрать доступ.'}
              </p>
            </div>
            <Switch checked={user.hasAccess} disabled={accessSaving} onCheckedChange={handleToggleAccess} />
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

          {/* Schedule */}
          {schedule.length > 0 && (
            <div>
              <h4 className="font-display font-bold text-purple-700 mb-2">{lbl.scheduleTitle}</h4>
              <div className="space-y-2">
                {schedule.map(slot => (
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
          )}

          {/* Analytics CTA */}
          <button
            onClick={onOpenAnalytics}
            className="btn-magic w-full px-6 py-4 text-white font-display font-bold flex items-center justify-center gap-2">
            <span className="text-xl">📊</span>
            <span>{lbl.openDash}</span>
          </button>

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

  // Schedule
  const [schedUserId, setSchedUserId] = useState('');
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);

  // Content
  const [contentUserId, setContentUserId] = useState('');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
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

  
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') { navigate('/login'); return; }
    loadAllUsers().then(refreshUsers);
    const unsub = subscribe(refreshUsers);
    return () => { unsub(); };
  }, [currentUser, navigate]);
  useEffect(() => { if (schedUserId) loadStudentSchedule(schedUserId).then(setSlots); else setSlots([]); }, [schedUserId]);
  useEffect(() => { if (contentUserId) loadStudentContent(contentUserId).then(setContentItems); else setContentItems([]); }, [contentUserId]);

  const refreshUsers = () => setUsers(getUsers().filter(u => u.role !== 'admin'));
  const showToast = (msg: string, type: 'success'|'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleGrant = async (uid: string, name: string) => { await grantAccess(uid); refreshUsers(); showToast(`✅ ${name}`); };
  const handleRevoke = async (uid: string, name: string) => { await revokeAccess(uid); refreshUsers(); showToast(`🔒 ${name}`, 'error'); };
  const doDelete = async () => {
    if (!deleteTarget) return;
    await deleteUser(deleteTarget.id); refreshUsers();
    if (schedUserId === deleteTarget.id) setSchedUserId('');
    if (contentUserId === deleteTarget.id) setContentUserId('');
    showToast(`🗑️ ${deleteTarget.name}`); setDeleteTarget(null);
  };
  const handleLogout = async () => { await logout(); navigate('/'); };

  // Schedule
  const addSlot = () => setSlots(p => [...p, { id: crypto.randomUUID(), day:'Monday', time:'15:00', topic:'' }]);
  const updateSlot = (id: string, f: keyof ScheduleSlot, v: string) => setSlots(p => p.map(s => s.id === id ? { ...s, [f]: v } : s));
  const removeSlot = (id: string) => setSlots(p => p.filter(s => s.id !== id));
  const saveSchedule = async () => {
    if (!schedUserId) return;
    await saveStudentSchedule(schedUserId, slots);
    const fresh = await loadStudentSchedule(schedUserId);
    setSlots(fresh);
    showToast(t(lang,'admin_schedule_saved'));
  };

  // Content
  const toggleUnlock = async (itemId: string, cur: boolean) => {
    const updated = contentItems.map(i => i.id === itemId ? { ...i, unlocked: !cur } : i);
    setContentItems(updated); await saveStudentContent(contentUserId, updated);
    showToast(cur ? '🔒 Закрыто' : '✅ Открыто!');
  };
  const startEdit = (item: ContentItem) => {
    setEditingId(item.id); setEditTitle(item.title); setEditEmoji(item.emoji);
    setEditDueDate(item.dueDate||''); setEditSchedDate(item.scheduledDate||''); setEditSchedTime(item.scheduledTime||'');
    setEditStars(item.starRating||0); setEditFileDataUrl(item.fileDataUrl||''); setEditFileName(item.fileName||'');
    setEditExternalLink(item.externalLink||'');
  };
  const saveEdit = async (itemId: string, type: ContentType) => {
    const updated = contentItems.map(i => i.id === itemId ? {
      ...i, title:editTitle, emoji:editEmoji,
      dueDate: editDueDate || null,
      scheduledDate: editSchedDate || null,
      scheduledTime: editSchedTime || null,
      fileDataUrl: editFileDataUrl || null, fileName: editFileName || null,
      fileUrl: editFileDataUrl || null, externalLink: editExternalLink || null,
      starRating: (type === 'homework' || type === 'checkpoint') ? editStars : i.starRating,
    } : i);
    await saveStudentContent(contentUserId, updated);
    const fresh = await loadStudentContent(contentUserId);
    setContentItems(fresh);
    setEditingId(null);
    showToast(t(lang,'admin_content_saved'));
  };

  const getNextModuleId = () => {
    const nums = contentItems.map(i => parseInt(i.moduleId.replace('module-',''))||0);
    return `module-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  };
  const addModule = async () => {
    const moduleId = getNextModuleId(); const num = moduleId.replace('module-','');
    const newItems: ContentItem[] = [
      { id: crypto.randomUUID(), userId: contentUserId, moduleId, type:'lesson',   title:newModTitle.lesson   ||`Lesson ${num}`,    emoji:newModEmoji.lesson,   fileUrl:newModFile.lesson   || null, fileDataUrl:newModFile.lesson   || null, fileName:newModFileName.lesson   || null, externalLink:newModLink.lesson   ||null, scheduledDate:newModSchedLesson.date   || null, scheduledTime:newModSchedLesson.time   || null, unlocked:false },
      { id: crypto.randomUUID(), userId: contentUserId, moduleId, type:'homework', title:newModTitle.homework ||`Home Task ${num}`, emoji:newModEmoji.homework, fileUrl:newModFile.homework || null, fileDataUrl:newModFile.homework || null, fileName:newModFileName.homework || null, externalLink:newModLink.homework ||null, dueDate:newModDue || null, scheduledDate:newModSchedHW.date || null, scheduledTime:newModSchedHW.time || null, unlocked:false },
      { id: crypto.randomUUID(), userId: contentUserId, moduleId, type:'practice', title:newModTitle.practice ||`Practice ${num}`,  emoji:newModEmoji.practice, fileUrl:newModFile.practice || null, fileDataUrl:newModFile.practice || null, fileName:newModFileName.practice || null, externalLink:newModLink.practice ||null, scheduledDate:newModSchedPractice.date || null, scheduledTime:newModSchedPractice.time || null, unlocked:false },
    ];
    const updated = [...contentItems, ...newItems];
    await saveStudentContent(contentUserId, updated);
    const fresh = await loadStudentContent(contentUserId);
    setContentItems(fresh);
    setShowNewModule(false); setNewModTitle({lesson:'',homework:'',practice:''}); setNewModEmoji({lesson:'📚',homework:'✏️',practice:'🎮'});
    setNewModFile({lesson:'',homework:'',practice:''}); setNewModFileName({lesson:'',homework:'',practice:''}); setNewModLink({lesson:'',homework:'',practice:''}); setNewModDue('');
    setNewModSchedLesson({date:'',time:''}); setNewModSchedPractice({date:'',time:''}); setNewModSchedHW({date:'',time:''});
    showToast(`✅ ${t(lang,'admin_module')} ${num}!`);
  };
  const addExtra = async () => {
    const existingCount = contentItems.filter(i => i.type === newExtraType).length + 1;
    const extraModuleId = `${newExtraType}-${Date.now()}`;
    const defaultTitle = newExtraType === 'grammar' ? `Grammar ${existingCount}`
      : newExtraType === 'listening' ? `Listening ${existingCount}`
      : `Unit Checkpoint ${existingCount}`;
    const newItem: ContentItem = { id: crypto.randomUUID(), userId: contentUserId, moduleId:extraModuleId, type:newExtraType, title:newExtraTitle||defaultTitle, emoji:newExtraEmoji, fileUrl:newExtraFile || null, fileDataUrl:newExtraFile || null, fileName:newExtraFileName || null, externalLink:newExtraLink||null, scheduledDate:newExtraSchedDate || null, scheduledTime:newExtraSchedTime || null, unlocked:false };
    const updated = [...contentItems, newItem];
    await saveStudentContent(contentUserId, updated);
    const fresh = await loadStudentContent(contentUserId);
    setContentItems(fresh);
    setShowNewExtra(false); setNewExtraTitle(''); setNewExtraFile(''); setNewExtraFileName(''); setNewExtraLink(''); setNewExtraSchedDate(''); setNewExtraSchedTime('');
    const toastKey = newExtraType === 'grammar' ? 'dash_grammar' : newExtraType === 'listening' ? 'dash_listening' : 'dash_checkpoint';
    showToast(`✅ ${t(lang, toastKey)}!`);
  };

  const filtered = users.filter(u => {
    const ms = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const mf = filter==='all' ? true : filter==='active' ? u.hasAccess : !u.hasAccess;
    return ms && mf;
  });
  const totalStudents = users.length;
  const activeStudents = users.filter(u => u.hasAccess).length;
  const pendingStudents = users.filter(u => !u.hasAccess).length;

  if (!currentUser || currentUser.role !== 'admin') return null;

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

  return (
    <div className="min-h-screen" style={{ background:'linear-gradient(135deg,#F5F0FF 0%,#FFF0F6 50%,#F0F8FF 100%)' }}>

      <AnimatePresence>
        {deleteTarget && <DeleteModal name={deleteTarget.name} onConfirm={doDelete} onCancel={() => setDeleteTarget(null)} lang={lang} />}
      </AnimatePresence>

      <AnimatePresence>
        {profileTarget && (
          <StudentProfileModal
            user={profileTarget}
            lang={lang}
            onClose={() => setProfileTarget(null)}
            onCredentialsSaved={(msg) => { showToast(msg); setProfileTarget(null); refreshUsers(); }}
            onOpenAnalytics={() => { const id = profileTarget.id; setProfileTarget(null); navigate(`/analytics/${id}`); }}
          />
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
            { id:'content' as Section, label:t(lang,'admin_content_tab') },
            { id:'schedule' as Section, label:t(lang,'admin_schedule_tab') },
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

              <div className="glass rounded-3xl overflow-hidden mb-6">
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
                        <tr className="border-b border-purple-100">
                          {[t(lang,'admin_student'), t(lang,'admin_email'), t(lang,'admin_joined'), t(lang,'admin_status'), t(lang,'admin_actions')].map(h => (
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
                                transition={{ delay:i*0.05 }} className="border-b border-purple-50 hover:bg-purple-50/50 transition-colors">
                                <td className="px-4 md:px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-300 to-purple-300 flex items-center justify-center font-display font-black text-white text-sm flex-shrink-0">
                                      {user.name[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-body font-600 text-purple-700 text-sm">{user.name}</div>
                                      {avg > 0 && (
                                        <div className="flex gap-0.5 mt-0.5">
                                          {[1,2,3,4,5].map(s => <span key={s} className={`text-xs ${s<=Math.round(avg)?'text-yellow-400':'text-gray-200'}`}>★</span>)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 md:px-6 py-4 font-body text-sm text-purple-500 hidden md:table-cell">{user.email}</td>
                                <td className="px-4 md:px-6 py-4 font-body text-xs text-purple-400 hidden lg:table-cell">
                                  {new Date(user.joinedAt).toLocaleDateString(lang==='en'?'en-GB':lang==='ua'?'uk-UA':'ru-RU', { day:'numeric', month:'short', year:'numeric' })}
                                </td>
                                <td className="px-4 md:px-6 py-4">
                                  <span className={`inline-flex items-center gap-1 text-xs font-body font-600 px-3 py-1 rounded-full ${user.hasAccess?'bg-green-100 text-green-600':'bg-yellow-100 text-yellow-600'}`}>
                                    {user.hasAccess ? `🟢 ${t(lang,'admin_active_label')}` : `🟡 ${t(lang,'admin_pending_label')}`}
                                  </span>
                                </td>
                                <td className="px-4 md:px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    {user.hasAccess
                                      ? <button onClick={() => handleRevoke(user.id, user.name)} className="text-xs bg-red-100 text-red-500 hover:bg-red-200 px-3 py-1.5 rounded-xl font-body font-600 transition-colors whitespace-nowrap">{t(lang,'admin_take')}</button>
                                      : <button onClick={() => handleGrant(user.id, user.name)} className="text-xs bg-green-100 text-green-600 hover:bg-green-200 px-3 py-1.5 rounded-xl font-body font-600 transition-colors">✅ {t(lang,'admin_give')}</button>
                                    }
                                    <button onClick={() => setDeleteTarget(user)}
                                      className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded-xl transition-colors text-base" title={t(lang,'admin_delete_title')}>
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

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="glass rounded-3xl p-6">
                  <h3 className="font-display font-bold text-lg text-purple-700 mb-3">{t(lang,'admin_quick_actions')}</h3>
                  <button onClick={async () => { await Promise.all(users.filter(u => !u.hasAccess).map(u => grantAccess(u.id))); refreshUsers(); showToast('✅ Всем открыт доступ!'); }}
                    className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-2xl font-body text-sm text-green-700 font-600 transition-colors">
                    {t(lang,'admin_grant_all_btn')}
                  </button>
                </div>
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

          {/* ===== CONTENT & GRADES ===== */}
          {activeSection === 'content' && (
            <motion.div key="content" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}>
              <div className="glass rounded-3xl p-6 mb-6">
                <h3 className="font-display font-bold text-xl text-purple-700 mb-1">{t(lang,'admin_content_title')}</h3>
                <p className="font-body text-sm text-purple-400 mb-6">{t(lang,'admin_content_desc')}</p>

                <div className="mb-6">
                  <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang,'admin_select_student')}</label>
                  <select value={contentUserId} onChange={e => { setContentUserId(e.target.value); setEditingId(null); setShowNewModule(false); setShowNewExtra(false); }} className="input-magic">
                    <option value="">— {t(lang,'admin_select_student')} —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>

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
                                          {(item.type === 'homework' || item.type === 'checkpoint') && (
                                            <div>
                                              <label className="font-body text-xs text-purple-500 font-600 mb-2 block">{t(lang,'admin_stars_label')}</label>
                                              <StarPicker value={editStars} onChange={setEditStars} />
                                            </div>
                                          )}
                                          <div className="flex gap-2">
                                            <button onClick={() => saveEdit(item.id, item.type)} className="btn-magic px-5 py-2 text-white text-sm font-display font-bold">{t(lang,'admin_save_changes')}</button>
                                            <button onClick={() => setEditingId(null)} className="btn-outline px-5 py-2 text-sm font-display font-bold">{t(lang,'admin_cancel_btn')}</button>
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
                        </div>
                      )}

                      {/* New grammar/listening form */}
                      <AnimatePresence>
                        {showNewExtra && (
                          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
                            className={`rounded-3xl p-6 border mt-4 ${newExtraType==='grammar'?'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200':'bg-gradient-to-br from-green-50 to-teal-50 border-green-200'}`}>
                            <h4 className="font-display font-bold text-xl text-purple-700 mb-5">
                              {newExtraType==='grammar' ? t(lang,'admin_new_grammar_title') : t(lang,'admin_new_listening_title')}
                            </h4>
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
                              <button onClick={addExtra} className="btn-magic px-6 py-3 text-white font-display font-bold">{t(lang,'admin_add_btn')}</button>
                              <button onClick={() => setShowNewExtra(false)} className="btn-outline px-6 py-3 font-display font-bold">{t(lang,'admin_cancel_btn')}</button>
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
                              <button onClick={addModule} className="btn-magic px-6 py-3 text-white font-display font-bold">{t(lang,'admin_create_module')}</button>
                              <button onClick={() => setShowNewModule(false)} className="btn-outline px-6 py-3 font-display font-bold">{t(lang,'admin_cancel_btn')}</button>
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
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-300 flex items-center justify-center font-display font-black text-white text-sm flex-shrink-0">
                            {u.name[0].toUpperCase()}
                          </div>
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
              <div className="glass rounded-3xl p-6 mb-6">
                <h3 className="font-display font-bold text-xl text-purple-700 mb-1">{t(lang,'admin_schedule_title')}</h3>
                <p className="font-body text-sm text-purple-400 mb-6">{t(lang,'admin_schedule_desc')}</p>
                <div className="mb-6">
                  <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang,'admin_select_student')}</label>
                  <select value={schedUserId} onChange={e => setSchedUserId(e.target.value)} className="input-magic">
                    <option value="">— {t(lang,'admin_select_student')} —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                {schedUserId && (
                  <AnimatePresence>
                    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
                      <div className="space-y-3 mb-4">
                        {slots.length === 0 && (
                          <div className="text-center py-8 bg-purple-50 rounded-2xl">
                            <p className="font-body text-purple-400 text-sm">{t(lang,'admin_no_slots')}</p>
                          </div>
                        )}
                        {slots.map((slot, i) => (
                          <motion.div key={slot.id} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.05 }}
                            className="flex flex-col sm:flex-row gap-3 p-4 bg-white/70 rounded-2xl border border-purple-100">
                            <div className="flex-1">
                              <label className="font-body text-xs text-purple-500 font-600 mb-1 block">{t(lang,'admin_day')}</label>
                              <select value={slot.day} onChange={e => updateSlot(slot.id,'day',e.target.value)} className="input-magic text-sm py-2">
                                {DAYS_EN.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
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
                              <button onClick={() => removeSlot(slot.id)} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-sm font-body font-600 transition-colors">{t(lang,'admin_remove')}</button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
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
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-300 flex items-center justify-center font-display font-black text-white text-sm flex-shrink-0">
                            {u.name[0].toUpperCase()}
                          </div>
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

        </AnimatePresence>
      </div>
    </div>
  );
}
