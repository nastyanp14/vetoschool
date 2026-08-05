/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import { User } from './auth';
import { awardStars } from './stars';
import { notifyHomeworkAssigned, notifyHomeworkChanged, notifyHomeworkReviewed, notifyLessonGradePublished, notifyLessonNoShow, notifyLessonResultPublished, notifyScheduleSaved } from './telegram';
import type { ScheduleSlot } from './schedule';

export type TeacherStatus = 'active' | 'inactive' | 'vacation' | 'blocked';
export type LessonStatus = 'scheduled' | 'upcoming' | 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled' | 'student_absent' | 'teacher_absent';
export type LessonType = 'group' | 'individual' | 'trial';
export type LessonBlockKind = 'theory' | 'class_task' | 'homework' | 'practice' | 'grammar' | 'listening' | 'checkpoint';
export type GradeCategory = 'Participation' | 'Speaking' | 'Grammar' | 'Listening' | 'Homework';
export type AttendanceStatus = 'present' | 'absent_unexcused' | 'late' | 'technical_issue';
export type HomeworkReviewStatus = 'not_submitted' | 'submitted' | 'reviewed' | 'revision_requested' | 'late';

export interface LessonStructureTask {
  id: string;
  mechanicType: string;
  title: string;
  order: number;
  payload: Record<string, unknown>;
}

export interface LessonStructureSection {
  id: string;
  label: string;
  kind: LessonBlockKind | 'custom';
  order: number;
  sourceLessonId: string | null;
  materialTitle?: string;
  materialUrl?: string | null;
  adminNote?: string;
  materialMode?: 'file_link' | 'interactive' | null;
  tasks: LessonStructureTask[];
}

export interface TeacherRecord {
  id: string;
  teacherUserId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  teachingLanguages: string[];
  levels: string[];
  description: string | null;
  adminNote: string | null;
  status: TeacherStatus;
  lastLoginAt: string | null;
  inviteEmailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  teachingLanguages?: string[];
  levels?: string[];
  description?: string;
  adminNote?: string;
  status?: TeacherStatus;
}

export interface StudentGroup {
  id: string;
  name: string;
  description: string | null;
  teacherId: string | null;
  createdAt: string;
  updatedAt: string;
  studentIds: string[];
  level?: string | null;
  ageRange?: string | null;
  maxSeats?: number | null;
  course?: string | null;
  currentUnit?: string | null;
  currentLesson?: string | null;
  progress?: number;
  status?: string | null;
  lessonDurationMinutes?: number | null;
  weeklyFrequency?: number | null;
  startDate?: string | null;
}

export interface StudentGroupInput {
  name: string;
  description?: string;
  teacherId?: string | null;
  studentIds?: string[];
  level?: string;
  course?: string;
}

export interface TeacherLesson {
  id: string;
  studentId: string;
  groupId: string | null;
  teacherId: string | null;
  sourceLessonId: string | null;
  day: string;
  date: string | null;
  time: string;
  title: string;
  type: LessonType;
  status: LessonStatus;
  topic: string;
  comment: string | null;
  isConducted: boolean;
  room: string | null;
  onlineUrl: string | null;
  durationMinutes: number | null;
  lessonNumber: string | null;
  startedAt: string | null;
  completedAt: string | null;
  homeworkBrief: string | null;
  carryOverToNextLesson: string | null;
  structure: LessonStructureSection[];
  result: TeacherLessonResult | null;
}

