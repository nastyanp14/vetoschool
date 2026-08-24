#!/usr/bin/env node
/**
 * Copies Storage objects from the OLD Supabase project (Lovable Cloud) to the NEW one.
 *
 * SOURCE AUTH (Lovable Cloud): the old service_role key is NOT accessible, so the source is
 * read with an ADMIN USER SESSION instead. All three buckets grant SELECT to that session:
 *   content         -> content_read_own_or_admin (admin sees every folder)
 *   workbook-assets -> wba_read_* (authenticated read)
 *   lesson-audio    -> lesson_audio_authenticated_read (authenticated read)
 *
 * Safety guarantees:
 *  - read-only on the source (never deletes or modifies anything there)
 *  - keeps bucket names, full object paths (including UUID folders), file names and MIME types
 *  - skips objects that already exist in the target with the same size (idempotent, resumable)
 *  - prints a per-object log plus a final summary of successes / skips / failures
 *
 * Run locally:
 *
 *   OLD_SUPABASE_URL=https://<old-ref>.supabase.co \
 *   OLD_ANON_KEY=<old publishable/anon key from .env> \
 *   OLD_ADMIN_EMAIL=<admin login> OLD_ADMIN_PASSWORD=<admin password> \
 *   NEW_SUPABASE_URL=https://ggflcriakiudnejmiuwh.supabase.co \
 *   NEW_SERVICE_ROLE_KEY=<new project service role key> \
 *   node scripts/migrate-storage.mjs
 *
 * OLD_SERVICE_ROLE_KEY still works instead of the admin login if you ever have one.
 *
 * Optional:
 *   BUCKETS=content,workbook-assets,lesson-audio   # default, comma separated
 *   DRY_RUN=1                                      # list what would be copied, upload nothing
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SERVICE_ROLE_KEY;
const OLD_ANON_KEY = process.env.OLD_ANON_KEY;
const OLD_ADMIN_EMAIL = process.env.OLD_ADMIN_EMAIL;
const OLD_ADMIN_PASSWORD = process.env.OLD_ADMIN_PASSWORD;
const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';
const BUCKETS = (process.env.BUCKETS || 'content,workbook-assets,lesson-audio')
  .split(',')
  .map(b => b.trim())
  .filter(Boolean);

const usingAdminSession = !OLD_KEY;

if (!OLD_URL || !NEW_URL || !NEW_KEY) {
  console.error('Missing env: OLD_SUPABASE_URL, NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (usingAdminSession && !(OLD_ANON_KEY && OLD_ADMIN_EMAIL && OLD_ADMIN_PASSWORD)) {
  console.error('Source auth: provide OLD_SERVICE_ROLE_KEY, or OLD_ANON_KEY + OLD_ADMIN_EMAIL + OLD_ADMIN_PASSWORD');
  process.exit(1);
}

const source = createClient(OLD_URL, OLD_KEY || OLD_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});
const target = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } });

if (usingAdminSession) {
  const { data, error } = await source.auth.signInWithPassword({
    email: OLD_ADMIN_EMAIL,
    password: OLD_ADMIN_PASSWORD,
  });
  if (error || !data?.session) {
    console.error(`Source sign-in failed: ${error?.message || 'no session'}`);
    process.exit(1);
  }
  console.log(`[auth] signed in to source as ${data.user?.email} (admin session, read-only)`);
}

// Bucket settings are known from the migrations, so the target bucket can be created
// without reading storage.buckets on the source (not possible with an admin session).
const BUCKET_CONFIG = {
  content: { public: false },
  'workbook-assets': { public: false },
  'lesson-audio': { public: false, fileSizeLimit: 10485760, allowedMimeTypes: ['audio/mpeg'] },
};

const PAGE = 100;
const stats = { copied: 0, skipped: 0, failed: 0 };
const failures = [];

/** Recursively lists every object path inside a bucket prefix. */
async function listAll(client, bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders come back without metadata/id.
      if (entry.id === null || !entry.metadata) {
        files.push(...(await listAll(client, bucket, path)));
      } else {
        files.push({ path, size: entry.metadata?.size ?? null, mime: entry.metadata?.mimetype ?? null });
      }
    }
    if (data.length < PAGE) break;
  }
  return files;
}

