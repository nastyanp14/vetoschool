import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, signInWithGoogle } from '../lib/auth';
import { Lang, t } from '../lib/i18n';
import { AuthAlert, AuthFooterLink, AuthHeader, AuthPageShell, GoogleButton } from '../components/AuthCard';

const text = {
  ru: { google: 'Продолжить с Google', divider: 'или через email', forgot: 'Забыли пароль?' },
  ua: { google: 'Продовжити з Google', divider: 'або через email', forgot: 'Забули пароль?' },
  en: { google: 'Continue with Google', divider: 'or use email', forgot: 'Forgot password?' },
};

export default function Login({ lang }: { lang: Lang }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const copy = text[lang] || text.ru;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success && result.data) {
      if (result.data.role === 'admin') navigate('/admin');
      else navigate(result.data.hasAccess ? '/dashboard' : '/pending-activation');
    } else {
      setError(result.error || 'Login failed');
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
    <AuthPageShell tone="pink">
      <AuthHeader icon="📖" title={t(lang, 'login_title')} subtitle={t(lang, 'login_sub')} />

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
          <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'login_email')}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="input-magic" required />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-body font-600 text-purple-600 text-sm block">{t(lang, 'login_pass')}</label>
            <Link to="/forgot-password" className="font-body text-xs font-700 text-pink-500 hover:text-purple-500">
              {copy.forgot}
            </Link>
          </div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input-magic" required />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <button type="submit" disabled={loading} className="btn-magic w-full py-4 text-white font-display font-bold text-lg mt-2 disabled:opacity-70">
          {loading ? t(lang, 'login_loading') : t(lang, 'login_btn')}
        </button>
      </form>

      <AuthFooterLink to="/register" muted={t(lang, 'login_no_account')} label={t(lang, 'login_join')} />
    </AuthPageShell>
  );
}
