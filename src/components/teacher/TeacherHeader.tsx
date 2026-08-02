import { Link } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import { Lang } from '@/lib/i18n';
import { TeacherRecord } from '@/lib/teachers';
import { teacherDisplayName } from '@/lib/teacherUi';
import { TeacherAvatar } from './TeacherAvatar';

export function TeacherHeader({
  teacher,
  lang,
  onLangChange,
  onLogout,
  logoutLabel,
}: {
  teacher: TeacherRecord | null;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onLogout: () => void;
  logoutLabel: string;
}) {
  const name = teacherDisplayName(teacher, lang);

  return (
    <header className="sticky top-0 z-40 glass border-b border-purple-100 shadow-[0_4px_20px_rgba(150,100,200,0.1)]">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="text-2xl">📖</span>
          <span className="truncate bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text font-display text-xl font-black text-transparent">
            Vetoschool
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <div className="flex rounded-full bg-white/70 p-1 shadow-sm">
            {(['ru', 'en', 'ua'] as Lang[]).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => onLangChange(item)}
                className={`rounded-full px-3 py-1.5 font-body text-xs font-800 transition-all ${
                  lang === item ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-md' : 'text-purple-500 hover:text-pink-500'
                }`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="hidden min-w-0 items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 sm:flex">
            <TeacherAvatar src={teacher?.avatarUrl} name={name} size="sm" />
            <span className="max-w-[150px] truncate font-body text-sm font-600 text-purple-700">{name}</span>
          </div>
          <button onClick={onLogout} className="px-1 font-body text-xs text-purple-400 transition hover:text-pink-500 sm:px-2">
            <span>{logoutLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
