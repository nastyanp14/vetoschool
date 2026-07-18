import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function AuthPageShell({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'pink';
}) {
  const bg = tone === 'blue'
    ? 'linear-gradient(135deg, #D6EEFF 0%, #E8D6FF 50%, #FFD6E8 100%)'
    : 'linear-gradient(135deg, #FFD6E8 0%, #E8D6FF 50%, #D6EEFF 100%)';

  return (
    <div className="page-bg-auth min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: bg }}>
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'rgba(179,217,255,0.4)', top: '5%', right: '5%' }}
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'rgba(255,179,209,0.4)', bottom: '5%', left: '5%' }}
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 7, repeat: Infinity, delay: 1 }}
        />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass rounded-3xl p-8 shadow-2xl" style={{ boxShadow: '0 25px 80px rgba(150,100,200,0.2)' }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export function AuthHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="text-center mb-8">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-6xl mb-3">
        {icon}
      </motion.div>
      <h1 className="font-display font-black text-3xl bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
        {title}
      </h1>
      <p className="font-body text-purple-400 mt-2">{subtitle}</p>
    </div>
  );
}

export function AuthAlert({ children, type = 'error' }: { children: ReactNode; type?: 'error' | 'success' | 'info' }) {
  const cls = type === 'success'
    ? 'bg-green-50 border-green-200 text-green-600'
    : type === 'info'
      ? 'bg-blue-50 border-blue-100 text-blue-500'
      : 'bg-red-50 border-red-200 text-red-500';

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`${cls} border font-body text-sm px-4 py-3 rounded-2xl`}>
      {children}
    </motion.div>
  );
}

export function GoogleButton({ onClick, loading, label }: { onClick: () => void; loading?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full py-3.5 rounded-2xl bg-white/80 border border-purple-100 text-purple-700 font-display font-bold text-sm hover:bg-white transition-colors disabled:opacity-60"
    >
      {loading ? '...' : label}
    </button>
  );
}

export function AuthFooterLink({ to, muted, label }: { to: string; muted: string; label: string }) {
  return (
    <p className="font-body text-purple-400 text-sm text-center mt-6">
      {muted}{' '}
      <Link to={to} className="text-pink-500 font-600 hover:text-purple-500 transition-colors">
        {label}
      </Link>
    </p>
  );
}
