import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../lib/auth';
import { Lang } from '../lib/i18n';
import ThemeToggle from '../components/ThemeToggle';

const text = {
  ru: {
    title: 'Ожидается активация доступа',
    exact: 'Your account has been created, but access to lessons has not yet been activated. Contact Vetoschool through Telegram after payment.',
    translated: 'Ваш аккаунт создан, но доступ к урокам ещё не активирован. После оплаты напишите Vetoschool в Telegram.',
    telegram: 'Написать в Telegram',
    security: 'Безопасность аккаунта',
    logout: 'Выйти',
  },
  ua: {
    title: 'Очікується активація доступу',
    exact: 'Your account has been created, but access to lessons has not yet been activated. Contact Vetoschool through Telegram after payment.',
    translated: 'Ваш акаунт створено, але доступ до уроків ще не активовано. Після оплати напишіть Vetoschool у Telegram.',
    telegram: 'Написати в Telegram',
    security: 'Безпека акаунта',
    logout: 'Вийти',
  },
  en: {
    title: 'Access pending',
    exact: 'Your account has been created, but access to lessons has not yet been activated. Contact Vetoschool through Telegram after payment.',
    translated: '',
    telegram: 'Contact on Telegram',
    security: 'Account security',
    logout: 'Log out',
  },
};

export default function PendingActivation({ lang }: { lang: Lang }) {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const copy = text[lang] || text.ru;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg,#FFF0F6,#F5F0FF,#F0F8FF)' }}>
      <div className="w-full max-w-2xl glass rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link to="/" className="font-display font-black text-xl bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Vetoschool
          </Link>
          <ThemeToggle />
        </div>
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="font-display font-black text-3xl text-purple-700 mb-3">{copy.title}</h1>
          {user && <p className="font-body text-sm text-purple-400 mb-5">{user.email}</p>}
          <div className="rounded-3xl bg-white/75 border border-purple-100 p-5 text-left space-y-3">
            <p className="font-body font-700 text-purple-700">{copy.exact}</p>
            {copy.translated && <p className="font-body text-sm text-purple-500">{copy.translated}</p>}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
            <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer" className="btn-magic px-6 py-3 text-white font-display font-bold text-sm">
              {copy.telegram}
            </a>
            <Link to="/account/security" className="btn-outline px-6 py-3 font-display font-bold text-sm">
              {copy.security}
            </Link>
            <button onClick={handleLogout} className="font-body text-sm font-700 text-purple-400 hover:text-pink-500 px-4">
              {copy.logout}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
