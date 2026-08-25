import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet, cacheClear, subscribe } from './storage';
import { safeRedirectPath } from './authRedirects';

export type Role = 'admin' | 'teacher' | 'student';
export type PaymentStatus = 'unpaid' | 'pending_review' | 'paid' | 'refunded' | 'failed';
export type AccessStatus = 'pending' | 'active' | 'suspended' | 'cancelled';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  hasAccess: boolean;
  paymentStatus: PaymentStatus;
  accessStatus: AccessStatus;
  emailConfirmed: boolean;
  createdAt: string;
  joinedAt: string;
  avatarId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  subscriptionStatus?: string | null;
  planId?: string | null;
  lessonFormat?: string | null;
  lessonsTotal?: number;
  lessonsRemaining?: number;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextPaymentDate?: string | null;
  paymentFailedAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  manualAccessOverride?: boolean;
  manualAccessOverrideBy?: string | null;
  manualAccessOverrideAt?: string | null;
  manualAccessOverrideReason?: string | null;
}

type AuthResult<T = undefined> = Promise<{ success: boolean; data?: T; error?: string }>;
type AuthStep =
  | 'initialize_profile'
  | 'load_profile'
  | 'load_roles'
  | 'load_auth_user'
  | 'confirm_email'
  | 'password_recovery'
  | 'password_update'
  | 'login';

const ME_KEY = 'me';
const USERS_KEY = 'users';

export const getCurrentUser = (): User | null => cacheGet<User>(ME_KEY) ?? null;
export const getUsers = (): User[] => cacheGet<User[]>(USERS_KEY) ?? [];
export const subscribeAuth = subscribe;
export { safeRedirectPath };

export function homePathForUser(user?: User | null) {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'teacher') return '/teacher';
  return user ? '/dashboard' : '/';
}

function redirectUrl(path: string) {
  const publicOrigin =
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)
    || (import.meta.env.VITE_SITE_URL as string | undefined)
    || window.location.origin;
  return `${publicOrigin.replace(/\/+$/, '')}${path}`;
}

function emailConfirmed(authUser: { email_confirmed_at?: string | null; confirmed_at?: string | null }) {
  return Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
}

function friendlyAuthError(message?: string) {
  const raw = message || 'Authentication failed';
  const lower = raw.toLowerCase();
  if (
    lower.includes('unsupported provider') ||
    lower.includes('missing oauth secret') ||
    lower.includes('provider is not enabled')
  ) {
    return 'Google-вход ещё не настроен. Добавьте Client ID и Client Secret в Supabase → Authentication → Providers → Google.';
  }
  if (lower.includes('email not confirmed')) return 'Подтвердите email перед входом.';
  if (lower.includes('invalid login credentials')) return 'Неверный email или пароль.';
  if (lower.includes('user already registered')) return 'Аккаунт с этим email уже существует. Войдите или восстановите пароль.';
  if (lower.includes('rate limit')) return 'Слишком много запросов. Попробуйте позже.';
  if (lower.includes('same password')) return 'Новый пароль должен отличаться от текущего.';
  if (lower.includes('permission denied')) return 'Аккаунт подтверждён, но профиль пока недоступен. Обновите страницу или войдите ещё раз.';
  return raw;
}

function authErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const err = error as { message?: string; error?: string; details?: string; hint?: string; code?: string };
  return err.error || err.message || err.details || err.hint || fallback;
}

function logAuthDiagnostics(step: AuthStep, details: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  const sanitized = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/token|password|secret|key/i.test(key)),
  );
  console.info(`[auth:${step}]`, sanitized);
}

export function friendlyActionError(error: unknown) {
  if (!error) return 'Действие не выполнено. Попробуйте ещё раз.';
  if (typeof error === 'string') return friendlyAuthError(error);

  const err = error as { message?: string; error?: string; details?: string; hint?: string; code?: string };
  const message = err.error || err.message || err.details || 'Действие не выполнено. Попробуйте ещё раз.';
  return friendlyAuthError(message);
}

