import { useNavigate, useParams } from 'react-router-dom';
import ClassroomPreview from '@/components/meet/ClassroomPreview';
import { meetCopy } from '@/components/meet/copy';
import type { Lang } from '@/lib/i18n';
import { getCurrentUser, homePathForUser } from '@/lib/auth';

export default function Classroom({ lang }: { lang: Lang }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const exit = () => navigate(user?.role === 'student' ? '/dashboard?tab=online-class' : homePathForUser(user));
  // This reserved ID is a design mock, not an accessible conference or an access check.
  if (roomId === 'design-preview') return <ClassroomPreview lang={lang} onExit={exit} />;
  const c = meetCopy[lang];
  return <main className="meet-room min-h-screen grid place-content-center text-center gap-4"><h1 className="text-2xl font-bold">{c.unavailable}</h1><p>{c.unavailableHint}</p><button className="meet-button meet-secondary" type="button" onClick={exit}>{c.back}</button></main>;
}
