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

export async function clearCelebration(userId: string) {
  await supabase.from('profiles').update({ pending_celebration: 0 }).eq('id', userId);
}

// ============== AVATAR CATALOG (DiceBear) ==============
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AvatarDef {
  id: string;
  rarity: Rarity;
  cost: number;
  style: string;
  seed: string;
}

export const AVATARS: AvatarDef[] = [
  // Common (5) — 10★
  { id: 'c1', rarity: 'common', cost: 10, style: 'adventurer', seed: 'Luna' },
  { id: 'c2', rarity: 'common', cost: 10, style: 'adventurer', seed: 'Max' },
  { id: 'c3', rarity: 'common', cost: 10, style: 'big-smile', seed: 'Sunny' },
  { id: 'c4', rarity: 'common', cost: 10, style: 'big-smile', seed: 'Pip' },
  { id: 'c5', rarity: 'common', cost: 10, style: 'fun-emoji', seed: 'Star' },
  // Rare (6) — 30★
  { id: 'r1', rarity: 'rare', cost: 30, style: 'avataaars', seed: 'Hero' },
  { id: 'r2', rarity: 'rare', cost: 30, style: 'avataaars', seed: 'Magic' },
  { id: 'r3', rarity: 'rare', cost: 30, style: 'lorelei', seed: 'Aurora' },
  { id: 'r4', rarity: 'rare', cost: 30, style: 'lorelei', seed: 'Nova' },
  { id: 'r5', rarity: 'rare', cost: 30, style: 'micah', seed: 'Rio' },
  { id: 'r6', rarity: 'rare', cost: 30, style: 'micah', seed: 'Zen' },
  // Epic (5) — 70★
  { id: 'e1', rarity: 'epic', cost: 70, style: 'bottts', seed: 'RoboPink' },
  { id: 'e2', rarity: 'epic', cost: 70, style: 'bottts', seed: 'RoboBlue' },
  { id: 'e3', rarity: 'epic', cost: 70, style: 'bottts-neutral', seed: 'Cyber' },
  { id: 'e4', rarity: 'epic', cost: 70, style: 'pixel-art', seed: 'Pixie' },
  { id: 'e5', rarity: 'epic', cost: 70, style: 'pixel-art', seed: 'Knight' },
  // Legendary (3) — 150★
  { id: 'l1', rarity: 'legendary', cost: 150, style: 'lorelei', seed: 'Phoenix' },
  { id: 'l2', rarity: 'legendary', cost: 150, style: 'bottts', seed: 'GalaxyKing' },
  { id: 'l3', rarity: 'legendary', cost: 150, style: 'adventurer', seed: 'Unicorn' },
];

export function avatarUrl(a: AvatarDef): string {
  return `https://api.dicebear.com/7.x/${a.style}/svg?seed=${encodeURIComponent(a.seed)}&backgroundType=gradientLinear`;
}

export function findAvatar(id: string | null | undefined): AvatarDef | undefined {
  if (!id) return undefined;
  return AVATARS.find(a => a.id === id);
}
