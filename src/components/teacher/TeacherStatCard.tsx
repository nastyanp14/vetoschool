import { LucideIcon } from 'lucide-react';

export function TeacherStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'purple',
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'pink' | 'purple' | 'blue' | 'green' | 'yellow' | 'red';
  onClick?: () => void;
}) {
  const tones = {
    pink: 'from-pink-50 to-rose-50 text-pink-500',
    purple: 'from-purple-50 to-pink-50 text-purple-500',
    blue: 'from-blue-50 to-purple-50 text-blue-500',
    green: 'from-green-50 to-blue-50 text-green-500',
    yellow: 'from-yellow-50 to-pink-50 text-yellow-600',
    red: 'from-red-50 to-pink-50 text-red-500',
  };
  const content = (
    <>
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="font-display text-3xl font-black text-purple-700">{value}</div>
      <div className="mt-1 font-body text-sm font-700 text-purple-500">{label}</div>
      {hint && <div className="mt-1 truncate font-body text-xs text-purple-400">{hint}</div>}
    </>
  );

  const className = `rounded-3xl border border-white/80 bg-white/65 p-5 text-left shadow-sm dark-panel-soft ${onClick ? 'card-hover cursor-pointer' : ''}`;

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
