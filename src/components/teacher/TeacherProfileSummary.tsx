import { BookOpen, CalendarDays, Users } from 'lucide-react';
import { Lang } from '@/lib/i18n';
import { TeacherLesson, TeacherRecord } from '@/lib/teachers';
import { formatLessonMoment, teacherDisplayName, teacherStatusLabel } from '@/lib/teacherUi';
import { TeacherAvatar } from './TeacherAvatar';

const labels = {
  ru: { welcome: 'Добро пожаловать', status: 'Рабочий статус', nextLesson: 'Ближайший урок', students: 'Ученики', groups: 'Группы' },
  ua: { welcome: 'Ласкаво просимо', status: 'Робочий статус', nextLesson: 'Найближчий урок', students: 'Учні', groups: 'Групи' },
  en: { welcome: 'Welcome', status: 'Work status', nextLesson: 'Next lesson', students: 'Students', groups: 'Groups' },
};

export function TeacherProfileSummary({
  teacher,
  lang,
  nextLesson,
  studentsCount,
  groupsCount,
}: {
  teacher: TeacherRecord;
  lang: Lang;
  nextLesson: TeacherLesson | null;
  studentsCount: number;
  groupsCount: number;
}) {
  const copy = labels[lang];
  const name = teacherDisplayName(teacher, lang);

  return (
    <section className="glass-card rounded-3xl p-5 shadow-xl md:p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <TeacherAvatar src={teacher.avatarUrl} name={name} size="lg" />
          <div className="min-w-0">
            <p className="font-body text-sm font-700 text-purple-400">{copy.welcome}</p>
            <h1 className="truncate font-display text-3xl font-black text-purple-700">{name}</h1>
            <p className="truncate font-body text-sm text-purple-400">{teacher.email}</p>
            <div className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1 font-body text-xs font-800 text-green-700">
              {copy.status}: {teacherStatusLabel(teacher.status, lang)}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:w-[500px]">
          <SummaryItem icon={CalendarDays} label={copy.nextLesson} value={formatLessonMoment(nextLesson, lang)} />
          <SummaryItem icon={Users} label={copy.students} value={String(studentsCount)} />
          <SummaryItem icon={BookOpen} label={copy.groups} value={String(groupsCount)} />
        </div>
      </div>
    </section>
  );
}

function SummaryItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-purple-100 bg-white/60 p-4 shadow-sm dark-panel-soft">
      <Icon className="mb-2 h-5 w-5 text-pink-400" />
      <div className="font-body text-xs font-700 uppercase text-purple-300">{label}</div>
      <div className="mt-1 truncate font-display text-lg font-black text-purple-700">{value}</div>
    </div>
  );
}
