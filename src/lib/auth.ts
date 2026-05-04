import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet, cacheClear, subscribe } from './storage';

export type Role = 'admin' | 'student';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  hasAccess: boolean;
  createdAt: string;
  joinedAt: string;
}

const ME_KEY = 'me';
const USERS_KEY = 'users';

export const getCurrentUser = (): User | null => cacheGet<User>(ME_KEY) ?? null;
export const getUsers = (): User[] => cacheGet<User[]>(USERS_KEY) ?? [];
export const subscribeAuth = subscribe;

async function loadCurrentUser(authUserId: string): Promise<User | null> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', authUserId),
  ]);
  if (!profile) return null;
  const role: Role = roles?.some(r => r.role === 'admin') ? 'admin' : 'student';
  return {
    id: profile.id,
    name: profile.name || profile.email.split('@')[0],
    email: profile.email,
    role,
    hasAccess: profile.has_access,
    createdAt: profile.created_at,
    joinedAt: profile.created_at,
  };
}

export async function loadAllUsers(): Promise<User[]> {
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role'),
  ]);
  const roleMap = new Map<string, Role>();
  roles?.forEach(r => { if (r.role === 'admin') roleMap.set(r.user_id, 'admin'); });
  const list: User[] = (profiles || []).map(p => ({
    id: p.id,
    name: p.name || p.email.split('@')[0],
    email: p.email,
    role: roleMap.get(p.id) || 'student',
    hasAccess: p.has_access,
    createdAt: p.created_at,
    joinedAt: p.created_at,
  }));
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
  // defer to avoid deadlock
  setTimeout(async () => {
    const me = await loadCurrentUser(session.user.id);
    cacheSet(ME_KEY, me);
    if (me?.role === 'admin') await loadAllUsers();
  }, 0);
});

// ---- mutations ----
export async function login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { success: false, error: error?.message || 'Login failed' };
  const me = await loadCurrentUser(data.user.id);
  cacheSet(ME_KEY, me);
  if (me?.role === 'admin') await loadAllUsers();
  return { success: true, user: me || undefined };
}

export async function register(name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const { error, data } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { name } },
  });
  if (error) return { success: false, error: error.message };
  if (data.session) {
    const me = await loadCurrentUser(data.user!.id);
    cacheSet(ME_KEY, me);
  }
  return { success: true };
}

export async function logout() {
  await supabase.auth.signOut();
  cacheClear();
}

export async function setAccess(userId: string, hasAccess: boolean) {
  const { error } = await supabase.from('profiles').update({ has_access: hasAccess }).eq('id', userId);
  if (error) throw error;
  await loadAllUsers();
}
export const grantAccess = (id: string) => setAccess(id, true);
export const revokeAccess = (id: string) => setAccess(id, false);

export async function deleteUser(userId: string) {
  // Full deletion requires service role — handled by edge function which removes
  // app data and the auth.users row so credentials/JWTs are invalidated.
  const { error } = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  });
  if (error) throw error;
  await loadAllUsers();
}
