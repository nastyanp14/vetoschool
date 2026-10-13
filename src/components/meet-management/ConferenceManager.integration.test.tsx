import { fireEvent,render,screen,waitFor,cleanup } from '@testing-library/react';
import { afterEach,describe,it,expect,vi } from 'vitest';
import ConferenceManager from './ConferenceManager';
import ConferenceForm from './ConferenceForm';
import type {Conference} from './model';
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
const row:Conference={id:'c1',roomId:'room',version:2,title:'English',description:'',date:'2026-10-15',time:'16:00',duration:45,type:'group',teacherId:'teacher',studentIds:['student'],code:'CODE',status:'scheduled'};
const people={teachers:[{id:'teacher',name:'Anna'}],students:[{id:'student',name:'Sophie'}]};
afterEach(cleanup);
describe('live Meet forms',()=>{
 it('saves existing ID through async callback and keeps rejected form visible',async()=>{
  const save=vi.fn().mockRejectedValue({message:'MEET_CONFLICT'});
  render(<ConferenceForm lang="ua" role="teacher" teacherId="teacher" {...people} initial={row} live onClose={vi.fn()} onSave={save}/>);
  fireEvent.click(screen.getByRole('button',{name:'Зберегти зміни'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Конференцію вже змінено'));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({teacherId:'teacher',studentIds:['student']}));
 });
 it('requires confirmation and calls server cancellation for a teacher',async()=>{
  const remote={save:vi.fn(),transition:vi.fn().mockResolvedValue(undefined),refresh:vi.fn().mockResolvedValue(undefined)};
  render(<ConferenceManager lang="ua" role="teacher" teacherId="teacher" {...people} conferences={[row]} remote={remote}/>);
  fireEvent.keyDown(screen.getByRole('button',{name:'Інші дії: English'}),{key:'ArrowDown'});
  fireEvent.click(await screen.findByRole('menuitem',{name:'Скасувати'}));
  expect(remote.transition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Підтвердити'}));
  await waitFor(()=>expect(remote.transition).toHaveBeenCalledWith(row,'cancelled'));
  expect(remote.refresh).toHaveBeenCalled();
 });
 it('hides edit on active conferences and allows admin completion',async()=>{
  const remote={save:vi.fn(),transition:vi.fn().mockResolvedValue(undefined),refresh:vi.fn().mockResolvedValue(undefined)};
  render(<ConferenceManager lang="ua" role="admin" {...people} conferences={[{...row,status:'active'}]} remote={remote}/>);
  fireEvent.keyDown(screen.getByRole('button',{name:'Інші дії: English'}),{key:'ArrowDown'});
  expect(screen.queryByRole('menuitem',{name:'Редагувати'})).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('menuitem',{name:'Завершити заняття'}));
  fireEvent.click(screen.getByRole('button',{name:'Підтвердити'}));
  await waitFor(()=>expect(remote.transition).toHaveBeenCalledWith(expect.objectContaining({version:2}),'completed'));
 });
});
