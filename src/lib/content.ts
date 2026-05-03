import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet, fileToDataUrl as _fileToDataUrl } from './storage';

export type ContentType = 'lesson' | 'homework' | 'practice' | 'grammar' | 'listening';

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
  await loadStudentContent(userId);
}

export async function deleteContentItem(userId: string, id: string): Promise<void> {
  await supabase.from('content_items').delete().eq('id', id);
  await loadStudentContent(userId);
}

export function getStudentRating(userId: string): { avg: number; count: number } {
  const items = ensureStudentContent(userId);
  const graded = items.filter(i => i.type === 'homework' && i.starRating && i.starRating > 0);
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
  if (/^https?:\/\//i.test(stored)) return stored; // legacy public URL
  const { data, error } = await supabase.storage.from('content').createSignedUrl(stored, 60 * 60);
  if (error || !data) throw error || new Error('Could not sign URL');
  return data.signedUrl;
}

// ---- Smart download/open ----
export async function openOrDownload(item: ContentItem) {
  if (item.externalLink) {
    window.open(item.externalLink, '_blank', 'noopener,noreferrer');
    return;
  }
  if (item.fileUrl) {
    const url = await resolveFileUrl(item.fileUrl);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.fileName || item.title || 'file';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  }
}

/** Legacy helper kept so existing modal code compiles */
export function downloadDataUrl(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); a.remove();
}
