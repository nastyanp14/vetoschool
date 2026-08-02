import { initialsFor } from '@/lib/teacherUi';

export function TeacherAvatar({
  src,
  name,
  size = 'md',
}: {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizes = {
    sm: 'h-9 w-9 text-sm',
    md: 'h-11 w-11 text-base',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-24 w-24 text-3xl',
  };

  return (
    <div className={`${sizes[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-300 to-purple-400 font-display font-black text-white shadow-sm`}>
      {src ? (
        <img src={src} alt={name || 'Teacher'} className="h-full w-full object-cover" />
      ) : (
        <span>{initialsFor(name)}</span>
      )}
    </div>
  );
}
