import { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUser, logout } from '../lib/auth';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Lang, t } from '../lib/i18n';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export default function Navbar({ lang, setLang }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null;
    if (location.pathname !== '/' || !state?.scrollTo) return;

    const timer = window.setTimeout(() => {
      scrollToSection(state.scrollTo as string);
      navigate('/', { replace: true, state: {} });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.state, navigate, scrollToSection]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    window.location.reload();
  };

  const navigateToSection = (id: string) => {
    setMenuOpen(false);
    if (location.pathname === '/') {
      scrollToSection(id);
      return;
    }

    navigate('/', { state: { scrollTo: id } });
  };

  const langs: Lang[] = ['ru', 'en', 'ua'];

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'glass shadow-lg shadow-pink-100/50 py-2' : 'bg-transparent py-4'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="text-2xl"
          >
            📖
          </motion.div>
          <span className="font-display font-black text-2xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            Vetoschool
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {[
            [t(lang, 'nav_about'), 'about'],
            [t(lang, 'nav_courses'), 'courses'],
            [t(lang, 'nav_contact'), 'contact'],
          ].map(([label, id]) => (
            <button
              key={id}
              onClick={() => navigateToSection(id)}
              className="font-body font-600 text-purple-600 hover:text-pink-500 transition-colors duration-200 text-sm"
            >
              {label}
            </button>
          ))}
          <Link
            to="/pricing"
            className="font-body font-600 text-purple-600 hover:text-pink-500 transition-colors duration-200 text-sm"
          >
            {t(lang, 'nav_pricing')}
          </Link>
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <div className="flex gap-1 bg-white/60 rounded-full px-1 py-1">
            {langs.map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-full text-xs font-body font-700 uppercase transition-all ${
                  lang === l
                    ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow'
                    : 'text-purple-500 hover:text-purple-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {user ? (
            <>
              <Link
                to={user.role === 'admin' ? '/admin' : '/dashboard'}
                className="btn-outline px-5 py-2 text-sm"
              >
                {user.role === 'admin' ? t(lang, 'nav_admin') : t(lang, 'nav_dashboard')}
              </Link>
              <button onClick={handleLogout} className="text-sm text-purple-400 hover:text-pink-500 transition-colors">
                {t(lang, 'nav_logout')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-outline px-5 py-2 text-sm">
                {t(lang, 'nav_signin')}
              </Link>
              <Link to="/trial-booking" className="btn-magic px-5 py-2 text-sm text-white">
                {t(lang, 'nav_join')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            className="p-2 rounded-xl glass"
            onClick={() => setMenuOpen(!menuOpen)}
          >
          <div className={`w-5 h-0.5 bg-purple-400 mb-1 transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <div className={`w-5 h-0.5 bg-purple-400 mb-1 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <div className={`w-5 h-0.5 bg-purple-400 transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-pink-100 mt-2"
          >
            <div className="px-4 py-4 flex flex-col gap-3">
              {[
                [t(lang, 'nav_about'), 'about'],
                [t(lang, 'nav_courses'), 'courses'],
                [t(lang, 'nav_contact'), 'contact'],
              ].map(([label, id]) => (
                <button
                  key={id}
                  onClick={() => navigateToSection(id)}
                  className="text-left font-body font-600 text-purple-600 py-2"
                >
                  {label}
                </button>
              ))}
              <Link
                to="/pricing"
                onClick={() => setMenuOpen(false)}
                className="text-left font-body font-600 text-purple-600 py-2"
              >
                {t(lang, 'nav_pricing')}
              </Link>

              {/* Lang switcher mobile */}
              <div className="flex gap-2">
                {langs.map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1.5 rounded-full text-xs font-body font-700 uppercase transition-all ${
                      lang === l
                        ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white'
                        : 'bg-white/60 text-purple-500'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="border-t border-pink-100 pt-3 flex flex-col gap-2">
                {user ? (
                  <>
                    <Link
                      to={user.role === 'admin' ? '/admin' : '/dashboard'}
                      className="btn-outline px-5 py-2 text-sm text-center"
                      onClick={() => setMenuOpen(false)}
                    >
                      {user.role === 'admin' ? t(lang, 'nav_admin') : t(lang, 'nav_dashboard')}
                    </Link>
                    <button onClick={handleLogout} className="text-sm text-purple-400 text-center py-2">
                      {t(lang, 'nav_logout')}
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="btn-outline px-5 py-2 text-sm text-center" onClick={() => setMenuOpen(false)}>
                      {t(lang, 'nav_signin')}
                    </Link>
                    <Link to="/trial-booking" className="btn-magic px-5 py-2 text-sm text-white text-center" onClick={() => setMenuOpen(false)}>
                      {t(lang, 'nav_join')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