async function ensureBucket(bucket) {
  const { data } = await target.storage.getBucket(bucket);
  if (data) return;
  // With an admin session getBucket() on the source is not permitted; fall back to known config.
  const { data: srcBucket } = usingAdminSession
    ? { data: null }
    : await source.storage.getBucket(bucket);
  const known = BUCKET_CONFIG[bucket] || { public: false };
  const isPublic = srcBucket?.public ?? known.public ?? false;
  const { error } = await target.storage.createBucket(bucket, {
    public: isPublic,
    fileSizeLimit: srcBucket?.file_size_limit ?? known.fileSizeLimit ?? undefined,
    allowedMimeTypes: srcBucket?.allowed_mime_types ?? known.allowedMimeTypes ?? undefined,
  });
  if (error && !/already exists/i.test(error.message)) throw new Error(`createBucket ${bucket}: ${error.message}`);
  console.log(`[bucket] created ${bucket} (public=${isPublic})`);
}

async function existsIdentical(bucket, file) {
  const slash = file.path.lastIndexOf('/');
  const dir = slash === -1 ? '' : file.path.slice(0, slash);
  const name = slash === -1 ? file.path : file.path.slice(slash + 1);
  const { data, error } = await target.storage.from(bucket).list(dir, { limit: PAGE, search: name });
  if (error) return false;
  const match = data?.find(entry => entry.name === name);
  if (!match) return false;
  if (file.size == null || match.metadata?.size == null) return true;
  return Number(match.metadata.size) === Number(file.size);
}

async function copyOne(bucket, file) {
  if (await existsIdentical(bucket, file)) {
    stats.skipped++;
    console.log(`[skip] ${bucket}/${file.path}`);
    return;
  }
  if (DRY_RUN) {
    stats.copied++;
    console.log(`[dry-run] would copy ${bucket}/${file.path}`);
    return;
  }
  const { data: blob, error: dlError } = await source.storage.from(bucket).download(file.path);
  if (dlError || !blob) {
    stats.failed++;
    failures.push({ bucket, path: file.path, reason: `download: ${dlError?.message || 'empty body'}` });
    console.error(`[fail] ${bucket}/${file.path} — download`);
    return;
  }
  const contentType = file.mime || blob.type || 'application/octet-stream';
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { error: upError } = await target.storage.from(bucket).upload(file.path, bytes, {
    contentType,
    upsert: true,
  });
  if (upError) {
    stats.failed++;
    failures.push({ bucket, path: file.path, reason: `upload: ${upError.message}` });
    console.error(`[fail] ${bucket}/${file.path} — upload: ${upError.message}`);
    return;
  }
  stats.copied++;
  console.log(`[ok] ${bucket}/${file.path} (${contentType}, ${bytes.length} bytes)`);
}

for (const bucket of BUCKETS) {
  console.log(`\n=== ${bucket} ===`);
  try {
    await ensureBucket(bucket);
    const files = await listAll(source, bucket);
    console.log(`[list] ${files.length} objects in ${bucket}`);
    for (const file of files) await copyOne(bucket, file);
  } catch (error) {
    stats.failed++;
    failures.push({ bucket, path: '(bucket)', reason: error.message });
    console.error(`[fail] bucket ${bucket}: ${error.message}`);
  }
}

console.log('\n=== summary ===');
console.log(`copied: ${stats.copied}  skipped: ${stats.skipped}  failed: ${stats.failed}`);
if (failures.length) {
  console.log('failures:');
  for (const f of failures) console.log(`  ${f.bucket}/${f.path} — ${f.reason}`);
  process.exit(2);
}
