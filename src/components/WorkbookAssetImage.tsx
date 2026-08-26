import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { sanitizeWorkbookAssetUrl, signedUrlFor, workbookAssetDebugLog } from '../lib/workbooks';

type WorkbookAssetDebugOptions = {
  surface?: string;
};

function useWorkbookAssetUrl(assetPath: string | null | undefined, options: WorkbookAssetDebugOptions = {}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const relativePath = String(assetPath || '').trim();
    if (!relativePath) {
      setUrl(null);
      return;
    }

    setUrl(null);
    workbookAssetDebugLog('consumer:resolve-start', {
      surface: options.surface || null,
      relativePath,
    }, relativePath);

    signedUrlFor(relativePath).then(value => {
      if (!alive) return;
      setUrl(value);
      workbookAssetDebugLog('consumer:resolve-result', {
        surface: options.surface || null,
        relativePath,
        success: Boolean(value),
        renderedUrl: sanitizeWorkbookAssetUrl(value),
      }, relativePath);
    });

    return () => {
      alive = false;
    };
  }, [assetPath, options.surface]);

  return url;
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
  const url = useWorkbookAssetUrl(path, { surface });

  if (!url) return fallback ? <>{fallback}</> : <div className={placeholderClassName || `bg-purple-100 animate-pulse ${className}`} />;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      draggable={draggable}
      onLoad={event => workbookAssetDebugLog('image:load', {
        surface: surface || null,
        relativePath: path,
        renderedUrl: sanitizeWorkbookAssetUrl(event.currentTarget.currentSrc || event.currentTarget.src),
        naturalWidth: event.currentTarget.naturalWidth,
        naturalHeight: event.currentTarget.naturalHeight,
      }, path)}
      onError={event => workbookAssetDebugLog('image:error', {
        surface: surface || null,
        relativePath: path,
        renderedUrl: sanitizeWorkbookAssetUrl(event.currentTarget.currentSrc || event.currentTarget.src),
        complete: event.currentTarget.complete,
        naturalWidth: event.currentTarget.naturalWidth,
        naturalHeight: event.currentTarget.naturalHeight,
      }, path)}
    />
  );
}
