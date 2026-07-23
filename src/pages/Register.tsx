import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, signInWithGoogle } from '../lib/auth';
import { Lang, t } from '../lib/i18n';
import { validatePasswordPair } from '../lib/password';
import { AuthAlert, AuthFooterLink, AuthHeader, AuthPageShell, GoogleButton } from '../components/AuthCard';
import { useToast } from '@/hooks/use-toast';

const text = {
  ru: {
    google: 'Продолжить с Google',
    divider: 'или',
    googleErrorTitle: 'Google-регистрация не запустилась',
    passPlaceholder: 'Минимум 6 символов',
    hint: '👋 Подтвердите email кодом. Доступ к урокам откроет администратор после оплаты.',
  },
  ua: {
    google: 'Продовжити з Google',
    divider: 'або',
    googleErrorTitle: 'Google-реєстрація не запустилася',
    passPlaceholder: 'Мінімум 6 символів',
    hint: '👋 Підтвердьте email кодом. Доступ до уроків відкриє адміністратор після оплати.',
  },
  en: {
    google: 'Continue with Google',
    divider: 'or',
    googleErrorTitle: 'Google registration did not start',
    passPlaceholder: 'Minimum 6 characters',
    hint: '👋 Confirm your email with a code. Lesson access is opened by an administrator after payment.',
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
  const { toast } = useToast();
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
    if (!result.success) {
      const message = result.error || 'Google sign-in failed';
      setError(message);
      toast({ title: copy.googleErrorTitle, description: message, variant: 'destructive' });
    }
  };

  return (
    <AuthPageShell tone="blue">
      <AuthHeader icon="✨" title={t(lang, 'reg_title')} subtitle={t(lang, 'reg_sub')} />

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
          <p className="font-body text-xs text-blue-500 text-center">{copy.hint}</p>
        </div>

        <button type="submit" disabled={loading} className="btn-magic w-full py-4 text-white font-display font-bold text-lg mt-2 disabled:opacity-70">
          {loading ? t(lang, 'reg_loading') : t(lang, 'reg_btn')}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-purple-100" />
        <span className="font-body text-xs text-purple-300">{copy.divider}</span>
        <div className="h-px flex-1 bg-purple-100" />
      </div>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} label={copy.google} />

      <AuthFooterLink to="/login" muted={t(lang, 'reg_have')} label={t(lang, 'reg_signin')} />
    </AuthPageShell>
  );
}
