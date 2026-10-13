import { describe,it,expect,vi,beforeEach } from 'vitest';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc}}));
import {conferenceError,fromConferenceRow,listConferences,saveConference,transitionConferenceRemote} from './conferences';
import type {Conference,ConferenceDraft} from '@/components/meet-management/model';
const draft:ConferenceDraft={title:'English',description:'',type:'group',teacherId:'directory-id',studentIds:['s1'],date:'2026-10-15',time:'16:00',duration:45};
const row:Conference={...draft,id:'id',roomId:'room',code:'code',version:3,status:'scheduled'};
beforeEach(()=>rpc.mockReset());
describe('Meet RPC adapter',()=>{
 it('creates atomically through one RPC and converts local time to UTC',async()=>{
  rpc.mockResolvedValue({data:'id',error:null});await saveConference(draft);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('meet_save',expect.objectContaining({_teacher_id:'directory-id',_students:['s1'],_scheduled_at:new Date('2026-10-15T16:00').toISOString()}));
  expect(rpc.mock.calls[0][1]).not.toHaveProperty('created_by');expect(rpc.mock.calls[0][1]).not.toHaveProperty('room_id');
 });
 it('edits original conference with version and schedule link',async()=>{
  rpc.mockResolvedValue({data:'id',error:null});await saveConference(draft,{...row,scheduleId:'schedule'});
  expect(rpc.mock.calls[0][1]).toMatchObject({_id:'id',_version:3,_schedule_id:'schedule'});
 });
 it('sends expected version for lifecycle and propagates rejection',async()=>{
  rpc.mockResolvedValue({error:{message:'MEET_CONFLICT'}});
  await expect(transitionConferenceRemote(row,'active')).rejects.toEqual({message:'MEET_CONFLICT'});
  expect(rpc).toHaveBeenCalledWith('meet_transition',{_id:'id',_version:3,_status:'active'});
 });
 it('maps UTC to browser-local date and time',()=>{
  const date=new Date('2026-10-15T13:00:00Z');
  const result=fromConferenceRow({...row,version:3,roomId:'room',teacherName:'Anna',scheduledAt:date.toISOString()});
  expect(new Date(`${result.date}T${result.time}`).getTime()).toBe(date.getTime());
 });
 it('paginates without silently losing history',async()=>{
  const raw={...row,scheduledAt:'2026-10-15T13:00:00Z'};
  rpc.mockResolvedValueOnce({data:Array(100).fill(raw)}).mockResolvedValueOnce({data:[raw]});
  expect(await listConferences()).toHaveLength(101);
  expect(rpc).toHaveBeenLastCalledWith('meet_list',{_offset:100});
 });
 it('does not expose PostgreSQL errors',()=>{
  expect(conferenceError({message:'secret SQL constraint names'})).not.toContain('secret');
  expect(conferenceError({message:'MEET_LIMIT'})).toContain('4');
 });
});
