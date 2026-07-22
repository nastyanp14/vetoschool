import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { Lang, t } from '../lib/i18n';

type FooterProps = {
  lang: Lang;
};

export default function Footer({ lang }: FooterProps) {
  const { openPreferences } = useCookieConsent();

  return (
    <footer id="contact" className="bg-purple-900 px-4 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-3xl">📖</span>
              <span className="bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text font-display text-2xl font-black text-transparent">Vetoschool</span>
            </div>
            <p className="mb-6 max-w-md font-body leading-relaxed text-purple-300">{t(lang, 'footer_desc')}</p>
          </div>
          <div>
            <h4 className="mb-4 font-display text-lg font-bold text-white">{t(lang, 'footer_contact')}</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 font-body text-sm text-purple-300">
                <span>✈️</span>
                <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-pink-300">@vetoschool_bot</a>
              </li>
              <li className="flex items-center gap-2 font-body text-sm text-purple-300">
                <span>📧</span>
                <a href="mailto:vetoschool.english@gmail.com" className="transition-colors hover:text-pink-300">vetoschool.english@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-purple-700 pt-8 md:flex-row">
          <p className="font-body text-sm text-purple-400">{t(lang, 'footer_copy')}</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            <Link to="/login" className="font-body text-sm text-purple-400 transition-colors hover:text-pink-300">{t(lang, 'footer_signin')}</Link>
            <Link to="/register" className="font-body text-sm text-purple-400 transition-colors hover:text-pink-300">{t(lang, 'footer_register')}</Link>
            <Link to="/privacy-policy" className="font-body text-sm text-purple-400 transition-colors hover:text-pink-300">{t(lang, 'footer_privacy_policy')}</Link>
            <Link to="/cookie-policy" className="font-body text-sm text-purple-400 transition-colors hover:text-pink-300">{t(lang, 'footer_cookie_policy')}</Link>
            <button
              type="button"
              onClick={openPreferences}
              className="inline-flex items-center gap-1.5 font-body text-sm text-purple-400 transition-colors hover:text-pink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 focus-visible:ring-offset-purple-900"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'footer_cookie_settings')}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
