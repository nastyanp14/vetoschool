import { LucideIcon } from 'lucide-react';

export function TeacherNavigation<T extends string>({
  items,
  active,
  onChange,
}: {
  items: Array<{ id: T; label: string; icon: LucideIcon }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="glass-card rounded-3xl p-2 shadow-sm">
      <div className="flex gap-2 overflow-x-auto md:flex-wrap">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 font-body text-sm font-800 transition-all ${
              active === item.id ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-md' : 'text-purple-600 hover:bg-white/70'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
