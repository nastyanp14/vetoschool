import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Edit3, GraduationCap, Mail, Phone, Plus, Trash2, Users, UserCheck, Activity, Eye } from 'lucide-react';
import { Lang } from '../lib/i18n';
import { User } from '../lib/auth';
import ConfirmActionModal from './ConfirmActionModal';
import {
  createStudentGroupForAdmin,
  createTeacher,
  deleteStudentGroupForAdmin,
  deleteTeacher,
  listTeacherDirectory,
  setTeacherGroups,
  setTeacherStatus,
  setTeacherStudents,
  StudentGroup,
  TeacherDirectoryItem,
  TeacherInput,
  TeacherStatus,
  updateTeacher,
} from '../lib/teachers';

const emptyForm: TeacherInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  teachingLanguages: [],
  levels: [],
  description: '',
  adminNote: '',
  status: 'active',
};

const texts = {
  ru: {
    title: 'Учителя',
    subtitle: 'Управление преподавателями, назначениями и нагрузкой',
    add: 'Добавить учителя',
    edit: 'Редактировать',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    activate: 'Активировать',
    disable: 'Отключить',
    firstName: 'Имя',
    lastName: 'Фамилия',
    email: 'Email',
    phone: 'Телефон',
    languages: 'Языки преподавания',
    levels: 'Уровни',
    description: 'Описание',
    note: 'Заметка',
    status: 'Статус',
    students: 'Ученики',
    groups: 'Группы',
    today: 'Уроков сегодня',
    week: 'Уроков за неделю',
    lastLogin: 'Последний вход',
    registered: 'Дата регистрации',
    workStatus: 'Рабочий статус',
    lessons: 'Уроков',
    attendance: 'Средняя посещаемость',
    assignedStudents: 'Назначить учеников',
    assignedGroups: 'Назначить группы',
    createGroup: 'Создать группу',
    groupName: 'Название группы',
    groupLevel: 'Уровень группы',
    groupCourse: 'Курс',
    groupMembers: 'Ученики группы',
    groupCreated: 'Группа создана',
    groupDeleted: 'Группа удалена',
    deleteGroup: 'Удалить группу',
    deleteGroupConfirm: 'Удалить эту группу? Ученики останутся в системе.',
    chooseMembers: 'Выберите учеников для группы',
    studentsInGroup: 'Ученики в группе',
    noGroupStudents: 'В группе пока нет учеников',
    profile: 'Профиль',
    schedule: 'Расписание',
    workload: 'Нагрузка',
    activity: 'Активность',
    empty: 'Учителей пока нет',
    selectHint: 'Откройте учителя, чтобы посмотреть карточку и назначения',
    saved: 'Учитель сохранён',
    assignmentsSaved: 'Назначения сохранены',
    deleted: 'Учитель удалён',
    active: 'Активен',
    inactive: 'Неактивен',
    vacation: 'В отпуске',
    blocked: 'Заблокирован',
  },
  ua: {
    title: 'Учителі',
    subtitle: 'Керування викладачами, призначеннями та навантаженням',
    add: 'Додати вчителя',
    edit: 'Редагувати',
    save: 'Зберегти',
    cancel: 'Скасувати',
    delete: 'Видалити',
    activate: 'Активувати',
    disable: 'Вимкнути',
    firstName: 'Імʼя',
    lastName: 'Прізвище',
    email: 'Email',
    phone: 'Телефон',
    languages: 'Мови викладання',
    levels: 'Рівні',
    description: 'Опис',
    note: 'Нотатка',
    status: 'Статус',
    students: 'Учні',
    groups: 'Групи',
    today: 'Уроків сьогодні',
    week: 'Уроків за тиждень',
    lastLogin: 'Останній вхід',
    registered: 'Дата реєстрації',
    workStatus: 'Робочий статус',
    lessons: 'Уроків',
    attendance: 'Середня відвідуваність',
    assignedStudents: 'Призначити учнів',
    assignedGroups: 'Призначити групи',
    createGroup: 'Створити групу',
    groupName: 'Назва групи',
    groupLevel: 'Рівень групи',
    groupCourse: 'Курс',
    groupMembers: 'Учні групи',
    groupCreated: 'Групу створено',
    groupDeleted: 'Групу видалено',
    deleteGroup: 'Видалити групу',
    deleteGroupConfirm: 'Видалити цю групу? Учні залишаться в системі.',
    chooseMembers: 'Оберіть учнів для групи',
    studentsInGroup: 'Учні в групі',
    noGroupStudents: 'У групі поки немає учнів',
    profile: 'Профіль',
    schedule: 'Розклад',
    workload: 'Навантаження',
    activity: 'Активність',
    empty: 'Учителів поки немає',
    selectHint: 'Відкрийте вчителя, щоб переглянути картку та призначення',
    saved: 'Учителя збережено',
    assignmentsSaved: 'Призначення збережено',
    deleted: 'Учителя видалено',
    active: 'Активний',
    inactive: 'Неактивний',
    vacation: 'У відпустці',
    blocked: 'Заблокований',
  },
  en: {
    title: 'Teachers',
    subtitle: 'Manage teachers, assignments, and workload',
    add: 'Add teacher',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    activate: 'Activate',
    disable: 'Disable',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone',
    languages: 'Teaching languages',
    levels: 'Levels',
    description: 'Description',
    note: 'Note',
    status: 'Status',
    students: 'Students',
    groups: 'Groups',
    today: 'Lessons today',
    week: 'Lessons this week',
    lastLogin: 'Last login',
    registered: 'Registered',
    workStatus: 'Work status',
    lessons: 'Lessons',
    attendance: 'Average attendance',
    assignedStudents: 'Assign students',
    assignedGroups: 'Assign groups',
    createGroup: 'Create group',
    groupName: 'Group name',
    groupLevel: 'Group level',
    groupCourse: 'Course',
    groupMembers: 'Group students',
    groupCreated: 'Group created',
    groupDeleted: 'Group deleted',
    deleteGroup: 'Delete group',
    deleteGroupConfirm: 'Delete this group? Students stay in the system.',
    chooseMembers: 'Choose students for the group',
    studentsInGroup: 'Students in group',
    noGroupStudents: 'No students in this group yet',
    profile: 'Profile',
    schedule: 'Schedule',
    workload: 'Workload',
    activity: 'Activity',
    empty: 'No teachers yet',
    selectHint: 'Open a teacher to view profile and assignments',
    saved: 'Teacher saved',
    assignmentsSaved: 'Assignments saved',
    deleted: 'Teacher deleted',
    active: 'Active',
    inactive: 'Inactive',
    vacation: 'On vacation',
    blocked: 'Blocked',
  },
};

