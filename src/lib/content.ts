import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet, fileToDataUrl as _fileToDataUrl } from './storage';
import { notifyContentChanges, notifyContentDeleted } from './telegram';

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
}

export const fileToDataUrl = _fileToDataUrl;

const key = (uid: string) => `content:${uid}`;
export const GRADED_CONTENT_TYPES: ContentType[] = ['homework', 'practice', 'grammar', 'listening', 'checkpoint'];

export function isGradedContentType(type?: ContentType | null) {
  return !!type && GRADED_CONTENT_TYPES.includes(type);
}

function rowToItem(r: any): ContentItem {
  return {
    id: r.id, userId: r.user_id, moduleId: r.module_id, type: r.type,
    title: r.title, emoji: r.emoji,
    fileUrl: r.file_url, fileName: r.file_name, externalLink: r.external_link,
    fileDataUrl: r.file_url, // alias for legacy UI
    dueDate: r.due_date, scheduledDate: r.scheduled_date, scheduledTime: r.scheduled_time,
    unlocked: r.unlocked, starRating: r.star_rating,
  };
}

export async function loadStudentContent(userId: string): Promise<ContentItem[]> {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  const items = (data || []).map(rowToItem);
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
    due_date: i.dueDate || null,
    scheduled_date: i.scheduledDate || null,
    scheduled_time: i.scheduledTime || null,
    unlocked: !!i.unlocked,
    star_rating: i.starRating ?? null,
  }));
  if (rows.length) {
    const { error } = await supabase.from('content_items').upsert(rows);
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
}

export async function deleteModule(userId: string, moduleId: string): Promise<void> {
  const { error } = await supabase
    .from('content_items')
    .delete()
    .eq('user_id', userId)
    .eq('module_id', moduleId);
  if (error) { console.error('deleteModule error', error); throw error; }
  await loadStudentContent(userId);
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

async function resolveFileUrl(stored: string): Promise<string> {
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
