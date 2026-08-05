import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const AVATAR_BUCKET = 'avatars';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const cache = new Map<string, { url: string; expiresAt: number }>();

function storagePathFromUrl(value?: string | null) {
  if (!value) return null;
  if (/^(data:|blob:)/.test(value)) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const index = value.indexOf(marker);
  if (index === -1) return value.startsWith('http') ? null : value;
  return decodeURIComponent(value.slice(index + marker.length).split('?')[0]);
}

/**
 * The avatars bucket is private, so stored public URLs must be exchanged for
 * short-lived signed URLs before they can be rendered.
 */
export async function resolveAvatarUrl(value?: string | null): Promise<string | null> {
  if (!value) return null;
  if (/^(data:|blob:)/.test(value)) return value;

  const path = storagePathFromUrl(value);
  if (!path) return value;

  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000 });
  return data.signedUrl;
}

export function useAvatarUrl(value?: string | null) {
  const [url, setUrl] = useState<string | null>(
    value && /^(data:|blob:)/.test(value) ? value : null,
  );

  useEffect(() => {
    let active = true;
    if (!value) {
      setUrl(null);
      return () => {
        active = false;
      };
    }
    resolveAvatarUrl(value)
      .then(resolved => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  return url;
}
