import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout, updatePassword, validateRecoverySession } from '../lib/auth';
import { validatePasswordPair } from '../lib/password';
import { Lang } from '../lib/i18n';
import { AuthAlert, AuthHeader, AuthPageShell } from '../components/AuthCard';

const text = {
  ru: {
    title: 'Новый пароль',
    sub: 'Введите новый пароль для аккаунта.',
    pass: 'Новый пароль',
    confirm: 'Повторите пароль',
    save: 'Сохранить пароль',
    success: 'Пароль обновлён. Теперь можно войти.',
    login: 'Перейти ко входу',
  },
  ua: {
    title: 'Новий пароль',
    sub: 'Введіть новий пароль для акаунта.',
    pass: 'Новий пароль',
    confirm: 'Повторіть пароль',
    save: 'Зберегти пароль',
    success: 'Пароль оновлено. Тепер можна увійти.',
    login: 'Перейти до входу',
  },
  en: {
    title: 'New password',
    sub: 'Enter a new password for your account.',
    pass: 'New password',
    confirm: 'Confirm password',
    save: 'Save password',
    success: 'Password updated. You can now log in.',
    login: 'Go to login',
  },
};

export default function ResetPassword({ lang }: { lang: Lang }) {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const copy = text[lang] || text.ru;

  useEffect(() => {
    let cancelled = false;
    validateRecoverySession().then(result => {
      if (cancelled) return;
      if (result.success) setReady(true);
      else navigate('/auth/link-expired?type=recovery', { replace: true });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const validation = validatePasswordPair(password, confirm);
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (result.success) {
      await logout();
      setSuccess(true);
    } else {
      setError(result.error || 'Could not update password');
    }
  };

  return (
    <AuthPageShell tone="blue">
      <AuthHeader icon="🔒" title={copy.title} subtitle={copy.sub} />
      {!ready ? (
        <div className="text-center font-body text-purple-400">...</div>
      ) : success ? (
        <div className="space-y-4">
          <AuthAlert type="success">{copy.success}</AuthAlert>
          <Link to="/login" className="btn-magic block w-full py-4 text-center text-white font-display font-bold">
            {copy.login}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{copy.pass}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-magic" required />
          </div>
          <div>
            <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{copy.confirm}</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-magic" required />
          </div>
          {error && <AuthAlert>{error}</AuthAlert>}
          <button type="submit" disabled={loading} className="btn-magic w-full py-4 text-white font-display font-bold disabled:opacity-60">
            {loading ? '...' : copy.save}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}
