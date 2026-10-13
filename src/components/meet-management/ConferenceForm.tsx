import { useState, type FormEvent } from 'react';
import { Search, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Lang } from '@/lib/i18n';
import { managerCopy } from './copy';
import { validateDraft, type Conference, type ConferenceDraft, type ManagerRole, type Person } from './model';

export default function ConferenceForm({ lang, role, teacherId, teachers, students, initial, onClose, onSave }: {
  lang: Lang; role: ManagerRole; teacherId: string; teachers: Person[]; students: Person[];
  initial: Conference | null; onClose: () => void; onSave: (draft: ConferenceDraft) => void;
}) {
  const c = managerCopy[lang];
  const [draft, setDraft] = useState<ConferenceDraft>(() => initial ? {
    title: initial.title, type: initial.type, teacherId: initial.teacherId, studentIds: [...initial.studentIds], date: initial.date, time: initial.time, duration: initial.duration, description: initial.description,
  } : { title: '', type: 'individual', teacherId: role === 'teacher' ? teacherId : '', studentIds: [], date: '', time: '16:00', duration: 45, description: '' });
  const [durationOption, setDurationOption] = useState([30,45,60].includes(draft.duration) ? String(draft.duration) : 'custom');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const patch = <K extends keyof ConferenceDraft>(key: K, value: ConferenceDraft[K]) => { setDraft(prev => ({ ...prev, [key]: value })); setError(''); };
  const limit = draft.type === 'individual' ? 1 : 4;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const issue = validateDraft(draft, teachers, students, role, teacherId);
    if (issue) { setError(c.errors[issue]); return; }
    onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() });
  };
  const visibleStudents = students.filter(student => student.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="conf-ui conference-dialog">
    <DialogTitle className="conf-dialog-title">{initial ? c.edit : c.create}</DialogTitle>
    <DialogDescription>{c.demo} · {c.localHint}</DialogDescription>
    <form className="conf-form" onSubmit={submit}>
      <label>{c.titleField}<input autoFocus required maxLength={120} value={draft.title} onChange={e => patch('title',e.target.value)} placeholder="English — My Home" /></label>
      <fieldset className="conf-type"><legend>{c.type}</legend>{(['individual','group'] as const).map(type => <label key={type}><input type="radio" name="conference-type" checked={draft.type===type} onChange={() => patch('type',type)} />{c[type]}</label>)}</fieldset>
      {role === 'admin' ? <label>{c.teacher}<select required value={draft.teacherId} onChange={e => patch('teacherId',e.target.value)}><option value="">{c.selectTeacher}</option>{teachers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label> : <div className="conf-assigned"><span>{c.teacher}</span><strong>{teachers.find(person=>person.id===teacherId)?.name}</strong></div>}
      <fieldset className="conf-students"><legend><Users size={16} />{c.students}<span>{draft.studentIds.length} / {limit}</span></legend><p className="conf-help">{role==='teacher' ? c.assignedOnly : c.selectHint}</p>
        <div className="conf-search"><Search size={17} /><input aria-label={c.studentSearch} placeholder={c.studentSearch} value={query} onChange={e=>setQuery(e.target.value)} /></div>
        <div className="conf-student-options">{visibleStudents.length ? visibleStudents.map(person=>{
          const checked=draft.studentIds.includes(person.id);
          return <label key={person.id}><input type="checkbox" checked={checked} disabled={!checked && draft.studentIds.length>=limit} onChange={()=>patch('studentIds',checked ? draft.studentIds.filter(id=>id!==person.id) : [...draft.studentIds,person.id])} /><span className="conf-avatar">{person.name[0]}</span>{person.name}</label>;
        }) : <p className="conf-help">{c.noStudents}</p>}</div>
        {draft.studentIds.length>limit && <p role="alert" className="conf-error">{c.errors.limit}</p>}
      </fieldset>
      <div className="conf-form-grid"><label>{c.date}<input required type="date" value={draft.date} onChange={e=>patch('date',e.target.value)} /></label><label>{c.time}<input required type="time" value={draft.time} onChange={e=>patch('time',e.target.value)} /></label></div>
      <div className="conf-form-grid"><label>{c.duration}<select value={durationOption} onChange={e=>{setDurationOption(e.target.value); if(e.target.value!=='custom')patch('duration',Number(e.target.value));}}>{[30,45,60].map(value=><option key={value} value={value}>{value} {c.minutes}</option>)}<option value="custom">{c.custom}</option></select></label>{durationOption==='custom' && <label>{c.custom} ({c.minutes})<input required type="number" min="1" step="1" value={Number.isNaN(draft.duration)?'':draft.duration} onChange={e=>patch('duration',e.target.valueAsNumber)} /></label>}</div>
      <p className="conf-help">{c.durationHint}</p>
      <label>{c.description}<textarea rows={3} maxLength={1500} value={draft.description} onChange={e=>patch('description',e.target.value)} /></label>
      {error && <p role="alert" className="conf-error">{error}</p>}
      <div className="conf-dialog-actions"><button type="button" className="conf-button conf-secondary" onClick={onClose}>{c.cancel}</button><button type="submit" className="conf-button conf-primary">{initial?c.save:c.create}</button></div>
    </form>
  </DialogContent></Dialog>;
}
