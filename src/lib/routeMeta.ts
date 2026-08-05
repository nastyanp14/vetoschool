export const SITE_URL = 'https://vetoschool.eu';

export type RouteMeta = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

export const routeMeta = {
  home: {
    title: 'Vetoschool | Online English School for Kids',
    description:
      'Vetoschool offers playful online English lessons for children ages 5-12 with interactive practice, homework, listening, and grammar.',
    path: '/',
  },
  login: {
    title: 'Login | Vetoschool',
    description: 'Sign in to the private Vetoschool learning account for students, teachers, and administrators.',
    path: '/login',
    noindex: true,
  },
  register: {
    title: 'Create an Account | Vetoschool',
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
  teacher: {
    title: 'Teacher Dashboard | Vetoschool',
    description: 'Private Vetoschool teacher area for assigned students, groups, schedules, and workload.',
    path: '/teacher',
    noindex: true,
  },
  analytics: {
    title: 'Student Analytics | Vetoschool',
    description: 'Private Vetoschool analytics page for reviewing individual student learning progress.',
    path: '/analytics',
    noindex: true,
  },
  cookiePolicy: {
    title: 'Cookie Policy | Vetoschool',
    description: 'How Vetoschool uses cookies, localStorage, and similar technologies, and how to manage consent.',
    path: '/cookie-policy',
  },
  privacyPolicy: {
    title: 'Privacy Policy | Vetoschool',
    description: 'How Vetoschool collects, uses, and protects users’ personal data.',
    path: '/privacy-policy',
  },
  trialBooking: {
    title: 'Book a Free Trial Lesson | Vetoschool',
    description:
      'Book a free Vetoschool trial lesson and get a friendly preliminary English level recommendation for your child.',
    path: '/trial-booking',
  },
  pricing: {
    title: 'Pricing | Vetoschool',
    description: 'Choose a Vetoschool group or individual English learning plan with full access to the learning platform.',
    path: '/pricing',
  },
  checkout: {
    title: 'Checkout | Vetoschool',
    description: 'Secure Vetoschool checkout page for completing your English course payment.',
    path: '/checkout',
    noindex: true,
  },
  paymentSuccess: {
    title: 'Payment Successful | Vetoschool',
    description: 'Your Vetoschool payment was completed successfully and your learning access is being activated.',
    path: '/payment/success',
    noindex: true,
  },
  paymentCancel: {
    title: 'Payment Canceled | Vetoschool',
    description: 'Your Vetoschool payment was canceled before completion. You can pick a plan and try again anytime.',
    path: '/payment/cancel',
    noindex: true,
  },
  checkEmail: {
    title: 'Check Your Email | Vetoschool',
    description: 'Confirm your Vetoschool email address with the code we just sent to finish creating your account.',
    path: '/auth/check-email',
    noindex: true,
  },
  authCallback: {
    title: 'Signing You In | Vetoschool',
    description: 'Completing your Vetoschool sign-in. This page finishes the secure authentication handshake.',
    path: '/auth/callback',
    noindex: true,
  },
  emailConfirmed: {
    title: 'Email Confirmed | Vetoschool',
    description: 'Your Vetoschool email address is confirmed and your learning account is ready to use.',
    path: '/auth/confirmed',
    noindex: true,
  },
  authLinkExpired: {
    title: 'Link Expired | Vetoschool',
    description: 'This Vetoschool authentication link has expired. Request a new one to continue signing in.',
    path: '/auth/link-expired',
    noindex: true,
  },
  forgotPassword: {
    title: 'Forgot Password | Vetoschool',
    description: 'Recover access to your Vetoschool account by requesting a secure password reset email.',
    path: '/forgot-password',
    noindex: true,
  },
  resetPassword: {
    title: 'Reset Password | Vetoschool',
    description: 'Choose a new password for your Vetoschool learning account and sign back in securely.',
    path: '/reset-password',
    noindex: true,
  },
  pendingActivation: {
    title: 'Pending Activation | Vetoschool',
    description: 'Your Vetoschool paid access is being activated. This page updates once your plan is ready.',
    path: '/pending-activation',
    noindex: true,
  },
  accountSecurity: {
    title: 'Account Security | Vetoschool',
    description: 'Manage your Vetoschool account security, password, and connected sign-in methods.',
    path: '/account/security',
    noindex: true,
  },
  notFound: {
    title: 'Page Not Found | Vetoschool',
    description: 'This Vetoschool page does not exist. Use the quick links to get back to the home page or sign in.',
    path: '/',
    noindex: true,
  },
} satisfies Record<string, RouteMeta>;

const STATIC_ROUTES: Record<string, RouteMeta> = {
  '/': routeMeta.home,
  '/login': routeMeta.login,
  '/register': routeMeta.register,
  '/auth/check-email': routeMeta.checkEmail,
  '/auth/callback': routeMeta.authCallback,
  '/auth/confirmed': routeMeta.emailConfirmed,
  '/auth/link-expired': routeMeta.authLinkExpired,
  '/forgot-password': routeMeta.forgotPassword,
  '/reset-password': routeMeta.resetPassword,
  '/pending-activation': routeMeta.pendingActivation,
  '/account/security': routeMeta.accountSecurity,
  '/dashboard': routeMeta.dashboard,
  '/admin': routeMeta.admin,
  '/teacher': routeMeta.teacher,
  '/cookie-policy': routeMeta.cookiePolicy,
  '/privacy-policy': routeMeta.privacyPolicy,
  '/trial-booking': routeMeta.trialBooking,
  '/pricing': routeMeta.pricing,
  '/payment/success': routeMeta.paymentSuccess,
  '/payment/cancel': routeMeta.paymentCancel,
};

/** Resolves head metadata for a pathname (used by the SPA and the edge worker). */
export function resolveRouteMeta(pathname: string): RouteMeta {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const exact = STATIC_ROUTES[normalized];
  if (exact) return exact;

  if (/^\/analytics\/[^/]+$/.test(normalized)) return routeMeta.analytics;
  if (/^\/checkout\/[^/]+$/.test(normalized)) return routeMeta.checkout;
  if (/^\/teacher\/(groups|students)\/[^/]+$/.test(normalized)) return routeMeta.teacher;

  return routeMeta.notFound;
}
