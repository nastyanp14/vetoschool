import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getCurrentUser, updatePassword } from '../lib/auth';
import { validatePasswordPair } from '../lib/password';
import { Lang } from '../lib/i18n';
import { AuthAlert } from '../components/AuthCard';
import ThemeToggle from '../components/ThemeToggle';

const text = {
  ru: {
    title: 'Безопасность аккаунта',
    sub: 'Измените пароль для входа в Vetoschool.',
    pass: 'Новый пароль',
    confirm: 'Повторите новый пароль',
    save: 'Обновить пароль',
    success: 'Пароль успешно обновлён.',
    reauth: 'Если Supabase запросит повторную авторизацию, выйдите и войдите снова перед сменой пароля.',
    back: 'Назад',
  },
  ua: {
    title: 'Безпека акаунта',
    sub: 'Змініть пароль для входу у Vetoschool.',
    pass: 'Новий пароль',
    confirm: 'Повторіть новий пароль',
    save: 'Оновити пароль',
    success: 'Пароль успішно оновлено.',
    reauth: 'Якщо Supabase запросить повторну авторизацію, вийдіть і увійдіть знову перед зміною пароля.',
    back: 'Назад',
  },
  en: {
    title: 'Account security',
    sub: 'Change your Vetoschool sign-in password.',
    pass: 'New password',
    confirm: 'Confirm new password',
    save: 'Update password',
    success: 'Password updated successfully.',
    reauth: 'If Supabase requires re-authentication, log out and sign in again before changing your password.',
    back: 'Back',
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
    <div className="min-h-screen p-4" style={{ background: 'linear-gradient(135deg,#FFF0F6,#F5F0FF,#F0F8FF)' }}>
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link to={user.hasAccess ? '/dashboard' : '/pending-activation'} className="font-body text-sm font-700 text-pink-500 hover:text-purple-500">
            {copy.back}
          </Link>
          <ThemeToggle />
        </div>
        <div className="glass rounded-3xl p-8 shadow-2xl">
          <h1 className="font-display font-black text-3xl text-purple-700 mb-2">{copy.title}</h1>
          <p className="font-body text-purple-400 mb-6">{copy.sub}</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{copy.pass}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-magic" required />
            </div>
            <div>
              <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{copy.confirm}</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-magic" required />
            </div>
            <AuthAlert type="info">{copy.reauth}</AuthAlert>
            {success && <AuthAlert type="success">{success}</AuthAlert>}
            {error && <AuthAlert>{error}</AuthAlert>}
            <button type="submit" disabled={loading} className="btn-magic w-full py-4 text-white font-display font-bold disabled:opacity-60">
              {loading ? '...' : copy.save}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
