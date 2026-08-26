import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { sanitizeWorkbookAssetUrl, signedUrlFor, workbookAssetDebugLog } from '../lib/workbooks';

type WorkbookAssetDebugOptions = {
  surface?: string;
};

type WorkbookAssetImageSource = {
  src: string;
  kind: 'direct' | 'proxy-blob';
  revoke?: () => void;
};

function shouldProxyWorkbookAssetUrl(value: string) {
  if (typeof window === 'undefined' || typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.supabase.co') &&
      url.pathname.includes('/storage/v1/object/sign/workbook-assets/') &&
      url.searchParams.has('token')
    );
  } catch {
    return false;
  }
}

async function proxiedWorkbookAssetImageSource(signedUrl: string, relativePath: string, surface?: string): Promise<WorkbookAssetImageSource> {
  if (!shouldProxyWorkbookAssetUrl(signedUrl)) return { src: signedUrl, kind: 'direct' };

  workbookAssetDebugLog('proxy:start', {
    surface: surface || null,
    relativePath,
    signedUrl: sanitizeWorkbookAssetUrl(signedUrl),
  }, signedUrl);

  try {
    const response = await fetch('/api/workbook-asset-proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: signedUrl }),
    });
    const contentType = response.headers.get('content-type');
    workbookAssetDebugLog('proxy:response', {
      surface: surface || null,
      relativePath,
      status: response.status,
      ok: response.ok,
      contentType,
    }, signedUrl);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      workbookAssetDebugLog('proxy:error-body', {
        surface: surface || null,
        relativePath,
        status: response.status,
        body: body.slice(0, 500),
      }, signedUrl);
      return { src: signedUrl, kind: 'direct' };
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    workbookAssetDebugLog('proxy:blob', {
      surface: surface || null,
      relativePath,
      contentType: blob.type || contentType,
      size: blob.size,
      renderedUrl: sanitizeWorkbookAssetUrl(objectUrl),
    }, signedUrl);

    return { src: objectUrl, kind: 'proxy-blob', revoke: () => URL.revokeObjectURL(objectUrl) };
  } catch (error) {
    workbookAssetDebugLog('proxy:error', {
      surface: surface || null,
      relativePath,
      message: error instanceof Error ? error.message : 'Proxy fetch failed',
    }, signedUrl);
    return { src: signedUrl, kind: 'direct' };
  }
}

function useWorkbookAssetUrl(assetPath: string | null | undefined, options: WorkbookAssetDebugOptions = {}) {
  const [source, setSource] = useState<WorkbookAssetImageSource | null>(null);

  useEffect(() => {
    let alive = true;
    let revokePrevious: (() => void) | undefined;
    const relativePath = String(assetPath || '').trim();
    if (!relativePath) {
      setSource(null);
      return;
    }

    setSource(null);
    workbookAssetDebugLog('consumer:resolve-start', {
      surface: options.surface || null,
      relativePath,
    }, relativePath);

    signedUrlFor(relativePath).then(value => {
      if (!value) return null;
      return proxiedWorkbookAssetImageSource(value, relativePath, options.surface);
    }).then(value => {
      if (!alive) {
        value?.revoke?.();
        return;
      }
      revokePrevious = value?.revoke;
      setSource(value || null);
      workbookAssetDebugLog('consumer:resolve-result', {
        surface: options.surface || null,
        relativePath,
        success: Boolean(value?.src),
        sourceKind: value?.kind || null,
        renderedUrl: sanitizeWorkbookAssetUrl(value?.src),
      }, relativePath);
    });

    return () => {
      alive = false;
      revokePrevious?.();
    };
  }, [assetPath, options.surface]);

  return source;
}

export function WorkbookAssetImage({
  path,
  alt = '',
  className,
  placeholderClassName,
  draggable,
  surface,
  fallback,
}: {
  path: string;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
  draggable?: boolean;
  surface?: string;
  fallback?: ReactNode;
}) {
  const source = useWorkbookAssetUrl(path, { surface });

  if (!source?.src) return fallback ? <>{fallback}</> : <div className={placeholderClassName || `bg-purple-100 animate-pulse ${className}`} />;

  return (
    <img
      src={source.src}
      alt={alt}
      className={className}
      draggable={draggable}
      onLoad={event => workbookAssetDebugLog('image:load', {
        surface: surface || null,
        relativePath: path,
        sourceKind: source.kind,
        renderedUrl: sanitizeWorkbookAssetUrl(event.currentTarget.currentSrc || event.currentTarget.src),
        naturalWidth: event.currentTarget.naturalWidth,
        naturalHeight: event.currentTarget.naturalHeight,
      }, path)}
      onError={event => workbookAssetDebugLog('image:error', {
        surface: surface || null,
        relativePath: path,
        sourceKind: source.kind,
        renderedUrl: sanitizeWorkbookAssetUrl(event.currentTarget.currentSrc || event.currentTarget.src),
        complete: event.currentTarget.complete,
        naturalWidth: event.currentTarget.naturalWidth,
        naturalHeight: event.currentTarget.naturalHeight,
      }, path)}
    />
  );
}
