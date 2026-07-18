import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { logout } from '../lib/auth';
import { Lang } from '../lib/i18n';
import { AuthAlert, AuthHeader, AuthPageShell } from '../components/AuthCard';

const text = {
  ru: {
    title: 'Email подтверждён',
    sub: 'Теперь можно войти в аккаунт Vetoschool.',
    note: 'Подтверждение email не активирует платный доступ к урокам. После оплаты напишите Vetoschool в Telegram.',
    login: 'Войти',
  },
  ua: {
    title: 'Email підтверджено',
    sub: 'Тепер можна увійти в акаунт Vetoschool.',
    note: 'Підтвердження email не активує платний доступ до уроків. Після оплати напишіть Vetoschool у Telegram.',
    login: 'Увійти',
  },
  en: {
    title: 'Email confirmed',
    sub: 'You can now log in to Vetoschool.',
    note: 'Email confirmation does not activate paid lesson access. After payment, contact Vetoschool through Telegram.',
    login: 'Log in',
  },
};

export default function EmailConfirmed({ lang }: { lang: Lang }) {
  const copy = text[lang] || text.ru;

  useEffect(() => {
    logout();
  }, []);

  return (
    <AuthPageShell tone="blue">
      <AuthHeader icon="✅" title={copy.title} subtitle={copy.sub} />
      <div className="space-y-4">
        <AuthAlert type="info">{copy.note}</AuthAlert>
        <Link to="/login" className="btn-magic block w-full py-4 text-center text-white font-display font-bold">
          {copy.login}
        </Link>
      </div>
    </AuthPageShell>
  );
}
