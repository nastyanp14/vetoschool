import { Dispatch, SetStateAction } from 'react';
import { BookOpen, CalendarDays, ClipboardCheck, FileText, StickyNote, Star, Trash2 } from 'lucide-react';
import { Lang } from '@/lib/i18n';
import { TeacherDictionaryWord, TeacherGrade, TeacherHomework, TeacherLesson, TeacherNote, TeacherStudent } from '@/lib/teachers';
import { formatLessonMoment, formatTeacherDate, gradeCategoryLabel, lessonStatusLabel, missingValue, studentStatusLabel } from '@/lib/teacherUi';
import { TeacherAvatar } from './TeacherAvatar';
import { TeacherEmptyState } from './TeacherEmptyState';

export type TeacherStudentTab = 'overview' | 'schedule' | 'grades' | 'homework' | 'dictionary' | 'analytics' | 'notes';

const labels = {
  ru: {
    choose: 'Выберите ученика',
    chooseText: 'Откройте карточку ученика, чтобы увидеть профиль, расписание, оценки и заметки.',
    tabs: ['Обзор', 'Расписание', 'Оценки', 'Домашние задания', 'Словарь', 'Аналитика', 'Заметки'],
    status: 'Статус',
    age: 'Возраст',
    level: 'Уровень',
    group: 'Группа',
    lessons: 'Уроки',
    attendance: 'Посещаемость',
    tariff: 'Тариф',
    teacher: 'Учитель',
    progress: 'Прогресс',
    lastActivity: 'Последняя активность',
    nextLesson: 'Следующий урок',
    comment: 'Комментарий',
    addNote: 'Добавить заметку',
    notePlaceholder: 'Заметка видна только учителю и администратору',
    noSchedule: 'Уроков пока нет',
    noScheduleText: 'Для этого ученика ещё нет уроков в расписании.',
    noGrades: 'Оценок пока нет',
    noGradesText: 'Когда вы поставите оценку, она появится здесь.',
    noHomework: 'Домашних заданий пока нет',
    noHomeworkText: 'Назначенные задания появятся в этом разделе.',
    noDictionary: 'Словарь пока пуст',
    noDictionaryText: 'Назначенные слова появятся здесь.',
    deleteWord: 'Удалить',
    noNotes: 'Заметок пока нет',
    noNotesText: 'Добавьте личную заметку по ученику.',
  },
  ua: {
    choose: 'Виберіть учня',
    chooseText: 'Відкрийте картку учня, щоб побачити профіль, розклад, оцінки та нотатки.',
    tabs: ['Огляд', 'Розклад', 'Оцінки', 'Домашні завдання', 'Словник', 'Аналітика', 'Нотатки'],
    status: 'Статус',
    age: 'Вік',
    level: 'Рівень',
    group: 'Група',
    lessons: 'Уроки',
    attendance: 'Відвідуваність',
    tariff: 'Тариф',
    teacher: 'Учитель',
    progress: 'Прогрес',
    lastActivity: 'Остання активність',
    nextLesson: 'Наступний урок',
    comment: 'Коментар',
    addNote: 'Додати нотатку',
    notePlaceholder: 'Нотатка видима тільки вчителю та адміністратору',
    noSchedule: 'Уроків поки немає',
    noScheduleText: 'Для цього учня ще немає уроків у розкладі.',
    noGrades: 'Оцінок поки немає',
    noGradesText: 'Коли ви поставите оцінку, вона зʼявиться тут.',
    noHomework: 'Домашніх завдань поки немає',
    noHomeworkText: 'Призначені завдання зʼявляться в цьому розділі.',
    noDictionary: 'Словник поки порожній',
    noDictionaryText: 'Призначені слова зʼявляться тут.',
    deleteWord: 'Видалити',
    noNotes: 'Нотаток поки немає',
    noNotesText: 'Додайте особисту нотатку щодо учня.',
  },
  en: {
    choose: 'Choose a student',
    chooseText: 'Open a student card to see profile, schedule, grades, and notes.',
    tabs: ['Overview', 'Schedule', 'Grades', 'Homework', 'Dictionary', 'Analytics', 'Notes'],
    status: 'Status',
    age: 'Age',
    level: 'Level',
    group: 'Group',
    lessons: 'Lessons',
    attendance: 'Attendance',
    tariff: 'Plan',
    teacher: 'Teacher',
    progress: 'Progress',
    lastActivity: 'Last activity',
    nextLesson: 'Next lesson',
    comment: 'Comment',
    addNote: 'Add note',
    notePlaceholder: 'Only the teacher and administrator can see this note',
    noSchedule: 'No lessons yet',
    noScheduleText: 'This student has no lessons in the schedule yet.',
    noGrades: 'No grades yet',
    noGradesText: 'New grades will appear here after saving.',
    noHomework: 'No homework yet',
    noHomeworkText: 'Assigned homework will appear in this section.',
    noDictionary: 'Dictionary is empty',
    noDictionaryText: 'Assigned words will appear here.',
    deleteWord: 'Delete',
    noNotes: 'No notes yet',
    noNotesText: 'Add a private note for this student.',
  },
};

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3 font-body text-sm">
      <span className="text-purple-400">{label}</span>
      <span className="text-right font-800 text-purple-700">{value}</span>
    </div>
  );
}

