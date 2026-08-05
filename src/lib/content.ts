import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet, fileToDataUrl as _fileToDataUrl } from './storage';
import { notifyContentChanges, notifyContentDeleted, notifyHomeworkChanged } from './telegram';

export type ContentType = 'lesson' | 'homework' | 'practice' | 'grammar' | 'listening' | 'checkpoint';

export interface ContentItem {
  id: string;
  userId?: string;
  moduleId: string;
  type: ContentType;
  title: string;
  emoji: string;
  fileUrl?: string | null;
  fileName?: string | null;
  externalLink?: string | null;
  /** Convenience: same as fileUrl, kept for legacy UI */
  fileDataUrl?: string | null;
  dueDate?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  unlocked: boolean;
  starRating?: number | null;
  submittedAt?: string | null;
  checkedAt?: string | null;
  homeworkStatus?: string | null;
  teacherComment?: string | null;
  reviewComment?: string | null;
  studentResult?: string | null;
  resultPercent?: number | null;
  submittedAttachmentUrl?: string | null;
  submittedAttachmentName?: string | null;
  interactiveLessonId?: string | null;
  interactiveCompletedAt?: string | null;
  interactiveScorePercent?: number | null;
  materialMode?: 'file_link' | 'interactive' | null;
  updatedAt?: string | null;
}

export const fileToDataUrl = _fileToDataUrl;

const key = (uid: string) => `content:${uid}`;
export const GRADED_CONTENT_TYPES: ContentType[] = ['homework', 'practice', 'grammar', 'listening', 'checkpoint'];

