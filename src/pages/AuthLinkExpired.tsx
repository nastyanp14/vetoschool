import { Link, useSearchParams } from 'react-router-dom';
import { Lang } from '../lib/i18n';
import { AuthHeader, AuthPageShell } from '../components/AuthCard';

const text = {
  ru: {
    title: 'Ссылка недействительна',
    sub: 'Она могла устареть или уже быть использована.',
    confirmation: 'Запросить новое письмо подтверждения',
    recovery: 'Запросить новое письмо восстановления',
    login: 'Вернуться ко входу',
  },
  ua: {
    title: 'Посилання недійсне',
    sub: 'Воно могло застаріти або вже бути використане.',
    confirmation: 'Запросити новий лист підтвердження',
    recovery: 'Запросити новий лист відновлення',
    login: 'Повернутися до входу',
  },
  en: {
    title: 'Link expired',
    sub: 'This link may have expired or already been used.',
    confirmation: 'Request a new confirmation email',
    recovery: 'Request a new recovery email',
    login: 'Back to login',
  },
};

export default function AuthLinkExpired({ lang }: { lang: Lang }) {
  const [params] = useSearchParams();
  const copy = text[lang] || text.ru;
  const type = params.get('type');

  return (
    <AuthPageShell tone="pink">
      <AuthHeader icon="⌛" title={copy.title} subtitle={copy.sub} />
      <div className="space-y-3">
        <Link to={type === 'recovery' ? '/forgot-password' : '/auth/check-email'} className="btn-magic block w-full py-4 text-center text-white font-display font-bold">
          {type === 'recovery' ? copy.recovery : copy.confirmation}
        </Link>
        <Link to="/login" className="block text-center font-body text-sm font-700 text-pink-500 hover:text-purple-500">
          {copy.login}
        </Link>
      </div>
    </AuthPageShell>
  );
}
