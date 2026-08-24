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
  const { error } = await supabase.rpc('purchase_avatar', { _avatar_id: avatarId });
  if (error) throw new Error(error.message);
}

export async function equipAvatar(userId: string, avatarId: string | null) {
  const { error } = await supabase.rpc('equip_avatar', { _avatar_id: avatarId });
  if (error) throw new Error(error.message);
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
  await supabase.rpc('clear_star_celebration');
}


// ============== AVATAR CATALOG ==============
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AvatarDef {
  id: string;
  rarity: Rarity;
  cost: number;
  emoji: string;
  imageSrc?: string;
  /** Display name (English fallback); for UI we use rarity color + emoji */
  name: string;
}

export const AVATARS: AvatarDef[] = [
  // Common - 10 stars
  ...[
    ['c-flower', 24],
    ['c-strawberry', 13],
    ['c-cat', 5],
    ['c-dog', 23],
    ['c-15', 15],
    ['c-14', 14],
  ].map(([id, number]) => avatarDef(id, number, 'common', 10)),
  // Rare - 30 stars
  ...[
    ['r-bunny', 4],
    ['r-bear', 9],
    ['r-elephant', 25],
    ['r-giraffe', 1],
    ['r-monkey', 2],
    ['r-fox', 18],
    ['r-car', 17],
  ].map(([id, number]) => avatarDef(id, number, 'rare', 30)),
  // Epic - 60 stars
  ...[
    ['e-lion', 8],
    ['e-tiger', 16],
    ['e-koala', 7],
    ['e-elf', 10],
    ['e-6', 6],
    ['e-11', 11],
    ['e-12', 12],
  ].map(([id, number]) => avatarDef(id, number, 'epic', 60)),
  // Legendary - 100 stars
  ...[
    ['l-fairy', 21],
    ['l-princess', 22],
    ['l-hero', 19],
    ['l-prince', 3],
    ['l-20', 20],
  ].map(([id, number]) => avatarDef(id, number, 'legendary', 100)),
];

function avatarDef(id: string | number, number: string | number, rarity: Rarity, cost: number): AvatarDef {
  return {
    id: String(id),
    rarity,
    cost,
    emoji: '⭐',
    imageSrc: `/shop/avatars-round/avatar-${number}.png`,
    name: `Avatar ${number}`,
  };
}

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

/** Legacy compatibility - some old code may still call avatarUrl(). */
export function avatarUrl(a: AvatarDef): string { return a.imageSrc || ''; }