export function isGradedContentType(type?: ContentType | null) {
  return !!type && GRADED_CONTENT_TYPES.includes(type);
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

function ratingFromScore(scorePercent: number) {
  return Math.max(1, Math.min(5, Math.ceil(Math.max(0, Math.min(100, Math.round(scorePercent))) / 20)));
}

function scoreFromRating(stars: number) {
  return Math.max(0, Math.min(100, Math.round(Math.max(0, Math.min(5, stars)) * 20)));
}

function rowToItem(r: any): ContentItem {
  return {
    id: r.id, userId: r.user_id, moduleId: r.module_id, type: r.type,
    title: r.title, emoji: r.emoji,
    fileUrl: r.file_url, fileName: r.file_name, externalLink: r.external_link,
    fileDataUrl: r.file_url, // alias for legacy UI
    dueDate: r.due_date, scheduledDate: r.scheduled_date, scheduledTime: r.scheduled_time,
    unlocked: r.unlocked, starRating: r.star_rating,
    submittedAt: r.submitted_at ?? null,
    checkedAt: r.checked_at ?? null,
    homeworkStatus: r.homework_status ?? null,
    teacherComment: r.teacher_comment ?? null,
    reviewComment: r.review_comment ?? null,
    studentResult: r.student_result ?? null,
    resultPercent: r.result_percent ?? null,
    submittedAttachmentUrl: r.submitted_attachment_url ?? null,
    submittedAttachmentName: r.submitted_attachment_name ?? null,
    interactiveLessonId: r.interactive_lesson_id ?? null,
    interactiveCompletedAt: r.interactive_completed_at ?? null,
    interactiveScorePercent: r.interactive_score_percent ?? null,
    materialMode: r.material_mode ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

export async function repairStudentInteractiveCompletion(userId: string): Promise<void> {
  if (!userId) return;
  const { error } = await (supabase as any).rpc('repair_student_interactive_completion', {
    _user_id: userId,
  });
  if (error && !isSchemaNotReadyError(error)) {
    console.warn('repair_student_interactive_completion RPC failed', error.message || error);
  }
}

function parseLessonBlockModuleId(moduleId?: string | null): { scheduleId: string; blockKind: string } | null {
  const match = String(moduleId || '').match(/^lesson-block:([^:]+):([^:]+)$/);
  return match ? { scheduleId: match[1], blockKind: match[2] } : null;
}

async function hydrateScheduledInteractiveContent(rows: any[]): Promise<any[]> {
  const repairCandidates = rows
    .map(row => ({ row, parsed: parseLessonBlockModuleId(row.module_id) }))
    .filter(({ row, parsed }) => parsed && !row.interactive_lesson_id);
  if (!repairCandidates.length) return rows;

  const scheduleIds = Array.from(new Set(repairCandidates.map(item => item.parsed!.scheduleId)));
  const [{ data: blockRows, error: blockError }, { data: scheduleRows, error: scheduleError }] = await Promise.all([
    (supabase as any)
      .from('lesson_plan_blocks')
      .select('schedule_id,block_kind,source_lesson_id,material_mode,material_url,material_title')
      .in('schedule_id', scheduleIds),
    (supabase as any)
      .from('schedules')
      .select('id,source_lesson_id')
      .in('id', scheduleIds),
  ]);

  if (blockError || scheduleError) {
    console.warn('Could not hydrate scheduled interactive content', blockError || scheduleError);
    return rows;
  }

  const schedulesById = new Map(((scheduleRows as any[]) || []).map(row => [row.id, row]));
  const blocksByKey = new Map(((blockRows as any[]) || []).map(row => [`${row.schedule_id}:${row.block_kind}`, row]));
  const patchedRows = rows.map(row => {
    const parsed = parseLessonBlockModuleId(row.module_id);
    if (!parsed || row.interactive_lesson_id) return row;
    const block = blocksByKey.get(`${parsed.scheduleId}:${parsed.blockKind}`);
    const fallbackLessonId = schedulesById.get(parsed.scheduleId)?.source_lesson_id || null;
    const sourceLessonId = block?.source_lesson_id || (block?.material_mode === 'interactive' ? fallbackLessonId : null);
    if (block?.material_mode !== 'interactive' || !sourceLessonId) return row;
    return {
      ...row,
      interactive_lesson_id: sourceLessonId,
      material_mode: 'interactive',
      external_link: null,
      title: row.title || block.material_title || row.title,
    };
  });

  const updates = patchedRows
    .filter((row, index) => row !== rows[index])
    .map(row => (supabase as any)
      .from('content_items')
      .update({
        interactive_lesson_id: row.interactive_lesson_id,
        material_mode: 'interactive',
        external_link: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id));
  if (updates.length) {
    await Promise.all(updates.map(async update => {
      const { error } = await update;
      if (error) console.warn('Could not persist hydrated interactive content', error);
    }));
  }

  return patchedRows;
}

async function reconcileInteractiveCompletionRows(userId: string, rows: any[]): Promise<any[]> {
  const lessonIds = Array.from(new Set(rows
    .filter(row => row.interactive_lesson_id && isGradedContentType(row.type))
    .map(row => row.interactive_lesson_id)));
  if (!lessonIds.length) return rows;

  const { data, error } = await (supabase as any)
    .from('lesson_progress')
    .select('lesson_id,completed_at,stars_awarded')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds);
  if (error) {
    if (!isSchemaNotReadyError(error)) console.warn('Could not read lesson progress for content repair', error.message || error);
    return rows;
  }

  const progressByLesson = new Map(((data as any[]) || []).map(row => [row.lesson_id, row]));
  const changedRows: any[] = [];
  const reconciled = rows.map(row => {
    const progress = progressByLesson.get(row.interactive_lesson_id);
    if (!progress) return row;
    const progressRating = Math.max(0, Math.min(5, Number(progress.stars_awarded || 0)));
    const shouldTrustProgressRating = progressRating > 0 && Number(row.star_rating || 0) > progressRating;
    const hasStoredScore = row.interactive_score_percent != null || row.result_percent != null;
    const score = shouldTrustProgressRating
      ? scoreFromRating(progressRating)
      : hasStoredScore
      ? Number(row.interactive_score_percent ?? row.result_percent)
      : progressRating > 0
        ? scoreFromRating(progressRating)
        : 100;
    const rating = shouldTrustProgressRating ? progressRating : Number(row.star_rating || progressRating || ratingFromScore(score));
    const completedAt = progress.completed_at || row.interactive_completed_at || new Date().toISOString();
    const next = {
      ...row,
      material_mode: 'interactive',
      submitted_at: row.submitted_at || completedAt,
      checked_at: row.checked_at || completedAt,
      homework_status: 'reviewed',
      result_percent: shouldTrustProgressRating ? score : row.result_percent ?? score,
      star_rating: shouldTrustProgressRating ? rating : row.star_rating ?? rating,
      student_result: row.student_result || 'Interactive completed',
      review_comment: row.review_comment || 'Интерактивное задание выполнено автоматически.',
      interactive_completed_at: row.interactive_completed_at || completedAt,
      interactive_score_percent: shouldTrustProgressRating ? score : row.interactive_score_percent ?? score,
      rewarded_stars: Number(row.rewarded_stars || 0) > 0
        ? row.rewarded_stars
        : Math.max(rating, Number(progress.stars_awarded || 0)),
      updated_at: row.updated_at,
    };
    if (
      row.homework_status !== next.homework_status ||
      !row.checked_at ||
      !row.submitted_at ||
      !row.interactive_completed_at ||
      row.star_rating == null ||
      row.interactive_score_percent == null ||
      shouldTrustProgressRating
    ) {
      changedRows.push(next);
    }
    return next;
  });

  await Promise.all(changedRows.map(async row => {
    const { error: updateError } = await (supabase as any)
      .from('content_items')
      .update({
        material_mode: 'interactive',
        submitted_at: row.submitted_at,
        checked_at: row.checked_at,
        homework_status: row.homework_status,
        result_percent: row.result_percent,
        star_rating: row.star_rating,
        student_result: row.student_result,
        review_comment: row.review_comment,
        interactive_completed_at: row.interactive_completed_at,
        interactive_score_percent: row.interactive_score_percent,
        rewarded_stars: row.rewarded_stars,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('user_id', userId);
    if (updateError && !isSchemaNotReadyError(updateError)) {
      console.warn('Could not persist interactive content repair', updateError.message || updateError);
    }
  }));

  return reconciled;
}

export async function loadStudentContent(userId: string): Promise<ContentItem[]> {
  await repairStudentInteractiveCompletion(userId);
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  let rows = (data || []) as any[];

  if (error || rows.length === 0) {
    const fallback = await (supabase as any).rpc('get_student_content_items', {
      _user_id: userId,
    });
    if (!fallback.error) rows = (fallback.data || []) as any[];
    else if (error) {
      console.error(error);
      console.warn('get_student_content_items RPC failed', fallback.error.message);
      return [];
    }
  }

  const hydratedRows = await hydrateScheduledInteractiveContent(rows);
  const reconciledRows = await reconcileInteractiveCompletionRows(userId, hydratedRows);
  const items = reconciledRows.map(rowToItem);
  cacheSet(key(userId), items);
  return items;
}

/** Sync getter for components — reads cache populated by loadStudentContent */
export function ensureStudentContent(userId: string): ContentItem[] {
  return cacheGet<ContentItem[]>(key(userId)) ?? [];
}

export async function saveStudentContent(userId: string, items: ContentItem[]): Promise<void> {
  const cachedBefore = ensureStudentContent(userId);
  const before = cachedBefore.length ? cachedBefore : await loadStudentContent(userId);
  const isUuid = (s?: string) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const savedAt = new Date().toISOString();
  const rows = items.map(i => ({
    id: isUuid(i.id) ? i.id : crypto.randomUUID(),
    user_id: userId,
    module_id: i.moduleId,
    type: i.type,
    title: i.title,
    emoji: i.emoji || '✨',
    file_url: i.fileUrl ?? i.fileDataUrl ?? null,
    file_name: i.fileName ?? null,
    external_link: i.externalLink || null,
    interactive_lesson_id: i.interactiveLessonId || null,
    material_mode: i.materialMode || (i.interactiveLessonId ? 'interactive' : 'file_link'),
    due_date: i.dueDate || null,
    scheduled_date: i.scheduledDate || null,
    scheduled_time: i.scheduledTime || null,
    unlocked: !!i.unlocked,
    star_rating: i.starRating ?? null,
    updated_at: savedAt,
  }));
  if (rows.length) {
    const { error } = await (supabase as any).from('content_items').upsert(rows);
    if (error) { console.error('saveStudentContent error', error); throw error; }
  }
  const fresh = await loadStudentContent(userId);
  await notifyContentChanges(userId, before, fresh);
}

export async function deleteContentItem(userId: string, id: string): Promise<void> {
  const deletedItem = ensureStudentContent(userId).find(item => item.id === id);
  const { error } = await supabase.from('content_items').delete().eq('id', id);
  if (error) { console.error('deleteContentItem error', error); throw error; }
  await loadStudentContent(userId);
  await notifyContentDeleted(userId, deletedItem);
  if (deletedItem?.type === 'homework') {
    await notifyHomeworkChanged(userId, { id: deletedItem.id, title: deletedItem.title, eventId: new Date().toISOString(), canceled: true });
  }
}

export async function deleteModule(userId: string, moduleId: string): Promise<void> {
  const deletedHomework = ensureStudentContent(userId).filter(item => item.moduleId === moduleId && item.type === 'homework');
  const { error } = await supabase
    .from('content_items')
    .delete()
    .eq('user_id', userId)
    .eq('module_id', moduleId);
  if (error) { console.error('deleteModule error', error); throw error; }
  await loadStudentContent(userId);
  await Promise.all(deletedHomework.map(item => notifyHomeworkChanged(userId, { id: item.id, title: item.title, eventId: new Date().toISOString(), canceled: true })));
}

export function getStudentRating(userId: string): { avg: number; count: number } {
  const items = ensureStudentContent(userId);
  const graded = items.filter(i => isGradedContentType(i.type) && i.starRating && i.starRating > 0);
  if (!graded.length) return { avg: 0, count: 0 };
  const sum = graded.reduce((s, i) => s + (i.starRating || 0), 0);
  return { avg: Math.round((sum / graded.length) * 10) / 10, count: graded.length };
}

// ---- Storage upload ----
export async function uploadContentFile(userId: string, file: File): Promise<{ url: string; name: string }> {
  const safe = file.name.replace(/[^\w.\-]/g, '_');
  const path = `${userId}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage.from('content').upload(path, file, { upsert: true });
  if (error) throw error;
  // Bucket is private; persist the storage path and resolve to a signed URL on demand.
  return { url: path, name: file.name };
}

export async function submitStudentContentWork(userId: string, itemId: string, file: File): Promise<void> {
  const uploaded = await uploadContentFile(userId, file);
  const { error: rpcError } = await (supabase as any).rpc('submit_student_homework', {
    _content_item_id: itemId,
    _attachment_url: uploaded.url,
    _attachment_name: uploaded.name,
  });
  if (!rpcError) {
    await loadStudentContent(userId);
    return;
  }
  if (!/submit_student_homework|pgrst202|42883|schema cache/i.test(rpcError.message || '')) {
    throw rpcError;
  }
  const { error } = await (supabase as any)
    .from('content_items')
    .update({
      submitted_attachment_url: uploaded.url,
      submitted_attachment_name: uploaded.name,
      submitted_at: new Date().toISOString(),
      homework_status: 'submitted',
      checked_at: null,
      reviewed_by_teacher_id: null,
      review_comment: null,
      result_percent: null,
      errors_count: null,
      student_result: null,
      star_rating: null,
    })
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) throw error;
  await loadStudentContent(userId);
}

export async function resolveFileUrl(stored: string): Promise<string> {
  if (/^data:/i.test(stored)) return stored;
  if (/^https?:\/\//i.test(stored)) return stored; // legacy public URL
  const { data, error } = await supabase.storage.from('content').createSignedUrl(stored, 60 * 60);
  if (error || !data) throw error || new Error('Could not sign URL');
  return data.signedUrl;
}

function extensionFromMime(mime?: string | null) {
  if (!mime) return '';
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('pdf')) return '.pdf';
  if (mime.includes('mpeg')) return '.mp3';
  if (mime.includes('wav')) return '.wav';
  return '';
}

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim();
}

function fileNameFor(item: ContentItem, blob?: Blob) {
  const raw = item.fileName || item.title || '';
  const safe = sanitizeFileName(raw);
  if (safe && /\.[a-z0-9]{2,8}$/i.test(safe)) return safe;
  const ext = extensionFromMime(blob?.type) || '.png';
  return `${safe || 'vetoschool-file'}${ext}`;
}

function saveBlob(blob: Blob, name: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = name;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function downloadResolvedUrl(url: string, name: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Файл недоступен для скачивания');
    const blob = await response.blob();
    if (!blob.size) throw new Error('Файл недоступен для скачивания');
    saveBlob(blob, fileNameFor({ id: '', moduleId: '', type: 'lesson', title: name, emoji: '📎', unlocked: true }, blob));
  } catch (error) {
    console.error('download failed', error);
    throw new Error('Файл недоступен для скачивания');
  }
}

// ---- Smart download/open ----
export async function openOrDownload(item: ContentItem) {
  if (item.externalLink) {
    window.open(item.externalLink, '_blank', 'noopener,noreferrer');
    return;
  }
  const stored = item.fileUrl || item.fileDataUrl;
  if (!stored) throw new Error('Файл недоступен для скачивания');
  const url = await resolveFileUrl(stored);
  await downloadResolvedUrl(url, fileNameFor(item));
}

/** Legacy helper kept so existing modal code compiles */
export function downloadDataUrl(url: string, name: string) {
  fetch(url)
    .then(res => res.blob())
    .then(blob => saveBlob(blob, sanitizeFileName(name) || fileNameFor({ id: '', moduleId: '', type: 'lesson', title: 'vetoschool-file', emoji: '📎', unlocked: true }, blob)))
    .catch(() => {
      const a = document.createElement('a');
      a.href = url; a.download = sanitizeFileName(name) || 'vetoschool-file';
      document.body.appendChild(a); a.click(); a.remove();
    });
}