export interface TeacherLessonAttendance {
  id: string;
  lessonId: string;
  studentId: string;
  teacherId: string;
  status: AttendanceStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherHomework {
  id: string;
  studentId: string;
  moduleId: string;
  title: string;
  type: string;
  dueDate: string | null;
  scheduledDate: string | null;
  submittedAt: string | null;
  checkedAt: string | null;
  resultPercent: number | null;
  errorsCount: number | null;
  teacherComment: string | null;
  studentResult: string | null;
  starRating: number | null;
  unlocked: boolean;
  reviewStatus: HomeworkReviewStatus;
  reviewedByTeacherId: string | null;
  reviewComment: string | null;
  submittedAttachmentUrl: string | null;
  submittedAttachmentName: string | null;
  externalLink: string | null;
  interactiveLessonId: string | null;
  interactiveCompletedAt: string | null;
  interactiveScorePercent: number | null;
  materialMode: 'file_link' | 'interactive' | null;
}

export interface TeacherLessonResult {
  id: string;
  lessonId: string;
  teacherId: string;
  summary: string;
  teacherComment: string;
  homeworkBrief: string;
  carryOverToNextLesson: string;
  adminNote: string;
  payload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherGrade {
  id: string;
  studentId: string;
  groupId: string | null;
  lessonId: string | null;
  category: GradeCategory;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface TeacherLessonPlanBlockInput {
  blockKind: LessonBlockKind;
  sourceLessonId?: string | null;
  materialTitle?: string;
  materialUrl?: string | null;
  adminNote?: string;
  materialMode?: 'file_link' | 'interactive';
  position?: number;
}

export interface TeacherDictionaryWord {
  id: string;
  studentId: string;
  lesson: string;
  category: string;
  word: string;
  translation: string;
  emoji: string;
  audioUrl: string | null;
  createdAt: string;
}

export interface TeacherNote {
  id: string;
  teacherId: string;
  studentId: string | null;
  authorId: string;
  text: string;
  targetType: 'Teacher' | 'Student' | 'Group' | 'Lesson' | 'Admin';
  targetId: string | null;
  noteType: 'Private' | 'Visible to Admin' | 'Important' | 'Follow-up';
  attachmentLabel: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherStudent extends User {
  age: string | null;
  level: string | null;
  tariff: string | null;
  groupNames: string[];
  lessonsCount: number;
  averageGrade: number;
  attendance: number;
  lastLesson: TeacherLesson | null;
  nextLesson: TeacherLesson | null;
  progress: number;
  lastActivity: string | null;
  statusLabel: string;
  course: string | null;
  homeworkCompletion: number;
}

export interface TeacherDirectoryItem extends TeacherRecord {
  studentsCount: number;
  groupsCount: number;
  lessonsToday: number;
  lessonsWeek: number;
  totalLessons: number;
  averageAttendance: number;
  assignedStudentIds: string[];
  assignedGroupIds: string[];
}

export interface TeacherWorkspace {
  teacher: TeacherRecord | null;
  students: TeacherStudent[];
  groups: StudentGroup[];
  lessons: TeacherLesson[];
  homeworks: TeacherHomework[];
  grades: TeacherGrade[];
  dictionary: TeacherDictionaryWord[];
  notes: TeacherNote[];
  attendance: TeacherLessonAttendance[];
  stats: {
    todayLessons: number;
    studentsCount: number;
    groupsCount: number;
    homeworkToReview: number;
    notifications: number;
    missedLessons: number;
    nextLesson: TeacherLesson | null;
    lessonsThisWeek: number;
    completedLessons: number;
    upcomingLessons: number;
  };
}

export interface TeacherNotificationState {
  read: boolean;
  opened: boolean;
}

export interface TeacherNotificationPersistInput {
  teacherId: string;
  eventKey: string;
  type: string;
  title: string;
  body?: string | null;
  date?: string | null;
  relatedSection?: string | null;
  lessonId?: string | null;
  homeworkId?: string | null;
  studentId?: string | null;
  groupId?: string | null;
  opened?: boolean;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayName() {
  return dayNames[new Date().getDay()];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function rowToTeacher(row: any): TeacherRecord {
  return {
    id: row.id,
    teacherUserId: row.teacher_user_id ?? null,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    email: row.email || '',
    phone: row.phone ?? null,
    avatarUrl: row.avatar_url ?? null,
    teachingLanguages: row.teaching_languages || [],
    levels: row.levels || [],
    description: row.description ?? null,
    adminNote: row.admin_note ?? null,
    status: (row.status || 'active') as TeacherStatus,
    lastLoginAt: row.last_login_at ?? null,
    inviteEmailSentAt: row.invite_email_sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function teacherToRow(input: TeacherInput) {
  return {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    avatar_url: input.avatarUrl?.trim() || null,
    teaching_languages: input.teachingLanguages || [],
    levels: input.levels || [],
    description: input.description?.trim() || null,
    admin_note: input.adminNote?.trim() || null,
    status: input.status || 'active',
  };
}

function profileToUser(row: any): User {
  const accessStatus = (row.access_status || (row.has_access ? 'active' : 'pending')) as User['accessStatus'];
  const paymentStatus = (row.payment_status || (row.has_access ? 'paid' : 'unpaid')) as User['paymentStatus'];
  return {
    id: row.id,
    name: row.name || row.email?.split('@')[0] || 'Student',
    email: row.email,
    role: 'student',
    hasAccess: accessStatus === 'active',
    paymentStatus,
    accessStatus,
    emailConfirmed: true,
    createdAt: row.created_at,
    joinedAt: row.created_at,
    avatarId: row.avatar_id ?? null,
  };
}

function rowToLesson(row: any): TeacherLesson {
  return {
    id: row.id,
    studentId: row.user_id,
    groupId: row.group_id ?? null,
    sourceLessonId: row.source_lesson_id ?? null,
    day: row.day,
    date: row.scheduled_date ?? null,
    time: row.time,
    title: row.topic || (row.lesson_type === 'trial' ? 'Trial Lesson' : row.lesson_type === 'group' ? 'Group Lesson' : 'Individual Lesson'),
    type: (row.lesson_type || 'individual') as LessonType,
    status: (row.lesson_status || (row.is_conducted ? 'completed' : 'scheduled')) as LessonStatus,
    topic: row.topic || '',
    comment: row.comment ?? null,
    isConducted: !!row.is_conducted || row.lesson_status === 'completed',
    room: row.room || row.location || null,
    onlineUrl: row.online_url || row.meeting_url || null,
    durationMinutes: row.duration_minutes ?? null,
    lessonNumber: row.lesson_number ?? null,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    homeworkBrief: row.homework_brief ?? null,
    carryOverToNextLesson: row.carry_over_to_next_lesson ?? null,
    structure: [],
    result: null,
    teacherId: row.teacher_id ?? null,
  };
}

function lessonToScheduleSlot(lesson: TeacherLesson): ScheduleSlot {
  return {
    id: lesson.id,
    day: lesson.day,
    date: lesson.date,
    time: lesson.time,
    topic: lesson.title,
    isConducted: lesson.isConducted,
    sourceLessonId: lesson.sourceLessonId,
    status: lesson.status,
    groupId: lesson.groupId,
    teacherId: lesson.teacherId,
    durationMinutes: lesson.durationMinutes,
    room: lesson.room,
    onlineUrl: lesson.onlineUrl,
  };
}

function rowToAttendance(row: any): TeacherLessonAttendance {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    studentId: row.student_id,
    teacherId: row.teacher_id,
    status: row.status as AttendanceStatus,
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToStudentGroup(group: any, studentIds: string[] = []): StudentGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description ?? null,
    teacherId: group.teacher_id ?? null,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
    studentIds,
    level: group.level ?? null,
    ageRange: group.age_range ?? null,
    maxSeats: group.max_seats ?? group.max_students ?? null,
    course: group.course ?? null,
    currentUnit: group.current_unit ?? null,
    currentLesson: group.current_lesson ?? null,
    progress: Number(group.progress ?? 0),
    status: group.status ?? 'active',
    lessonDurationMinutes: group.lesson_duration_minutes ?? null,
    weeklyFrequency: group.weekly_frequency ?? null,
    startDate: group.start_date ?? null,
  };
}

function rowToHomework(row: any): TeacherHomework {
  const reviewStatus = row.homework_status
    || (row.checked_at ? 'reviewed' : row.submitted_at ? 'submitted' : row.due_date && row.due_date < todayIso() ? 'late' : 'not_submitted');
  return {
    id: row.id,
    studentId: row.user_id,
    moduleId: row.module_id,
    title: row.title,
    type: row.type,
    dueDate: row.due_date ?? null,
    scheduledDate: row.scheduled_date ?? null,
    submittedAt: row.submitted_at ?? null,
    checkedAt: row.checked_at ?? null,
    resultPercent: row.result_percent ?? null,
    errorsCount: row.errors_count ?? null,
    teacherComment: row.teacher_comment ?? null,
    studentResult: row.student_result ?? null,
    starRating: row.star_rating ?? null,
    unlocked: !!row.unlocked,
    reviewStatus,
    reviewedByTeacherId: row.reviewed_by_teacher_id ?? null,
    reviewComment: row.review_comment ?? null,
    submittedAttachmentUrl: row.submitted_attachment_url ?? null,
    submittedAttachmentName: row.submitted_attachment_name ?? null,
    externalLink: row.external_link ?? null,
    interactiveLessonId: row.interactive_lesson_id ?? null,
    interactiveCompletedAt: row.interactive_completed_at ?? null,
    interactiveScorePercent: row.interactive_score_percent ?? null,
    materialMode: row.material_mode ?? null,
  };
}

function rowToLessonResult(row: any): TeacherLessonResult {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    teacherId: row.teacher_id,
    summary: row.summary || '',
    teacherComment: row.teacher_comment || '',
    homeworkBrief: row.homework_brief || '',
    carryOverToNextLesson: row.carry_over_to_next_lesson || '',
    adminNote: row.admin_note || '',
    payload: row.payload || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function lessonKindLabel(kind: string) {
  const labels: Record<string, string> = {
    theory: 'Theory',
    class_task: 'Lesson Tasks',
    practice: 'Practice',
    homework: 'Homework',
    grammar: 'Grammar',
    listening: 'Listening',
    checkpoint: 'Unit Checkpoint',
  };
  return labels[kind] || kind.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

const LESSON_BLOCK_KINDS: LessonBlockKind[] = ['theory', 'class_task', 'practice', 'homework', 'grammar', 'listening', 'checkpoint'];

function taskTitle(task: any) {
  const payload = task.payload_json || {};
  return payload.title || payload.name || payload.prompt || payload.heading || task.mechanic_type?.replace(/_/g, ' ') || 'Task';
}

function normalizeLessonTitle(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildLessonStructure(sourceLesson: any | undefined, tasks: any[] = [], relatedLessons: any[] = []): LessonStructureSection[] {
  if (!sourceLesson) return [];
  const lessons = relatedLessons.length ? relatedLessons : [sourceLesson];
  return lessons
    .sort((a, b) => Number(a.order ?? a.lesson_number ?? 0) - Number(b.order ?? b.lesson_number ?? 0))
    .map(item => {
      const kind = String(item.type || 'custom');
      return {
        id: item.id,
        label: item.title || lessonKindLabel(kind),
        kind: (LESSON_BLOCK_KINDS.includes(kind as LessonBlockKind) ? kind : 'custom') as LessonStructureSection['kind'],
        order: Number(item.order ?? item.lesson_number ?? 0),
        sourceLessonId: item.id,
        tasks: tasks
          .filter(task => task.lesson_id === item.id)
          .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
          .map(task => ({
            id: task.id,
            mechanicType: task.mechanic_type,
            title: taskTitle(task),
            order: Number(task.order ?? 0),
            payload: task.payload_json || {},
          })),
      };
    });
}

function fallbackLessonStructure(lesson: TeacherLesson): LessonStructureSection[] {
  return lesson.structure;
}

function buildAssignedLessonStructure(blocks: any[], sourceLessonsById: Map<string, any>, tasksByLessonId: Map<string, any[]>, fallbackSourceLessonId?: string | null): LessonStructureSection[] {
  return blocks
    .slice()
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map(block => {
      const blockSourceLessonId = block.source_lesson_id || (block.material_mode === 'interactive' ? fallbackSourceLessonId : null);
      const sourceLesson = blockSourceLessonId ? sourceLessonsById.get(blockSourceLessonId) : null;
      const tasks = blockSourceLessonId ? tasksByLessonId.get(blockSourceLessonId) || [] : [];
      return {
        id: block.id,
        label: block.material_title || sourceLesson?.title || lessonKindLabel(block.block_kind || 'custom'),
        kind: (LESSON_BLOCK_KINDS.includes(block.block_kind as LessonBlockKind) ? block.block_kind : 'custom') as LessonStructureSection['kind'],
        order: Number(block.position ?? sourceLesson?.order ?? sourceLesson?.lesson_number ?? 0),
        sourceLessonId: blockSourceLessonId ?? null,
        materialTitle: block.material_title || sourceLesson?.title || '',
        materialUrl: block.material_url ?? null,
        adminNote: block.admin_note || '',
        materialMode: block.material_mode ?? null,
        tasks: tasks
          .slice()
          .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
          .map(task => ({
            id: task.id,
            mechanicType: task.mechanic_type,
            title: taskTitle(task),
            order: Number(task.order ?? 0),
            payload: task.payload_json || {},
          })),
      };
    });
}

function rowToGrade(row: any): TeacherGrade {
  return {
    id: row.id,
    studentId: row.user_id,
    groupId: row.group_id ?? null,
    lessonId: row.lesson_id ?? null,
    category: (row.category || 'Participation') as GradeCategory,
    score: Number(row.score || 0),
    comment: row.comment ?? null,
    createdAt: row.created_at,
  };
}

function rowToDictionary(row: any): TeacherDictionaryWord {
  return {
    id: row.id,
    studentId: row.user_id,
    lesson: row.lesson || '',
    category: row.category || '',
    word: row.word,
    translation: row.translation,
    emoji: row.emoji || '✨',
    audioUrl: row.audio_url ?? null,
    createdAt: row.created_at,
  };
}

function rowToNote(row: any): TeacherNote {
  const targetType = String(row.target_type || (row.student_id ? 'student' : 'teacher')).toLowerCase();
  return {
    id: row.id,
    teacherId: row.teacher_id,
    studentId: row.student_id ?? null,
    authorId: row.author_id,
    text: row.text,
    targetType: targetType === 'student' ? 'Student' : targetType === 'group' ? 'Group' : targetType === 'lesson' ? 'Lesson' : targetType === 'admin' ? 'Admin' : 'Teacher',
    targetId: row.target_id ?? row.student_id ?? null,
    noteType: (row.note_type || 'Private') as TeacherNote['noteType'],
    attachmentLabel: row.attachment_label || '',
    pinned: !!row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function lessonTimeValue(lesson: TeacherLesson) {
  const date = lesson.date || todayIso();
  return new Date(`${date}T${lesson.time || '00:00'}`).getTime();
}

function calculateAttendance(lessons: TeacherLesson[]) {
  const finished = lessons.filter(lesson => ['completed', 'student_absent', 'teacher_absent'].includes(lesson.status));
  if (!finished.length) return 0;
  const attended = finished.filter(lesson => lesson.status === 'completed').length;
  return Math.round((attended / finished.length) * 100);
}

function calculateAverageGrade(grades: TeacherGrade[]) {
  if (!grades.length) return 0;
  return Math.round((grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length) * 10) / 10;
}

function ratingFromScore(scorePercent: number) {
  return Math.max(1, Math.min(5, Math.ceil(Math.max(0, Math.min(100, Math.round(scorePercent))) / 20)));
}

function scoreFromRating(stars: number) {
  return Math.max(0, Math.min(100, Math.round(Math.max(0, Math.min(5, stars)) * 20)));
}

function isSchemaNotReadyError(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = `${err?.code || ''} ${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();
  return (
    text.includes('42p01') ||
    text.includes('42703') ||
    text.includes('pgrst202') ||
    text.includes('pgrst204') ||
    text.includes('schema cache') ||
    text.includes('does not exist') ||
    text.includes('could not find')
  );
}

async function repairStudentsInteractiveCompletion(studentIds: string[]) {
  const uniqueIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (!uniqueIds.length) return;
  await Promise.all(uniqueIds.map(async studentId => {
    const { error } = await (supabase as any).rpc('repair_student_interactive_completion', {
      _user_id: studentId,
    });
    if (error && !isSchemaNotReadyError(error)) {
      console.warn('repair_student_interactive_completion RPC failed', error.message || error);
    }
  }));
}

async function assignTeacherRole(profileId: string) {
  await (supabase as any)
    .from('user_roles')
    .delete()
    .eq('user_id', profileId)
    .eq('role', 'student');

  const { error } = await (supabase as any)
    .from('user_roles')
    .upsert({ user_id: profileId, role: 'teacher' }, { onConflict: 'user_id,role' });
  if (error) throw error;
}

export async function listGroupsForAdmin(): Promise<StudentGroup[]> {
  const [{ data: groups, error: groupsError }, { data: members, error: membersError }] = await Promise.all([
    (supabase as any).from('student_groups').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('student_group_members').select('group_id,user_id'),
  ]);
  if (groupsError) throw groupsError;
  if (membersError) throw membersError;

  const memberMap = new Map<string, string[]>();
  ((members as any[]) || []).forEach(member => {
    const list = memberMap.get(member.group_id) || [];
    list.push(member.user_id);
    memberMap.set(member.group_id, list);
  });

  return ((groups as any[]) || []).map(group => rowToStudentGroup(group, memberMap.get(group.id) || []));
}

export async function listTeacherDirectory(students: User[] = []): Promise<{ teachers: TeacherDirectoryItem[]; groups: StudentGroup[] }> {
  const [{ data: teacherRows, error: teacherError }, { data: assignments, error: assignmentsError }, groups, { data: schedules, error: schedulesError }] = await Promise.all([
    (supabase as any).from('teachers').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('teacher_students').select('teacher_id,student_id'),
    listGroupsForAdmin(),
    (supabase as any).from('schedules').select('user_id,group_id,day,time,is_conducted,lesson_status'),
  ]);
  if (teacherError) throw teacherError;
  if (assignmentsError) throw assignmentsError;
  if (schedulesError) throw schedulesError;

  const directStudentsByTeacher = new Map<string, Set<string>>();
  const visibleStudentsByTeacher = new Map<string, Set<string>>();
  ((assignments as any[]) || []).forEach(row => {
    const directSet = directStudentsByTeacher.get(row.teacher_id) || new Set<string>();
    const visibleSet = visibleStudentsByTeacher.get(row.teacher_id) || new Set<string>();
    directSet.add(row.student_id);
    visibleSet.add(row.student_id);
    directStudentsByTeacher.set(row.teacher_id, directSet);
    visibleStudentsByTeacher.set(row.teacher_id, visibleSet);
  });

  const groupsByTeacher = new Map<string, StudentGroup[]>();
  groups.forEach(group => {
    if (!group.teacherId) return;
    const list = groupsByTeacher.get(group.teacherId) || [];
    list.push(group);
    groupsByTeacher.set(group.teacherId, list);
    const set = visibleStudentsByTeacher.get(group.teacherId) || new Set<string>();
    group.studentIds.forEach(id => set.add(id));
    visibleStudentsByTeacher.set(group.teacherId, set);
  });

  const knownStudentIds = new Set(students.map(student => student.id));
  const teachers = ((teacherRows as any[]) || []).map(row => {
    const teacher = rowToTeacher(row);
    const assignedStudentIds = Array.from(directStudentsByTeacher.get(teacher.id) || []).filter(id => !knownStudentIds.size || knownStudentIds.has(id));
    const visibleStudentIds = Array.from(visibleStudentsByTeacher.get(teacher.id) || []).filter(id => !knownStudentIds.size || knownStudentIds.has(id));
    const assignedGroups = groupsByTeacher.get(teacher.id) || [];
    const visibleSchedules = ((schedules as any[]) || []).filter(item => visibleStudentIds.includes(item.user_id) || (item.group_id && assignedGroups.some(group => group.id === item.group_id)));
    const conducted = visibleSchedules.filter(item => item.is_conducted || item.lesson_status === 'completed').length;
    return {
      ...teacher,
      studentsCount: visibleStudentIds.length,
      groupsCount: assignedGroups.length,
      lessonsToday: visibleSchedules.filter(item => item.day === todayName()).length,
      lessonsWeek: visibleSchedules.length,
      totalLessons: visibleSchedules.length,
      averageAttendance: visibleSchedules.length ? Math.round((conducted / visibleSchedules.length) * 100) : 0,
      assignedStudentIds,
      assignedGroupIds: assignedGroups.map(group => group.id),
    };
  });

  return { teachers, groups };
}

export async function createTeacher(input: TeacherInput): Promise<TeacherRecord> {
  const email = input.email.trim().toLowerCase();
  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (profileError) throw profileError;

  const payload = { ...teacherToRow(input), teacher_user_id: existingProfile?.id ?? null };
  const { data, error } = await (supabase as any).from('teachers').insert(payload).select('*').single();
  if (error) throw error;

  if (existingProfile?.id) await assignTeacherRole(existingProfile.id);
  return rowToTeacher(data);
}

export async function updateTeacher(id: string, input: TeacherInput): Promise<TeacherRecord> {
  const { data, error } = await (supabase as any)
    .from('teachers')
    .update(teacherToRow(input))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToTeacher(data);
}

export async function updateOwnTeacherProfile(id: string, patch: Partial<TeacherInput>) {
  const payload: Record<string, unknown> = {};
  if (patch.firstName !== undefined) payload.first_name = patch.firstName.trim();
  if (patch.lastName !== undefined) payload.last_name = patch.lastName.trim();
  if (patch.phone !== undefined) payload.phone = patch.phone.trim() || null;
  if (patch.avatarUrl !== undefined) payload.avatar_url = patch.avatarUrl.trim() || null;
  if (patch.teachingLanguages !== undefined) payload.teaching_languages = patch.teachingLanguages;
  if (patch.levels !== undefined) payload.levels = patch.levels;
  const { error } = await (supabase as any).from('teachers').update(payload).eq('id', id);
  if (error) throw error;
}

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function avatarPathFromUrl(url?: string | null) {
  if (!url) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}

function extensionForAvatar(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export function validateTeacherAvatar(file: File) {
  if (!AVATAR_TYPES.includes(file.type)) {
    throw new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.');
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error('Avatar image must be smaller than 5 MB.');
  }
}

export async function uploadTeacherAvatar(teacherId: string, file: File, previousUrl?: string | null) {
  validateTeacherAvatar(file);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('User is not authenticated.');

  const path = `${userId}/${teacherId}-${Date.now()}-${crypto.randomUUID()}.${extensionForAvatar(file)}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = data.publicUrl;
  await updateOwnTeacherProfile(teacherId, { avatarUrl });

  const previousPath = avatarPathFromUrl(previousUrl);
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  return avatarUrl;
}

export async function clearTeacherAvatar(teacherId: string, currentUrl?: string | null) {
  const path = avatarPathFromUrl(currentUrl);
  if (path) await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  await updateOwnTeacherProfile(teacherId, { avatarUrl: '' });
}

export async function deleteTeacher(id: string) {
  const { error } = await (supabase as any).from('teachers').delete().eq('id', id);
  if (error) throw error;
}

export async function setTeacherStatus(id: string, status: TeacherStatus) {
  const { error } = await (supabase as any).from('teachers').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function setTeacherStudents(teacherId: string, studentIds: string[]) {
  const unique = Array.from(new Set(studentIds.filter(Boolean)));
  const { error: deleteError } = await (supabase as any).from('teacher_students').delete().eq('teacher_id', teacherId);
  if (deleteError) throw deleteError;

  if (!unique.length) return;
  const { error } = await (supabase as any)
    .from('teacher_students')
    .insert(unique.map(studentId => ({ teacher_id: teacherId, student_id: studentId })));
  if (error) throw error;
}

export async function setTeacherGroups(teacherId: string, groupIds: string[]) {
  const unique = Array.from(new Set(groupIds.filter(Boolean)));
  const { error: clearError } = await (supabase as any).from('student_groups').update({ teacher_id: null }).eq('teacher_id', teacherId);
  if (clearError) throw clearError;

  if (!unique.length) return;
  const { error } = await (supabase as any).from('student_groups').update({ teacher_id: teacherId }).in('id', unique);
  if (error) throw error;
}

export async function setStudentGroupMembers(groupId: string, studentIds: string[]) {
  const unique = Array.from(new Set(studentIds.filter(Boolean)));
  const { error: deleteError } = await (supabase as any).from('student_group_members').delete().eq('group_id', groupId);
  if (deleteError) throw deleteError;

  if (!unique.length) return;
  const { error } = await (supabase as any)
    .from('student_group_members')
    .insert(unique.map(studentId => ({ group_id: groupId, user_id: studentId })));
  if (error) throw error;
}

export async function createStudentGroupForAdmin(input: StudentGroupInput): Promise<StudentGroup> {
  const name = input.name.trim();
  if (!name) throw new Error('Group name is required.');

  const payload: Record<string, unknown> = {
    name,
    description: input.description?.trim() || null,
    teacher_id: input.teacherId || null,
    level: input.level?.trim() || null,
    course: input.course?.trim() || input.level?.trim() || null,
    status: 'active',
  };

  let result = await (supabase as any).from('student_groups').insert(payload).select('*').single();
  if (result.error && isSchemaNotReadyError(result.error)) {
    const compatiblePayload = { ...payload };
    delete compatiblePayload.level;
    delete compatiblePayload.course;
    delete compatiblePayload.status;
    result = await (supabase as any).from('student_groups').insert(compatiblePayload).select('*').single();
  }
  if (result.error) throw result.error;

  await setStudentGroupMembers(result.data.id, input.studentIds || []);
  return rowToStudentGroup(result.data, input.studentIds || []);
}

export async function deleteStudentGroupForAdmin(groupId: string) {
  const { error: memberError } = await (supabase as any)
    .from('student_group_members')
    .delete()
    .eq('group_id', groupId);
  if (memberError && !isSchemaNotReadyError(memberError)) throw memberError;

  const { error: assignmentError } = await (supabase as any)
    .from('teacher_groups')
    .delete()
    .eq('group_id', groupId);
  if (assignmentError && !isSchemaNotReadyError(assignmentError)) throw assignmentError;

  const { error } = await (supabase as any)
    .from('student_groups')
    .delete()
    .eq('id', groupId);
  if (error) throw error;
}

export async function loadTeacherWorkspace(currentUserId?: string): Promise<TeacherWorkspace> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const authUserId = authData.user?.id || currentUserId;
  if (!authUserId) {
    throw new Error('Teacher workspace requires an authenticated user.');
  }

  const { data: initialTeacherRow, error: teacherError } = await (supabase as any)
    .from('teachers')
    .select('*')
    .eq('teacher_user_id', authUserId)
    .maybeSingle();
  if (teacherError) throw teacherError;
  let teacherRow = initialTeacherRow;

  if (!teacherRow) {
    const { error: linkError } = await (supabase as any).rpc('link_current_teacher_by_email');
    if (linkError && !/link_current_teacher_by_email|schema cache|pgrst202|42883/i.test(linkError.message || '')) {
      throw linkError;
    }
    const retry = await (supabase as any)
      .from('teachers')
      .select('*')
      .eq('teacher_user_id', authUserId)
      .maybeSingle();
    if (retry.error) throw retry.error;
    teacherRow = retry.data;
  }

  if (!teacherRow) {
    return {
      teacher: null,
      students: [],
      groups: [],
      lessons: [],
      homeworks: [],
      grades: [],
      dictionary: [],
      notes: [],
      attendance: [],
      stats: { todayLessons: 0, studentsCount: 0, groupsCount: 0, homeworkToReview: 0, notifications: 0, missedLessons: 0, nextLesson: null, lessonsThisWeek: 0, completedLessons: 0, upcomingLessons: 0 },
    };
  }

  const teacher = rowToTeacher(teacherRow);
  const [{ data: directRows, error: directError }, { data: groupRows, error: groupError }] = await Promise.all([
    (supabase as any).from('teacher_students').select('student_id').eq('teacher_id', teacher.id),
    (supabase as any).from('student_groups').select('*').eq('teacher_id', teacher.id),
  ]);
  if (directError && !isSchemaNotReadyError(directError)) throw directError;
  if (groupError && !isSchemaNotReadyError(groupError)) throw groupError;

  const groups = ((groupError ? [] : groupRows as any[]) || []).map(group => rowToStudentGroup(group, []));
  const groupIds = groups.map(group => group.id);
  const { data: memberRows, error: memberError } = groupIds.length
    ? await (supabase as any).from('student_group_members').select('group_id,user_id').in('group_id', groupIds)
    : { data: [], error: null };
  if (memberError && !isSchemaNotReadyError(memberError)) throw memberError;

  const visibleStudentIds = new Set<string>(((directError ? [] : directRows as any[]) || []).map(row => row.student_id));
  (((memberError ? [] : memberRows) as any[]) || []).forEach(member => {
    visibleStudentIds.add(member.user_id);
    const group = groups.find(item => item.id === member.group_id);
    if (group) group.studentIds.push(member.user_id);
  });

  const ids = Array.from(visibleStudentIds);
  await repairStudentsInteractiveCompletion(ids);
  const empty = { data: [], error: null };
  const [
    { data: profileRows, error: profileError },
    { data: contentRows, error: contentError },
    { data: gradeRows, error: gradeError },
    { data: dictRows, error: dictError },
    { data: attendanceRows, error: attendanceError },
  ] = ids.length
    ? await Promise.all([
        supabase.from('profiles').select('*').in('id', ids),
        (supabase as any).from('content_items').select('*').in('user_id', ids).order('created_at', { ascending: false }),
        (supabase as any).from('grades').select('*').in('user_id', ids).order('created_at', { ascending: false }),
        (supabase as any).from('dictionary_words').select('*').in('user_id', ids).order('created_at', { ascending: false }),
        (supabase as any).from('lesson_attendance').select('*').eq('teacher_id', teacher.id).in('student_id', ids).order('updated_at', { ascending: false }),
      ])
    : [empty, empty, empty, empty, empty, empty];
  const [{ data: teacherScheduleRows, error: teacherScheduleError }, { data: studentScheduleRows, error: studentScheduleError }] = await Promise.all([
    (supabase as any).from('schedules').select('*').eq('teacher_id', teacher.id).order('time', { ascending: true }),
    ids.length
      ? (supabase as any).from('schedules').select('*').in('user_id', ids).order('time', { ascending: true })
      : Promise.resolve(empty),
  ]);
  const { data: noteRows, error: noteError } = await (supabase as any)
    .from('teacher_student_notes')
    .select('*')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false });
  if (profileError && !isSchemaNotReadyError(profileError)) throw profileError;
  if (teacherScheduleError && !isSchemaNotReadyError(teacherScheduleError)) throw teacherScheduleError;
  if (studentScheduleError && !isSchemaNotReadyError(studentScheduleError)) throw studentScheduleError;
  if (contentError && !isSchemaNotReadyError(contentError)) throw contentError;
  if (gradeError && !isSchemaNotReadyError(gradeError)) throw gradeError;
  if (dictError && !isSchemaNotReadyError(dictError)) throw dictError;
  if (noteError && !isSchemaNotReadyError(noteError)) throw noteError;
  if (attendanceError && !isSchemaNotReadyError(attendanceError)) throw attendanceError;

  const rawLessonRows = Array.from(new Map([
    ...(((teacherScheduleError ? [] : teacherScheduleRows) as any[]) || []),
    ...(((studentScheduleError ? [] : studentScheduleRows) as any[]) || []),
  ].map(row => [row.id, row])).values());
  const rawLessonIds = rawLessonRows.map(row => row.id).filter(Boolean);
  const { data: planBlockRows, error: planBlockError } = rawLessonIds.length
    ? await (supabase as any).from('lesson_plan_blocks').select('*').in('schedule_id', rawLessonIds).order('position', { ascending: true })
    : { data: [], error: null };
  if (planBlockError && !isSchemaNotReadyError(planBlockError)) throw planBlockError;

  const planBlocks = (((planBlockError ? [] : planBlockRows) as any[]) || []);
  const sourceLessonIds = Array.from(new Set([
    ...rawLessonRows.map(row => row.source_lesson_id).filter(Boolean),
    ...planBlocks.map(row => row.source_lesson_id).filter(Boolean),
  ]));
  const [{ data: sourceLessonRows, error: sourceLessonError }, { data: sourceTaskRows, error: sourceTaskError }, { data: resultRows, error: resultError }] = await Promise.all([
    sourceLessonIds.length
      ? (supabase as any).from('lessons').select('*').in('id', sourceLessonIds)
      : Promise.resolve({ data: [], error: null }),
    sourceLessonIds.length
      ? (supabase as any).from('interactive_tasks').select('*').in('lesson_id', sourceLessonIds).order('order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    rawLessonRows.length
      ? (supabase as any).from('lesson_results').select('*').eq('teacher_id', teacher.id).in('lesson_id', rawLessonIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sourceLessonError && !isSchemaNotReadyError(sourceLessonError)) throw sourceLessonError;
  if (sourceTaskError && !isSchemaNotReadyError(sourceTaskError)) throw sourceTaskError;
  if (resultError && !isSchemaNotReadyError(resultError)) throw resultError;

  const sourceLessonsById = new Map((((sourceLessonError ? [] : sourceLessonRows) as any[]) || []).map(row => [row.id, row]));
  const allTaskRows = (((sourceTaskError ? [] : sourceTaskRows) as any[]) || []);
  const tasksByLessonId = allTaskRows.reduce<Map<string, any[]>>((acc, row) => {
    const list = acc.get(row.lesson_id) || [];
    list.push(row);
    acc.set(row.lesson_id, list);
    return acc;
  }, new Map());
  const resultsByLessonId = new Map((((resultError ? [] : resultRows) as any[]) || []).map(row => [row.lesson_id, rowToLessonResult(row)]));
  const blocksByScheduleId = planBlocks.reduce<Map<string, any[]>>((acc, row) => {
    const list = acc.get(row.schedule_id) || [];
    list.push(row);
    acc.set(row.schedule_id, list);
    return acc;
  }, new Map());

  const lessons = rawLessonRows.map(row => {
    const lesson = rowToLesson(row);
    return {
      ...lesson,
      structure: fallbackLessonStructure({
        ...lesson,
        structure: buildAssignedLessonStructure(blocksByScheduleId.get(lesson.id) || [], sourceLessonsById, tasksByLessonId, lesson.sourceLessonId),
      }),
      result: resultsByLessonId.get(lesson.id) || null,
    };
  });
  const homeworks = (((contentError ? [] : contentRows) as any[]) || []).filter(row => ['homework', 'practice', 'grammar', 'listening', 'checkpoint'].includes(row.type)).map(rowToHomework);
  const grades = (((gradeError ? [] : gradeRows) as any[]) || []).map(rowToGrade);
  const dictionary = (((dictError ? [] : dictRows) as any[]) || []).map(rowToDictionary);
  const notes = (((noteError ? [] : noteRows) as any[]) || []).map(rowToNote);
  const attendance = (((attendanceError ? [] : attendanceRows) as any[]) || []).map(rowToAttendance);

  const teacherStudents: TeacherStudent[] = (((profileError ? [] : profileRows) as any[]) || []).map(row => {
    const base = profileToUser(row);
    const studentLessons = lessons.filter(lesson => lesson.studentId === base.id);
    const studentGrades = grades.filter(grade => grade.studentId === base.id);
    const studentGroups = groups.filter(group => group.studentIds.includes(base.id));
    const pastLessons = studentLessons.filter(lesson => ['completed', 'student_absent', 'teacher_absent'].includes(lesson.status)).sort((a, b) => lessonTimeValue(b) - lessonTimeValue(a));
    const futureLessons = studentLessons.filter(lesson => ['scheduled', 'upcoming', 'ready', 'in_progress'].includes(lesson.status) && lessonTimeValue(lesson) >= Date.now()).sort((a, b) => lessonTimeValue(a) - lessonTimeValue(b));
    const progress = Math.min(100, Math.round((studentGrades.length * 8 + studentLessons.filter(lesson => lesson.status === 'completed').length * 5) || 0));
    return {
      ...base,
      age: row.age ?? null,
      level: row.level ?? studentGroups[0]?.level ?? null,
      tariff: row.tariff ?? row.plan_name ?? null,
      groupNames: studentGroups.map(group => group.name),
      lessonsCount: studentLessons.length,
      averageGrade: calculateAverageGrade(studentGrades),
      attendance: calculateAttendance(studentLessons),
      lastLesson: pastLessons[0] || null,
      nextLesson: futureLessons[0] || null,
      progress,
      lastActivity: [pastLessons[0]?.date, pastLessons[0]?.day].filter(Boolean).join(' ') || base.joinedAt,
      statusLabel: row.student_status ?? (base.hasAccess ? 'active' : 'trial'),
      course: row.course ?? studentGroups[0]?.course ?? null,
      homeworkCompletion: homeworks.filter(item => item.studentId === base.id).length
        ? Math.round((homeworks.filter(item => item.studentId === base.id && item.checkedAt).length / homeworks.filter(item => item.studentId === base.id).length) * 100)
        : 0,
    };
  });

  const nowTime = Date.now();
  const activeLessonStatuses: LessonStatus[] = ['scheduled', 'upcoming', 'ready', 'in_progress'];
  const isFutureLesson = (lesson: TeacherLesson) => lessonTimeValue(lesson) >= nowTime && !['completed', 'cancelled', 'rescheduled'].includes(lesson.status);
  const isTodayActiveLesson = (lesson: TeacherLesson) => {
    const matchesToday = lesson.date === todayIso() || (!lesson.date && lesson.day === todayName());
    return matchesToday && activeLessonStatuses.includes(lesson.status) && lessonTimeValue(lesson) >= nowTime;
  };
  const upcoming = lessons
    .filter(isFutureLesson)
    .sort((a, b) => lessonTimeValue(a) - lessonTimeValue(b));
  const homeworkToReview = homeworks.filter(item => item.reviewStatus === 'submitted' || (!item.checkedAt && !!item.submittedAt)).length;
  const overdueHomework = homeworks.filter(item => item.dueDate && item.dueDate < todayIso() && !item.checkedAt).length;
  const missedLessons = lessons.filter(lesson => lesson.status === 'student_absent' || lesson.status === 'teacher_absent').length;

  return {
    teacher,
    students: teacherStudents,
    groups,
    lessons,
    homeworks,
    grades,
    dictionary,
    notes,
    attendance,
    stats: {
      todayLessons: lessons.filter(isTodayActiveLesson).length,
      studentsCount: teacherStudents.length,
      groupsCount: groups.length,
      homeworkToReview,
      notifications: homeworkToReview + overdueHomework + missedLessons,
      missedLessons,
      nextLesson: upcoming[0] || null,
      lessonsThisWeek: lessons.length,
      completedLessons: lessons.filter(lesson => lesson.status === 'completed' || lesson.isConducted).length,
      upcomingLessons: upcoming.length,
    },
  };
}

export async function saveTeacherLesson(input: {
  id?: string;
  teacherId: string;
  studentId: string;
  groupId?: string | null;
  sourceLessonId?: string | null;
  date?: string | null;
  day: string;
  time: string;
  title: string;
  type: LessonType;
  status: LessonStatus;
  durationMinutes?: number | null;
  room?: string | null;
  onlineUrl?: string | null;
  comment?: string;
  assignedBlocks?: TeacherLessonPlanBlockInput[];
}) {
  const { data: previousRow } = input.id
    ? await (supabase as any).from('schedules').select('*').eq('id', input.id).maybeSingle()
    : { data: null };
  const row = {
    user_id: input.studentId,
    teacher_id: input.teacherId,
    group_id: input.groupId || null,
    source_lesson_id: input.sourceLessonId || null,
    scheduled_date: input.date || null,
    day: input.day,
    time: input.time,
    topic: input.title,
    lesson_type: input.type,
    lesson_status: input.status,
    duration_minutes: input.durationMinutes || null,
    room: input.room || null,
    online_url: input.onlineUrl || null,
    comment: input.comment || null,
    is_conducted: input.status === 'completed',
  };
  const write = (payload: Record<string, unknown>) => input.id
    ? (supabase as any).from('schedules').update(payload).eq('id', input.id).select('*').single()
    : (supabase as any).from('schedules').insert(payload).select('*').single();
  let { data, error } = await write(row);
  if (error && isSchemaNotReadyError(error)) {
    const { duration_minutes, room, online_url, ...fallbackRow } = row;
    const retry = await write(fallbackRow);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  const savedLesson = rowToLesson(data);
  if (input.assignedBlocks !== undefined) {
    await saveLessonPlanBlocks(savedLesson.id, input.assignedBlocks);
  }
  if (input.studentId && savedLesson.status !== 'completed') {
    const before = previousRow ? [lessonToScheduleSlot(rowToLesson(previousRow))] : [];
    await notifyScheduleSaved(input.studentId, before, [lessonToScheduleSlot(savedLesson)]);
  }
  return savedLesson;
}

export async function saveLessonPlanBlocks(scheduleId: string, blocks: TeacherLessonPlanBlockInput[]) {
  const uniqueBlocks = blocks.filter(block => block.blockKind);
  const { error: deleteError } = await (supabase as any)
    .from('lesson_plan_blocks')
    .delete()
    .eq('schedule_id', scheduleId);
  if (deleteError && !isSchemaNotReadyError(deleteError)) throw deleteError;
  if (!uniqueBlocks.length || (deleteError && isSchemaNotReadyError(deleteError))) return;
  const rows = uniqueBlocks.map((block, index) => ({
    schedule_id: scheduleId,
    block_kind: block.blockKind,
    source_lesson_id: block.sourceLessonId || null,
    material_title: block.materialTitle?.trim() || '',
    material_url: block.materialUrl?.trim() || null,
    admin_note: block.adminNote?.trim() || '',
    material_mode: block.materialMode || (block.sourceLessonId && !block.materialUrl ? 'interactive' : 'file_link'),
    position: block.position ?? index,
  }));
  const { error } = await (supabase as any).from('lesson_plan_blocks').insert(rows);
  if (error && !isSchemaNotReadyError(error)) throw error;
}

export async function deleteTeacherLesson(lessonId: string) {
  const { data: lessonBefore } = await (supabase as any).from('schedules').select('*').eq('id', lessonId).maybeSingle();
  await (supabase as any).from('content_items').delete().like('module_id', `lesson-block:${lessonId}:%`);
  await (supabase as any).from('lesson_plan_blocks').delete().eq('schedule_id', lessonId);
  await (supabase as any).from('lesson_attendance').delete().eq('lesson_id', lessonId);
  await (supabase as any).from('lesson_results').delete().eq('lesson_id', lessonId);
  await (supabase as any).from('grades').delete().eq('lesson_id', lessonId);
  const { error } = await (supabase as any).from('schedules').delete().eq('id', lessonId);
  if (error) throw error;
  if (lessonBefore?.user_id) {
    await notifyScheduleSaved(lessonBefore.user_id, [lessonToScheduleSlot(rowToLesson(lessonBefore))], []);
  }
}

const REVIEWABLE_LESSON_BLOCKS: Partial<Record<LessonBlockKind, { type: string; emoji: string; label: string }>> = {
  homework: { type: 'homework', emoji: '📚', label: 'Homework' },
  practice: { type: 'practice', emoji: '🎯', label: 'Practice' },
  grammar: { type: 'grammar', emoji: '📝', label: 'Grammar' },
  listening: { type: 'listening', emoji: '🎧', label: 'Listening' },
  checkpoint: { type: 'checkpoint', emoji: '🏁', label: 'Unit Checkpoint' },
};

export async function syncLessonBlockContentForStudents(input: {
  lessonId: string;
  teacherId: string;
  studentIds: string[];
  date?: string | null;
  time?: string;
  blocks: TeacherLessonPlanBlockInput[];
}) {
  const students = Array.from(new Set(input.studentIds.filter(Boolean)));
  const reviewableBlocks = input.blocks.filter(block => !!REVIEWABLE_LESSON_BLOCKS[block.blockKind]);
  if (!students.length) return;

  const moduleIds = reviewableBlocks.map(block => `lesson-block:${input.lessonId}:${block.blockKind}`);
  const { data: existingRows, error: existingError } = await (supabase as any)
    .from('content_items')
    .select('*')
    .in('user_id', students)
    .like('module_id', `lesson-block:${input.lessonId}:%`);
  if (existingError && !isSchemaNotReadyError(existingError)) throw existingError;
  const allExisting = (((existingError ? [] : existingRows) as any[]) || []);
  const staleIds = allExisting
    .filter(row => !moduleIds.includes(row.module_id))
    .map(row => row.id)
    .filter(Boolean);
  if (staleIds.length) {
    const { error: staleError } = await (supabase as any).from('content_items').delete().in('id', staleIds);
    if (staleError && !isSchemaNotReadyError(staleError)) throw staleError;
    await Promise.all(allExisting
      .filter(row => staleIds.includes(row.id) && row.type === 'homework')
      .map(row => notifyHomeworkChanged(row.user_id, { id: row.id, title: row.title || 'Homework', eventId: new Date().toISOString(), canceled: true })));
  }
  if (!reviewableBlocks.length) return;

  const existingByKey = new Map(allExisting.map(row => [`${row.user_id}:${row.module_id}`, row]));
  const interactiveLessonIds = Array.from(new Set(reviewableBlocks
    .filter(block => block.materialMode === 'interactive' && !!block.sourceLessonId)
    .map(block => block.sourceLessonId as string)));
  let progressByStudentLesson = new Map<string, any>();
  if (interactiveLessonIds.length) {
    const { data: progressRows, error: progressError } = await (supabase as any)
      .from('lesson_progress')
      .select('user_id,lesson_id,completed_at,stars_awarded')
      .in('user_id', students)
      .in('lesson_id', interactiveLessonIds);
    if (progressError && !isSchemaNotReadyError(progressError)) {
      console.warn('Could not read interactive lesson progress during content sync', progressError.message || progressError);
    }
    progressByStudentLesson = new Map((((progressError ? [] : progressRows) as any[]) || [])
      .map(row => [`${row.user_id}:${row.lesson_id}`, row]));
  }
  const now = new Date().toISOString();

  for (const studentId of students) {
    for (const block of reviewableBlocks) {
      const meta = REVIEWABLE_LESSON_BLOCKS[block.blockKind];
      if (!meta) continue;
      const moduleId = `lesson-block:${input.lessonId}:${block.blockKind}`;
      const existing = existingByKey.get(`${studentId}:${moduleId}`);
      const isInteractive = block.materialMode === 'interactive' && !!block.sourceLessonId;
      const progress = isInteractive ? progressByStudentLesson.get(`${studentId}:${block.sourceLessonId}`) : null;
      const progressRating = Math.max(0, Math.min(5, Number(progress?.stars_awarded || 0)));
      const shouldTrustProgressRating = progressRating > 0 && Number(existing?.star_rating || 0) > progressRating;
      const hasStoredScore = existing?.interactive_score_percent != null || existing?.result_percent != null;
      const completedScore = shouldTrustProgressRating
        ? scoreFromRating(progressRating)
        : hasStoredScore
        ? Number(existing?.interactive_score_percent ?? existing?.result_percent)
        : progressRating > 0
          ? scoreFromRating(progressRating)
          : 100;
      const completedRating = shouldTrustProgressRating ? progressRating : Number(existing?.star_rating || progressRating || ratingFromScore(completedScore));
      const completedAt = progress?.completed_at || existing?.interactive_completed_at || now;
      const shouldPreserveSubmission = !!existing?.submitted_at || !!existing?.checked_at || ['submitted', 'reviewed', 'revision_requested'].includes(existing?.homework_status || '');
      const payload = {
        user_id: studentId,
        module_id: moduleId,
        type: meta.type,
        title: block.materialTitle?.trim() || meta.label,
        emoji: meta.emoji,
        external_link: isInteractive ? null : block.materialUrl?.trim() || null,
        interactive_lesson_id: isInteractive ? block.sourceLessonId : null,
        material_mode: isInteractive ? 'interactive' : 'file_link',
        scheduled_date: input.date || null,
        scheduled_time: input.time || null,
        due_date: input.date || null,
        teacher_comment: block.adminNote?.trim() || null,
        unlocked: true,
        homework_status: progress ? 'reviewed' : shouldPreserveSubmission ? (existing?.homework_status || (existing?.checked_at ? 'reviewed' : 'submitted')) : 'not_submitted',
        submitted_at: progress ? (existing?.submitted_at || completedAt) : shouldPreserveSubmission ? existing?.submitted_at || null : null,
        checked_at: progress ? (existing?.checked_at || completedAt) : existing?.checked_at || null,
        result_percent: progress ? (shouldTrustProgressRating ? completedScore : existing?.result_percent ?? completedScore) : existing?.result_percent ?? null,
        star_rating: progress ? (shouldTrustProgressRating ? completedRating : existing?.star_rating ?? completedRating) : existing?.star_rating ?? null,
        student_result: progress ? (existing?.student_result || 'Interactive completed') : existing?.student_result ?? null,
        review_comment: progress ? (existing?.review_comment || 'Интерактивное задание выполнено автоматически.') : existing?.review_comment ?? null,
        interactive_completed_at: progress ? (existing?.interactive_completed_at || completedAt) : existing?.interactive_completed_at ?? null,
        interactive_score_percent: progress ? (shouldTrustProgressRating ? completedScore : existing?.interactive_score_percent ?? completedScore) : existing?.interactive_score_percent ?? null,
        rewarded_stars: progress
          ? Number(existing?.rewarded_stars || 0) || Math.max(completedRating, Number(progress.stars_awarded || 0))
          : existing?.rewarded_stars ?? 0,
        updated_at: now,
      };
      const query = existing?.id
        ? (supabase as any).from('content_items').update(payload).eq('id', existing.id)
        : (supabase as any).from('content_items').insert(payload);
      const { error } = await query;
      if (error && !isSchemaNotReadyError(error)) throw error;
      if (meta.type === 'homework') {
        if (!existing) {
          await notifyHomeworkAssigned(studentId, { id: payload.module_id, title: payload.title });
        } else if (existing.title !== payload.title || existing.due_date !== payload.due_date || existing.external_link !== payload.external_link) {
          await notifyHomeworkChanged(studentId, { id: existing.id, title: payload.title, eventId: now });
        }
      }
    }
  }
}

async function saveLessonGrades(input: {
  lessonId: string;
  teacherId: string;
  groupId?: string | null;
  grades: Array<{ studentId: string; category?: GradeCategory; score: number; comment?: string | null }>;
}) {
  for (const grade of input.grades) {
    const category = grade.category || 'Participation';
    const existing = await (supabase as any)
      .from('grades')
      .select('id')
      .eq('lesson_id', input.lessonId)
      .eq('user_id', grade.studentId)
      .eq('category', category)
      .maybeSingle();
    if (existing.error && !isSchemaNotReadyError(existing.error)) throw existing.error;
    const payload = {
      lesson_id: input.lessonId,
      teacher_id: input.teacherId,
      user_id: grade.studentId,
      group_id: input.groupId || null,
      category,
      score: Math.max(0, Math.min(5, Number(grade.score) || 0)),
      max_score: 5,
      comment: grade.comment?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const query = existing.data?.id
      ? (supabase as any).from('grades').update(payload).eq('id', existing.data.id)
      : (supabase as any).from('grades').insert(payload);
    const { error } = await query;
    if (error && !isSchemaNotReadyError(error)) throw error;
  }
}

export async function updateLessonStatus(id: string, status: LessonStatus, comment?: string) {
  const { error } = await (supabase as any)
    .from('schedules')
    .update({ lesson_status: status, is_conducted: status === 'completed', comment: comment || null })
    .eq('id', id);
  if (error) throw error;
}

export async function updateTeacherLesson(id: string, patch: { status?: LessonStatus; date?: string | null; time?: string; comment?: string | null }) {
  if (patch.status === 'in_progress' && patch.date === undefined && patch.time === undefined && patch.comment === undefined) {
    const { error: rpcError } = await (supabase as any).rpc('teacher_start_lesson', {
      _lesson_id: id,
    });
    if (!rpcError) return;
    console.warn('teacher_start_lesson RPC failed, trying direct schedule update', rpcError.message || rpcError);
  }

  const row: Record<string, unknown> = {};
  if (patch.status) {
    row.lesson_status = patch.status;
    row.is_conducted = patch.status === 'completed';
    if (patch.status === 'in_progress') row.started_at = new Date().toISOString();
    if (patch.status === 'completed') row.completed_at = new Date().toISOString();
  }
  if (patch.date !== undefined) row.scheduled_date = patch.date;
  if (patch.time !== undefined) row.time = patch.time;
  if (patch.comment !== undefined) row.comment = patch.comment;
  const { error } = await (supabase as any).from('schedules').update(row).eq('id', id);
  if (error) throw error;
}

export async function completeTeacherLesson(input: {
  lessonId: string;
  teacherId: string;
  groupId?: string | null;
  attendance: Array<{ studentId: string; status: AttendanceStatus; note?: string }>;
  summary: string;
  teacherComment: string;
  homeworkBrief: string;
  carryOverToNextLesson: string;
  adminNote?: string;
  startedAt?: string | null;
  grades?: Array<{ studentId: string; category?: GradeCategory; score: number; comment?: string | null }>;
}) {
  const { data: scheduleBefore } = await (supabase as any)
    .from('schedules')
    .select('started_at')
    .eq('id', input.lessonId)
    .maybeSingle();

  await saveLessonAttendances(input.attendance.map(row => ({
    lessonId: input.lessonId,
    teacherId: input.teacherId,
    studentId: row.studentId,
    status: row.status,
    note: row.note,
  })));

  const now = new Date().toISOString();
  const startedAt = scheduleBefore?.started_at || input.startedAt || now;
  const actualDurationSeconds = Math.max(0, Math.round((new Date(now).getTime() - new Date(startedAt).getTime()) / 1000));
  const { data: result, error: resultError } = await (supabase as any)
    .from('lesson_results')
    .upsert({
      lesson_id: input.lessonId,
      teacher_id: input.teacherId,
      summary: input.summary.trim(),
      teacher_comment: input.teacherComment.trim(),
      homework_brief: input.homeworkBrief.trim(),
      carry_over_to_next_lesson: input.carryOverToNextLesson.trim(),
      admin_note: input.adminNote?.trim() || '',
      payload: {
        attendance: input.attendance.map(row => ({ student_id: row.studentId, status: row.status, note: row.note || null })),
        grades: (input.grades || []).map(row => ({ student_id: row.studentId, category: row.category || 'Participation', score: row.score, comment: row.comment || null })),
        started_at: startedAt,
        completed_at: now,
        actual_duration_seconds: actualDurationSeconds,
        actual_duration_minutes: Math.max(0, Math.round(actualDurationSeconds / 60)),
      },
      updated_at: now,
    }, { onConflict: 'lesson_id' })
    .select('*')
    .single();
  if (resultError) throw resultError;

  const { error: lessonError } = await (supabase as any)
    .from('schedules')
    .update({
      lesson_status: 'completed',
      is_conducted: true,
      completed_at: now,
      started_at: startedAt,
      completed_by_teacher_id: input.teacherId,
      comment: input.teacherComment.trim() || null,
      homework_brief: input.homeworkBrief.trim() || null,
      carry_over_to_next_lesson: input.carryOverToNextLesson.trim() || null,
    })
    .eq('id', input.lessonId);
  if (lessonError) throw lessonError;
  const resultEventId = result.updated_at || now;
  const resultStudents = Array.from(new Set(input.attendance.map(row => row.studentId).filter(Boolean)));
  await Promise.all(resultStudents.map(studentId => notifyLessonResultPublished(studentId, {
    lessonId: input.lessonId,
    title: input.summary.trim() || 'Lesson result',
    comment: input.teacherComment,
    eventId: resultEventId,
  })));
  if (input.grades?.length) {
    await saveLessonGrades({
      lessonId: input.lessonId,
      teacherId: input.teacherId,
      groupId: input.groupId || null,
      grades: input.grades,
    });
    const { data: scheduleRow } = await (supabase as any)
      .from('schedules')
      .select('topic,title,day,time,scheduled_date')
      .eq('id', input.lessonId)
      .maybeSingle();
    const title = scheduleRow?.topic || scheduleRow?.title || input.summary.trim() || 'Lesson result';
    await Promise.all(input.grades.map(grade => notifyLessonGradePublished(grade.studentId, {
      lessonId: input.lessonId,
      title,
      score: grade.score,
      comment: grade.comment || input.teacherComment,
      category: grade.category || 'Participation',
      gradeEventId: `${resultEventId}:${grade.category || 'Participation'}`,
    })));
  }

  return rowToLessonResult(result);
}

export async function saveLessonAttendance(input: {
  lessonId: string;
  teacherId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}) {
  const { error } = await (supabase as any)
    .from('lesson_attendance')
    .upsert({
      lesson_id: input.lessonId,
      teacher_id: input.teacherId,
      student_id: input.studentId,
      status: input.status,
      note: input.note || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lesson_id,student_id' });
  if (error) throw error;
  await notifyAttendanceNoShow([input]);
}

export async function saveLessonAttendances(rows: Array<{ lessonId: string; teacherId: string; studentId: string; status: AttendanceStatus; note?: string }>) {
  if (!rows.length) return;
  const payload = rows.map(row => ({
    lesson_id: row.lessonId,
    teacher_id: row.teacherId,
    student_id: row.studentId,
    status: row.status,
    note: row.note || null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await (supabase as any).from('lesson_attendance').upsert(payload, { onConflict: 'lesson_id,student_id' });
  if (error) throw error;
  await notifyAttendanceNoShow(rows);
}

/** Пропуск урока — отдельное событие уведомлений (родитель, преподаватель, админ). */
async function notifyAttendanceNoShow(rows: Array<{ lessonId: string; studentId: string; status: AttendanceStatus }>) {
  const absent = rows.filter(row => row.status === 'absent_unexcused');
  if (!absent.length) return;
  const lessonIds = Array.from(new Set(absent.map(row => row.lessonId)));
  const { data } = await (supabase as any)
    .from('schedules')
    .select('id,day,date,time,topic,teacher_id')
    .in('id', lessonIds);
  const byId = new Map(((data as any[]) || []).map(row => [row.id, row]));
  await Promise.all(absent.map(async row => {
    const lesson = byId.get(row.lessonId);
    if (!lesson) return;
    try {
      await notifyLessonNoShow(row.studentId, {
        id: lesson.id,
        day: lesson.day,
        date: lesson.date,
        time: lesson.time,
        topic: lesson.topic,
      } as any);
    } catch (error) {
      console.warn('no-show notification failed', error);
    }
  }));
}

export async function saveHomeworkComment(homeworkId: string, patch: { teacherId?: string; teacherComment?: string; resultPercent?: number | null; errorsCount?: number | null; starRating?: number | null; status?: 'reviewed' | 'revision_requested' }) {
  const reviewedAt = new Date().toISOString();
  const previous = await (supabase as any)
    .from('content_items')
    .select('id,user_id,type,title,star_rating,teacher_comment,review_comment,checked_at,updated_at')
    .eq('id', homeworkId)
    .maybeSingle();
  if (previous.error && !isSchemaNotReadyError(previous.error)) throw previous.error;
  const previousRow = previous.data as any | null;
  const shouldAward = patch.status !== 'revision_requested'
    && !!previousRow?.user_id
    && !!patch.starRating
    && patch.starRating > 0
    && !(previousRow?.star_rating && previousRow.star_rating > 0);
  const awardIfNeeded = async () => {
    if (!shouldAward) return;
    try {
      await awardStars(previousRow.user_id, Math.max(1, Math.min(5, Number(patch.starRating) || 0)));
    } catch (error) {
      console.error('awardStars failed', error);
    }
  };

  if (patch.teacherId && ['homework', 'practice', 'grammar', 'listening', 'checkpoint'].includes(previousRow?.type || '')) {
    const { error: rpcError } = await (supabase as any).rpc('teacher_review_homework', {
      _homework_id: homeworkId,
      _teacher_id: patch.teacherId,
      _teacher_comment: patch.teacherComment ?? '',
      _result_percent: patch.resultPercent ?? null,
      _star_rating: patch.starRating ?? null,
      _status: patch.status || 'reviewed',
    });
    if (!rpcError) {
      await awardIfNeeded();
      if (previousRow?.user_id) {
        const changed = previousRow.star_rating !== (patch.starRating ?? null)
          || (previousRow.teacher_comment || previousRow.review_comment || '') !== (patch.teacherComment || '');
        if (!changed) return;
        await notifyHomeworkReviewed(previousRow.user_id, {
          id: homeworkId,
          type: previousRow.type,
          title: previousRow.title || 'Homework',
          starRating: patch.starRating,
          teacherComment: patch.teacherComment,
          gradeEventId: reviewedAt,
        });
      }
      return;
    }
    if (!isSchemaNotReadyError(rpcError)) throw rpcError;
  }

  const { error } = await (supabase as any)
    .from('content_items')
    .update({
      teacher_comment: patch.teacherComment ?? null,
      review_comment: patch.teacherComment ?? null,
      result_percent: patch.resultPercent ?? null,
      errors_count: patch.errorsCount ?? null,
      star_rating: patch.starRating ?? null,
      reviewed_by_teacher_id: patch.teacherId ?? null,
      homework_status: patch.status || 'reviewed',
      checked_at: reviewedAt,
      student_result: patch.status === 'revision_requested' ? 'Revision Requested' : undefined,
    })
    .eq('id', homeworkId);
  if (error) throw error;
  await awardIfNeeded();
  if (previousRow?.user_id) {
    await notifyHomeworkReviewed(previousRow.user_id, {
      id: homeworkId,
      type: previousRow.type,
      title: previousRow.title || 'Homework',
      starRating: patch.starRating,
      teacherComment: patch.teacherComment,
      gradeEventId: reviewedAt,
    });
  }
}

export async function updateTeacherContentAccess(contentItemId: string, unlocked: boolean) {
  const { error } = await (supabase as any)
    .from('content_items')
    .update({ unlocked })
    .eq('id', contentItemId);
  if (error) throw error;
}

export async function createLessonChangeRequest(input: {
  lessonId: string;
  teacherId: string;
  requestType?: 'reschedule' | 'cancel' | 'format_change' | 'other';
  desiredDate?: string | null;
  desiredTime?: string | null;
  reason: string;
  comment?: string;
}) {
  const requestType = input.requestType || 'reschedule';
  const row = {
    lesson_id: input.lessonId,
    teacher_id: input.teacherId,
    request_type: requestType,
    desired_date: input.desiredDate || null,
    desired_time: input.desiredTime || null,
    reason: input.reason.trim(),
    comment: input.comment?.trim() || '',
    status: 'pending',
  };
  const existing = await (supabase as any)
    .from('lesson_change_requests')
    .select('id')
    .eq('lesson_id', input.lessonId)
    .eq('teacher_id', input.teacherId)
    .eq('request_type', requestType)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing.error && !isSchemaNotReadyError(existing.error)) throw existing.error;
  const query = existing.data?.id
    ? (supabase as any).from('lesson_change_requests').update(row).eq('id', existing.data.id)
    : (supabase as any).from('lesson_change_requests').insert(row);
  const { error } = await query;
  if (error && !isSchemaNotReadyError(error)) throw error;
}

export async function assignContentToStudents(input: {
  studentIds: string[];
  type: 'lesson' | 'homework' | 'practice';
  title: string;
  openDate?: string;
  dueDate?: string;
  comment?: string;
}) {
  const rows = Array.from(new Set(input.studentIds)).map(studentId => ({
    user_id: studentId,
    module_id: crypto.randomUUID(),
    type: input.type,
    title: input.title,
    emoji: input.type === 'lesson' ? '📚' : input.type === 'practice' ? '🎮' : '✏️',
    scheduled_date: input.openDate || null,
    due_date: input.dueDate || null,
    teacher_comment: input.comment || null,
    unlocked: true,
  }));
  if (!rows.length) return;
  const { data: inserted, error } = await (supabase as any).from('content_items').insert(rows).select('id,user_id,type,title');
  if (error) throw error;

  // Homework must reach linked Telegram parents immediately, without waiting for
  // a dashboard refresh. event_key dedupe on the edge function prevents doubles.
  if (input.type === 'homework') {
    await Promise.all((inserted || []).map((row: any) => notifyHomeworkAssigned(row.user_id, {
      id: row.id,
      title: row.title,
    })));
  }
}

export async function saveGrade(input: { teacherId: string; studentId: string; groupId?: string | null; category: GradeCategory; score: number; comment?: string }) {
  const { data, error } = await (supabase as any).from('grades').insert({
    teacher_id: input.teacherId,
    user_id: input.studentId,
    group_id: input.groupId || null,
    category: input.category,
    score: input.score,
    max_score: 5,
    comment: input.comment || null,
  }).select('id').maybeSingle();
  if (error) throw error;

  // Standalone grades never notified parents before — this was the missing link.
  await notifyLessonGradePublished(input.studentId, {
    lessonId: data?.id || `${input.studentId}:${Date.now()}`,
    title: input.category,
    score: input.score,
    comment: input.comment || null,
    category: input.category,
  });
}


export async function assignDictionaryWords(input: { studentIds: string[]; lesson?: string; category?: string; word: string; translation: string; emoji?: string; audioUrl?: string }) {
  const rows = Array.from(new Set(input.studentIds)).map(studentId => ({
    user_id: studentId,
    lesson: input.lesson || '',
    category: input.category || '',
    word: input.word,
    translation: input.translation,
    emoji: input.emoji || '✨',
    audio_url: input.audioUrl || null,
  }));
  if (!rows.length) return;
  let { error } = await (supabase as any).from('dictionary_words').insert(rows);
  if (error && /audio_url|schema cache|column/i.test(error.message || '')) {
    const legacyRows = rows.map(({ audio_url, ...row }) => row);
    const retry = await (supabase as any).from('dictionary_words').insert(legacyRows);
    error = retry.error;
  }
  if (error) throw error;
}

export async function updateTeacherDictionaryAssignments(input: {
  ids: string[];
  word: string;
  translation: string;
  category?: string;
  lesson?: string;
  emoji?: string;
  audioUrl?: string | null;
}) {
  const uniqueIds = Array.from(new Set(input.ids.filter(Boolean)));
  if (!uniqueIds.length) return;
  const row = {
    word: input.word.trim(),
    translation: input.translation.trim(),
    category: input.category?.trim() || '',
    lesson: input.lesson?.trim() || '',
    emoji: input.emoji?.trim() || '✨',
    audio_url: input.audioUrl?.trim() || null,
  };
  let { error } = await (supabase as any).from('dictionary_words').update(row).in('id', uniqueIds);
  if (error && /audio_url|schema cache|column/i.test(error.message || '')) {
    const { audio_url, ...legacyRow } = row;
    const retry = await (supabase as any).from('dictionary_words').update(legacyRow).in('id', uniqueIds);
    error = retry.error;
  }
  if (error) throw error;
}

export async function deleteTeacherDictionaryAssignments(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return 0;
  const { error, count } = await (supabase as any)
    .from('dictionary_words')
    .delete({ count: 'exact' })
    .in('id', uniqueIds);
  if (error) throw error;
  return count ?? uniqueIds.length;
}

export async function addTeacherNote(input: {
  teacherId: string;
  target: TeacherNote['targetType'];
  targetId: string;
  authorId: string;
  text: string;
  noteType?: TeacherNote['noteType'];
  attachmentLabel?: string;
  pinned?: boolean;
}) {
  const targetType = input.target.toLowerCase();
  const { data, error } = await (supabase as any).from('teacher_student_notes').insert({
    teacher_id: input.teacherId,
    student_id: input.target === 'Student' ? input.targetId : null,
    target_type: targetType,
    target_id: input.targetId,
    author_id: input.authorId,
    note_type: input.noteType || 'Private',
    attachment_label: input.attachmentLabel || '',
    pinned: !!input.pinned,
    visible_to_admin: input.noteType === 'Visible to Admin' || input.target === 'Admin',
    text: input.text,
  }).select('*').single();
  if (error) throw error;
  return rowToNote(data);
}

export async function updateTeacherNotePinned(noteId: string, pinned: boolean) {
  const { error } = await (supabase as any)
    .from('teacher_student_notes')
    .update({ pinned })
    .eq('id', noteId);
  if (error) throw error;
}

export async function deleteTeacherNote(noteId: string) {
  const { error } = await (supabase as any)
    .from('teacher_student_notes')
    .delete()
    .eq('id', noteId);
  if (error) throw error;
}

function toTeacherNotificationDbType(type: string) {
  if (type === 'Lesson rescheduled') return 'lesson_rescheduled';
  if (type === 'Lesson cancelled') return 'lesson_cancelled';
  if (type === 'Homework received') return 'homework_submitted';
  if (type === 'Lesson completed') return 'lesson_completed';
  if (type === 'Homework overdue') return 'homework_overdue';
  if (type === 'Admin message') return 'admin_message';
  return 'system';
}

export async function loadTeacherNotificationStates(teacherId: string): Promise<Record<string, TeacherNotificationState>> {
  const { data, error } = await (supabase as any)
    .from('teacher_notifications')
    .select('payload,read_at,opened_at,created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    if (isSchemaNotReadyError(error)) return {};
    throw error;
  }

  return (((data as any[]) || [])).reduce<Record<string, TeacherNotificationState>>((acc, row) => {
    const eventKey = row.payload?.event_key;
    if (eventKey && !acc[eventKey]) {
      acc[eventKey] = {
        read: !!row.read_at,
        opened: !!row.opened_at,
      };
    }
    return acc;
  }, {});
}

export async function saveTeacherNotificationState(input: TeacherNotificationPersistInput) {
  const now = new Date().toISOString();
  const existing = await (supabase as any)
    .from('teacher_notifications')
    .select('id,payload')
    .eq('teacher_id', input.teacherId)
    .order('created_at', { ascending: false })
    .limit(300);

  if (existing.error) {
    if (isSchemaNotReadyError(existing.error)) return;
    throw existing.error;
  }

  const existingRow = (((existing.data as any[]) || [])).find(row => row.payload?.event_key === input.eventKey);
  const patch = {
    read_at: now,
    opened_at: input.opened ? now : null,
  };

  if (existingRow?.id) {
    const { error } = await (supabase as any)
      .from('teacher_notifications')
      .update(input.opened ? patch : { read_at: now })
      .eq('id', existingRow.id);
    if (error && !isSchemaNotReadyError(error)) throw error;
    return;
  }

  const { error } = await (supabase as any)
    .from('teacher_notifications')
    .insert({
      teacher_id: input.teacherId,
      type: toTeacherNotificationDbType(input.type),
      title: input.title,
      body: input.body || null,
      student_id: input.studentId || null,
      group_id: input.groupId || null,
      lesson_id: input.lessonId || null,
      homework_id: input.homeworkId || null,
      payload: {
        event_key: input.eventKey,
        source_type: input.type,
        related_section: input.relatedSection || null,
        event_date: input.date || null,
      },
      read_at: now,
      opened_at: input.opened ? now : null,
      created_at: input.date || now,
    });

  if (error && !isSchemaNotReadyError(error)) throw error;
}

export async function updateTeacherPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