export function TeacherStudentProfile({
  student,
  teacherName,
  lang,
  tab,
  setTab,
  lessons,
  grades,
  homeworks,
  words,
  notes,
  noteText,
  setNoteText,
  onAddNote,
  onDeleteDictionaryWord,
}: {
  student: TeacherStudent | null;
  teacherName: string;
  lang: Lang;
  tab: TeacherStudentTab;
  setTab: Dispatch<SetStateAction<TeacherStudentTab>>;
  lessons: TeacherLesson[];
  grades: TeacherGrade[];
  homeworks: TeacherHomework[];
  words: TeacherDictionaryWord[];
  notes: TeacherNote[];
  noteText: string;
  setNoteText: (value: string) => void;
  onAddNote: (text: string) => void;
  onDeleteDictionaryWord?: (word: TeacherDictionaryWord) => void;
}) {
  const copy = labels[lang];
  const tabs: TeacherStudentTab[] = ['overview', 'schedule', 'grades', 'homework', 'dictionary', 'analytics', 'notes'];

  if (!student) {
    return <TeacherEmptyState icon={BookOpen} title={copy.choose} description={copy.chooseText} />;
  }

  const groups = student.groupNames.join(', ') || missingValue[lang];

  return (
    <div className="rounded-3xl border border-purple-100 bg-white/55 p-5 shadow-sm dark-panel-soft">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-purple-100 bg-white/65 p-4">
          <div className="flex items-center gap-4">
            <TeacherAvatar name={student.name} size="lg" />
            <div className="min-w-0">
              <h3 className="truncate font-display text-2xl font-black text-purple-700">{student.name}</h3>
              <p className="truncate font-body text-sm text-purple-400">{student.email}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <InfoRow label={copy.status} value={studentStatusLabel(student.statusLabel, lang)} />
            {student.age && <InfoRow label={copy.age} value={student.age} />}
            <InfoRow label={copy.level} value={student.level || missingValue[lang]} />
            <InfoRow label={copy.group} value={groups} />
            <InfoRow label={copy.lessons} value={student.lessonsCount} />
            <InfoRow label={copy.attendance} value={`${student.attendance}%`} />
          </div>
        </div>
        <div className="rounded-3xl border border-purple-100 bg-white/65 p-4">
          <div className="grid gap-2">
            <InfoRow label={copy.tariff} value={student.tariff || missingValue[lang]} />
            <InfoRow label={copy.teacher} value={teacherName} />
            <InfoRow label={copy.progress} value={`${student.progress}%`} />
            <InfoRow label={copy.lastActivity} value={formatTeacherDate(student.lastActivity, lang)} />
            <InfoRow label={copy.nextLesson} value={formatLessonMoment(student.nextLesson, lang)} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item, index) => (
          <button key={item} onClick={() => setTab(item)} className={`min-w-max rounded-2xl px-3 py-2 font-body text-xs font-800 ${tab === item ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-md' : 'bg-white/70 text-purple-600 hover:bg-pink-50'}`}>
            {copy.tabs[index]}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'overview' && (
          <div className="grid gap-3 md:grid-cols-4">
            <InfoRow label={copy.lessons} value={student.lessonsCount} />
            <InfoRow label={copy.attendance} value={`${student.attendance}%`} />
            <InfoRow label={copy.progress} value={`${student.progress}%`} />
            <InfoRow label={copy.nextLesson} value={formatLessonMoment(student.nextLesson, lang)} />
          </div>
        )}
        {tab === 'schedule' && (
          lessons.length ? <div className="space-y-3">{lessons.map(lesson => <div key={lesson.id} className="rounded-2xl bg-white/65 p-4 font-body text-sm text-purple-600"><b>{formatLessonMoment(lesson, lang)}</b> · {lesson.title || lesson.topic || missingValue[lang]} · {lessonStatusLabel(lesson.status, lang)}{lesson.comment && <div className="mt-1 text-purple-400">{lesson.comment}</div>}</div>)}</div> : <TeacherEmptyState icon={CalendarDays} title={copy.noSchedule} description={copy.noScheduleText} />
        )}
        {tab === 'grades' && (
          grades.length ? <div className="space-y-3">{grades.map(grade => <div key={grade.id} className="flex items-center justify-between rounded-2xl bg-white/65 p-4"><div><div className="font-body font-800 text-purple-700">{gradeCategoryLabel(grade.category, lang)}</div><div className="font-body text-xs text-purple-400">{formatTeacherDate(grade.createdAt, lang)} · {grade.comment || missingValue[lang]}</div></div><div className="font-display text-3xl font-black text-purple-700">{grade.score}</div></div>)}</div> : <TeacherEmptyState icon={Star} title={copy.noGrades} description={copy.noGradesText} />
        )}
        {tab === 'homework' && (
          homeworks.length ? <div className="space-y-3">{homeworks.map(item => <div key={item.id} className="rounded-2xl bg-white/65 p-4 font-body text-sm text-purple-600"><b>{item.title}</b><div className="text-xs text-purple-400">{formatTeacherDate(item.dueDate, lang, false)} · {item.teacherComment || missingValue[lang]}</div></div>)}</div> : <TeacherEmptyState icon={ClipboardCheck} title={copy.noHomework} description={copy.noHomeworkText} />
        )}
        {tab === 'dictionary' && (
          words.length ? <div className="grid gap-3 sm:grid-cols-2">{words.map(word => <div key={word.id} className="rounded-2xl bg-white/65 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-display text-xl font-black text-purple-700">{word.emoji} {word.word}</div><div className="font-body text-sm text-purple-500">{word.translation}</div></div>{onDeleteDictionaryWord && <button type="button" onClick={() => onDeleteDictionaryWord(word)} className="rounded-full bg-red-100 p-2 text-red-500 transition hover:bg-red-200" aria-label={copy.deleteWord}><Trash2 className="h-4 w-4" /></button>}</div></div>)}</div> : <TeacherEmptyState icon={BookOpen} title={copy.noDictionary} description={copy.noDictionaryText} />
        )}
        {tab === 'analytics' && (
          <div className="grid gap-3 md:grid-cols-3">
            <InfoRow label={copy.lessons} value={student.lessonsCount} />
            <InfoRow label={copy.attendance} value={`${student.attendance}%`} />
            <InfoRow label={copy.progress} value={`${student.progress}%`} />
          </div>
        )}
        {tab === 'notes' && (
          <div className="space-y-3">
            <textarea value={noteText} onChange={event => setNoteText(event.target.value)} placeholder={copy.notePlaceholder} className="input-magic min-h-24" />
            <button onClick={() => { if (noteText.trim()) onAddNote(noteText.trim()); }} className="btn-magic px-5 py-2.5 text-sm text-white">{copy.addNote}</button>
            {notes.length ? notes.map(note => <div key={note.id} className="rounded-2xl bg-white/70 p-4 font-body text-sm text-purple-600"><FileText className="mb-2 h-4 w-4 text-pink-400" />{note.text}<div className="mt-2 text-xs text-purple-300">{formatTeacherDate(note.createdAt, lang)}</div></div>) : <TeacherEmptyState icon={StickyNote} title={copy.noNotes} description={copy.noNotesText} />}
          </div>
        )}
      </div>
    </div>
  );
}
