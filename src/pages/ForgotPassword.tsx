import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../lib/auth';
import { Lang } from '../lib/i18n';
import { AuthAlert, AuthHeader, AuthPageShell } from '../components/AuthCard';

const text = {
  ru: {
    title: 'Восстановление пароля',
    sub: 'Введите email аккаунта Vetoschool.',
    email: 'Email',
    send: 'Отправить ссылку',
    wait: 'Повторная отправка через',
    neutral: 'Если аккаунт с этим email существует, мы отправили письмо для восстановления пароля.',
    login: 'Вернуться ко входу',
  },
  ua: {
    title: 'Відновлення пароля',
    sub: 'Введіть email акаунта Vetoschool.',
    email: 'Email',
    send: 'Надіслати посилання',
    wait: 'Повторне надсилання через',
    neutral: 'Якщо акаунт з цим email існує, ми надіслали лист для відновлення пароля.',
    login: 'Повернутися до входу',
  },
  en: {
    title: 'Password recovery',
    sub: 'Enter your Vetoschool account email.',
    email: 'Email',
    send: 'Send reset link',
    wait: 'Resend available in',
    neutral: 'If an account with this email exists, we sent a password reset email.',
    login: 'Back to login',
  },
};

export default function ForgotPassword({ lang }: { lang: Lang }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (cooldown > 0) return;
    setError('');
    setMessage('');
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    startCooldown();
    if (result.success) setMessage(copy.neutral);
    else setError(result.error || 'Could not request password reset');
  };

  return (
    <AuthPageShell tone="pink">
      <AuthHeader icon="🔑" title={copy.title} subtitle={copy.sub} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{copy.email}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="input-magic" required />
        </div>
        {message && <AuthAlert type="success">{message}</AuthAlert>}
        {error && <AuthAlert>{error}</AuthAlert>}
        <button type="submit" disabled={loading || cooldown > 0} className="btn-magic w-full py-4 text-white font-display font-bold disabled:opacity-60">
          {cooldown > 0 ? `${copy.wait} ${cooldown}s` : loading ? '...' : copy.send}
        </button>
        <Link to="/login" className="block text-center font-body text-sm font-700 text-pink-500 hover:text-purple-500">
          {copy.login}
        </Link>
      </form>
    </AuthPageShell>
  );
}
