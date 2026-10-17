import { useNavigate, useParams } from 'react-router-dom';
import ClassroomPreview from '@/components/meet/ClassroomPreview';
import type { Lang } from '@/lib/i18n';
import { getCurrentUser, homePathForUser } from '@/lib/auth';
import { useConferences } from '@/hooks/useConferences';
import LiveClassroom from '@/components/meet/LiveClassroom';

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
    return <main className="meet-room meet-finished"><div className="meet-finished-card"><span className="meet-finished-heart">💜</span><h1>Заняття завершено!</h1><p>Дякуємо за участь 💜</p>{user?.role !== 'student' && <div className="meet-finished-summary"><strong>{conference.title}</strong>{seconds !== null && <span>Тривалість: {seconds} хв</span>}<span>Учнів: {conference.studentIds.length}</span></div>}<button className="meet-button meet-primary" type="button" onClick={exit}>Повернутися до онлайн-класу</button></div></main>;
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
