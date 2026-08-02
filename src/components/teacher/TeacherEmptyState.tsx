import { LucideIcon } from 'lucide-react';

export function TeacherEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-purple-100 bg-white/60 p-6 text-center shadow-sm dark-panel-soft">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100">
        <Icon className="h-6 w-6 text-purple-500" />
      </div>
      <h3 className="font-display text-xl font-black text-purple-700">{title}</h3>
      <p className="mx-auto mt-2 max-w-md font-body text-sm text-purple-500">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-magic mt-5 px-5 py-2.5 text-sm text-white">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
