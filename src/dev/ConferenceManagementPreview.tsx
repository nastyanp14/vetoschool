import { useEffect, useState } from 'react';
import ConferenceManager from '@/components/meet-management/ConferenceManager';
import type { Conference, ManagerRole, Person } from '@/components/meet-management/model';
import type { Lang } from '@/lib/i18n';
const teachers: Person[]=[{id:'demo-anna',name:'Anna Wilson'},{id:'demo-kate',name:'Kate Miller'}];
const students: Person[]=['Sophie','Max','Oliver','Emma','Leo','Mia'].map((name,index)=>({id:`demo-student-${index}`,name}));
const examples: Conference[]=[
  {id:'demo-1',code:'DEMO-HOME',title:'English — My Home',type:'group',teacherId:'demo-anna',studentIds:students.slice(0,4).map(person=>person.id),date:'2026-10-15',time:'16:00',duration:45,description:'Speaking practice: rooms, furniture and describing your home.',status:'scheduled'},
  {id:'demo-2',code:'DEMO-SPEAK',title:'Speaking Club',type:'group',teacherId:'demo-kate',studentIds:students.slice(3,6).map(person=>person.id),date:'2026-10-16',time:'17:00',duration:60,description:'A small group conversation lesson.',status:'scheduled'},
  {id:'demo-3',code:'DEMO-ANIMALS',title:'English — Amazing Animals',type:'individual',teacherId:'demo-anna',studentIds:[students[0].id],date:'2026-10-11',time:'15:00',duration:30,description:'',status:'active'},
  {id:'demo-4',code:'DEMO-FAMILY',title:'English — My Family',type:'group',teacherId:'demo-anna',studentIds:students.slice(0,2).map(person=>person.id),date:'2026-10-08',time:'16:00',duration:45,description:'Describing family members.',status:'completed'},
  {id:'demo-5',code:'DEMO-GRAMMAR',title:'Grammar — Present Simple',type:'individual',teacherId:'demo-anna',studentIds:[students[1].id],date:'2026-10-07',time:'14:00',duration:45,description:'',status:'cancelled'},
];
export default function ConferenceManagementPreview(){
  const params=new URLSearchParams(location.search);
  const [role,setRole]=useState<ManagerRole>(params.get('role')==='teacher'?'teacher':'admin');
  const [lang,setLang]=useState<Lang>(params.get('lang')==='ru'?'ru':params.get('lang')==='en'?'en':'ua');
  const [rows,setRows]=useState<Conference[]>(examples);
  const [dark,setDark]=useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);
  return <div className={dark?'dark':''}><main className="min-h-screen bg-[#faf5ff] p-4 dark:bg-[#1d152d] sm:p-6"><div className="mx-auto max-w-7xl"><header className="mb-7 flex flex-wrap items-center gap-3 rounded-2xl border border-purple-100 bg-white/80 p-4 font-body text-purple-700"><span className="mr-auto text-sm font-bold">Vetoschool · локальное превью · данные вымышленные</span><select className="rounded-xl border border-purple-100 p-2 text-sm" aria-label="Роль" value={role} onChange={e=>setRole(e.target.value as ManagerRole)}><option value="admin">Администратор</option><option value="teacher">Преподаватель</option></select><select aria-label="Язык" className="rounded-xl border border-purple-100 p-2 text-sm" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="ua">UA</option><option value="ru">RU</option><option value="en">EN</option></select><button className="p-2 text-sm" type="button" onClick={()=>setRows([])}>Пустой список</button><button className="p-2 text-sm" type="button" onClick={()=>setRows(examples)}>Вернуть примеры</button><button className="p-2 text-sm" type="button" aria-pressed={dark} onClick={()=>setDark(!dark)}>Тёмная тема</button></header>
    <ConferenceManager key={role} role={role} teacherId="demo-anna" lang={lang} teachers={role==='teacher'?teachers.slice(0,1):teachers} students={role==='teacher'?students.slice(0,4):students} conferences={rows} onChange={setRows}/>
  </div></main></div>;
}
