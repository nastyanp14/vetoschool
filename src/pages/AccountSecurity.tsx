import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { getCurrentUser, updatePassword } from '../lib/auth';
import { validatePasswordPair } from '../lib/password';
import { Lang } from '../lib/i18n';
import { AuthAlert } from '../components/AuthCard';
import ThemeToggle from '../components/ThemeToggle';

const text = {
  ru: {
    title: 'Смена пароля',
    sub: 'Обновите пароль для входа в Vetoschool.',
    pass: 'Новый пароль',
    confirm: 'Повторите пароль',
    save: 'Сохранить',
    success: 'Пароль обновлён.',
    reauth: 'Если сессия устарела, выйдите и войдите снова.',
    back: 'Назад в кабинет',
  },
  ua: {
    title: 'Зміна пароля',
    sub: 'Оновіть пароль для входу у Vetoschool.',
    pass: 'Новий пароль',
    confirm: 'Повторіть пароль',
    save: 'Зберегти',
    success: 'Пароль оновлено.',
    reauth: 'Якщо сесія застаріла, вийдіть і увійдіть знову.',
    back: 'Назад до кабінету',
  },
  en: {
    title: 'Change Password',
    sub: 'Update your Vetoschool sign-in password.',
    pass: 'New password',
    confirm: 'Confirm password',
    save: 'Save',
    success: 'Password updated.',
    reauth: 'If your session expired, log out and sign in again.',
    back: 'Back to account',
  },
};

export default function AccountSecurity({ lang }: { lang: Lang }) {
  const user = getCurrentUser();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const copy = text[lang] || text.ru;

  if (!user) return <Navigate to="/login" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const validation = validatePasswordPair(password, confirm);
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (result.success) {
      setPassword('');
      setConfirm('');
      setSuccess(copy.success);
    } else {
      setError(result.error || 'Could not update password');
    }
  };

  return (
    <div className="page-bg-dashboard min-h-screen p-4">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center py-8">
        <div className="mb-4 flex items-center justify-between">
          <Link to={user.hasAccess ? '/dashboard' : '/pending-activation'} className="font-body text-sm font-700 text-pink-500 hover:text-purple-500">
            {copy.back}
          </Link>
          <ThemeToggle />
        </div>

        <div className="glass rounded-3xl border border-purple-100 p-6 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 text-purple-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black text-purple-700">{copy.title}</h1>
              <p className="font-body text-sm text-purple-400">{copy.sub}</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-2 block font-body text-sm font-700 text-purple-600">{copy.pass}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-magic py-3" required />
            </div>
            <div>
              <label className="mb-2 block font-body text-sm font-700 text-purple-600">{copy.confirm}</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-magic py-3" required />
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 font-body text-xs font-700 text-blue-500">
              {copy.reauth}
            </div>
            {success && <AuthAlert type="success">{success}</AuthAlert>}
            {error && <AuthAlert>{error}</AuthAlert>}
            <button type="submit" disabled={loading} className="btn-magic w-full py-3.5 text-white font-display font-bold disabled:opacity-60">
              {loading ? '...' : copy.save}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
