import { describe, it, expect } from 'vitest';
import { canManageConference, isEditable, transitionConference, validateDraft, type Conference, type ConferenceDraft } from './model';
const teachers=[{id:'teacher-a',name:'Anna'},{id:'teacher-b',name:'Kate'}];
const students=Array.from({length:5},(_,i)=>({id:`s${i}`,name:`Student ${i}`}));
const draft:ConferenceDraft={title:'English',type:'group',teacherId:'teacher-a',studentIds:['s0','s1'],date:'2030-10-11',time:'16:00',duration:45,description:''};
const row:Conference={...draft,id:'room-a',code:'DEMO-A',status:'scheduled'};
describe('conference preview permissions and lifecycle',()=>{
  it('restricts a teacher to their own conferences',()=>{
    expect(canManageConference(row,'teacher','teacher-b')).toBe(false);
    expect(transitionConference(row,'active','teacher','teacher-b')).toBe(row);
    expect(canManageConference(row,'admin','')).toBe(true);
  });
  it('starts a future scheduled lesson without a time gate',()=>{
    expect(transitionConference(row,'active','teacher','teacher-a').status).toBe('active');
  });
  it('only completes an active lesson',()=>{
    expect(transitionConference(row,'completed','teacher','teacher-a')).toBe(row);
    expect(transitionConference({...row,status:'active'},'completed','teacher','teacher-a').status).toBe('completed');
  });
  it.each(['completed','cancelled'] as const)('does not restart or edit %s lessons',status=>{
    const terminal={...row,status};
    expect(isEditable(terminal)).toBe(false);
    expect(transitionConference(terminal,'active','teacher','teacher-a')).toBe(terminal);
    expect(transitionConference(terminal,'cancelled','admin','')).toBe(terminal);
  });
  it('lets admins cancel but not impersonate a teacher to start',()=>{
    expect(transitionConference(row,'cancelled','admin','').status).toBe('cancelled');
    expect(transitionConference(row,'active','admin','')).toBe(row);
  });
});
describe('conference form constraints',()=>{
  const validate=(patch:Partial<ConferenceDraft>,role:'admin'|'teacher'='admin',allowed=students)=>validateDraft({...draft,...patch},teachers,allowed,role,'teacher-a');
  it('limits groups to four students and individual lessons to one',()=>{
    expect(validate({studentIds:students.slice(0,4).map(s=>s.id)})).toBeNull();
    expect(validate({studentIds:students.map(s=>s.id)})).toBe('limit');
    expect(validate({type:'individual'})).toBe('limit');
    expect(validate({type:'individual',studentIds:['s0']})).toBeNull();
  });
  it('rejects unknown, duplicate and missing students',()=>{
    expect(validate({studentIds:['unknown']})).toBe('students');
    expect(validate({studentIds:[]})).toBe('students');
    expect(validate({studentIds:['s0','s0']})).toBe('limit');
  });
  it('does not let a teacher choose another teacher or an unassigned student',()=>{
    expect(validate({teacherId:'teacher-b'},'teacher')).toBe('teacher');
    expect(validate({studentIds:['s4']},'teacher',students.slice(0,4))).toBe('students');
  });
  it('validates required fields and positive integer duration without a preset cap',()=>{
    expect(validate({title:'  '})).toBe('title');
    expect(validate({date:''})).toBe('date');
    expect(validate({duration:0})).toBe('duration');
    expect(validate({duration:30.5})).toBe('duration');
    expect(validate({duration:180})).toBeNull();
  });
});
