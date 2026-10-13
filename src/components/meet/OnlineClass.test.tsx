import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({rows:[] as unknown[],loading:false,error:'',syncError:'',refresh:vi.fn()}));
vi.mock('@/hooks/useConferences',()=>({useConferences:()=>state}));
import OnlineClass from './OnlineClass';
const lesson={id:'c1',roomId:'room',title:'English',date:'2026-10-15',time:'16:00',duration:45,teacherName:'Anna',status:'scheduled'};
afterEach(cleanup);
describe('student Meet list',()=>{
 it('shows assigned lesson and enables join only after start',()=>{
  state.rows=[lesson];const view=render(<OnlineClass lang="ua"/>);
  expect(screen.getAllByText('English').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button',{name:/Приєднатися/})).not.toBeInTheDocument();
  state.rows=[{...lesson,status:'active'}];view.rerender(<OnlineClass lang="ua"/>);
  expect(screen.getAllByRole('button',{name:/Приєднатися/}).length).toBeGreaterThan(0);
  state.rows=[];view.rerender(<OnlineClass lang="ua"/>);
  expect(screen.queryByText('English')).not.toBeInTheDocument();
 });
 it.each(['cancelled','completed'])('moves %s to history with no join button',status=>{
  state.rows=[{...lesson,status}];render(<OnlineClass lang="ua"/>);
  expect(screen.queryByText('English')).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('tab',{name:'Історія занять'}),{button:0,ctrlKey:false});
  expect(screen.getByText('English')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/Приєднатися/})).not.toBeInTheDocument();
 });
});