const statusClasses: Record<TeacherStatus, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  inactive: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  vacation: 'bg-blue-100 text-blue-700 border-blue-200',
  blocked: 'bg-red-100 text-red-600 border-red-200',
};

type TextField = 'firstName' | 'lastName' | 'email' | 'phone';
const textFields: Array<{ key: TextField; getLabel: (labels: typeof texts.ru) => string; required: boolean; type?: string }> = [
  { key: 'firstName', getLabel: labels => labels.firstName, required: true },
  { key: 'lastName', getLabel: labels => labels.lastName, required: true },
  { key: 'email', getLabel: labels => labels.email, required: true, type: 'email' },
  { key: 'phone', getLabel: labels => labels.phone, required: false },
];

function formatDate(value: string | null, lang: Lang) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function listFromText(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function nameOf(teacher: TeacherDirectoryItem) {
  return `${teacher.firstName} ${teacher.lastName}`.trim() || teacher.email;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function TeachersAdmin({ lang, students, onToast }: { lang: Lang; students: User[]; onToast: (msg: string, type?: 'success' | 'error') => void }) {
  const labels = texts[lang] || texts.ru;
  const [teachers, setTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeacherInput>(emptyForm);
  const [languageText, setLanguageText] = useState('');
  const [levelText, setLevelText] = useState('');
  const [studentSelection, setStudentSelection] = useState<string[]>([]);
  const [groupSelection, setGroupSelection] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupLevel, setNewGroupLevel] = useState('');
  const [newGroupCourse, setNewGroupCourse] = useState('');
  const [newGroupStudents, setNewGroupStudents] = useState<string[]>([]);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<StudentGroup | null>(null);
  const [deleteTeacherTarget, setDeleteTeacherTarget] = useState<TeacherDirectoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedTeacher = useMemo(() => teachers.find(teacher => teacher.id === selectedId) || null, [teachers, selectedId]);

  const refresh = useCallback(async () => {
    const data = await listTeacherDirectory(students);
    setTeachers(data.teachers);
    setGroups(data.groups);
    if (selectedId && !data.teachers.some(teacher => teacher.id === selectedId)) setSelectedId(null);
  }, [selectedId, students]);

  useEffect(() => {
    refresh().catch(error => onToast(errorMessage(error, 'Teacher data did not load'), 'error'));
  }, [onToast, refresh]);

  useEffect(() => {
    if (!selectedTeacher) {
      setStudentSelection([]);
      setGroupSelection([]);
      return;
    }
    setStudentSelection(selectedTeacher.assignedStudentIds);
    setGroupSelection(selectedTeacher.assignedGroupIds);
    setNewGroupName('');
    setNewGroupLevel('');
    setNewGroupCourse('');
    setNewGroupStudents([]);
  }, [selectedTeacher]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLanguageText('');
    setLevelText('');
    setShowForm(true);
  };

  const startEdit = (teacher: TeacherDirectoryItem) => {
    setEditingId(teacher.id);
    setForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      phone: teacher.phone || '',
      avatarUrl: teacher.avatarUrl || '',
      teachingLanguages: teacher.teachingLanguages,
      levels: teacher.levels,
      description: teacher.description || '',
      adminNote: teacher.adminNote || '',
      status: teacher.status,
    });
    setLanguageText(teacher.teachingLanguages.join(', '));
    setLevelText(teacher.levels.join(', '));
    setShowForm(true);
  };

  const saveTeacher = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, teachingLanguages: listFromText(languageText), levels: listFromText(levelText) };
      const saved = editingId ? await updateTeacher(editingId, payload) : await createTeacher(payload);
      await refresh();
      setSelectedId(saved.id);
      setShowForm(false);
      onToast(`✅ ${labels.saved}`);
    } catch (error: unknown) {
      onToast(errorMessage(error, labels.saved), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTeacher = async () => {
    if (!deleteTeacherTarget) return;
    setSaving(true);
    try {
      await deleteTeacher(deleteTeacherTarget.id);
      setDeleteTeacherTarget(null);
      await refresh();
      onToast(`🗑️ ${labels.deleted}`);
    } catch (error: unknown) {
      onToast(errorMessage(error, labels.deleted), 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveAssignments = async () => {
    if (!selectedTeacher) return;
    setSaving(true);
    try {
      await setTeacherStudents(selectedTeacher.id, studentSelection);
      await setTeacherGroups(selectedTeacher.id, groupSelection);
      await refresh();
      onToast(`✅ ${labels.assignmentsSaved}`);
    } catch (error: unknown) {
      onToast(errorMessage(error, labels.assignmentsSaved), 'error');
    } finally {
      setSaving(false);
    }
  };

  const createGroup = async () => {
    if (!selectedTeacher) return;
    if (!newGroupName.trim()) {
      onToast(labels.groupName, 'error');
      return;
    }
    if (!newGroupStudents.length) {
      onToast(labels.chooseMembers, 'error');
      return;
    }
    setSaving(true);
    try {
      const group = await createStudentGroupForAdmin({
        name: newGroupName,
        level: newGroupLevel,
        course: newGroupCourse,
        teacherId: selectedTeacher.id,
        studentIds: newGroupStudents,
      });
      setNewGroupName('');
      setNewGroupLevel('');
      setNewGroupCourse('');
      setNewGroupStudents([]);
      setGroupSelection(prev => Array.from(new Set([...prev, group.id])));
      await refresh();
      onToast(`✅ ${labels.groupCreated}`);
    } catch (error: unknown) {
      onToast(errorMessage(error, labels.groupCreated), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setSaving(true);
    try {
      await deleteStudentGroupForAdmin(deleteGroupTarget.id);
      setGroupSelection(prev => prev.filter(id => id !== deleteGroupTarget.id));
      setDeleteGroupTarget(null);
      await refresh();
      onToast(`🗑️ ${labels.groupDeleted}`);
    } catch (error: unknown) {
      onToast(errorMessage(error, labels.groupDeleted), 'error');
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (teacher: TeacherDirectoryItem, status: TeacherStatus) => {
    setSaving(true);
    try {
      await setTeacherStatus(teacher.id, status);
      await refresh();
      onToast(`✅ ${labels.saved}`);
    } catch (error: unknown) {
      onToast(errorMessage(error, labels.saved), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div key="teachers" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <AnimatePresence>
        {deleteTeacherTarget && (
          <ConfirmActionModal
            title={labels.delete}
            message={`${labels.delete}: ${nameOf(deleteTeacherTarget)}?`}
            confirmLabel={labels.delete}
            cancelLabel={labels.cancel}
            onConfirm={confirmDeleteTeacher}
            onCancel={() => setDeleteTeacherTarget(null)}
            busy={saving}
          />
        )}
        {deleteGroupTarget && (
          <ConfirmActionModal
            title={labels.deleteGroup}
            message={`${labels.deleteGroupConfirm} ${deleteGroupTarget.name}`}
            confirmLabel={labels.deleteGroup}
            cancelLabel={labels.cancel}
            onConfirm={confirmDeleteGroup}
            onCancel={() => setDeleteGroupTarget(null)}
            busy={saving}
          />
        )}
      </AnimatePresence>

      <div className="glass rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-3xl text-purple-700">{labels.title}</h2>
          <p className="font-body text-sm text-purple-400 mt-1">{labels.subtitle}</p>
        </div>
        <button onClick={startCreate} className="btn-magic inline-flex items-center justify-center gap-2 px-5 py-3 text-white font-display font-bold text-sm">
          <Plus className="w-4 h-4" />
          {labels.add}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form onSubmit={saveTeacher} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="glass rounded-3xl p-6 grid md:grid-cols-2 gap-4">
            {textFields.map(field => (
              <label key={field.key} className="font-body font-600 text-purple-600 text-sm">
                {field.getLabel(labels)}
                <input
                  value={form[field.key] || ''}
                  onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))}
                  required={field.required}
                  type={field.type || 'text'}
                  className="input-magic mt-2"
                />
              </label>
            ))}
            <label className="font-body font-600 text-purple-600 text-sm">
              {labels.languages}
              <input value={languageText} onChange={event => setLanguageText(event.target.value)} placeholder="English, Czech" className="input-magic mt-2" />
            </label>
            <label className="font-body font-600 text-purple-600 text-sm">
              {labels.levels}
              <input value={levelText} onChange={event => setLevelText(event.target.value)} placeholder="A1, A2, Kids" className="input-magic mt-2" />
            </label>
            <label className="font-body font-600 text-purple-600 text-sm">
              {labels.status}
              <select value={form.status} onChange={event => setForm(prev => ({ ...prev, status: event.target.value as TeacherStatus }))} className="input-magic mt-2">
                {(['active', 'inactive', 'vacation', 'blocked'] as TeacherStatus[]).map(status => <option key={status} value={status}>{labels[status]}</option>)}
              </select>
            </label>
            <label className="font-body font-600 text-purple-600 text-sm md:col-span-2">
              {labels.description}
              <textarea value={form.description || ''} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} className="input-magic mt-2 min-h-24" />
            </label>
            <label className="font-body font-600 text-purple-600 text-sm md:col-span-2">
              {labels.note}
              <textarea value={form.adminNote || ''} onChange={event => setForm(prev => ({ ...prev, adminNote: event.target.value }))} className="input-magic mt-2 min-h-20" />
            </label>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline px-5 py-2.5 text-sm font-display font-bold">{labels.cancel}</button>
              <button type="submit" disabled={saving} className="btn-magic px-6 py-2.5 text-white text-sm font-display font-bold disabled:opacity-60">{saving ? '...' : labels.save}</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid xl:grid-cols-[1.25fr_0.75fr] gap-6">
        <div className="glass rounded-3xl overflow-hidden border border-white/70 shadow-xl">
          {teachers.length === 0 ? (
            <div className="text-center py-16">
              <GraduationCap className="w-12 h-12 text-pink-400 mx-auto mb-4" />
              <p className="font-display font-bold text-purple-600 text-xl">{labels.empty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-100 bg-white/35">
                    {[labels.profile, labels.status, labels.students, labels.groups, labels.today, labels.week, labels.lastLogin, labels.registered, labels.workStatus].map(header => (
                      <th key={header} className="text-left px-4 py-4 font-display font-bold text-purple-600 text-sm whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(teacher => (
                    <tr key={teacher.id} className={`border-b border-purple-50 bg-white/20 hover:bg-pink-50/60 transition-colors ${selectedId === teacher.id ? 'bg-pink-50/70' : ''}`}>
                      <td className="px-4 py-4 min-w-[250px]">
                        <button onClick={() => setSelectedId(teacher.id)} className="flex items-center gap-3 text-left">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-300 to-purple-400 flex items-center justify-center text-white font-display font-black overflow-hidden">
                            {teacher.avatarUrl ? <img src={teacher.avatarUrl} alt="" className="w-full h-full object-cover" /> : nameOf(teacher)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-body font-700 text-purple-700 text-sm">{nameOf(teacher)}</div>
                            <div className="font-body text-xs text-purple-400 truncate max-w-[180px]">{teacher.email}</div>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-2xl border px-3 py-1.5 font-body font-700 text-xs whitespace-nowrap ${statusClasses[teacher.status]}`}>{labels[teacher.status]}</span>
                      </td>
                      <td className="px-4 py-4 font-display font-black text-purple-700">{teacher.studentsCount}</td>
                      <td className="px-4 py-4 font-display font-black text-purple-700">{teacher.groupsCount}</td>
                      <td className="px-4 py-4 font-display font-black text-purple-700">{teacher.lessonsToday}</td>
                      <td className="px-4 py-4 font-display font-black text-purple-700">{teacher.lessonsWeek}</td>
                      <td className="px-4 py-4 font-body text-xs text-purple-400 whitespace-nowrap">{formatDate(teacher.lastLoginAt, lang)}</td>
                      <td className="px-4 py-4 font-body text-xs text-purple-400 whitespace-nowrap">{formatDate(teacher.createdAt, lang)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedId(teacher.id)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-purple-100 text-purple-600 hover:bg-purple-200" title={labels.profile}>
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => startEdit(teacher)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200" title={labels.edit}>
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {teacher.status === 'active'
                            ? <button onClick={() => quickStatus(teacher, 'inactive')} className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-3 py-1.5 rounded-xl font-body font-700 whitespace-nowrap">{labels.disable}</button>
                            : <button onClick={() => quickStatus(teacher, 'active')} className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-xl font-body font-700 whitespace-nowrap">{labels.activate}</button>
                          }
                          <button onClick={() => setDeleteTeacherTarget(teacher)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-pink-50 text-pink-500 hover:bg-red-100 hover:text-red-500" title={labels.delete}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="glass rounded-3xl p-6 min-h-[420px]">
          {!selectedTeacher ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <UserCheck className="w-12 h-12 text-pink-400 mb-4" />
              <p className="font-body text-purple-400">{labels.selectHint}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-pink-300 to-purple-400 flex items-center justify-center text-white font-display font-black text-2xl overflow-hidden">
                  {selectedTeacher.avatarUrl ? <img src={selectedTeacher.avatarUrl} alt="" className="w-full h-full object-cover" /> : nameOf(selectedTeacher)[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-black text-2xl text-purple-700">{nameOf(selectedTeacher)}</h3>
                  <div className="font-body text-sm text-purple-400 truncate">{selectedTeacher.email}</div>
                  <span className={`inline-flex mt-2 rounded-2xl border px-3 py-1 font-body font-700 text-xs ${statusClasses[selectedTeacher.status]}`}>{labels[selectedTeacher.status]}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: labels.students, value: selectedTeacher.studentsCount, icon: Users },
                  { label: labels.groups, value: selectedTeacher.groupsCount, icon: GraduationCap },
                  { label: labels.lessons, value: selectedTeacher.totalLessons, icon: CalendarDays },
                  { label: labels.attendance, value: `${selectedTeacher.averageAttendance}%`, icon: Activity },
                ].map(item => (
                  <div key={item.label} className="bg-white/60 rounded-2xl border border-purple-100 p-3">
                    <item.icon className="w-5 h-5 text-pink-400 mb-2" />
                    <div className="font-display font-black text-2xl text-purple-700">{item.value}</div>
                    <div className="font-body text-xs text-purple-400">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 font-body text-sm text-purple-600">
                <div className="flex gap-2"><Mail className="w-4 h-4 text-pink-400 mt-0.5" />{selectedTeacher.email}</div>
                <div className="flex gap-2"><Phone className="w-4 h-4 text-pink-400 mt-0.5" />{selectedTeacher.phone || '—'}</div>
                <div><span className="font-700 text-purple-700">{labels.languages}:</span> {selectedTeacher.teachingLanguages.join(', ') || '—'}</div>
                <div><span className="font-700 text-purple-700">{labels.levels}:</span> {selectedTeacher.levels.join(', ') || '—'}</div>
                <div><span className="font-700 text-purple-700">{labels.registered}:</span> {formatDate(selectedTeacher.createdAt, lang)}</div>
                <div><span className="font-700 text-purple-700">{labels.lastLogin}:</span> {formatDate(selectedTeacher.lastLoginAt, lang)}</div>
              </div>

              {selectedTeacher.description && (
                <div>
                  <h4 className="font-display font-bold text-purple-700 mb-2">{labels.description}</h4>
                  <p className="font-body text-sm text-purple-500 leading-relaxed">{selectedTeacher.description}</p>
                </div>
              )}
              {selectedTeacher.adminNote && (
                <div>
                  <h4 className="font-display font-bold text-purple-700 mb-2">{labels.note}</h4>
                  <p className="font-body text-sm text-purple-500 leading-relaxed">{selectedTeacher.adminNote}</p>
                </div>
              )}

              <div>
                <h4 className="font-display font-bold text-purple-700 mb-3">{labels.assignedStudents}</h4>
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {students.map(student => (
                    <label key={student.id} className="flex items-center gap-3 bg-white/60 rounded-2xl px-3 py-2 font-body text-sm text-purple-600">
                      <input
                        type="checkbox"
                        checked={studentSelection.includes(student.id)}
                        onChange={event => setStudentSelection(prev => event.target.checked ? [...prev, student.id] : prev.filter(id => id !== student.id))}
                        className="w-4 h-4 accent-pink-500"
                      />
                      <span className="truncate">{student.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-display font-bold text-purple-700 mb-3">{labels.assignedGroups}</h4>
                <div className="mb-4 rounded-2xl border border-pink-100 bg-white/60 p-3">
                  <h5 className="mb-3 font-display font-bold text-purple-700">{labels.createGroup}</h5>
                  <div className="grid gap-2">
                    <input
                      value={newGroupName}
                      onChange={event => setNewGroupName(event.target.value)}
                      placeholder={labels.groupName}
                      className="input-magic"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={newGroupLevel}
                        onChange={event => setNewGroupLevel(event.target.value)}
                        placeholder={labels.groupLevel}
                        className="input-magic"
                      />
                      <input
                        value={newGroupCourse}
                        onChange={event => setNewGroupCourse(event.target.value)}
                        placeholder={labels.groupCourse}
                        className="input-magic"
                      />
                    </div>
                    <div>
                      <div className="mb-2 font-body text-xs font-800 uppercase tracking-wider text-purple-300">{labels.groupMembers}</div>
                      <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                        {students.map(student => (
                          <label key={student.id} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2 font-body text-sm text-purple-600">
                            <input
                              type="checkbox"
                              checked={newGroupStudents.includes(student.id)}
                              onChange={event => setNewGroupStudents(prev => event.target.checked ? [...prev, student.id] : prev.filter(id => id !== student.id))}
                              className="w-4 h-4 accent-pink-500"
                            />
                            <span className="truncate">{student.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button onClick={createGroup} disabled={saving} className="btn-outline px-4 py-2.5 font-display text-sm font-bold">
                      <Plus className="mr-2 inline h-4 w-4" />
                      {labels.createGroup}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {groups.map(group => {
                    const groupStudents = students.filter(student => group.studentIds.includes(student.id));
                    const checked = groupSelection.includes(group.id);
                    return (
                      <div key={group.id} className={`rounded-2xl border p-3 transition ${checked ? 'border-pink-200 bg-pink-50/70' : 'border-purple-100 bg-white/60'}`}>
                        <div className="flex items-start gap-2">
                          <label className="flex min-w-0 flex-1 items-center gap-3 font-body text-sm text-purple-600">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={event => setGroupSelection(prev => event.target.checked ? [...prev, group.id] : prev.filter(id => id !== group.id))}
                              className="w-4 h-4 accent-pink-500"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-700 text-purple-700">{group.name}</span>
                              <span className="block text-xs text-purple-300">{labels.studentsInGroup}: {groupStudents.length}</span>
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setDeleteGroupTarget(group)}
                            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100"
                            title={labels.deleteGroup}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                          {groupStudents.length === 0 ? (
                            <span className="font-body text-xs text-purple-300">{labels.noGroupStudents}</span>
                          ) : groupStudents.map(student => (
                            <span key={student.id} className="rounded-full bg-white px-2.5 py-1 font-body text-xs font-700 text-purple-500 shadow-sm">
                              {student.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button onClick={saveAssignments} disabled={saving} className="btn-magic w-full py-3 text-white font-display font-bold text-sm disabled:opacity-60">
                {saving ? '...' : labels.save}
              </button>
            </div>
          )}
        </aside>
      </div>
    </motion.div>
  );
}
