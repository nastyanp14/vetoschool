import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { completeAuthCallback } from '../lib/auth';
import { Lang } from '../lib/i18n';
import { AuthAlert, AuthHeader, AuthPageShell } from '../components/AuthCard';

const text = {
  ru: { title: 'Завершаем вход', sub: 'Проверяем безопасную ссылку Vetoschool.' },
  ua: { title: 'Завершуємо вхід', sub: 'Перевіряємо безпечне посилання Vetoschool.' },
  en: { title: 'Finishing sign-in', sub: 'Checking your secure Vetoschool link.' },
};

export default function AuthCallback({ lang }: { lang: Lang }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const copy = text[lang] || text.ru;

  useEffect(() => {
    let cancelled = false;

    completeAuthCallback(params.get('next')).then(result => {
      if (cancelled) return;
      if (result.success && result.data) {
        navigate(result.data.redirectTo, { replace: true });
      } else {
        setError(result.error || 'Invalid or expired link');
        window.setTimeout(() => navigate('/auth/link-expired?type=confirmation', { replace: true }), 1400);
      }
    });

    return () => { cancelled = true; };
  }, [navigate, params]);

  return (
    <AuthPageShell tone="blue">
      <AuthHeader icon="🔐" title={copy.title} subtitle={copy.sub} />
      {error ? <AuthAlert>{error}</AuthAlert> : <div className="text-center font-body text-purple-400">...</div>}
    </AuthPageShell>
  );
}
