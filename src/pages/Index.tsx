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
import { Seo, homeSchoolSchema } from '../components/Seo';

const seo = {
  home: {
    title: 'Vetoschool | Online English School for Kids',
    description: 'Vetoschool offers playful online English lessons for children ages 5-12 with interactive practice, homework, listening, and grammar.',
    path: '/',
  },
  login: {
    title: 'Login | Vetoschool',
    description: 'Sign in to the private Vetoschool learning account for students, teachers, and administrators.',
    path: '/login',
    noindex: true,
  },
  register: {
    title: 'Register | Vetoschool',
    description: 'Create a private Vetoschool learning account for access to student lessons and homework.',
    path: '/register',
    noindex: true,
  },
  dashboard: {
    title: 'Student Dashboard | Vetoschool',
    description: 'Private Vetoschool student dashboard with lessons, practice, progress, and homework.',
    path: '/dashboard',
    noindex: true,
  },
  admin: {
    title: 'Admin | Vetoschool',
    description: 'Private Vetoschool admin area for managing students, lessons, and learning content.',
    path: '/admin',
    noindex: true,
  },
  analytics: {
    title: 'Student Analytics | Vetoschool',
    description: 'Private Vetoschool analytics page for reviewing individual student learning progress.',
    path: '/analytics',
    noindex: true,
  },
  notFound: {
    title: 'Page Not Found | Vetoschool',
    description: 'The requested Vetoschool page could not be found.',
    path: '/',
    noindex: true,
  },
};

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
      <Route path="/" element={<><Seo {...seo.home} schema={homeSchoolSchema} /><Navbar lang={lang} setLang={setLang} /><Home lang={lang} /></>} />
      <Route path="/login" element={<><Seo {...seo.login} /><Login lang={lang} /></>} />
      <Route path="/register" element={<><Seo {...seo.register} /><Register lang={lang} /></>} />
      <Route path="/dashboard" element={<><Seo {...seo.dashboard} /><ProtectedRoute><Dashboard lang={lang} /></ProtectedRoute></>} />
      <Route path="/admin" element={<><Seo {...seo.admin} /><ProtectedRoute role="admin"><Admin lang={lang} setLang={setLang} /></ProtectedRoute></>} />
      <Route path="/analytics/:userId" element={<><Seo {...seo.analytics} /><ProtectedRoute role="admin"><Analytics lang={lang} setLang={setLang} /></ProtectedRoute></>} />
      <Route path="*" element={<><Seo {...seo.notFound} /><NotFound /></>} />
    </Routes>
  );
}
