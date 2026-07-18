import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, signInWithGoogle } from '../lib/auth';
import { Lang, t } from '../lib/i18n';
import { validatePasswordPair } from '../lib/password';
import { AuthAlert, AuthFooterLink, AuthHeader, AuthPageShell, GoogleButton } from '../components/AuthCard';

const text = {
  ru: {
    google: 'Продолжить с Google',
    divider: 'или через email',
    passPlaceholder: 'Минимум 6 символов',
    telegram: 'После регистрации и оплаты напишите Vetoschool в Telegram и отправьте подтверждение оплаты. Доступ к урокам вручную активирует администратор.',
  },
  ua: {
    google: 'Продовжити з Google',
    divider: 'або через email',
    passPlaceholder: 'Мінімум 6 символів',
    telegram: 'Після реєстрації та оплати напишіть Vetoschool у Telegram і надішліть підтвердження оплати. Доступ до уроків вручну активує адміністратор.',
  },
  en: {
    google: 'Continue with Google',
    divider: 'or use email',
    passPlaceholder: 'Minimum 6 characters',
    telegram: 'After registration and payment, contact Vetoschool through Telegram and send proof of payment. Lesson access is activated manually by an administrator.',
  },
};

export default function Register({ lang }: { lang: Lang }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const copy = text[lang] || text.ru;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePasswordPair(password, confirm);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);

    if (result.success) {
      navigate(`/auth/check-email?email=${encodeURIComponent(result.data?.email || email)}`, {
        state: { email: result.data?.email || email },
      });
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const result = await signInWithGoogle('/dashboard');
    setGoogleLoading(false);
    if (!result.success) setError(result.error || 'Google sign-in failed');
  };

  return (
    <AuthPageShell tone="blue">
      <AuthHeader icon="✨" title={t(lang, 'reg_title')} subtitle={t(lang, 'reg_sub')} />

      <div className="space-y-4">
        <GoogleButton onClick={handleGoogle} loading={googleLoading} label={copy.google} />
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-purple-100" />
          <span className="font-body text-xs text-purple-300">{copy.divider}</span>
          <div className="h-px flex-1 bg-purple-100" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'reg_name')}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Sofia" className="input-magic" required />
        </div>
        <div>
          <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'reg_email')}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="input-magic" required />
        </div>
        <div>
          <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'reg_pass')}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={copy.passPlaceholder} className="input-magic" required />
        </div>
        <div>
          <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'reg_confirm')}</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={copy.passPlaceholder} className="input-magic" required />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <AuthAlert type="info">
          {copy.telegram}{' '}
          <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer" className="font-700 underline">
            Telegram
          </a>
        </AuthAlert>

        <button type="submit" disabled={loading} className="btn-magic w-full py-4 text-white font-display font-bold text-lg mt-2 disabled:opacity-70">
          {loading ? t(lang, 'reg_loading') : t(lang, 'reg_btn')}
        </button>
      </form>

      <AuthFooterLink to="/login" muted={t(lang, 'reg_have')} label={t(lang, 'reg_signin')} />
    </AuthPageShell>
  );
}
