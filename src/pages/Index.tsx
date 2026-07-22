import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Lang } from '../lib/i18n';
import { bootstrapAuth, getCurrentUser, subscribeAuth } from '../lib/auth';
import Navbar from '../components/Navbar';
import Home from './Home';
import Login from './Login';
import Register from './Register';
import CheckEmail from './CheckEmail';
import AuthCallback from './AuthCallback';
import EmailConfirmed from './EmailConfirmed';
import AuthLinkExpired from './AuthLinkExpired';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import AccountSecurity from './AccountSecurity';
import PendingActivation from './PendingActivation';
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
    title: '404 | Vetoschool',
    description: 'A friendly Vetoschool not found page with quick links back to home and login.',
    path: '/',
    noindex: true,
  },
};

function ProtectedRoute({
  children,
  role,
  requirePaidAccess = false,
}: {
  children: JSX.Element;
  role?: 'admin' | 'student';
  requirePaidAccess?: boolean;
}) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailConfirmed) return <Navigate to={`/auth/check-email?email=${encodeURIComponent(user.email)}`} replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  if (requirePaidAccess && user.role !== 'admin' && !user.hasAccess) return <Navigate to="/pending-activation" replace />;
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
      <Route path="/auth/check-email" element={<><Seo title="Check Email | Vetoschool" description="Confirm your Vetoschool email address." path="/auth/check-email" noindex /><CheckEmail lang={lang} /></>} />
      <Route path="/auth/callback" element={<><Seo title="Auth Callback | Vetoschool" description="Vetoschool authentication callback." path="/auth/callback" noindex /><AuthCallback lang={lang} /></>} />
      <Route path="/auth/confirmed" element={<><Seo title="Email Confirmed | Vetoschool" description="Vetoschool email confirmation success." path="/auth/confirmed" noindex /><EmailConfirmed lang={lang} /></>} />
      <Route path="/auth/link-expired" element={<><Seo title="Auth Link Expired | Vetoschool" description="Vetoschool authentication link expired." path="/auth/link-expired" noindex /><AuthLinkExpired lang={lang} /></>} />
      <Route path="/forgot-password" element={<><Seo title="Forgot Password | Vetoschool" description="Recover your Vetoschool password." path="/forgot-password" noindex /><ForgotPassword lang={lang} /></>} />
      <Route path="/reset-password" element={<><Seo title="Reset Password | Vetoschool" description="Reset your Vetoschool password." path="/reset-password" noindex /><ResetPassword lang={lang} /></>} />
      <Route path="/pending-activation" element={<><Seo title="Pending Activation | Vetoschool" description="Vetoschool paid access pending activation." path="/pending-activation" noindex /><ProtectedRoute><PendingActivation lang={lang} /></ProtectedRoute></>} />
      <Route path="/account/security" element={<><Seo title="Account Security | Vetoschool" description="Manage Vetoschool account security." path="/account/security" noindex /><ProtectedRoute><AccountSecurity lang={lang} /></ProtectedRoute></>} />
      <Route path="/dashboard" element={<><Seo {...seo.dashboard} /><ProtectedRoute requirePaidAccess><Dashboard lang={lang} /></ProtectedRoute></>} />
      <Route path="/admin" element={<><Seo {...seo.admin} /><ProtectedRoute role="admin"><Admin lang={lang} setLang={setLang} /></ProtectedRoute></>} />
      <Route path="/analytics/:userId" element={<><Seo {...seo.analytics} /><ProtectedRoute role="admin"><Analytics lang={lang} setLang={setLang} /></ProtectedRoute></>} />
      <Route path="*" element={<><Seo {...seo.notFound} /><NotFound lang={lang} /></>} />
    </Routes>
  );
}
