import { useAvatarUrl } from '@/lib/avatarUrl';

/** Renders a stored avatar path/URL through a short-lived signed URL. */
export function AvatarImage({
  src,
  alt = '',
  className,
  fallback,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const resolved = useAvatarUrl(src);
  if (!resolved) return <>{fallback}</>;
  return <img src={resolved} alt={alt} className={className} />;
}
