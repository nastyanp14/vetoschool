export type ConferenceStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type ManagerRole = 'admin' | 'teacher';
export type Person = { id: string; name: string };
export type Conference = {
  id: string;
  title: string;
  type: 'individual' | 'group';
  teacherId: string;
  studentIds: string[];
  date: string;
  time: string;
  duration: number;
  description: string;
  status: ConferenceStatus;
  code: string;
};
export type ConferenceDraft = Omit<Conference, 'id' | 'status' | 'code'>;
export type DraftError = 'title' | 'teacher' | 'students' | 'limit' | 'date' | 'duration';

export function canManageConference(row: Conference, role: ManagerRole, teacherId: string) {
  return role === 'admin' || row.teacherId === teacherId;
}
export function isEditable(row: Conference) {
  return row.status === 'scheduled' || row.status === 'active';
}
export function validateDraft(draft: ConferenceDraft, teachers: Person[], students: Person[], role: ManagerRole, teacherId: string): DraftError | null {
  if (!draft.title.trim()) return 'title';
  if (!teachers.some(person => person.id === draft.teacherId) || (role === 'teacher' && draft.teacherId !== teacherId)) return 'teacher';
  if (!draft.studentIds.length || draft.studentIds.some(id => !students.some(person => person.id === id))) return 'students';
  const unique = new Set(draft.studentIds);
  if (unique.size !== draft.studentIds.length || unique.size > (draft.type === 'individual' ? 1 : 4)) return 'limit';
  const date = new Date(`${draft.date}T${draft.time}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time) || !Number.isFinite(date.getTime())) return 'date';
  if (!Number.isInteger(draft.duration) || draft.duration < 1) return 'duration';
  return null;
}
export function transitionConference(row: Conference, status: ConferenceStatus, role: ManagerRole, teacherId: string): Conference {
  if (!canManageConference(row, role, teacherId)) return row;
  if (role === 'teacher' && ((row.status === 'scheduled' && status === 'active') || (row.status === 'active' && status === 'completed'))) return { ...row, status };
  if (role === 'admin' && isEditable(row) && status === 'cancelled') return { ...row, status };
  return row;
}
export function demoLink(row: Conference) {
  // Reserved preview route, not an invitation or an accessible conference.
  return `${window.location.origin}/classroom/design-preview?demo=${encodeURIComponent(row.code)}`;
}
