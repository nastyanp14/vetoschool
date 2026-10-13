import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { conferenceError, conferencePeople, listConferences } from '@/lib/conferences';
import type { Conference, Person } from '@/components/meet-management/model';

export function useConferences({ enabled=true, manager=false, room }: {enabled?: boolean; manager?: boolean; room?: string} = {}) {
  const [rows,setRows] = useState<Conference[]>([]);
  const [people,setPeople] = useState<{teachers:Person[];students:Person[]}>({teachers:[],students:[]});
  const [loading,setLoading] = useState(enabled);
  const [error,setError] = useState('');
  const [syncError,setSyncError] = useState('');
  const refreshRef = useRef<() => Promise<void>>(async()=>{});
  const refresh = useCallback(()=>refreshRef.current(),[]);
  useEffect(()=>{
    if (!enabled) { setLoading(false); return; }
    let disposed=false, generation=0, queued=false, running=false, authObserved=false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let currentUser: string | null | undefined = null;
    const reload = async () => {
      if (disposed) return;
      if (running) { queued=true; return; }
      running=true;
      const current=generation;
      try {
        const [list,catalog] = await Promise.all([listConferences(room), manager ? conferencePeople() : Promise.resolve(null)]);
        if (!disposed && current===generation) {setRows(list);if(catalog)setPeople(catalog);setError('');}
      } catch (e) {
        if (!disposed && current===generation) {setRows([]);setError(conferenceError(e));}
      } finally {
        running=false;
        if(!disposed) {setLoading(false);if(queued){queued=false;void reload();}}
      }
    };
    refreshRef.current=reload;
    const invalidate=()=>{clearTimeout(timer);timer=setTimeout(()=>void reload(),120);};
    const connect=async(userId?:string)=>{
      if(disposed || userId===currentUser)return;
      currentUser=userId;generation++;
      setRows([]);setPeople({teachers:[],students:[]});setSyncError('');
      if(channel){void supabase.removeChannel(channel);channel=undefined;}
      if(!userId){setLoading(false);setError('Увійдіть до свого облікового запису.');return;}
      setLoading(true);
      void reload();
      await supabase.realtime.setAuth();
      if(disposed || currentUser!==userId)return;
      channel=supabase.channel(`meet:${userId}`,{config:{private:true}})
        .on('broadcast',{event:'changed'},invalidate)
        .subscribe(status=>{
          if(disposed)return;
          if(status==='SUBSCRIBED'){setSyncError('');invalidate();}
          if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setSyncError('Автооновлення тимчасово недоступне. Оновіть список.');
        });
    };
    // Callback must stay synchronous: avoid awaiting Auth calls inside onAuthStateChange.
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      authObserved=true;
      setTimeout(()=>void connect(session?.user.id).catch(()=>setSyncError('Не вдалося підключити автооновлення.')),0);
    });
    void supabase.auth.getSession().then(({data,error:authError})=>{
      if(disposed || authObserved)return;
      if(authError || !data.session){setLoading(false);setError('Увійдіть до свого облікового запису.');}
      else void connect(data.session.user.id).catch(()=>setSyncError('Не вдалося підключити автооновлення.'));
    });
    const focus=()=>{if(currentUser && document.visibilityState==='visible')invalidate();};
    window.addEventListener('online',focus);
    window.addEventListener('focus',focus);
    document.addEventListener('visibilitychange',focus);
    return ()=>{
      disposed=true;generation++;clearTimeout(timer);subscription.unsubscribe();
      window.removeEventListener('online',focus);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);
      if(channel)void supabase.removeChannel(channel);
      refreshRef.current=async()=>{};
    };
  },[enabled,manager,room]);
  return {rows,people,loading,error,syncError,refresh};
}
