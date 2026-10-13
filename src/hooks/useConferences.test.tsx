import { act,renderHook,waitFor } from '@testing-library/react';
import { describe,it,expect,vi,beforeEach } from 'vitest';
const mock=vi.hoisted(()=>({list:vi.fn(),people:vi.fn(),channel:vi.fn(),remove:vi.fn(),unsubscribe:vi.fn(),auth:vi.fn(),setAuth:vi.fn(),session:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{
 rpc:vi.fn(),channel:mock.channel,removeChannel:mock.remove,realtime:{setAuth:mock.setAuth},
 auth:{getSession:mock.session,onAuthStateChange:mock.auth},
}}));
vi.mock('@/lib/conferences',()=>({listConferences:mock.list,conferencePeople:mock.people,conferenceError:()=> 'Помилка з’єднання'}));
import {useConferences} from './useConferences';
let invalidate:()=>void;
let changeAuth:(_event:string,session:{user:{id:string}}|null)=>void;
beforeEach(()=>{
 vi.clearAllMocks();
 mock.list.mockResolvedValue([{id:'c1'}]);mock.people.mockResolvedValue({teachers:[],students:[]});
 mock.session.mockResolvedValue({data:{session:{user:{id:'user'}}}});mock.setAuth.mockResolvedValue(undefined);
 mock.auth.mockImplementation(cb=>{changeAuth=cb;return {data:{subscription:{unsubscribe:mock.unsubscribe}}};});
 mock.channel.mockImplementation(()=>({on:(_kind:string,_filter:unknown,cb:()=>void)=>{invalidate=cb;return {subscribe:()=>({id:'channel'})};}}));
});
describe('Meet subscription lifecycle',()=>{
 it('uses a single private user channel and removes it on unmount',async()=>{
  const {result,unmount}=renderHook(()=>useConferences());
  await waitFor(()=>expect(result.current.rows).toHaveLength(1));
  expect(mock.channel).toHaveBeenCalledWith('meet:user',{config:{private:true}});
  expect(mock.channel).toHaveBeenCalledTimes(1);
  unmount();expect(mock.remove).toHaveBeenCalledTimes(1);expect(mock.unsubscribe).toHaveBeenCalled();
 });
 it('removes stale cards after broadcast invalidation',async()=>{
  const {result,unmount}=renderHook(()=>useConferences());
  await waitFor(()=>expect(result.current.rows).toHaveLength(1));
  mock.list.mockResolvedValue([]);act(()=>invalidate());
  await waitFor(()=>expect(result.current.rows).toHaveLength(0));unmount();
 });
 it('clears private state on logout',async()=>{
  const {result,unmount}=renderHook(()=>useConferences());
  await waitFor(()=>expect(result.current.rows).toHaveLength(1));
  act(()=>changeAuth('SIGNED_OUT',null));
  await waitFor(()=>expect(result.current.error).toContain('Увійдіть'));
  expect(result.current.rows).toEqual([]);expect(mock.remove).toHaveBeenCalledTimes(1);unmount();
 });
 it('ends loading for an unauthenticated initial auth event',async()=>{
  mock.auth.mockImplementation(cb=>{cb('INITIAL_SESSION',null);return {data:{subscription:{unsubscribe:mock.unsubscribe}}};});
  mock.session.mockResolvedValue({data:{session:null}});
  const {result,unmount}=renderHook(()=>useConferences());
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.error).toContain('Увійдіть');unmount();
 });
 it('makes no auth or network requests for design-only preview',()=>{
  const {unmount}=renderHook(()=>useConferences({enabled:false}));
  expect(mock.auth).not.toHaveBeenCalled();expect(mock.list).not.toHaveBeenCalled();unmount();
 });
});
