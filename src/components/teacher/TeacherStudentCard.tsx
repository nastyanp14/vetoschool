import { Lang } from '@/lib/i18n';
import { TeacherStudent } from '@/lib/teachers';
import { formatLessonMoment, missingValue, studentStatusLabel } from '@/lib/teacherUi';
import { TeacherAvatar } from './TeacherAvatar';

const labels = {
  ru: { age: 'Возраст', level: 'Уровень', group: 'Группа', attendance: 'Посещаемость', grade: 'Средняя оценка', next: 'Следующий урок' },
  ua: { age: 'Вік', level: 'Рівень', group: 'Група', attendance: 'Відвідуваність', grade: 'Середня оцінка', next: 'Наступний урок' },
  en: { age: 'Age', level: 'Level', group: 'Group', attendance: 'Attendance', grade: 'Average grade', next: 'Next lesson' },
};

export function TeacherStudentCard({
  student,
  lang,
  active,
  onOpen,
}: {
  student: TeacherStudent;
  lang: Lang;
  active?: boolean;
  onOpen: () => void;
}) {
  const copy = labels[lang];
  const group = student.groupNames.join(', ') || missingValue[lang];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-3xl border p-4 text-left transition-all ${
        active ? 'border-pink-200 bg-pink-50 shadow-lg' : 'border-purple-100 bg-white/65 hover:bg-pink-50/70'
      }`}
    >
      <div className="flex items-center gap-3">
        <TeacherAvatar name={student.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-body text-base font-800 text-purple-700">{student.name}</div>
          <div className="truncate font-body text-xs text-purple-400">{group}</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 font-body text-[11px] font-800 ${student.statusLabel === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {studentStatusLabel(student.statusLabel, lang)}
        </span>
      </div>
      <div className="mt-4 grid gap-2 font-body text-xs text-purple-500 sm:grid-cols-2">
        {student.age && <span>{copy.age}: <b>{student.age}</b></span>}
        {student.level && <span>{copy.level}: <b>{student.level}</b></span>}
        <span>{copy.attendance}: <b>{student.attendance}%</b></span>
        <span>{copy.grade}: <b>{student.averageGrade || missingValue[lang]}</b></span>
        <span className="sm:col-span-2">{copy.next}: <b>{formatLessonMoment(student.nextLesson, lang)}</b></span>
      </div>
    </button>
  );
}
