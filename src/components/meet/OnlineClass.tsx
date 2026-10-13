import { useState } from 'react';
import { CalendarDays, ChevronRight, Clock3, Video } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useConferences } from '@/hooks/useConferences';
import { meetCopy } from './copy';
import ClassroomPreview from './ClassroomPreview';
import OnlineClassBanner from './OnlineClassBanner';
import './meet.css';

// Fixtures are passed only by the separate development preview. No database data is implied.
export type MeetLesson = {
  id: string; title: string; date: string; time: string; duration: number;
  teacher: string; avatar?: string; icon: string; status: 'ready' | 'planned' | 'completed' | 'cancelled'; roomId?: string;
};

type Props = { lang: Lang; demoLessons?: MeetLesson[]; showBanner?: boolean };

export default function OnlineClass({ lang, demoLessons, showBanner = true }: Props) {
  const c = meetCopy[lang];
  const [details, setDetails] = useState<MeetLesson | null>(null);
  const [room, setRoom] = useState<MeetLesson | null>(null);
  const data=useConferences({enabled:demoLessons===undefined});
  const lessons:MeetLesson[]=demoLessons ?? data.rows.map(row=>({
    id:row.id,title:row.title,date:new Date(`${row.date}T12:00:00`).toLocaleDateString(lang==='ua'?'uk-UA':lang,{day:'numeric',month:'long',year:'numeric'}),
    time:row.time,duration:row.duration,teacher:row.teacherName||'—',roomId:row.roomId,
    icon:'/dashboard/meet/camera.png',status:row.status==='active'?'ready':row.status==='scheduled'?'planned':row.status,
  }));
  const next = lessons.find(lesson => lesson.status==='ready') || lessons.find(lesson => !['completed','cancelled'].includes(lesson.status));
  const demo = demoLessons !== undefined;
  const selectedDetails=details ? lessons.find(lesson=>lesson.id===details.id) : null;

  const meta = (lesson: MeetLesson) => (
    <div className="meet-meta">
      <span><CalendarDays size={18} />{lesson.date === 'today' ? c.today : lesson.date}, {lesson.time}</span>
      <span><Clock3 size={18} />{lesson.duration} {c.minutes}</span>
      <span>{lesson.avatar ? <img className="meet-avatar" src={lesson.avatar} alt="" /> : <span className="meet-initial" aria-hidden="true">{lesson.teacher[0]}</span>}{c.teacher}: {lesson.teacher}</span>
    </div>
  );
  const action = (lesson: MeetLesson) => (
    <button type="button" className={lesson.status === 'ready' ? 'meet-button meet-primary' : 'meet-button meet-secondary'} onClick={() => lesson.status === 'ready' ? (lesson.roomId ? window.location.assign(`/classroom/${encodeURIComponent(lesson.roomId)}`) : setRoom(lesson)) : setDetails(lesson)}>
      {lesson.status === 'ready' && <Video size={20} fill="currentColor" />}
      {lesson.status === 'ready' ? c.join : c.details}<ChevronRight size={20} />
    </button>
  );

  return (
    <section className="meet-section" aria-label={c.title}>
      {showBanner && <OnlineClassBanner lang={lang} />}
      {demo && <p className="meet-demo-note"><strong>{c.demo}.</strong> {c.demoHint}</p>}
      {!demo&&data.loading&&<p role="status" className="meet-muted">Завантаження конференцій…</p>}
      {!demo&&(data.error||data.syncError)&&<p role="alert">{data.error||data.syncError} <button type="button" className="meet-button meet-secondary" onClick={()=>void data.refresh()}>Оновити</button></p>}
      <section className="meet-next" aria-labelledby="meet-next-title">
        <div className="meet-lesson-icon meet-calendar"><img src="/dashboard/menu-icons/schedule.png" alt="" /></div>
        <div className="meet-lesson-copy"><p id="meet-next-title" className="meet-eyebrow">{c.next}</p>
          <h3>{next ? next.title : c.empty}</h3>
          {next ? meta(next) : <p className="meet-muted">{c.emptyHint}</p>}
        </div>
        {next && action(next)}
      </section>
      <Tabs defaultValue="mine" className="meet-tabs">
        <div className="meet-tabs-scroll"><TabsList className="meet-tab-list" aria-label={c.title}>
          <TabsTrigger className="meet-tab" value="mine">{c.mine}</TabsTrigger>
          <TabsTrigger className="meet-tab" value="scheduled">{c.scheduled}</TabsTrigger>
          <TabsTrigger className="meet-tab" value="history">{c.history}</TabsTrigger>
        </TabsList></div>
        {(['mine', 'scheduled', 'history'] as const).map(tab => {
          const visible = lessons.filter(lesson => tab === 'history' ? ['completed','cancelled'].includes(lesson.status) : tab === 'scheduled' ? lesson.status === 'planned' : !['completed','cancelled'].includes(lesson.status));
          return <TabsContent key={tab} value={tab} className="meet-list">
            {visible.length ? visible.map(lesson => <article key={lesson.id} className="meet-card">
              <div className="meet-lesson-icon"><img src={lesson.icon} alt="" /></div>
              <div className="meet-lesson-copy"><div className="meet-card-heading"><h3>{lesson.title}</h3><span className={`meet-status meet-status-${lesson.status}`}>{lesson.status==='cancelled'?'Скасована':c[lesson.status]}</span></div>{meta(lesson)}</div>
              {action(lesson)}
            </article>) : <div className="meet-empty"><span className="meet-empty-icon"><img src="/dashboard/meet/camera.png" alt="" aria-hidden="true" className="h-full w-full object-contain" /></span><h3>{tab === 'history' ? c.historyEmpty : c.empty}</h3><p>{tab === 'history' ? c.historyHint : c.emptyHint}</p></div>}
          </TabsContent>;
        })}
      </Tabs>
      <Dialog open={!!selectedDetails} onOpenChange={open => { if (!open) setDetails(null); }}>
        <DialogContent className="meet-dialog"><DialogTitle>{selectedDetails?.title}</DialogTitle><DialogDescription>{demo?`${c.demo} · ${c.lessonDetails}`:c.lessonDetails}</DialogDescription>
          {selectedDetails && <><span className="meet-status">{selectedDetails.status==='cancelled'?'Скасована':c[selectedDetails.status]}</span>{meta(selectedDetails)}</>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!room} onOpenChange={open => { if (!open) setRoom(null); }}>
        <DialogContent className="meet-room-dialog">
          <DialogTitle className="sr-only">{room?.title}</DialogTitle><DialogDescription className="sr-only">{c.demoHint}</DialogDescription>
          {room && <ClassroomPreview lang={lang} title={room.title} onExit={() => setRoom(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
