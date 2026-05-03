import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Lang } from '../lib/i18n';
import { bootstrapAuth, getCurrentUser, subscribeAuth } from '../lib/auth';
import Navbar from '../components/Navbar';
import Home from './Home';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import Admin from './Admin';
import Analytics from './Analytics';
import NotFound from './NotFound';

function ProtectedRoute({ children, role }: { children: JSX.Element; role?: 'admin' | 'student' }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function Index() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('vetoschool_lang') as Lang | null;
    return saved || 'ru';
  });
  const [, force] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrapAuth().finally(() => setReady(true));
    const unsub = subscribeAuth(() => force(n => n + 1));
    return () => { unsub(); };
  }, []);

  useEffect(() => { localStorage.setItem('vetoschool_lang', lang); }, [lang]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#FFF0F6,#F5F0FF,#F0F8FF)' }}>
        <div className="text-4xl animate-pulse">✨</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<><Navbar lang={lang} setLang={setLang} /><Home lang={lang} /></>} />
      <Route path="/login" element={<Login lang={lang} />} />
      <Route path="/register" element={<Register lang={lang} />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard lang={lang} /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><Admin lang={lang} /></ProtectedRoute>} />
      <Route path="/analytics/:userId" element={<ProtectedRoute role="admin"><Analytics lang={lang} /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
