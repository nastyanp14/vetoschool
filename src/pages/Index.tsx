import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Lang } from '../lib/i18n';
import { bootstrapAuth, getCurrentUser, homePathForUser, subscribeAuth } from '../lib/auth';
import Navbar from '../components/Navbar';
import Home from './Home';
import Pricing from './Pricing';
import CheckoutPlaceholder from './CheckoutPlaceholder';
import PaymentResult from './PaymentResult';
import Login from './Login';
import Register from './Register';
import CheckEmail from './CheckEmail';
import AuthCallback from './AuthCallback';
import EmailConfirmed from './EmailConfirmed';
import AuthLinkExpired from './AuthLinkExpired';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import AccountSecurity from './AccountSecurity';
import Dashboard from './Dashboard';
import Admin from './Admin';
import TeacherDashboard from './TeacherDashboard';
import Analytics from './Analytics';
import CookiePolicy from './CookiePolicy';
import PrivacyPolicy from './PrivacyPolicy';
import TrialBooking from './TrialBooking';
import NotFound from './NotFound';
import { Seo, homeSchoolSchema } from '../components/Seo';
import CookieConsentBanner from '../components/CookieConsentBanner';
import CookiePreferencesModal from '../components/CookiePreferencesModal';

const seo = routeMeta;


function ProtectedRoute({
  children,
  role,
}: {
  children: JSX.Element;
  role?: 'admin' | 'teacher' | 'student';
}) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailConfirmed) return <Navigate to={`/auth/check-email?email=${encodeURIComponent(user.email)}`} replace />;
  if (role && user.role !== role) return <Navigate to={homePathForUser(user)} replace />;
  return children;
}

export default function Index() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('vetoschool_lang') as Lang | null : null;
    return saved || 'ru';
  });
  const [, force] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrapAuth().finally(() => setReady(true));
    const unsub = subscribeAuth(() => force(n => n + 1));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('vetoschool_lang', lang);
  }, [lang]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#FFF0F6,#F5F0FF,#F0F8FF)' }}>
        <div className="text-4xl animate-pulse">✨</div>
      </div>
    );
  }

  return (
    <>
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
        <Route path="/pending-activation" element={<><Seo title="Pending Activation | Vetoschool" description="Vetoschool paid access pending activation." path="/pending-activation" noindex /><ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute></>} />
        <Route path="/account/security" element={<><Seo title="Account Security | Vetoschool" description="Manage Vetoschool account security." path="/account/security" noindex /><ProtectedRoute><AccountSecurity lang={lang} /></ProtectedRoute></>} />
        <Route path="/dashboard" element={<><Seo {...seo.dashboard} /><ProtectedRoute role="student"><Dashboard lang={lang} /></ProtectedRoute></>} />
        <Route path="/admin" element={<><Seo {...seo.admin} /><ProtectedRoute role="admin"><Admin lang={lang} setLang={setLang} /></ProtectedRoute></>} />
        <Route path="/teacher" element={<><Seo {...seo.teacher} /><ProtectedRoute role="teacher"><TeacherDashboard lang={lang} setLang={setLang} /></ProtectedRoute></>} />
        <Route path="/teacher/groups/:groupId" element={<><Seo {...seo.teacher} /><ProtectedRoute role="teacher"><TeacherDashboard lang={lang} setLang={setLang} mode="group" /></ProtectedRoute></>} />
        <Route path="/teacher/students/:studentId" element={<><Seo {...seo.teacher} /><ProtectedRoute role="teacher"><TeacherDashboard lang={lang} setLang={setLang} mode="student" /></ProtectedRoute></>} />
        <Route path="/analytics/:userId" element={<><Seo {...seo.analytics} /><ProtectedRoute role="admin"><Analytics lang={lang} setLang={setLang} /></ProtectedRoute></>} />
        <Route path="/cookie-policy" element={<><Seo {...seo.cookiePolicy} /><Navbar lang={lang} setLang={setLang} /><CookiePolicy lang={lang} /></>} />
        <Route path="/privacy-policy" element={<><Seo {...seo.privacyPolicy} /><Navbar lang={lang} setLang={setLang} /><PrivacyPolicy lang={lang} /></>} />
        <Route path="/trial-booking" element={<><Seo {...seo.trialBooking} /><Navbar lang={lang} setLang={setLang} /><TrialBooking lang={lang} /></>} />
        <Route path="/pricing" element={<><Seo {...seo.pricing} /><Navbar lang={lang} setLang={setLang} /><Pricing lang={lang} /></>} />
        <Route path="/checkout/:planId" element={<><Seo {...seo.checkout} /><Navbar lang={lang} setLang={setLang} /><CheckoutPlaceholder lang={lang} /></>} />
        <Route path="/payment/success" element={<><Seo {...seo.paymentSuccess} /><Navbar lang={lang} setLang={setLang} /><PaymentResult lang={lang} variant="success" /></>} />
        <Route path="/payment/cancel" element={<><Seo {...seo.paymentCancel} /><Navbar lang={lang} setLang={setLang} /><PaymentResult lang={lang} variant="cancel" /></>} />
        <Route path="*" element={<><Seo {...seo.notFound} /><NotFound lang={lang} /></>} />
      </Routes>
      <CookieConsentBanner lang={lang} />
      <CookiePreferencesModal lang={lang} />
    </>
  );
}
