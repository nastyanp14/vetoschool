import { useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Copy, MoreHorizontal, Pencil, Play, Plus, Search, Users, Video, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ClassroomPreview from '@/components/meet/ClassroomPreview';
import type { Lang } from '@/lib/i18n';
import ConferenceForm from './ConferenceForm';
import { managerCopy } from './copy';
import { canManageConference, demoLink, isEditable, transitionConference, type Conference, type ConferenceDraft, type ConferenceStatus, type ManagerRole, type Person } from './model';
import './management.css';

type Props = { lang: Lang; role: ManagerRole; teacherId?: string; teachers: Person[]; students: Person[]; conferences: Conference[]; onChange: (rows: Conference[]) => void };
export default function ConferenceManager({ lang, role, teacherId='', teachers, students, conferences, onChange }: Props) {
  const c=managerCopy[lang];
  const [filter,setFilter]=useState('all');
  const [search,setSearch]=useState('');
  const [form,setForm]=useState<{initial:Conference|null}|null>(null);
  const [detailsId,setDetailsId]=useState<string|null>(null);
  const [confirmation,setConfirmation]=useState<{id:string;status:'cancelled'|'completed'}|null>(null);
  const [roomId,setRoomId]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const rows=conferences.filter(row=>canManageConference(row,role,teacherId));
  const details=rows.find(row=>row.id===detailsId);
  const room=rows.find(row=>row.id===roomId && row.status==='active');
  const teacherName=(id:string)=>teachers.find(person=>person.id===id)?.name || '—';
  const studentName=(id:string)=>students.find(person=>person.id===id)?.name || '—';
  const query=search.trim().toLocaleLowerCase();
  const visible=rows.filter(row=>(filter==='all' || (filter==='history' ? ['completed','cancelled'].includes(row.status) : row.status===filter)) && `${row.title} ${teacherName(row.teacherId)}`.toLocaleLowerCase().includes(query));
  const next=rows.filter(row=>row.status==='scheduled').sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  const status=(row:Conference)=><span className={`conf-badge conf-${row.status}`}><span />{c[row.status]}</span>;
  const dateText=(row:Conference)=>new Date(`${row.date}T12:00:00`).toLocaleDateString(lang==='ua'?'uk-UA':lang,{day:'numeric',month:'short',year:'numeric'});
  const meta=(row:Conference)=><div className="conf-meta"><span><CalendarDays size={15}/>{dateText(row)} · {row.time}</span><span><Clock3 size={15}/>{row.duration} {c.minutes}</span><span><Users size={15}/>{row.studentIds.length} / {row.type==='individual'?1:4} · {c.students}</span></div>;
  const updateStatus=(id:string,target:ConferenceStatus)=>onChange(conferences.map(row=>row.id===id?transitionConference(row,target,role,teacherId):row));
  const copy=async(row:Conference)=>{
    try { await navigator.clipboard.writeText(demoLink(row)); setNotice(c.copied); }
    catch { setNotice(c.copyFailed); setDetailsId(row.id); }
  };
  const edit=(row:Conference)=>{if(!isEditable(row))return;setDetailsId(null);setForm({initial:row});};
  const save=(draft:ConferenceDraft)=>{
    if(form?.initial){
      const current=conferences.find(row=>row.id===form.initial?.id);
      if(!current || !isEditable(current) || !canManageConference(current,role,teacherId))return;
      onChange(conferences.map(row=>row.id===current.id?{...row,...draft}:row));setDetailsId(current.id);setNotice(c.saved);
    } else {
      const id=crypto.randomUUID();
      const created:Conference={...draft,id,code:`DEMO-${id.slice(0,8).toUpperCase()}`,status:'scheduled'};
      onChange([...conferences,created]);setDetailsId(id);setNotice(c.created);setFilter('all');setSearch('');
    }
    setForm(null);
  };
  const start=(row:Conference)=>{if(role!=='teacher'||row.teacherId!==teacherId||!isEditable(row))return;if(row.status==='scheduled')updateStatus(row.id,'active');setDetailsId(null);setRoomId(row.id);};
  const primaryAction=(row:Conference)=>role==='teacher' && isEditable(row)
    ? <button className="conf-button conf-primary" type="button" onClick={()=>start(row)}><Play size={16}/>{row.status==='active'?c.return:c.start}</button>
    : role==='admin' && row.status==='active'
      ? <button className="conf-button conf-primary" type="button" onClick={()=>{setDetailsId(null);setRoomId(row.id);}}><Video size={16}/>{c.join}</button>
      : <button className="conf-button conf-secondary" type="button" onClick={()=>setDetailsId(row.id)}>{isEditable(row)?c.view:c.details}</button>;
  const extraActions=(row:Conference)=><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="conf-more" aria-label={`${c.more}: ${row.title}`}><MoreHorizontal size={21}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="conf-menu">
    <DropdownMenuItem onSelect={()=>setDetailsId(row.id)}>{c.view}</DropdownMenuItem>
    {isEditable(row)&&<DropdownMenuItem onSelect={()=>edit(row)}><Pencil size={15}/>{c.edit}</DropdownMenuItem>}
    <DropdownMenuItem onSelect={()=>void copy(row)}><Copy size={15}/>{c.copy}</DropdownMenuItem>
    {role==='admin'&&isEditable(row)&&<DropdownMenuItem onSelect={()=>setConfirmation({id:row.id,status:'cancelled'})}><XCircle size={15}/>{c.cancel}</DropdownMenuItem>}
    {role==='teacher'&&row.status==='active'&&<DropdownMenuItem onSelect={()=>setConfirmation({id:row.id,status:'completed'})}><CheckCircle2 size={15}/>{c.end}</DropdownMenuItem>}
  </DropdownMenuContent></DropdownMenu>;
  const tabs=role==='admin'?[['all',c.all],['scheduled',c.scheduledPlural],['active',c.activePlural],['completed',c.completedPlural],['cancelled',c.cancelledPlural]]:[['all',c.mine],['scheduled',c.scheduledPlural],['history',c.history]];
  return <section className="conf-ui conf-manager" aria-label={role==='admin'?c.title:c.teacherTitle}>
    <header className="conf-heading"><div><p className="conf-kicker">Vetoschool Meet</p><h2>{role==='admin'?c.title:c.teacherTitle}</h2><p>{role==='admin'?c.subtitle:c.teacherSubtitle}</p></div><button className="conf-button conf-primary" type="button" onClick={()=>setForm({initial:null})}><Plus size={19}/>{c.create}</button></header>
    <p className="conf-demo"><strong>{c.demo}.</strong> {c.demoHint}</p>
    {notice&&<p role="status" className="conf-notice">{notice}</p>}
    {role==='admin'?<div className="conf-stats">{[{label:c.total,count:rows.length,icon:Video,tone:'lavender'},{label:c.scheduledPlural,count:rows.filter(row=>row.status==='scheduled').length,icon:CalendarDays,tone:'pink'},{label:c.activePlural,count:rows.filter(row=>row.status==='active').length,icon:Play,tone:'blue'},{label:c.completedPlural,count:rows.filter(row=>row.status==='completed').length,icon:CheckCircle2,tone:'cream'}].map(({label,count,icon:Icon,tone})=><div className={`conf-stat conf-stat-${tone}`} key={label}><span className="conf-stat-icon"><Icon size={21}/></span><div><p>{label}</p><strong>{count}</strong></div></div>)}</div>
      : <section className="conf-next"><div className="conf-stat-icon"><CalendarDays size={27}/></div><div><p className="conf-kicker">{c.next}</p><h3>{next?.title||c.noNext}</h3>{next&&meta(next)}</div>{next&&<div className="conf-next-action">{status(next)}{primaryAction(next)}</div>}</section>}
    <Tabs value={filter} onValueChange={setFilter} className="conf-list-panel"><div className="conf-toolbar"><TabsList aria-label={c.nav} className="conf-tabs">{tabs.map(([value,label])=><TabsTrigger key={value} value={value} className="conf-tab">{label}</TabsTrigger>)}</TabsList><div className="conf-search"><Search size={18}/><input aria-label={c.search} placeholder={c.search} value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
      <TabsContent value={filter} className="conf-rows" aria-live="polite">{visible.length?visible.map(row=><article className="conf-row" key={row.id}><div className="conf-row-icon"><Video size={23}/></div><div className="conf-row-main"><div className="conf-row-title"><h3>{row.title}</h3>{status(row)}</div><p className="conf-teacher">{c.teacher}: {teacherName(row.teacherId)}</p>{meta(row)}</div><div className="conf-row-actions">{primaryAction(row)}{extraActions(row)}</div></article>):<div className="conf-empty"><Video size={32}/><h3>{rows.length?c.noResults:c.empty}</h3><p>{rows.length?c.noResultsHint:c.emptyHint}</p></div>}</TabsContent>
    </Tabs>
    {form&&<ConferenceForm lang={lang} role={role} teacherId={teacherId} teachers={teachers} students={students} initial={form.initial} onClose={()=>setForm(null)} onSave={save}/>}
    <Dialog open={!!details} onOpenChange={open=>{if(!open)setDetailsId(null);}}><DialogContent className="conf-ui conference-dialog"><DialogTitle className="conf-dialog-title">{details?.title}</DialogTitle><DialogDescription>{c.demo} · {details&&isEditable(details)?c.localHint:c.readOnly}</DialogDescription>{details&&<>
      {status(details)}<dl className="conf-details"><div><dt>{c.date} · {c.time}</dt><dd>{dateText(details)} · {details.time}</dd></div><div><dt>{c.duration}</dt><dd>{details.duration} {c.minutes}</dd></div><div><dt>{c.type}</dt><dd>{c[details.type]}</dd></div><div><dt>{c.teacher}</dt><dd>{teacherName(details.teacherId)}</dd></div></dl>
      <div className="conf-participants"><h3>{c.participants} · {details.studentIds.length+1}</h3><p><span className="conf-avatar">{teacherName(details.teacherId)[0]}</span>{teacherName(details.teacherId)} · {c.teacher}</p>{details.studentIds.map(id=><p key={id}><span className="conf-avatar">{studentName(id)[0]}</span>{studentName(id)}</p>)}</div>
      {details.description&&<p className="conf-description">{details.description}</p>}
      <div className="conf-link-box"><label>{c.code}<input readOnly value={details.code}/></label><label>{c.link}<input readOnly value={demoLink(details)} onFocus={e=>e.target.select()}/></label><button className="conf-button conf-secondary" type="button" onClick={()=>void copy(details)}><Copy size={16}/>{c.copy}</button><p role="status" className="conf-help">{notice}</p></div>
      <div className="conf-dialog-actions">{isEditable(details)&&<button className="conf-button conf-secondary" type="button" onClick={()=>edit(details)}><Pencil size={16}/>{c.edit}</button>}{role==='admin'&&isEditable(details)&&<button className="conf-button conf-danger" type="button" onClick={()=>{setDetailsId(null);setConfirmation({id:details.id,status:'cancelled'});}}>{c.cancel}</button>}{role==='teacher'&&details.status==='active'&&<button className="conf-button conf-danger" type="button" onClick={()=>{setDetailsId(null);setConfirmation({id:details.id,status:'completed'});}}>{c.end}</button>}{isEditable(details)&&(role==='teacher'||details.status==='active')&&primaryAction(details)}</div>
    </>}</DialogContent></Dialog>
    <Dialog open={!!confirmation} onOpenChange={open=>{if(!open)setConfirmation(null);}}><DialogContent className="conf-ui conference-dialog conf-confirm"><DialogTitle>{confirmation?.status==='completed'?c.confirmEnd:c.confirmCancel}</DialogTitle><DialogDescription>{rows.find(row=>row.id===confirmation?.id)?.title}. {c.terminalHint} {c.localHint}.</DialogDescription><div className="conf-dialog-actions"><button className="conf-button conf-secondary" type="button" onClick={()=>setConfirmation(null)}>{c.back}</button><button className="conf-button conf-danger" type="button" onClick={()=>{if(confirmation)updateStatus(confirmation.id,confirmation.status);setConfirmation(null);}}>{c.confirm}</button></div></DialogContent></Dialog>
    <Dialog open={!!room} onOpenChange={open=>{if(!open)setRoomId(null);}}><DialogContent className="meet-room-dialog"><DialogTitle className="sr-only">{room?.title}</DialogTitle><DialogDescription className="sr-only">{c.demoHint}</DialogDescription>{room&&<ClassroomPreview lang={lang} title={room.title} onExit={()=>setRoomId(null)}/>}</DialogContent></Dialog>
  </section>;
}
