import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { resendConfirmationEmail } from '../lib/auth';
import { Lang } from '../lib/i18n';
import { AuthAlert, AuthHeader, AuthPageShell } from '../components/AuthCard';

const text = {
  ru: {
    title: 'Проверьте почту',
    sub: 'Мы отправили ссылку для подтверждения email.',
    sentTo: 'Письмо отправлено на',
    resend: 'Отправить ещё раз',
    wait: 'Повторная отправка через',
    done: 'Письмо отправлено повторно.',
    login: 'Перейти ко входу',
    expired: 'Если ссылка устарела, запросите новое письмо здесь.',
  },
  ua: {
    title: 'Перевірте пошту',
    sub: 'Ми надіслали посилання для підтвердження email.',
    sentTo: 'Лист надіслано на',
    resend: 'Надіслати ще раз',
    wait: 'Повторне надсилання через',
    done: 'Лист надіслано повторно.',
    login: 'Перейти до входу',
    expired: 'Якщо посилання застаріло, запросіть новий лист тут.',
  },
  en: {
    title: 'Check your email',
    sub: 'We sent an email confirmation link.',
    sentTo: 'Message sent to',
    resend: 'Resend confirmation email',
    wait: 'Resend available in',
    done: 'Confirmation email sent again.',
    login: 'Go to login',
    expired: 'If the link expired, request a fresh email here.',
  },
};

export default function CheckEmail({ lang }: { lang: Lang }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const email = useMemo(() => {
    const stateEmail = (location.state as { email?: string } | null)?.email;
    return stateEmail || params.get('email') || '';
  }, [location.state, params]);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const copy = text[lang] || text.ru;

  const startCooldown = () => {
    setCooldown(60);
    const timer = window.setInterval(() => {
      setCooldown(value => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  };

  const resend = async () => {
    if (!email || cooldown > 0) return;
    setError('');
    setMessage('');
    setLoading(true);
    const result = await resendConfirmationEmail(email);
    setLoading(false);
    startCooldown();
    if (result.success) setMessage(copy.done);
    else setError(result.error || 'Could not resend email');
  };

  return (
    <AuthPageShell tone="blue">
      <AuthHeader icon="📧" title={copy.title} subtitle={copy.sub} />
      <div className="space-y-4">
        {email && (
          <div className="rounded-2xl bg-white/70 border border-purple-100 px-4 py-3 text-center">
            <div className="font-body text-xs text-purple-400">{copy.sentTo}</div>
            <div className="font-display font-bold text-purple-700 break-all">{email}</div>
          </div>
        )}
        <AuthAlert type="info">{copy.expired}</AuthAlert>
        {message && <AuthAlert type="success">{message}</AuthAlert>}
        {error && <AuthAlert>{error}</AuthAlert>}
        <button
          type="button"
          onClick={resend}
          disabled={!email || loading || cooldown > 0}
          className="btn-magic w-full py-4 text-white font-display font-bold disabled:opacity-60"
        >
          {cooldown > 0 ? `${copy.wait} ${cooldown}s` : loading ? '...' : copy.resend}
        </button>
        <Link to="/login" className="block text-center font-body text-sm font-700 text-pink-500 hover:text-purple-500">
          {copy.login}
        </Link>
      </div>
    </AuthPageShell>
  );
}
