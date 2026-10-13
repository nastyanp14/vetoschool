import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
const state=vi.hoisted(()=>({rows:[] as unknown[],loading:false,error:'',syncError:'',refresh:vi.fn()}));
vi.mock('@/hooks/useConferences',()=>({useConferences:()=>state}));
vi.mock('@/lib/auth',()=>({getCurrentUser:()=>({role:'student'}),homePathForUser:()=>'/dashboard'}));
vi.mock('@/components/meet/LiveClassroom',()=>({default:()=> <div>Live conference</div>}));
import Classroom from './Classroom';
afterEach(cleanup);
function show(){return render(<MemoryRouter initialEntries={['/classroom/room']}><Routes><Route path="/classroom/:roomId" element={<Classroom lang="ua"/>}/></Routes></MemoryRouter>);}
describe('room access state',()=>{
 it('does not disclose details for an inaccessible room',()=>{
  state.rows=[];show();expect(screen.getByText('У вас немає доступу до цієї конференції')).toBeInTheDocument();
 });
 it.each([['scheduled','Очікуємо початку заняття'],['cancelled','Цю конференцію скасовано'],['completed','Заняття завершено!'],['active','Live conference']])('handles %s without simulated calls',(status,message)=>{
  state.rows=[{id:'c1',title:'English',status,studentIds:[]}];show();expect(screen.getByText(message)).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/Камера|Мікрофон/})).not.toBeInTheDocument();
 });
});
