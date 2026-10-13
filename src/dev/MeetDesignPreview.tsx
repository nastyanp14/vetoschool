import { useState } from 'react';
import OnlineClass, { type MeetLesson } from '@/components/meet/OnlineClass';
import type { Lang } from '@/lib/i18n';

const lessons: MeetLesson[] = [
  { id: 'demo-home', title: 'English — My Home', date: 'today', time: '16:00', duration: 45, teacher: 'Anna', icon: '/dashboard/homework-house.png', status: 'ready' },
  { id: 'demo-speaking', title: 'Speaking Club', date: '16.10.2026', time: '17:00', duration: 45, teacher: 'Kate', icon: '/dashboard/menu-icons/interactive.png', status: 'planned' },
  { id: 'demo-grammar', title: 'Grammar — Present Simple', date: '20.10.2026', time: '15:00', duration: 45, teacher: 'Julie', icon: '/dashboard/grammar-book.png', status: 'planned' },
  { id: 'demo-completed', title: 'English — My Family', date: '08.10.2026', time: '16:00', duration: 45, teacher: 'Anna', icon: '/dashboard/lessons-header-books.png', status: 'completed' },
];

export default function MeetDesignPreview({ lang }: { lang: Lang }) {
  const [empty, setEmpty] = useState(false);
  return <div className="mx-auto max-w-[1248px]">
    <label className="mb-5 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={empty} onChange={event => setEmpty(event.target.checked)} />{lang === 'ua' ? 'Показати порожній розділ' : lang === 'en' ? 'Show empty state' : 'Показать пустой раздел'}</label>
    <OnlineClass key={String(empty)} lang={lang} demoLessons={empty ? [] : lessons} />
  </div>;
}
