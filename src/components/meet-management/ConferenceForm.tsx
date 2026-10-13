import { useRef, useState, type FormEvent } from 'react';
import { Search, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Lang } from '@/lib/i18n';
import { conferenceError } from '@/lib/conferences';
import { managerCopy } from './copy';
import { ConferenceDate, ConferenceSelect, ConferenceTime } from './ConferenceFields';
import { validateDraft, type Conference, type ConferenceDraft, type ManagerRole, type Person } from './model';

export default function ConferenceForm({ lang, role, teacherId, teachers, students, initial, onClose, onSave, live=false, onConflict }: {
  lang: Lang; role: ManagerRole; teacherId: string; teachers: Person[]; students: Person[];
  initial: Conference | null; onClose: () => void; onSave: (draft: ConferenceDraft) => void | Promise<void>; live?: boolean; onConflict?: () => void;
}) {
  const pending=useRef(false);
  const [saving,setSaving]=useState(false);
  const c = managerCopy[lang];
  const [draft, setDraft] = useState<ConferenceDraft>(() => initial ? {
    title: initial.title, type: initial.type, teacherId: initial.teacherId, studentIds: [...initial.studentIds], date: initial.date, time: initial.time, duration: initial.duration, description: initial.description,
  } : { title: '', type: 'individual', teacherId: role === 'teacher' ? teacherId : '', studentIds: [], date: '', time: '16:00', duration: 45, description: '' });
  const [durationOption, setDurationOption] = useState([30,45,60].includes(draft.duration) ? String(draft.duration) : 'custom');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const patch = <K extends keyof ConferenceDraft>(key: K, value: ConferenceDraft[K]) => { setDraft(prev => ({ ...prev, [key]: value })); setError(''); };
  const limit = draft.type === 'individual' ? 1 : 4;
  const submit = async(event: FormEvent) => {
    event.preventDefault();
    const issue = validateDraft(draft, teachers, students, role, teacherId);
    if (issue) { setError(c.errors[issue]); return; }
    if(pending.current)return;
    pending.current=true;setSaving(true);
    try { await onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() }); }
    catch(e){setError(conferenceError(e));onConflict?.();}
    finally{pending.current=false;setSaving(false);}
  };
  const visibleStudents = students.filter(student => student.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="conf-ui conference-dialog conf-form-dialog">
    <div className="conf-form-scroll"><DialogTitle className="conf-dialog-title">{initial ? c.edit : c.create}</DialogTitle>
    <DialogDescription>{live?'Vetoschool Meet':`${c.demo} · ${c.localHint}`}</DialogDescription>
    <form className="conf-form" onSubmit={submit}><fieldset disabled={saving} className="contents">
      <label>{c.titleField}<input autoFocus required maxLength={120} value={draft.title} onChange={e => patch('title',e.target.value)} placeholder="English — My Home" /></label>
      <fieldset className="conf-type"><legend>{c.type}</legend>{(['individual','group'] as const).map(type => <label key={type}><input type="radio" name="conference-type" checked={draft.type===type} onChange={() => patch('type',type)} />{c[type]}</label>)}</fieldset>
      {role === 'admin' ? <div className="conf-field"><span>{c.teacher}</span><ConferenceSelect label={c.teacher} value={draft.teacherId} placeholder={c.selectTeacher} options={teachers.map(person => ({ value: person.id, label: person.name }))} onChange={value => patch('teacherId', value)} /></div> : <div className="conf-assigned"><span>{c.teacher}</span><strong>{teachers.find(person=>person.id===teacherId)?.name}</strong></div>}
      <fieldset className="conf-students"><legend><Users size={16} />{c.students}<span>{draft.studentIds.length} / {limit}</span></legend><p className="conf-help">{role==='teacher' ? c.assignedOnly : c.selectHint}</p>
        <div className="conf-search"><Search size={17} /><input aria-label={c.studentSearch} placeholder={c.studentSearch} value={query} onChange={e=>setQuery(e.target.value)} /></div>
        <div className="conf-student-options">{visibleStudents.length ? visibleStudents.map(person=>{
          const checked=draft.studentIds.includes(person.id);
          return <label key={person.id}><input type="checkbox" checked={checked} disabled={!checked && draft.studentIds.length>=limit} onChange={()=>patch('studentIds',checked ? draft.studentIds.filter(id=>id!==person.id) : [...draft.studentIds,person.id])} /><span className="conf-avatar">{person.name[0]}</span>{person.name}</label>;
        }) : <p className="conf-help">{c.noStudents}</p>}</div>
        {draft.studentIds.length>limit && <p role="alert" className="conf-error">{c.errors.limit}</p>}
      </fieldset>
      <div className="conf-form-grid"><div className="conf-field"><span>{c.date}</span><ConferenceDate label={c.date} lang={lang} value={draft.date} onChange={value => patch('date', value)} /></div><div className="conf-field"><span>{c.time}</span><ConferenceTime label={c.time} lang={lang} value={draft.time} onChange={value => patch('time', value)} /></div></div>
      <div className="conf-form-grid"><div className="conf-field"><span>{c.duration}</span><ConferenceSelect label={c.duration} value={durationOption} options={[...[30,45,60].map(value => ({ value: String(value), label: `${value} ${c.minutes}` })), { value: 'custom', label: c.custom }]} onChange={value => { setDurationOption(value); if (value !== 'custom') patch('duration', Number(value)); }} /></div>{durationOption==='custom' && <label>{c.custom} ({c.minutes})<input required type="number" min="1" max="1440" step="1" value={Number.isNaN(draft.duration)?'':draft.duration} onChange={e=>patch('duration',e.target.valueAsNumber)} /></label>}</div>
      <p className="conf-help">{c.durationHint}</p>
      <label>{c.description}<textarea rows={3} maxLength={1500} value={draft.description} onChange={e=>patch('description',e.target.value)} /></label>
      {error && <p role="alert" className="conf-error">{error}</p>}
      <div className="conf-dialog-actions"><button type="button" className="conf-button conf-secondary" onClick={onClose}>{c.cancel}</button><button disabled={saving} type="submit" className="conf-button conf-primary">{initial?c.save:c.create}</button></div>
    </fieldset></form>
    </div>
  </DialogContent></Dialog>;
}
