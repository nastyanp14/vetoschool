import { useNavigate, useParams } from 'react-router-dom';
import ClassroomPreview from '@/components/meet/ClassroomPreview';
import type { Lang } from '@/lib/i18n';
import { getCurrentUser, homePathForUser } from '@/lib/auth';
import { useConferences } from '@/hooks/useConferences';

export default function Classroom({ lang }: { lang: Lang }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const preview=import.meta.env.DEV && roomId==='design-preview';
  const data=useConferences({enabled:!preview,room:roomId});
  const exit = () => navigate(user?.role === 'student' ? '/dashboard?tab=online-class' : homePathForUser(user));
  if (preview) return <ClassroomPreview lang={lang} onExit={exit} />;
  const conference=data.rows[0];
  const message=data.loading ? 'Перевірка доступу…' : data.error || (!conference ? 'У вас немає доступу до цієї конференції' :
    conference.status==='cancelled' ? 'Конференцію скасовано.' :
    conference.status==='completed' ? 'Конференцію завершено.' :
    conference.status==='scheduled' ? 'Конференція ще не розпочалася.' :
    'Підключення відеозв’язку знаходиться в розробці.');
  return <main className="meet-room min-h-screen grid place-content-center text-center gap-4">
    <h1 className="text-2xl font-bold">Vetoschool Meet</h1>
    {conference?.status==='active'&&<h2>{conference.title}</h2>}
    <p role="status">{message}</p>
    {data.syncError&&<p role="alert">{data.syncError}</p>}
    {(data.error||data.syncError)&&<button className="meet-button meet-secondary" type="button" onClick={()=>void data.refresh()}>Спробувати ще раз</button>}
    <button className="meet-button meet-secondary" type="button" onClick={exit}>Назад до занять</button>
  </main>;
}
