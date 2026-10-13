import { useNavigate, useParams } from 'react-router-dom';
import ClassroomPreview from '@/components/meet/ClassroomPreview';
import type { Lang } from '@/lib/i18n';
import { getCurrentUser, homePathForUser } from '@/lib/auth';
import { useConferences } from '@/hooks/useConferences';
import LiveClassroom from '@/components/meet/LiveClassroom';

export function FinishedClassroom({ title, minutes, studentCount, showSummary, onExit }: {
  title: string;
  minutes: number | null;
  studentCount: number;
  showSummary: boolean;
  onExit: () => void;
}) {
  return <main className="meet-room meet-finished"><section className="meet-finished-card" aria-labelledby="meet-finished-title">
    <span className="meet-finished-glow" aria-hidden="true" />
    <img className="meet-finished-owl" src="/dashboard/meet/completion-owl.png" alt="Совка з сердечком показує, що заняття завершено" />
    <span className="meet-finished-kicker">Vetoschool Meet</span>
    <h1 id="meet-finished-title">Заняття завершено!</h1>
    <div className="meet-finished-thanks"><span>Дякуємо за участь</span><img src="/dashboard/meet/completion-heart.png" alt="" /></div>
    {showSummary && <div className="meet-finished-summary"><strong>{title}</strong><div>{minutes !== null && <span><small>Тривалість</small>{minutes} хв</span>}<span><small>Учнів</small>{studentCount}</span></div></div>}
    <button className="meet-button meet-primary" type="button" onClick={onExit}>Повернутися до онлайн-класу</button>
  </section></main>;
}

export default function Classroom({ lang }: { lang: Lang }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const preview=import.meta.env.DEV && roomId==='design-preview';
  const data=useConferences({enabled:!preview,room:roomId});
  const exit = () => navigate(user?.role === 'student' ? '/dashboard?tab=online-class' : homePathForUser(user));
  if (preview) return <ClassroomPreview lang={lang} onExit={exit} />;
  const conference=data.rows[0];
  if (conference?.status === 'active' && user) return <LiveClassroom conference={conference} user={user} onExit={exit} onRefresh={data.refresh} />;
  if (conference?.status === 'completed') {
    const seconds = conference.startedAt && conference.endedAt ? Math.max(0, Math.round((new Date(conference.endedAt).getTime()-new Date(conference.startedAt).getTime())/60000)) : null;
    return <FinishedClassroom title={conference.title} minutes={seconds} studentCount={conference.studentIds.length} showSummary={user?.role !== 'student'} onExit={exit} />;
  }
  const message=data.loading ? 'Перевірка доступу…' : data.error || (!conference ? 'У вас немає доступу до цієї конференції' :
    conference.status==='cancelled' ? 'Цю конференцію скасовано' :
    'Очікуємо початку заняття');
  return <main className="meet-room min-h-screen grid place-content-center text-center gap-4">
    <h1 className="text-2xl font-bold">Vetoschool Meet</h1>
    {conference&&<h2>{conference.title}</h2>}
    <p role="status">{message}</p>
    {data.syncError&&<p role="alert">{data.syncError}</p>}
    {(data.error||data.syncError)&&<button className="meet-button meet-secondary" type="button" onClick={()=>void data.refresh()}>Спробувати ще раз</button>}
    <button className="meet-button meet-secondary" type="button" onClick={exit}>Назад до занять</button>
  </main>;
}
