import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet, cacheClear, subscribe } from './storage';
import { safeRedirectPath } from './authRedirects';

export type Role = 'admin' | 'student';
export type PaymentStatus = 'unpaid' | 'pending_review' | 'paid' | 'refunded';
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
}

type AuthResult<T = undefined> = Promise<{ success: boolean; data?: T; error?: string }>;

const ME_KEY = 'me';
const USERS_KEY = 'users';

export const getCurrentUser = (): User | null => cacheGet<User>(ME_KEY) ?? null;
export const getUsers = (): User[] => cacheGet<User[]>(USERS_KEY) ?? [];
export const subscribeAuth = subscribe;
export { safeRedirectPath };

function redirectUrl(path: string) {
  return `${window.location.origin}${path}`;
}

function emailConfirmed(authUser: { email_confirmed_at?: string | null; confirmed_at?: string | null }) {
  return Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
}

function friendlyAuthError(message?: string) {
  const raw = message || 'Authentication failed';
  const lower = raw.toLowerCase();
  if (lower.includes('email not confirmed')) return 'Подтвердите email перед входом.';
  if (lower.includes('invalid login credentials')) return 'Неверный email или пароль.';
  if (lower.includes('user already registered')) return 'Аккаунт с этим email уже существует. Войдите или восстановите пароль.';
  if (lower.includes('rate limit')) return 'Слишком много запросов. Попробуйте позже.';
  if (lower.includes('same password')) return 'Новый пароль должен отличаться от текущего.';
  return raw;
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
    } as any, { onConflict: 'id', ignoreDuplicates: true });

  if (error) throw error;
}

async function loadCurrentUser(authUserId: string): Promise<User | null> {
  const [{ data: authData }, { data: profile }, { data: roles }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', authUserId),
  ]);

  if (!profile || !authData.user) return null;
  const role: Role = roles?.some(r => r.role === 'admin') ? 'admin' : 'student';
  const accessStatus = ((profile as any).access_status || (profile.has_access ? 'active' : 'pending')) as AccessStatus;
  const paymentStatus = ((profile as any).payment_status || (profile.has_access ? 'paid' : 'unpaid')) as PaymentStatus;

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
    avatarId: (profile as any).avatar_id ?? null,
  };
}

export async function loadAllUsers(): Promise<User[]> {
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  const roleMap = new Map<string, Role>();
  roles?.forEach(r => { if (r.role === 'admin') roleMap.set(r.user_id, 'admin'); });

  const list: User[] = (profiles || []).map((p: any) => {
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
}

export async function register(name: string, email: string, password: string): AuthResult<{ email: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const { error, data } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: redirectUrl('/auth/callback?next=/auth/confirmed'),
      data: { name: name.trim() },
    },
  });

  if (error) return { success: false, error: friendlyAuthError(error.message) };

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
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  return error ? { success: false, error: friendlyAuthError(error.message) } : { success: true };
}

export async function resendConfirmationEmail(email: string): AuthResult {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: { emailRedirectTo: redirectUrl('/auth/callback?next=/auth/confirmed') },
  });

  return error ? { success: false, error: friendlyAuthError(error.message) } : { success: true };
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

  return { success: true, data: { redirectTo: safeRedirectPath(next, me?.role === 'admin' ? '/admin' : '/dashboard') } };
}

export async function validateRecoverySession(): AuthResult {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const errorDescription = params.get('error_description') || hash.get('error_description');

  if (errorDescription) return { success: false, error: friendlyAuthError(errorDescription) };

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { success: false, error: friendlyAuthError(error.message) };
  }

  const { data } = await supabase.auth.getSession();
  return data.session ? { success: true } : { success: false, error: 'Ссылка восстановления недействительна или устарела.' };
}

export async function updatePassword(newPassword: string): AuthResult {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { success: false, error: 'Нужно снова войти в аккаунт.' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: friendlyAuthError(error.message) };
  return { success: true };
}

export async function logout() {
  await supabase.auth.signOut();
  cacheClear();
}

export async function setAccessStatus(userId: string, accessStatus: AccessStatus, paymentStatus?: PaymentStatus) {
  const patch: Record<string, string> = { access_status: accessStatus };
  if (paymentStatus) patch.payment_status = paymentStatus;

  const { error } = await supabase.from('profiles').update(patch as any).eq('id', userId);
  if (error) throw error;
  await loadAllUsers();
}

export async function setAccess(userId: string, hasAccess: boolean) {
  await setAccessStatus(userId, hasAccess ? 'active' : 'pending', hasAccess ? 'paid' : 'unpaid');
}

export const grantAccess = (id: string) => setAccess(id, true);
export const revokeAccess = (id: string) => setAccess(id, false);

export async function deleteUser(userId: string) {
  const { error } = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  });
  if (error) throw error;
  await loadAllUsers();
}