function isMissingAccessStatusColumns(error: unknown) {
  const err = error as { message?: string; details?: string; hint?: string; code?: string };
  const text = `${err?.code || ''} ${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();
  return (
    text.includes('access_status') ||
    text.includes('payment_status') ||
    text.includes('manual_access_override') ||
    text.includes('schema cache') ||
    text.includes('pgrst204') ||
    text.includes('42703')
  );
}

function profileNameFromEmail(email: string) {
  return email.split('@')[0] || 'Student';
}

async function initializeProfile(authUserId: string, email: string, name?: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = (name || '').trim() || profileNameFromEmail(normalizedEmail);

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: authUserId,
      email: normalizedEmail,
      name: displayName,
      payment_status: 'unpaid',
      access_status: 'pending',
      has_access: false,
    }, { onConflict: 'id', ignoreDuplicates: true });

  if (!error) return;
  if (!isMissingAccessStatusColumns(error)) throw error;

  const { error: legacyError } = await supabase
    .from('profiles')
    .upsert({
      id: authUserId,
      email: normalizedEmail,
      name: displayName,
      has_access: false,
    }, { onConflict: 'id', ignoreDuplicates: true });

  if (legacyError) throw legacyError;
}

async function loadCurrentUser(authUserId: string): Promise<User | null> {
  const [authResult, profileResult, rolesResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', authUserId),
  ]);
  const { data: authData, error: authError } = authResult;
  const { data: profile, error: profileError } = profileResult;
  const { data: roles, error: rolesError } = rolesResult;

  if (authError) {
    logAuthDiagnostics('load_auth_user', { message: authError.message });
    throw authError;
  }
  if (profileError) {
    logAuthDiagnostics('load_profile', { code: profileError.code, message: profileError.message });
    throw profileError;
  }
  if (rolesError) {
    logAuthDiagnostics('load_roles', { code: rolesError.code, message: rolesError.message });
    throw rolesError;
  }

  if (!profile || !authData.user) return null;
  const role: Role = roles?.some(r => r.role === 'admin') ? 'admin' : roles?.some(r => r.role === 'teacher') ? 'teacher' : 'student';
  const accessStatus = (profile.access_status || (profile.has_access ? 'active' : 'pending')) as AccessStatus;
  const paymentStatus = (profile.payment_status || (profile.has_access ? 'paid' : 'unpaid')) as PaymentStatus;

  return {
    id: profile.id,
    name: profile.name || profile.email.split('@')[0],
    email: profile.email,
    role,
    hasAccess: accessStatus === 'active',
    paymentStatus,
    accessStatus,
    emailConfirmed: emailConfirmed(authData.user),
    createdAt: profile.created_at,
    joinedAt: profile.created_at,
    avatarId: profile.avatar_id ?? null,
    stripeCustomerId: profile.stripe_customer_id ?? null,
    stripeSubscriptionId: profile.stripe_subscription_id ?? null,
    stripePriceId: profile.stripe_price_id ?? null,
    subscriptionStatus: profile.subscription_status ?? null,
    planId: profile.plan_id ?? null,
    lessonFormat: profile.lesson_format ?? null,
    lessonsTotal: profile.lessons_total ?? 0,
    lessonsRemaining: profile.lessons_remaining ?? 0,
    currentPeriodStart: profile.current_period_start ?? null,
    currentPeriodEnd: profile.current_period_end ?? null,
    nextPaymentDate: profile.next_payment_date ?? null,
    paymentFailedAt: profile.payment_failed_at ?? null,
    cancelAtPeriodEnd: profile.cancel_at_period_end ?? false,
    canceledAt: profile.canceled_at ?? null,
    manualAccessOverride: profile.manual_access_override ?? false,
    manualAccessOverrideBy: profile.manual_access_override_by ?? null,
    manualAccessOverrideAt: profile.manual_access_override_at ?? null,
    manualAccessOverrideReason: profile.manual_access_override_reason ?? null,
  };
}

export async function loadAllUsers(): Promise<User[]> {
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  const roleMap = new Map<string, Role>();
  roles?.forEach(r => {
    if (r.role === 'admin') roleMap.set(r.user_id, 'admin');
    else if (r.role === 'teacher' && roleMap.get(r.user_id) !== 'admin') roleMap.set(r.user_id, 'teacher');
  });

  const list: User[] = (profiles || []).map(p => {
    const accessStatus = (p.access_status || (p.has_access ? 'active' : 'pending')) as AccessStatus;
    const paymentStatus = (p.payment_status || (p.has_access ? 'paid' : 'unpaid')) as PaymentStatus;
    return {
      id: p.id,
      name: p.name || p.email.split('@')[0],
      email: p.email,
      role: roleMap.get(p.id) || 'student',
      hasAccess: accessStatus === 'active',
      paymentStatus,
      accessStatus,
      emailConfirmed: true,
      createdAt: p.created_at,
      joinedAt: p.created_at,
      avatarId: p.avatar_id ?? null,
      stripeCustomerId: p.stripe_customer_id ?? null,
      stripeSubscriptionId: p.stripe_subscription_id ?? null,
      stripePriceId: p.stripe_price_id ?? null,
      subscriptionStatus: p.subscription_status ?? null,
      planId: p.plan_id ?? null,
      lessonFormat: p.lesson_format ?? null,
      lessonsTotal: p.lessons_total ?? 0,
      lessonsRemaining: p.lessons_remaining ?? 0,
      currentPeriodStart: p.current_period_start ?? null,
      currentPeriodEnd: p.current_period_end ?? null,
      nextPaymentDate: p.next_payment_date ?? null,
      paymentFailedAt: p.payment_failed_at ?? null,
      cancelAtPeriodEnd: p.cancel_at_period_end ?? false,
      canceledAt: p.canceled_at ?? null,
      manualAccessOverride: p.manual_access_override ?? false,
      manualAccessOverrideBy: p.manual_access_override_by ?? null,
      manualAccessOverrideAt: p.manual_access_override_at ?? null,
      manualAccessOverrideReason: p.manual_access_override_reason ?? null,
    };
  });

  cacheSet(USERS_KEY, list);
  return list;
}

export async function bootstrapAuth() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    const me = await loadCurrentUser(data.session.user.id);
    cacheSet(ME_KEY, me);
    if (me?.role === 'admin') await loadAllUsers();
  } else {
    cacheSet(ME_KEY, null);
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session?.user) {
    cacheClear();
    return;
  }

  setTimeout(async () => {
    try {
      const me = await loadCurrentUser(session.user.id);
      cacheSet(ME_KEY, me);
      if (me?.role === 'admin') await loadAllUsers();
    } catch {
      cacheSet(ME_KEY, null);
    }
  }, 0);
});

export async function login(email: string, password: string): AuthResult<User> {
  try {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { success: false, error: friendlyAuthError(error?.message) };
    if (!emailConfirmed(data.user)) {
      await supabase.auth.signOut();
      cacheClear();
      return { success: false, error: 'Подтвердите email перед входом.' };
    }

    const me = await loadCurrentUser(data.user.id);
    cacheSet(ME_KEY, me);
    if (me?.role === 'admin') await loadAllUsers();
    return { success: true, data: me || undefined };
  } catch (error) {
    logAuthDiagnostics('login', { message: authErrorMessage(error, 'Login failed') });
    return { success: false, error: friendlyAuthError(authErrorMessage(error, 'Login failed')) };
  }
}

export async function register(name: string, email: string, password: string, lang: 'ru' | 'ua' | 'en' = 'ru'): AuthResult<{ email: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const { error, data } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: redirectUrl('/auth/callback?next=/auth/confirmed'),
      // lang lands in profiles.lang via handle_new_user and drives the email language.
      data: { name: name.trim(), lang },
    },
  });

  if (error) return { success: false, error: friendlyAuthError(error.message) };

  markEmailOtpSent(normalizedEmail);


  if (data.user && data.session) {
    try {
      await initializeProfile(data.user.id, normalizedEmail, name);
    } finally {
      await supabase.auth.signOut();
      cacheClear();
    }
  }

  return { success: true, data: { email: normalizedEmail } };
}

export async function signInWithGoogle(next = '/dashboard'): AuthResult {
  const redirectTo = redirectUrl(`/auth/callback?next=${encodeURIComponent(safeRedirectPath(next))}`);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    } as any,
  });

  if (error) return { success: false, error: friendlyAuthError(error.message) };
  const url = data?.url;
  if (!url) return { success: false, error: 'Google-вход сейчас недоступен. OAuth URL не был создан.' };

  try {
    const response = await fetch(url, { method: 'GET', redirect: 'manual' });
    const contentType = response.headers.get('Content-Type') || '';
    if (response.status >= 400 && contentType.includes('application/json')) {
      const detail = await response.json().catch(() => null) as { msg?: string; error?: string; error_description?: string } | null;
      return { success: false, error: friendlyAuthError(detail?.msg || detail?.error_description || detail?.error || `Google OAuth failed (${response.status})`) };
    }
    if (response.status >= 400) {
      return { success: false, error: friendlyAuthError(`Google OAuth failed (${response.status})`) };
    }
  } catch {
    // If the provider is correctly configured, some browsers may block this preflight.
    // Continue with the normal OAuth redirect in that case.
  }

  window.location.assign(url);
  return { success: true };
}

export async function resendConfirmationEmail(email: string): AuthResult {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: { emailRedirectTo: redirectUrl('/auth/callback?next=/auth/confirmed') },
  });

  if (error) return { success: false, error: friendlyAuthError(error.message) };
  markEmailOtpSent(normalizedEmail);
  return { success: true };

}

export const EMAIL_OTP_TTL_SECONDS = 600;

const OTP_SENT_KEY = 'vs_otp_sent_at';

export function markEmailOtpSent(email: string) {
  try {
    localStorage.setItem(OTP_SENT_KEY, JSON.stringify({ email: email.trim().toLowerCase(), at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

function isEmailOtpExpiredLocally(email: string): boolean {
  try {
    const raw = localStorage.getItem(OTP_SENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { email?: string; at?: number };
    if (parsed?.email !== email || typeof parsed.at !== 'number') return false;
    return Date.now() - parsed.at > EMAIL_OTP_TTL_SECONDS * 1000;
  } catch {
    return false;
  }
}

export async function confirmEmailCode(email: string, token: string): AuthResult<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanToken = token.trim().replace(/\s+/g, '');

  // Product rule: codes are valid for 10 minutes. The backend always validates the
  // code itself; this check only enforces our shorter UX window.
  if (isEmailOtpExpiredLocally(normalizedEmail)) {
    return { success: false, error: friendlyAuthError('Email link is invalid or has expired') };
  }


  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: cleanToken,
      type: 'signup',
    });

    logAuthDiagnostics('confirm_email', {
      hasUser: Boolean(data.user),
      hasSession: Boolean(data.session),
      message: error?.message,
    });

    if (error || !data.user) return { success: false, error: friendlyAuthError(error?.message || 'Invalid confirmation code') };

    try {
      await initializeProfile(
        data.user.id,
        data.user.email || normalizedEmail,
        (data.user.user_metadata?.name || data.user.user_metadata?.full_name) as string | undefined,
      );
    } catch (profileError) {
      logAuthDiagnostics('initialize_profile', {
        message: authErrorMessage(profileError, 'Profile initialization failed'),
      });
    }

    const me = await loadCurrentUser(data.user.id);
    if (!me) return { success: false, error: 'Email подтверждён, но профиль ещё создаётся. Обновите страницу или войдите ещё раз.' };
    cacheSet(ME_KEY, me);
    if (me?.role === 'admin') await loadAllUsers();
    return { success: true, data: me };
  } catch (error) {
    logAuthDiagnostics('confirm_email', { message: authErrorMessage(error, 'Email confirmation failed') });
    return { success: false, error: friendlyAuthError(authErrorMessage(error, 'Email confirmation failed')) };
  }
}

export async function requestPasswordReset(email: string): AuthResult {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: redirectUrl('/reset-password'),
  });

  if (error) return { success: false, error: friendlyAuthError(error.message) };
  return { success: true };
}

export async function completeAuthCallback(next?: string | null): AuthResult<{ redirectTo: string }> {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('code');
  const errorDescription = params.get('error_description') || hash.get('error_description');

  if (errorDescription) {
    return { success: false, error: friendlyAuthError(errorDescription) };
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { success: false, error: friendlyAuthError(error.message) };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { success: false, error: friendlyAuthError(error?.message || 'Invalid or expired auth link') };

  await initializeProfile(
    data.user.id,
    data.user.email || '',
    (data.user.user_metadata?.name || data.user.user_metadata?.full_name) as string | undefined,
  );

  const me = await loadCurrentUser(data.user.id);
  cacheSet(ME_KEY, me);
  if (me?.role === 'admin') await loadAllUsers();

  return { success: true, data: { redirectTo: safeRedirectPath(next, homePathForUser(me)) } };
}

export async function validateRecoverySession(): AuthResult {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const errorDescription = params.get('error_description') || hash.get('error_description');

  if (errorDescription) return { success: false, error: friendlyAuthError(errorDescription) };

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { success: false, error: friendlyAuthError(error.message) };
    }

    const { data, error } = await supabase.auth.getSession();
    logAuthDiagnostics('password_recovery', {
      hasSession: Boolean(data.session),
      message: error?.message,
    });
    if (error) return { success: false, error: friendlyAuthError(error.message) };
    return data.session ? { success: true } : { success: false, error: 'Ссылка восстановления недействительна или устарела.' };
  } catch (error) {
    logAuthDiagnostics('password_recovery', { message: authErrorMessage(error, 'Password recovery failed') });
    return { success: false, error: friendlyAuthError(authErrorMessage(error, 'Password recovery failed')) };
  }
}

export async function updatePassword(newPassword: string): AuthResult {
  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return { success: false, error: friendlyAuthError(sessionError.message) };
    if (!data.session) return { success: false, error: 'Ссылка восстановления недействительна или устарела. Запросите новое письмо.' };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    logAuthDiagnostics('password_update', { message: error?.message, hasSession: Boolean(data.session) });
    if (error) return { success: false, error: friendlyAuthError(error.message) };
    return { success: true };
  } catch (error) {
    logAuthDiagnostics('password_update', { message: authErrorMessage(error, 'Could not update password') });
    return { success: false, error: friendlyAuthError(authErrorMessage(error, 'Could not update password')) };
  }
}

export async function logout() {
  await supabase.auth.signOut();
  cacheClear();
}

export async function setAccessStatus(userId: string, accessStatus: AccessStatus, paymentStatus?: PaymentStatus) {
  const { data: sessionData } = await supabase.auth.getSession();
  const patch: {
    access_status: AccessStatus;
    payment_status?: PaymentStatus;
    manual_access_override?: boolean;
    manual_access_override_by?: string | null;
    manual_access_override_at?: string | null;
  } = {
    access_status: accessStatus,
    manual_access_override: accessStatus === 'active',
    manual_access_override_by: sessionData.session?.user.id ?? null,
    manual_access_override_at: new Date().toISOString(),
  };
  if (paymentStatus) patch.payment_status = paymentStatus;
  if (accessStatus !== 'active') {
    patch.manual_access_override = false;
    patch.manual_access_override_by = null;
    patch.manual_access_override_at = null;
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) {
    if (!isMissingAccessStatusColumns(error)) throw error;

    const isLegacyGrant = accessStatus === 'active' && (!paymentStatus || paymentStatus === 'paid');
    const isLegacyClose = accessStatus === 'pending' && (!paymentStatus || paymentStatus === 'unpaid');
    const isLegacyBlock = (accessStatus === 'suspended' || accessStatus === 'cancelled') && !paymentStatus;

    if (!isLegacyGrant && !isLegacyClose && !isLegacyBlock) {
      throw new Error('В базе ещё нет новых полей payment_status/access_status. Примените миграцию 20260719013000_secure_auth_access_status.sql, чтобы менять все статусы.');
    }

    const { error: legacyError } = await supabase
      .from('profiles')
      .update({ has_access: accessStatus === 'active' })
      .eq('id', userId);

    if (legacyError) throw legacyError;
  }
  await loadAllUsers();
}

function isMissingManualAccessAudit(error: unknown) {
  const err = error as { message?: string; details?: string; hint?: string; code?: string };
  const text = `${err?.code || ''} ${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();
  return text.includes('manual_access_overrides') || text.includes('schema cache') || text.includes('pgrst204') || text.includes('42p01') || text.includes('42703');
}

function hasActiveStripeAccess(profile: {
  payment_status?: string | null;
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}) {
  return Boolean(
    profile.payment_status === 'paid'
    && profile.stripe_customer_id
    && profile.stripe_subscription_id
    && (profile.subscription_status === 'active' || profile.subscription_status === 'trialing'),
  );
}

export async function setManualAccessOverride(userId: string, enabled: boolean, reason: string) {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 8) throw new Error('Укажите причину ручного доступа минимум 8 символов.');

  const { data: sessionData } = await supabase.auth.getSession();
  const adminId = sessionData.session?.user.id ?? null;
  if (!adminId) throw new Error('Нужно снова войти в аккаунт администратора.');

  const { data: current, error: loadError } = await (supabase as any)
    .from('profiles')
    .select('payment_status,subscription_status,stripe_customer_id,stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  if (loadError) throw loadError;

  const keepStripeAccess = !enabled && current && hasActiveStripeAccess(current);
  const now = new Date().toISOString();
  const patch = enabled
    ? {
      access_status: 'active' as AccessStatus,
      has_access: true,
      manual_access_override: true,
      manual_access_override_by: adminId,
      manual_access_override_at: now,
      manual_access_override_reason: normalizedReason,
    }
    : {
      access_status: keepStripeAccess ? 'active' as AccessStatus : 'pending' as AccessStatus,
      has_access: keepStripeAccess,
      manual_access_override: false,
      manual_access_override_by: null,
      manual_access_override_at: null,
      manual_access_override_reason: normalizedReason,
    };

  const { error } = await (supabase as any).from('profiles').update(patch).eq('id', userId);
  if (error) {
    if (!isMissingAccessStatusColumns(error)) throw error;
    throw new Error('В базе ещё нет полей ручного доступа. Pending migration: 20260802090000_manual_access_override_audit.sql.');
  }

  const { error: auditError } = await (supabase as any).from('manual_access_overrides').insert({
    student_id: userId,
    admin_id: adminId,
    action: enabled ? 'enabled' : 'disabled',
    reason: normalizedReason,
    created_at: now,
  });
  if (auditError && !isMissingManualAccessAudit(auditError)) throw auditError;

  await loadAllUsers();
}

export async function setAccess(userId: string, hasAccess: boolean) {
  await setAccessStatus(userId, hasAccess ? 'active' : 'pending', hasAccess ? 'paid' : 'unpaid');
}

export const grantAccess = (id: string) => setAccess(id, true);
export const revokeAccess = (id: string) => setAccess(id, false);

export async function deleteUser(userId: string) {
  const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>('admin-delete-user', {
    body: { userId },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const body = await context.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error || error.message);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  await loadAllUsers();
}
