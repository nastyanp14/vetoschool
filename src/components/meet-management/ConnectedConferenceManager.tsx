import ConferenceManager from './ConferenceManager';
import { useConferences } from '@/hooks/useConferences';
import { saveConference, transitionConferenceRemote } from '@/lib/conferences';
import type { Lang } from '@/lib/i18n';
import type { ManagerRole } from './model';

export default function ConnectedConferenceManager({lang,role}:{lang:Lang;role:ManagerRole}) {
  const data=useConferences({manager:true});
  return <ConferenceManager lang={lang} role={role} teacherId={role==='teacher' ? data.people.teachers[0]?.id : ''}
    teachers={data.people.teachers} students={data.people.students} conferences={data.rows}
    remote={{save:saveConference,transition:transitionConferenceRemote,refresh:data.refresh}}
    loading={data.loading} error={data.error || data.syncError} />;
}
