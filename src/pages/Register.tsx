import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../lib/auth';
import { Lang, t } from '../lib/i18n';

export default function Register({ lang }: { lang: Lang }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  return (
    <div
      className="page-bg-auth min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #D6EEFF 0%, #E8D6FF 50%, #FFD6E8 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <motion.div className="absolute w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(179,217,255,0.4)', top: '5%', right: '5%' }}
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 9, repeat: Infinity }} />
        <motion.div className="absolute w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(255,179,209,0.4)', bottom: '5%', left: '5%' }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 7, repeat: Infinity, delay: 1 }} />
      </div>

      {[...Array(6)].map((_, i) => (
        <motion.div key={i} className="absolute text-yellow-300 pointer-events-none select-none"
          style={{ left: `${15 + i * 14}%`, top: `${10 + (i % 3) * 30}%`, fontSize: 16 + (i % 3) * 6 }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8], rotate: [0, 360] }}
          transition={{ delay: i * 0.4, duration: 3 + i * 0.3, repeat: Infinity }}
        >⭐</motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass rounded-3xl p-8 shadow-2xl" style={{ boxShadow: '0 25px 80px rgba(150,100,200,0.2)' }}>
          <div className="text-center mb-8">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-6xl mb-3">✨</motion.div>
            <h1 className="font-display font-black text-3xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t(lang, 'reg_title')}
            </h1>
            <p className="font-body text-purple-400 mt-2">{t(lang, 'reg_sub')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'reg_name')}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sofia" className="input-magic" required />
            </div>
            <div>
              <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'reg_email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="input-magic" required />
            </div>
            <div>
              <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'reg_pass')}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" className="input-magic" required />
            </div>
            <div>
              <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{t(lang, 'reg_confirm')}</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" className="input-magic" required />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-500 font-body text-sm px-4 py-3 rounded-2xl">
                ⚠️ {error}
              </motion.div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
              <p className="font-body text-xs text-blue-500 text-center">{t(lang, 'reg_hint')}</p>
            </div>

            <button type="submit" disabled={loading}
              className="btn-magic w-full py-4 text-white font-display font-bold text-lg mt-2 disabled:opacity-70">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>✨</motion.span>
                  {t(lang, 'reg_loading')}
                </span>
              ) : t(lang, 'reg_btn')}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="font-body text-purple-400 text-sm">
              {t(lang, 'reg_have')}{' '}
              <Link to="/login" className="text-pink-500 font-600 hover:text-purple-500 transition-colors">{t(lang, 'reg_signin')}</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
