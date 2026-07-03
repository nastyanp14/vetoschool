import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lang, t } from '../lib/i18n';
import {
  AVATARS, AvatarDef, Rarity, RARITY_BG, RARITY_RING,
  equipAvatar, loadPurchases, loadStarProfile, purchaseAvatar,
} from '../lib/stars';

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

interface Props { userId: string; hasAccess: boolean; lang: Lang; onChange?: () => void; }

export default function AvatarShop({ userId, hasAccess, lang }: Props) {
  const [balance, setBalance] = useState(0);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [owned, setOwned] = useState<string[]>([]);
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const [p, list] = await Promise.all([loadStarProfile(userId), loadPurchases(userId)]);
    setBalance(p.starBalance);
    setEquipped(p.avatarId);
    setOwned(list);
  };
  useEffect(() => { if (userId) refresh(); }, [userId]);

  if (!hasAccess) {
    return (
      <div className="glass rounded-3xl p-10 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h3 className="font-display font-black text-2xl text-purple-700 mb-2">{t(lang, 'shop_locked_title')}</h3>
        <p className="font-body text-purple-500">{t(lang, 'shop_locked_desc')}</p>
      </div>
    );
  }

  const filtered = filter === 'all' ? AVATARS : AVATARS.filter(a => a.rarity === filter);

  const handleBuy = async (a: AvatarDef) => {
    if (balance < a.cost) return;
    setBusy(a.id);
    try { await purchaseAvatar(userId, a.id, a.cost, balance); await refresh(); }
    finally { setBusy(null); }
  };
  const handleEquip = async (a: AvatarDef) => {
    setBusy(a.id);
    try { await equipAvatar(userId, a.id); await refresh(); }
    finally { setBusy(null); }
  };
  const handleUnequip = async () => {
    setBusy('unequip');
    try { await equipAvatar(userId, null); await refresh(); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header / Balance */}
      <div className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #FF8DC7, #C8B3FF, #7EC8FF)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-display font-black text-3xl">{t(lang, 'shop_title')}</h2>
            <p className="font-body text-white/85 text-sm mt-1">{t(lang, 'shop_balance')}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-4xl">⭐</span>
              <span className="font-display font-black text-5xl">{balance}</span>
              <span className="font-body text-white/80">{t(lang, 'shop_stars')}</span>
            </div>
          </div>
          {equipped && (
            <button onClick={handleUnequip} disabled={busy === 'unequip'}
              className="bg-white/20 hover:bg-white/30 border-2 border-white rounded-2xl px-5 py-2.5 font-body font-700 text-sm transition-all disabled:opacity-60">
              {t(lang, 'shop_unequip')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...RARITY_ORDER] as const).map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-4 py-2 rounded-2xl font-body font-700 text-sm transition-all ${
              filter === r ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg' : 'bg-white/60 text-purple-600 hover:bg-pink-50'
            }`}>
            {r === 'all' ? '✨ All' : t(lang, `shop_rarity_${r}` as any)}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {filtered.map(a => {
          const isOwned = owned.includes(a.id);
          const isEquipped = equipped === a.id;
          const canAfford = balance >= a.cost;
          return (
            <motion.div key={a.id} layout
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="shop-card rounded-3xl p-4 flex flex-col items-center text-center relative overflow-hidden border border-purple-100">
              {a.rarity === 'legendary' && (
                <div className="absolute inset-0 pointer-events-none opacity-20 animate-pulse"
                  style={{ background: 'radial-gradient(circle, gold, transparent)' }} />
              )}
              {/* Avatar circle */}
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-3 ${RARITY_RING[a.rarity]}`}
                style={{ background: RARITY_BG[a.rarity] }}>
                <span style={{ fontSize: '3.5rem', lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                  {a.emoji}
                </span>
              </div>
              <div className="font-body text-[10px] font-700 uppercase tracking-wider text-purple-500 mb-1">
                {t(lang, `shop_rarity_${a.rarity}` as any)}
              </div>
              <div className="font-display font-bold text-purple-700 text-sm mb-2 flex items-center gap-1">
                ⭐ {a.cost}
              </div>
              {isEquipped ? (
                <span className="w-full bg-green-200 text-green-700 font-body font-700 text-xs py-2 rounded-xl">
                  {t(lang, 'shop_equipped')}
                </span>
              ) : isOwned ? (
                <button onClick={() => handleEquip(a)} disabled={busy === a.id}
                  className="w-full bg-gradient-to-r from-pink-400 to-purple-400 text-white font-body font-700 text-xs py-2 rounded-xl hover:opacity-90 transition disabled:opacity-60">
                  {t(lang, 'shop_equip')}
                </button>
              ) : (
                <button onClick={() => handleBuy(a)} disabled={!canAfford || busy === a.id}
                  className={`w-full font-body font-700 text-xs py-2 rounded-xl transition ${
                    canAfford ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-white hover:opacity-90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}>
                  {canAfford ? t(lang, 'shop_buy') : t(lang, 'shop_not_enough')}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Celebration popup (used by Dashboard when pending_celebration > 0)
export function StarCelebration({ amount, onDone, lang }: { amount: number; onDone: () => void; lang: Lang }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);
  const sparks = Array.from({ length: 40 });
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center"
        style={{ background: 'rgba(20,5,40,0.75)', backdropFilter: 'blur(8px)' }}
        onClick={onDone}>
        {sparks.map((_, i) => {
          const angle = (i / sparks.length) * Math.PI * 2;
          const dist = 200 + Math.random() * 240;
          const dx = Math.cos(angle) * dist;
          const dy = Math.sin(angle) * dist;
          const emoji = ['⭐', '✨', '🌟', '💫', '🎉'][i % 5];
          return (
            <motion.div key={i} initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{ x: dx, y: dy, scale: [0, 1.6, 1], opacity: [1, 1, 0], rotate: 360 }}
              transition={{ duration: 2.4, delay: (i % 8) * 0.05, ease: 'easeOut' }}
              className="absolute text-3xl pointer-events-none select-none">{emoji}</motion.div>
          );
        })}
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180 }}
          className="relative glass rounded-3xl px-10 py-8 text-center shadow-2xl border-2 border-yellow-300">
          <div className="text-7xl mb-3 animate-bounce-soft">🎉</div>
          <div className="font-display font-black text-3xl bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">
            +{amount} ⭐
          </div>
          <p className="font-body text-purple-600 font-700">
            {lang === 'en' ? 'Bonus stars received!' : lang === 'ua' ? 'Бонусні зірки отримано!' : 'Бонусные звёзды получены!'}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
