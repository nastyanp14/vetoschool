import { useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Copy, Eye, MoreHorizontal, Pencil, Play, Plus, Search, Users, Video, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { conferenceError } from '@/lib/conferences';
import ClassroomPreview from '@/components/meet/ClassroomPreview';
import type { Lang } from '@/lib/i18n';
import ConferenceForm from './ConferenceForm';
import { managerCopy } from './copy';
import { canManageConference, conferenceLink, isEditable, transitionConference, type Conference, type ConferenceDraft, type ConferenceStatus, type ManagerRole, type Person } from './model';
import './management.css';

type Props = { lang: Lang; role: ManagerRole; teacherId?: string; teachers: Person[]; students: Person[]; conferences: Conference[]; onChange?: (rows: Conference[]) => void;
  remote?: { save: (draft: ConferenceDraft, initial?: Conference | null) => Promise<string>; transition: (row: Conference, status: ConferenceStatus) => Promise<void>; refresh: () => Promise<void> };
  loading?: boolean; error?: string };
export default function ConferenceManager({ lang, role, teacherId='', teachers, students, conferences, onChange, remote, loading=false, error }: Props) {
  const c=managerCopy[lang];
  const busyRef=useRef(false);
  const [busy,setBusy]=useState(false);
  const editable=(row:Conference)=>remote ? row.status==='scheduled' : isEditable(row);
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
  const teacherName=(id:string)=>teachers.find(person=>person.id===id)?.name || conferences.find(row=>row.teacherId===id)?.teacherName || '—';
  const studentName=(id:string)=>students.find(person=>person.id===id)?.name || details?.studentNames?.[id] || '—';
  const query=search.trim().toLocaleLowerCase();
  const visible=rows.filter(row=>(filter==='all' || (filter==='history' ? ['completed','cancelled'].includes(row.status) : row.status===filter)) && `${row.title} ${teacherName(row.teacherId)}`.toLocaleLowerCase().includes(query));
  const next=rows.filter(row=>row.status==='scheduled').sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  const status=(row:Conference)=><span className={`conf-badge conf-${row.status}`}><span />{c[row.status]}</span>;
  const dateText=(row:Conference)=>new Date(`${row.date}T12:00:00`).toLocaleDateString(lang==='ua'?'uk-UA':lang,{day:'numeric',month:'short',year:'numeric'});
  const meta=(row:Conference)=><div className="conf-meta"><span><CalendarDays size={15}/>{dateText(row)} · {row.time}</span><span><Clock3 size={15}/>{row.duration} {c.minutes}</span><span><Users size={15}/>{row.studentIds.length} / {row.type==='individual'?1:4} · {c.students}</span></div>;
  const updateStatus=async(id:string,target:ConferenceStatus)=>{
    if(busyRef.current)return false;
    const row=conferences.find(item=>item.id===id);if(!row)return false;
    busyRef.current=true;setBusy(true);
    try {
      if(remote){await remote.transition(row,target);await remote.refresh();}
      else onChange?.(conferences.map(item=>item.id===id?transitionConference(item,target,role,teacherId):item));
      setNotice(target==='cancelled'?'Конференцію скасовано.':target==='completed'?'Конференцію завершено.':'Конференцію розпочато.');
      return true;
    }catch(e){setNotice(conferenceError(e));await remote?.refresh();return false;}
    finally{busyRef.current=false;setBusy(false);}
  };
  const copy=async(row:Conference,code=false)=>{
    try { await navigator.clipboard.writeText(code ? row.code : conferenceLink(row)); setNotice(remote ? (code ? 'Код скопійовано.' : 'Посилання скопійовано.') : c.copied); }
    catch { setNotice(c.copyFailed); setDetailsId(row.id); }
  };
  const edit=(row:Conference)=>{if(!editable(row))return;setDetailsId(null);setForm({initial:row});};
  const save=async(draft:ConferenceDraft)=>{
    if(remote){
      const id=await remote.save(draft,form?.initial);
      setForm(null);setDetailsId(id);setNotice(form?.initial?'Зміни збережено.':'Конференцію успішно створено!');setFilter('all');setSearch('');
      await remote.refresh();return;
    }
    if(form?.initial){
      const current=conferences.find(row=>row.id===form.initial?.id);
      if(!current || !isEditable(current) || !canManageConference(current,role,teacherId))return;
      onChange?.(conferences.map(row=>row.id===current.id?{...row,...draft}:row));setDetailsId(current.id);setNotice(c.saved);
    } else {
      const id=crypto.randomUUID();
      const created:Conference={...draft,id,code:`DEMO-${id.slice(0,8).toUpperCase()}`,status:'scheduled'};
      onChange?.([...conferences,created]);setDetailsId(id);setNotice(c.created);setFilter('all');setSearch('');
    }
    setForm(null);
  };
  const start=async(row:Conference)=>{
    if(!canManageConference(row,role,teacherId)||!isEditable(row))return;
    if(row.status==='scheduled' && !(await updateStatus(row.id,'active')))return;
    if(remote){window.location.assign(conferenceLink(row));return;}
    setDetailsId(null);setRoomId(row.id);
  };
  const primaryAction=(row:Conference)=>isEditable(row) && (remote || role==='teacher' || row.status==='active')
    ? <button disabled={busy} className="conf-button conf-primary" type="button" onClick={()=>void start(row)}><Play size={16}/>{row.status==='active'?c.join:c.start}</button>
    : <button className="conf-button conf-secondary" type="button" onClick={()=>setDetailsId(row.id)}>{isEditable(row)?c.view:c.details}</button>;
  const extraActions=(row:Conference)=><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="conf-more" aria-label={`${c.more}: ${row.title}`}><MoreHorizontal size={21}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={8} collisionPadding={16} className="conf-ui conf-menu">
    <DropdownMenuItem onSelect={()=>setDetailsId(row.id)}><Eye size={16}/>{c.view}</DropdownMenuItem>
    {editable(row)&&<DropdownMenuItem onSelect={()=>edit(row)}><Pencil size={15}/>{c.edit}</DropdownMenuItem>}
    <DropdownMenuItem onSelect={()=>void copy(row)}><Copy size={15}/>{c.copy}</DropdownMenuItem>
    {isEditable(row) && <DropdownMenuSeparator className="conf-menu-separator"/>}
    {(remote||role==='admin')&&isEditable(row)&&<DropdownMenuItem className="conf-menu-danger" onSelect={()=>{setNotice('');setConfirmation({id:row.id,status:'cancelled'});}}><XCircle size={15}/>{c.cancel}</DropdownMenuItem>}
    {(remote||role==='teacher')&&row.status==='active'&&<DropdownMenuItem onSelect={()=>{setNotice('');setConfirmation({id:row.id,status:'completed'});}}><CheckCircle2 size={15}/>{c.end}</DropdownMenuItem>}
  </DropdownMenuContent></DropdownMenu>;
  const tabs=role==='admin'?[['all',c.all],['scheduled',c.scheduledPlural],['active',c.activePlural],['completed',c.completedPlural],['cancelled',c.cancelledPlural]]:[['all',c.mine],['scheduled',c.scheduledPlural],['history',c.history]];
  return <section className="conf-ui conf-manager" aria-label={role==='admin'?c.title:c.teacherTitle}>
    <header className="conf-heading"><div><p className="conf-kicker">Vetoschool Meet</p><h2>{role==='admin'?c.title:c.teacherTitle}</h2><p>{role==='admin'?c.subtitle:c.teacherSubtitle}</p></div><button className="conf-button conf-primary" type="button" disabled={loading || busy || !!error} onClick={()=>setForm({initial:null})}><Plus size={19}/>{c.create}</button></header>
    {!remote&&<p className="conf-demo"><strong>{c.demo}.</strong> {c.demoHint}</p>}
    {loading&&<p role="status" className="conf-notice">Завантаження конференцій…</p>}
    {error&&<p role="alert" className="conf-error">{error} <button type="button" className="conf-button conf-secondary" onClick={()=>void remote?.refresh()}>Оновити</button></p>}
    {notice&&<p role="status" className="conf-notice">{notice}</p>}
    {role==='admin'?<div className="conf-stats">{[{label:c.total,count:rows.length,icon:Video,tone:'lavender'},{label:c.scheduledPlural,count:rows.filter(row=>row.status==='scheduled').length,icon:CalendarDays,tone:'pink'},{label:c.activePlural,count:rows.filter(row=>row.status==='active').length,icon:Play,tone:'blue'},{label:c.completedPlural,count:rows.filter(row=>row.status==='completed').length,icon:CheckCircle2,tone:'cream'}].map(({label,count,icon:Icon,tone})=><div className={`conf-stat conf-stat-${tone}`} key={label}><span className="conf-stat-icon"><Icon size={21}/></span><div><p>{label}</p><strong>{count}</strong></div></div>)}</div>
      : <section className="conf-next"><div className="conf-stat-icon"><CalendarDays size={27}/></div><div><p className="conf-kicker">{c.next}</p><h3>{next?.title||c.noNext}</h3>{next&&meta(next)}</div>{next&&<div className="conf-next-action">{status(next)}{primaryAction(next)}</div>}</section>}
    <Tabs value={filter} onValueChange={setFilter} className="conf-list-panel"><div className="conf-toolbar"><TabsList aria-label={c.nav} className="conf-tabs">{tabs.map(([value,label])=><TabsTrigger key={value} value={value} className="conf-tab">{label}</TabsTrigger>)}</TabsList><div className="conf-search"><Search size={18}/><input aria-label={c.search} placeholder={c.search} value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
      <TabsContent value={filter} className="conf-rows" aria-live="polite">{visible.length?visible.map(row=><article className="conf-row" key={row.id}><div className="conf-row-icon"><Video size={23}/></div><div className="conf-row-main"><div className="conf-row-title"><h3>{row.title}</h3>{status(row)}</div><p className="conf-teacher">{c.teacher}: {teacherName(row.teacherId)}</p>{meta(row)}</div><div className="conf-row-actions">{primaryAction(row)}{extraActions(row)}</div></article>):<div className="conf-empty"><Video size={32}/><h3>{rows.length?c.noResults:c.empty}</h3><p>{rows.length?c.noResultsHint:c.emptyHint}</p></div>}</TabsContent>
    </Tabs>
    {form&&<ConferenceForm lang={lang} role={role} teacherId={teacherId} teachers={teachers} students={students} initial={form.initial} live={!!remote} onConflict={()=>void remote?.refresh()} onClose={()=>setForm(null)} onSave={save}/>}
    <Dialog open={!!details} onOpenChange={open=>{if(!open)setDetailsId(null);}}><DialogContent className="conf-ui conference-dialog conf-form-dialog"><div className="conf-form-scroll"><DialogTitle className="conf-dialog-title">{details?.title}</DialogTitle><DialogDescription>{remote ? (details&&editable(details)?'Vetoschool Meet':c.readOnly) : `${c.demo} · ${c.localHint}`}</DialogDescription>{details&&<>
      {status(details)}<dl className="conf-details"><div><dt>{c.date} · {c.time}</dt><dd>{dateText(details)} · {details.time}</dd></div><div><dt>{c.duration}</dt><dd>{details.duration} {c.minutes}</dd></div><div><dt>{c.type}</dt><dd>{c[details.type]}</dd></div><div><dt>{c.teacher}</dt><dd>{teacherName(details.teacherId)}</dd></div></dl>
      <div className="conf-participants"><h3>{c.participants} · {details.studentIds.length+1}</h3><p><span className="conf-avatar">{teacherName(details.teacherId)[0]}</span>{teacherName(details.teacherId)} · {c.teacher}</p>{details.studentIds.map(id=><p key={id}><span className="conf-avatar">{studentName(id)[0]}</span>{studentName(id)}</p>)}</div>
      {details.description&&<p className="conf-description">{details.description}</p>}
      <div className="conf-link-box"><label>{c.code}<input readOnly value={details.code}/></label><label>{remote?'Посилання на конференцію':c.link}<input readOnly value={conferenceLink(details)} onFocus={e=>e.target.select()}/></label><button className="conf-button conf-secondary" type="button" onClick={()=>void copy(details)}><Copy size={16}/>{c.copy}</button>{remote&&<button className="conf-button conf-secondary" type="button" onClick={()=>void copy(details,true)}><Copy size={16}/>Скопіювати код</button>}<p role="status" className="conf-help">{notice}</p></div>
      <div className="conf-dialog-actions">{editable(details)&&<button className="conf-button conf-secondary" type="button" onClick={()=>edit(details)}><Pencil size={16}/>{c.edit}</button>}{(remote||role==='admin')&&isEditable(details)&&<button className="conf-button conf-danger" type="button" onClick={()=>{setDetailsId(null);setNotice('');setConfirmation({id:details.id,status:'cancelled'});}}>{c.cancel}</button>}{(remote||role==='teacher')&&details.status==='active'&&<button className="conf-button conf-danger" type="button" onClick={()=>{setDetailsId(null);setNotice('');setConfirmation({id:details.id,status:'completed'});}}>{c.end}</button>}{isEditable(details)&&(remote||role==='teacher'||details.status==='active')&&primaryAction(details)}</div>
    </>}</div></DialogContent></Dialog>
    <Dialog open={!!confirmation} onOpenChange={open=>{if(!open)setConfirmation(null);}}><DialogContent className="conf-ui conference-dialog conf-confirm"><DialogTitle>{confirmation?.status==='completed'?c.confirmEnd:c.confirmCancel}</DialogTitle><DialogDescription>{rows.find(row=>row.id===confirmation?.id)?.title}. {remote?'Повторний запуск буде недоступний.':`${c.terminalHint} ${c.localHint}.`}</DialogDescription>{notice&&<p role="alert" className="conf-error">{notice}</p>}<div className="conf-dialog-actions"><button className="conf-button conf-secondary" type="button" onClick={()=>setConfirmation(null)}>{c.back}</button><button className="conf-button conf-danger" type="button" disabled={busy} onClick={async()=>{if(confirmation && await updateStatus(confirmation.id,confirmation.status))setConfirmation(null);}}>{c.confirm}</button></div></DialogContent></Dialog>
    <Dialog open={!!room} onOpenChange={open=>{if(!open)setRoomId(null);}}><DialogContent className="meet-room-dialog"><DialogTitle className="sr-only">{room?.title}</DialogTitle><DialogDescription className="sr-only">{c.demoHint}</DialogDescription>{room&&<ClassroomPreview lang={lang} title={room.title} onExit={()=>setRoomId(null)}/>}</DialogContent></Dialog>
  </section>;
}
