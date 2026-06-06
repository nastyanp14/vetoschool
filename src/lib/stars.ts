import { supabase } from '@/integrations/supabase/client';

export interface StarProfile {
  starBalance: number;
  totalEarned: number;
  pendingCelebration: number;
  avatarId: string | null;
}

export async function loadStarProfile(userId: string): Promise<StarProfile> {
  const { data } = await supabase
    .from('profiles')
    .select('star_balance, total_stars_earned, pending_celebration, avatar_id')
    .eq('id', userId)
    .maybeSingle();
  return {
    starBalance: data?.star_balance ?? 0,
    totalEarned: data?.total_stars_earned ?? 0,
    pendingCelebration: data?.pending_celebration ?? 0,
    avatarId: data?.avatar_id ?? null,
  };
}

export async function loadPurchases(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('avatar_purchases')
    .select('avatar_id')
    .eq('user_id', userId);
  return (data || []).map(r => r.avatar_id);
}

export async function purchaseAvatar(userId: string, avatarId: string, cost: number, currentBalance: number) {
  if (currentBalance < cost) throw new Error('Not enough stars');
  await supabase.from('avatar_purchases').insert({ user_id: userId, avatar_id: avatarId });
  await supabase.from('profiles').update({ star_balance: currentBalance - cost }).eq('id', userId);
}

export async function equipAvatar(userId: string, avatarId: string | null) {
  await supabase.from('profiles').update({ avatar_id: avatarId }).eq('id', userId);
}

export async function giftStars(userId: string, amount: number, currentBalance: number, currentTotal: number, currentPending: number) {
  await supabase.from('profiles').update({
    star_balance: currentBalance + amount,
    total_stars_earned: currentTotal + amount,
    pending_celebration: currentPending + amount,
  }).eq('id', userId);
}

/** Award N stars to a student (used for automatic +5★ on task grading). */
export async function awardStars(userId: string, amount: number) {
  const p = await loadStarProfile(userId);
  await giftStars(userId, amount, p.starBalance, p.totalEarned, p.pendingCelebration);
}

export async function clearCelebration(userId: string) {
  await supabase.from('profiles').update({ pending_celebration: 0 }).eq('id', userId);
}

// ============== AVATAR CATALOG (emoji-based, playful) ==============
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AvatarDef {
  id: string;
  rarity: Rarity;
  cost: number;
  emoji: string;
  /** Display name (English fallback); for UI we use rarity color + emoji */
  name: string;
}

export const AVATARS: AvatarDef[] = [
  // Common — 10★ (4)
  { id: 'c-flower',     rarity: 'common', cost: 10,  emoji: '🌸', name: 'Flower' },
  { id: 'c-strawberry', rarity: 'common', cost: 10,  emoji: '🍓', name: 'Strawberry' },
  { id: 'c-cat',        rarity: 'common', cost: 10,  emoji: '🐱', name: 'Cat' },
  { id: 'c-dog',        rarity: 'common', cost: 10,  emoji: '🐶', name: 'Dog' },
  // Rare — 30★ (7)
  { id: 'r-bunny',      rarity: 'rare',   cost: 30,  emoji: '🐰', name: 'Bunny' },
  { id: 'r-bear',       rarity: 'rare',   cost: 30,  emoji: '🐻', name: 'Bear' },
  { id: 'r-elephant',   rarity: 'rare',   cost: 30,  emoji: '🐘', name: 'Elephant' },
  { id: 'r-giraffe',    rarity: 'rare',   cost: 30,  emoji: '🦒', name: 'Giraffe' },
  { id: 'r-monkey',     rarity: 'rare',   cost: 30,  emoji: '🐵', name: 'Monkey' },
  { id: 'r-fox',        rarity: 'rare',   cost: 30,  emoji: '🦊', name: 'Fox' },
  { id: 'r-car',        rarity: 'rare',   cost: 30,  emoji: '🚗', name: 'Car' },
  // Epic — 60★ (4)
  { id: 'e-lion',       rarity: 'epic',   cost: 60,  emoji: '🦁', name: 'Lion' },
  { id: 'e-tiger',      rarity: 'epic',   cost: 60,  emoji: '🐯', name: 'Tiger' },
  { id: 'e-koala',      rarity: 'epic',   cost: 60,  emoji: '🐨', name: 'Koala' },
  { id: 'e-elf',        rarity: 'epic',   cost: 60,  emoji: '🧝', name: 'Elf' },
  // Legendary — 100★ (4)
  { id: 'l-fairy',      rarity: 'legendary', cost: 100, emoji: '🧚', name: 'Fairy' },
  { id: 'l-princess',   rarity: 'legendary', cost: 100, emoji: '👸', name: 'Princess' },
  { id: 'l-hero',       rarity: 'legendary', cost: 100, emoji: '🦸', name: 'Superhero' },
  { id: 'l-prince',     rarity: 'legendary', cost: 100, emoji: '🤴', name: 'Little Prince' },
];

/** Background gradient (game-style) per rarity */
export const RARITY_BG: Record<Rarity, string> = {
  common:    'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
  rare:      'linear-gradient(135deg, #60a5fa 0%, #22d3ee 100%)',
  epic:      'linear-gradient(135deg, #c084fc 0%, #f472b6 100%)',
  legendary: 'linear-gradient(135deg, #facc15 0%, #fb923c 50%, #ef4444 100%)',
};

export const RARITY_RING: Record<Rarity, string> = {
  common:    'ring-2 ring-slate-300',
  rare:      'ring-2 ring-blue-300',
  epic:      'ring-2 ring-purple-300',
  legendary: 'ring-4 ring-yellow-300 shadow-[0_0_25px_rgba(250,204,21,0.6)]',
};

export function findAvatar(id: string | null | undefined): AvatarDef | undefined {
  if (!id) return undefined;
  return AVATARS.find(a => a.id === id);
}

/** Legacy compatibility — some old code may still call avatarUrl(); return '' */
export function avatarUrl(_a: AvatarDef): string { return ''; }
