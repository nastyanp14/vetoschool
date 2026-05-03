import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../lib/auth';
import { Lang, t } from '../lib/i18n';

export default function Login({ lang }: { lang: Lang }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success && result.user) {
      navigate(result.user.role === 'admin' ? '/admin' : '/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #FFD6E8 0%, #E8D6FF 50%, #D6EEFF 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <motion.div className="absolute w-72 h-72 rounded-full blur-3xl" style={{ background: 'rgba(255,179,209,0.4)', top: '5%', left: '5%' }}
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div className="absolute w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(200,179,255,0.4)', bottom: '10%', right: '5%' }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 10, repeat: Infinity, delay: 2 }} />
      </div>

      {['A', 'B', 'C', 'D'].map((l, i) => (
        <motion.div key={l} className="absolute font-display font-black text-5xl opacity-20 pointer-events-none select-none"
          style={{ color: ['#FFB3D1', '#C8B3FF', '#B3D9FF', '#B3F0E0'][i], left: `${[8, 85, 5, 90][i]}%`, top: `${[15, 20, 70, 65][i]}%` }}
          animate={{ y: [0, -14, 0], rotate: [0, 5, -5, 0] }}
          transition={{ delay: i * 0.4, duration: 4 + i * 0.5, repeat: Infinity }}
        >{l}</motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass rounded-3xl p-8 shadow-2xl" style={{ boxShadow: '0 25px 80px rgba(200,150,220,0.25)' }}>
          <div className="text-center mb-8">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="text-6xl mb-3">📖</motion.div>
            <h1 className="font-display font-black text-3xl bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              {t(lang, 'login_title')}
            </h1>
            <p className="font-body text-purple-400 mt-2">{t(lang, 'login_sub')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'login_email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" className="input-magic" required />
            </div>
            <div>
              <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'login_pass')}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className="input-magic" required />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-500 font-body text-sm px-4 py-3 rounded-2xl">
                ⚠️ {error}
              </motion.div>
            )}

            <button type="submit" disabled={loading}
              className="btn-magic w-full py-4 text-white font-display font-bold text-lg mt-2 disabled:opacity-70">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>✨</motion.span>
                  {t(lang, 'login_loading')}
                </span>
              ) : t(lang, 'login_btn')}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="font-body text-purple-400 text-sm">
              {t(lang, 'login_no_account')}{' '}
              <Link to="/register" className="text-pink-500 font-600 hover:text-purple-500 transition-colors">
                {t(lang, 'login_join')}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
