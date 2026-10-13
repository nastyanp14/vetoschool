import LiveClassroom from '@/components/meet/LiveClassroom';
import type { Conference } from '@/components/meet-management/model';
import type { User } from '@/lib/auth';

const previewConference: Conference = {
  id:'00000000-0000-0000-0000-000000000000', title:'English — My Home', type:'group', teacherId:'teacher',
  studentIds:['preview-student'], date:'2026-10-13', time:'16:00', duration:45, description:'', status:'active',
  code:'PREVIEW', version:1, startedAt:new Date().toISOString(),
};
const previewUser: User = {
  id:'preview-student', name:'Sophie Green', email:'preview@localhost', role:'student', hasAccess:true,
  paymentStatus:'paid', accessStatus:'active', emailConfirmed:true, createdAt:'', joinedAt:'',
};

// Development-only visual harness. It opens the real prejoin component but never bypasses production auth.
export default function MeetLivePreview() {
  return <LiveClassroom conference={previewConference} user={previewUser} onExit={() => undefined} onRefresh={async () => undefined} />;
}
