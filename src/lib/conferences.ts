import { supabase } from '@/integrations/supabase/client';
import type { Conference, ConferenceDraft, ConferenceStatus, Person } from '@/components/meet-management/model';

type ConferenceRow = Omit<Conference, 'date' | 'time'> & { scheduledAt: string; version: number; roomId: string; teacherName: string };
export function fromConferenceRow(row: ConferenceRow): Conference {
  const date = new Date(row.scheduledAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { ...row, date: `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}
export function conferenceError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const key = message.match(/MEET_[A-Z_]+/)?.[0];
  const messages: Record<string,string> = {
    MEET_AUTH: 'Увійдіть до свого облікового запису.',
    MEET_DENIED: 'У вас немає доступу до цієї конференції.',
    MEET_TEACHER: 'Оберіть доступного викладача з активним обліковим записом.',
    MEET_STUDENT: 'Оберіть доступних учнів, призначених викладачу.',
    MEET_LIMIT: 'Максимальна кількість учнів — 4. Для індивідуального заняття — 1.',
    MEET_INPUT: 'Перевірте назву, дату, час і тривалість (1–1440 хв).',
    MEET_SCHEDULE: 'Заняття в розкладі не відповідає викладачу або учасникам.',
    MEET_CONFLICT: 'Конференцію вже змінено. Закрийте форму та відкрийте її знову, щоб переглянути актуальні дані.',
    MEET_LOCKED: 'Ця дія недоступна для поточного статусу конференції.',
  };
  return (key && messages[key]) || 'Не вдалося отримати або зберегти дані конференції. Перевірте з’єднання та спробуйте ще раз.';
}
export async function listConferences(room?: string): Promise<Conference[]> {
  const rows: Conference[] = [];
  for (let offset=0; ; offset+=100) {
    const { data, error } = await supabase.rpc('meet_list', { ...(room ? { _room: room } : {}), _offset: offset });
    if (error) throw error;
    const page = (data as unknown as ConferenceRow[]).map(fromConferenceRow);
    rows.push(...page);
    if (page.length < 100 || room) return rows;
  }
}
export async function conferencePeople(): Promise<{teachers: Person[]; students: Person[]}> {
  const { data,error } = await supabase.rpc('meet_people');
  if (error) throw error;
  return data as unknown as {teachers: Person[]; students: Person[]};
}
export async function saveConference(draft: ConferenceDraft, initial?: Conference | null) {
  const { data,error } = await supabase.rpc('meet_save', {
    _title: draft.title, _description: draft.description, _teacher_id: draft.teacherId,
    _type: draft.type, _scheduled_at: new Date(`${draft.date}T${draft.time}`).toISOString(),
    _duration: draft.duration, _students: draft.studentIds,
    ...(initial ? { _id: initial.id, _version: initial.version, ...(initial.scheduleId ? {_schedule_id: initial.scheduleId} : {}) } : {}),
  });
  if (error) throw error;
  return data;
}
export async function transitionConferenceRemote(row: Conference, status: ConferenceStatus) {
  if (!row.version) throw new Error('MEET_CONFLICT');
  const { error } = await supabase.rpc('meet_transition', {_id: row.id, _version: row.version, _status: status});
  if (error) throw error;
}
