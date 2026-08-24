import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, LockKeyhole } from 'lucide-react';
import { Lang, t, type TranslationKey } from '../lib/i18n';
import {
  AVATARS, AvatarDef, Rarity,
  equipAvatar, loadPurchases, loadStarProfile, purchaseAvatar,
} from '../lib/stars';

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
type SortMode = 'newest' | 'price-asc' | 'price-desc';

interface Props {
  userId: string;
  hasAccess: boolean;
  lang: Lang;
  userName?: string;
  onChange?: () => void;
}

const shopAssets = {
  hero: '/shop/panels/shop-hero.png',
  heroDark: '/shop/panels/shop-hero-dark.png',
  tip: '/shop/panels/shop-tip.jpg',
  tipDark: '/shop/panels/shop-tip-dark.png',
  news: '/shop/panels/shop-new.jpg',
  newsDark: '/shop/panels/shop-new-dark.png',
  wallet: '/shop/icons/wallet.png',
  star: '/shop/icons/star.png',
  howPick: '/shop/icons/how-pick-avatar.png',
  howBuy: '/shop/icons/how-buy.png',
  howProfile: '/shop/icons/how-profile.png',
  newsGift: '/shop/icons/news-gift.png',
};

const rarityIcons: Record<Rarity | 'all', string> = {
  all: '/shop/icons/filter-all.png',
  common: '/shop/icons/filter-common.png',
  rare: '/shop/icons/filter-rare.png',
  epic: '/shop/icons/filter-epic.png',
  legendary: '/shop/icons/legendary.png',
};

const rarityLabelKeys: Record<Rarity, TranslationKey> = {
  common: 'shop_rarity_common',
  rare: 'shop_rarity_rare',
  epic: 'shop_rarity_epic',
  legendary: 'shop_rarity_legendary',
};

const avatarActionButtonClass = 'bg-gradient-to-r from-pink-400 to-purple-500 shadow-purple-200/80 hover:from-pink-500 hover:to-purple-500 hover:shadow-purple-300/70 dark:bg-gradient-to-r dark:from-pink-400 dark:to-purple-500 dark:shadow-purple-950/35 dark:hover:from-pink-500 dark:hover:to-purple-500';

const rarityStyles: Record<Rarity, { text: string; price: string }> = {
  common: {
    text: 'text-sky-500',
    price: 'text-yellow-500',
  },
  rare: {
    text: 'text-blue-500',
    price: 'text-blue-500',
  },
  epic: {
    text: 'text-purple-500',
    price: 'text-purple-500',
  },
  legendary: {
    text: 'text-violet-600',
    price: 'text-violet-600',
  },
};

function shopCopy(lang: Lang) {
  return {
    ru: {
      exit: 'Выйти',
      title: 'Магазин аватарок',
      subtitle: 'Покупай милые аватарки и выделяйся!',
      balance: 'Твой баланс',
      stars: 'звёзд',
      all: 'Все',
      sortNewest: 'Сначала новые',
      sortPriceAsc: 'Цена по возрастанию',
      sortPriceDesc: 'Цена по убыванию',
      howTitle: 'Как это работает?',
      howPick: 'Выбери аватарку',
      howBuy: 'Нажми «Купить» или «Надеть»',
      howProfile: 'Аватарка появится в твоём профиле',
      profileTitle: 'Мой профиль',
      active: 'Активен',
      remove: 'Снять аватарку',
      newsTitle: 'Новинки каждый месяц!',
      newsDesc: 'Следи за обновлениями',
      newsAction: 'Смотреть новинки',
      tipTitle: 'Полезно знать',
      tipDesc: 'Аватарка - это твой стиль и настроение!',
      footer: 'Выбирай, собирай и создавай своё настроение!',
      equipped: 'Надето',
      equip: 'Надеть',
      buy: 'Купить',
      notEnough: 'Не хватает звёзд',
      unlock: 'Магазин откроется после активации аккаунта',
    },
    en: {
      exit: 'Exit',
      title: 'Avatar Shop',
      subtitle: 'Buy cute avatars and stand out!',
      balance: 'Your balance',
      stars: 'stars',
      all: 'All',
      sortNewest: 'Newest first',
      sortPriceAsc: 'Price low to high',
      sortPriceDesc: 'Price high to low',
      howTitle: 'How does it work?',
      howPick: 'Choose an avatar',
      howBuy: 'Tap Buy or Equip',
      howProfile: 'The avatar appears in your profile',
      profileTitle: 'My profile',
      active: 'Active',
      remove: 'Remove avatar',
      newsTitle: 'New items every month!',
      newsDesc: 'Watch for updates',
      newsAction: 'See new items',
      tipTitle: 'Good to know',
      tipDesc: 'Your avatar is your style and mood!',
      footer: 'Choose, collect and create your mood!',
      equipped: 'Equipped',
      equip: 'Equip',
      buy: 'Buy',
      notEnough: 'Not enough stars',
      unlock: 'The shop opens after account activation',
    },
    ua: {
      exit: 'Вийти',
      title: 'Магазин аватарок',
      subtitle: 'Купуй милі аватарки та вирізняйся!',
      balance: 'Твій баланс',
      stars: 'зірок',
      all: 'Всі',
      sortNewest: 'Спочатку нові',
      sortPriceAsc: 'Ціна за зростанням',
      sortPriceDesc: 'Ціна за спаданням',
      howTitle: 'Як це працює?',
      howPick: 'Обери аватарку',
      howBuy: 'Натисни «Купити» або «Вдягти»',
      howProfile: 'Аватарка зʼявиться у твоєму профілі',
      profileTitle: 'Мій профіль',
      active: 'Активний',
      remove: 'Зняти аватарку',
      newsTitle: 'Новинки щомісяця!',
      newsDesc: 'Стеж за оновленнями',
      newsAction: 'Дивитися новинки',
      tipTitle: 'Корисно знати',
      tipDesc: 'Аватарка - це твій стиль і настрій!',
      footer: 'Обирай, збирай і створюй свій настрій!',
      equipped: 'Вдягнено',
      equip: 'Вдягти',
      buy: 'Купити',
      notEnough: 'Не вистачає зірок',
      unlock: 'Магазин відкриється після активації акаунта',
    },
  }[lang];
}

function AvatarVisual({ avatar, className = '' }: { avatar: AvatarDef; className?: string }) {
  if (avatar.imageSrc) {
    return (
      <img
        src={avatar.imageSrc}
        alt=""
        draggable={false}
        className={`select-none object-contain ${className}`}
      />
    );
  }
  return <span className={className} style={{ fontSize: '3.5rem', lineHeight: 1 }}>{avatar.emoji}</span>;
}

function InitialAvatar({ name, className = 'h-16 w-16 text-2xl' }: { name: string; className?: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() || 'V';

  return (
    <span
      aria-hidden="true"
      className={`inline-flex select-none items-center justify-center rounded-full bg-gradient-to-br from-pink-300 via-fuchsia-300 to-purple-300 font-display font-black leading-none text-white ${className}`}
    >
      {initial}
    </span>
  );
}

export default function AvatarShop({ userId, hasAccess, lang, userName = 'Vetoschool', onChange }: Props) {
  const [balance, setBalance] = useState(0);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [owned, setOwned] = useState<string[]>([]);
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const avatarGridRef = useRef<HTMLDivElement | null>(null);
  const copy = shopCopy(lang);

  const refresh = useCallback(async () => {
    const [p, list] = await Promise.all([loadStarProfile(userId), loadPurchases(userId)]);
    setBalance(p.starBalance);
    setEquipped(p.avatarId);
    setOwned(list);
  }, [userId]);

  useEffect(() => { if (userId) refresh(); }, [userId, refresh]);

  const filtered = useMemo(() => (
    filter === 'all' ? AVATARS : AVATARS.filter(a => a.rarity === filter)
  ), [filter]);
  const visibleAvatars = useMemo(() => {
    const sorted = [...filtered];
    if (sortMode === 'price-asc') sorted.sort((a, b) => a.cost - b.cost);
    if (sortMode === 'price-desc') sorted.sort((a, b) => b.cost - a.cost);
    return sorted;
  }, [filtered, sortMode]);
  const equippedAvatar = AVATARS.find(a => a.id === equipped);
  const sortOptions: Array<{ value: SortMode; label: string }> = [
    { value: 'newest', label: copy.sortNewest },
    { value: 'price-asc', label: copy.sortPriceAsc },
    { value: 'price-desc', label: copy.sortPriceDesc },
  ];
  const currentSortLabel = sortOptions.find(option => option.value === sortMode)?.label || copy.sortNewest;

  const focusAvatarGrid = () => {
    window.requestAnimationFrame(() => {
      avatarGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleFilterSelect = (nextFilter: Rarity | 'all') => {
    setFilter(nextFilter);
    focusAvatarGrid();
  };

  const handleSortSelect = (nextSortMode: SortMode) => {
    setSortMode(nextSortMode);
    setSortOpen(false);
    focusAvatarGrid();
  };

  const handleShowNewItems = () => {
    setFilter('all');
    setSortMode('newest');
    setSortOpen(false);
    focusAvatarGrid();
  };

  const handleBuy = async (a: AvatarDef) => {
    if (balance < a.cost) return;
    setBusy(a.id);
    try { await purchaseAvatar(userId, a.id, a.cost, balance); await refresh(); onChange?.(); }
    finally { setBusy(null); }
  };

  const handleEquip = async (a: AvatarDef) => {
    setBusy(a.id);
    try { await equipAvatar(userId, a.id); await refresh(); onChange?.(); }
    finally { setBusy(null); }
  };

  const handleUnequip = async () => {
    setBusy('unequip');
    try { await equipAvatar(userId, null); await refresh(); onChange?.(); }
    finally { setBusy(null); }
  };

  return (
    <div className="relative min-h-[calc(100dvh-5rem)] overflow-hidden rounded-[2rem] bg-[#fbf7ff] px-3 pb-5 pt-4 text-purple-950 shadow-[0_28px_80px_rgba(126,34,206,0.12)] dark:bg-[#0a0613] dark:text-purple-100 dark:shadow-none sm:px-5 lg:px-7">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,240,251,0.86),rgba(240,246,255,0.94))] dark:bg-[linear-gradient(135deg,rgba(14,4,32,0.96),rgba(21,8,46,0.94)_50%,rgba(10,18,48,0.96))]" />

      {!hasAccess ? (
        <div className="relative z-10 flex min-h-[28rem] items-center justify-center">
          <div className="max-w-lg rounded-[1.75rem] border border-purple-100 bg-white/85 p-8 text-center shadow-2xl shadow-purple-100/70 dark:border-white/10 dark:bg-white/[0.055] dark:shadow-none">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-50 text-purple-500 dark:bg-purple-400/15 dark:text-pink-200">
              <LockKeyhole className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl font-black text-purple-700 dark:text-purple-50">{t(lang, 'shop_locked_title')}</h3>
            <p className="mt-2 font-body text-sm font-bold text-purple-400 dark:text-purple-200/75">{copy.unlock}</p>
          </div>
        </div>
      ) : (
        <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_19.5rem]">
          <main className="space-y-5">
            <section className="shop-hero-shell relative min-h-[17.5rem] overflow-hidden rounded-[1.75rem] border border-white/70 bg-[linear-gradient(135deg,#ffe5f5_0%,#eadbff_48%,#dceeff_100%)] shadow-xl shadow-purple-100/55 dark:border-0 dark:bg-[#211331] dark:shadow-none">
              <img src={shopAssets.hero} alt="" draggable={false} className="shop-hero-art absolute inset-0 h-full w-full select-none object-cover object-center dark:hidden" />
              <img src={shopAssets.heroDark} alt="" draggable={false} className="shop-hero-art shop-hero-art--dark absolute inset-0 hidden h-full w-full select-none object-cover dark:block" />
              <div className="relative z-10 flex min-h-[17.5rem] flex-col justify-center gap-5 px-6 py-6 sm:px-9 lg:max-w-[36rem]">
                <div>
                  <h2 className="shop-hero-title font-display text-4xl font-black text-purple-700 dark:text-purple-50 sm:text-5xl">{copy.title}</h2>
                  <p className="shop-hero-subtitle mt-2 font-body text-base font-bold text-purple-500 dark:text-purple-200/80">{copy.subtitle}</p>
                </div>
                <div className="-ml-2 flex h-[5.75rem] w-full max-w-[22rem] items-center gap-3 overflow-visible rounded-[1.5rem] border border-white/90 bg-white/80 px-4 py-2 shadow-lg shadow-purple-100/55 backdrop-blur dark:border-purple-400/25 dark:bg-[#1a1028]/90 dark:shadow-purple-950/30 sm:-ml-4">
                  <img src={shopAssets.star} alt="" draggable={false} className="shop-balance-star h-[7.25rem] w-[7.25rem] translate-y-2 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm font-black text-purple-500 dark:text-purple-200/80">{copy.balance}</p>
                    <div className="flex items-end gap-2">
                      <span className="font-display text-5xl font-extrabold leading-none text-purple-600 dark:text-purple-50">{balance}</span>
                      <span className="pb-1 font-body text-sm font-black text-purple-400 dark:text-purple-200/70">{copy.stars}</span>
                    </div>
                  </div>
                  <img src={shopAssets.wallet} alt="" draggable={false} className="h-[4.25rem] w-[4.25rem] object-contain" />
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/80 bg-white/78 p-3 shadow-xl shadow-purple-100/45 backdrop-blur dark:border-white/10 dark:bg-[#150923]/82 dark:shadow-none">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {(['all', ...RARITY_ORDER] as const).map(r => {
                    const active = filter === r;
                    const label = r === 'all' ? copy.all : t(lang, rarityLabelKeys[r]);
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={active}
                        data-active={active ? 'true' : undefined}
                        onClick={() => handleFilterSelect(r)}
                        className={`shop-filter-pill relative inline-flex h-11 shrink-0 items-center gap-2 overflow-hidden rounded-full px-4 font-display text-sm font-black transition ${
                          active
                            ? `shop-filter-pill--active ${avatarActionButtonClass} text-white shadow-lg`
                            : 'border border-purple-50 bg-white text-purple-500 shadow-sm hover:bg-pink-50 dark:border-purple-400/20 dark:bg-[#211331] dark:text-purple-100 dark:shadow-none dark:hover:bg-white/10 dark:hover:text-pink-100'
                        }`}
                      >
                        {active && <span className="shop-filter-pill__active-bg" aria-hidden="true" />}
                        <img src={rarityIcons[r]} alt="" draggable={false} className="relative z-10 h-7 w-7 rounded-full object-contain" />
                        <span className="relative z-10">{label}</span>
                      </button>
                    );
                  })}
                </div>
                <div
                  className="relative z-30 w-full sm:w-64"
                  onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSortOpen(false);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Escape') setSortOpen(false);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSortOpen(open => !open)}
                    className="group inline-flex h-11 w-full items-center justify-between gap-3 rounded-full border border-white/85 bg-white/88 px-4 font-display text-sm font-black text-purple-500 shadow-[0_12px_26px_rgba(168,85,247,0.14)] ring-1 ring-purple-100/60 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-purple-700 hover:shadow-[0_16px_32px_rgba(168,85,247,0.2)] dark:border-purple-400/20 dark:bg-[#211331] dark:text-purple-100 dark:shadow-none dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-pink-100"
                    aria-haspopup="listbox"
                    aria-expanded={sortOpen}
                    aria-label={copy.sortNewest}
                  >
                    <span className="inline-flex min-w-0 items-center">
                      <span className="truncate">{currentSortLabel}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-purple-400 transition dark:text-purple-200 ${sortOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {sortOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 top-full mt-2 w-full overflow-hidden rounded-[1.25rem] border border-white/90 bg-white/95 p-1.5 shadow-[0_22px_50px_rgba(126,34,206,0.2)] ring-1 ring-purple-100/70 backdrop-blur dark:border-purple-400/20 dark:bg-[#211331]/95 dark:shadow-2xl dark:shadow-black/30 dark:ring-white/10"
                        role="listbox"
                      >
                        {sortOptions.map(option => {
                          const active = sortMode === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="option"
                              aria-selected={active}
                              data-active={active ? 'true' : undefined}
                              onClick={() => handleSortSelect(option.value)}
                              className={`relative flex h-10 w-full items-center justify-between gap-3 overflow-hidden rounded-[1rem] px-3 text-left font-display text-sm font-black transition ${
                                active
                                  ? `shop-sort-option--active ${avatarActionButtonClass} text-white shadow-md`
                                  : 'text-purple-500 hover:bg-pink-50 hover:text-purple-700 dark:text-purple-100 dark:hover:bg-white/10 dark:hover:text-pink-100'
                              }`}
                            >
                              {active && <span className="shop-sort-option__active-bg" aria-hidden="true" />}
                              <span className="relative z-10 truncate">{option.label}</span>
                              {active && <Check className="relative z-10 h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div ref={avatarGridRef} className="scroll-mt-28 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {visibleAvatars.map(a => {
                  const isOwned = owned.includes(a.id);
                  const isEquipped = equipped === a.id;
                  const canAfford = balance >= a.cost;
                  const styles = rarityStyles[a.rarity];
                  const avatarGlowClass = a.rarity === 'common' ? '' : `shop-avatar-glow shop-avatar-glow--${a.rarity}`;
                  const avatarImageClass = a.rarity === 'common' ? '' : `shop-avatar-image shop-avatar-image--${a.rarity}`;
                  return (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="shop-card group relative flex min-h-[16rem] flex-col items-center overflow-hidden rounded-[1.35rem] border border-purple-50 px-3 pb-3 pt-4 text-center shadow-lg shadow-purple-100/45 transition hover:-translate-y-1 dark:shadow-none"
                    >
                      <div className="shop-avatar-visual relative mb-3 flex h-36 w-36 shrink-0 items-center justify-center overflow-visible drop-shadow-[0_14px_20px_rgba(126,34,206,0.16)]">
                        <AvatarVisual avatar={a} className={`relative z-10 h-full w-full ${avatarImageClass}`} />
                        {avatarGlowClass && <span className={avatarGlowClass} aria-hidden="true" />}
                      </div>
                      <div className={`font-display text-base font-black ${styles.text}`}>
                        {t(lang, rarityLabelKeys[a.rarity])}
                      </div>
                      <div className={`relative mb-3 mt-1 flex w-full items-center justify-center font-display text-xl font-black ${styles.price}`}>
                        <img src={shopAssets.star} alt="" draggable={false} className="absolute right-[calc(50%+0.95rem)] h-8 w-8 scale-[1.3] rounded-full object-cover" />
                        <span>{a.cost}</span>
                      </div>
                      {isEquipped ? (
                        <span className="mt-auto inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-green-400 to-lime-500 px-3 font-display text-xs font-black text-white shadow-md">
                          <Check className="h-4 w-4" />
                          {copy.equipped}
                        </span>
                      ) : isOwned ? (
                        <button
                          type="button"
                          onClick={() => handleEquip(a)}
                          disabled={busy === a.id}
                          className={`shop-action-button relative mt-auto h-9 w-full overflow-hidden rounded-full px-3 font-display text-xs font-black text-white shadow-md transition hover:shadow-lg disabled:opacity-60 ${avatarActionButtonClass}`}
                        >
                          <span className="shop-action-button__bg" aria-hidden="true" />
                          <span className="relative z-10">{copy.equip}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBuy(a)}
                          disabled={!canAfford || busy === a.id}
                          className={`relative mt-auto h-9 w-full overflow-hidden rounded-full px-3 font-display text-xs font-black text-white shadow-md transition disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none ${
                            canAfford ? `shop-action-button ${avatarActionButtonClass}` : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {canAfford && <span className="shop-action-button__bg" aria-hidden="true" />}
                          <span className="relative z-10">{canAfford ? copy.buy : copy.notEnough}</span>
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </main>

          <aside className="space-y-5">
            <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-xl shadow-purple-100/45 dark:border-white/10 dark:bg-[#211331] dark:shadow-none">
              <h3 className="font-display text-xl font-black text-purple-700 dark:text-purple-50">{copy.howTitle}</h3>
              <div className="mt-5 space-y-5">
                {[
                  { icon: shopAssets.howPick, text: copy.howPick },
                  { icon: shopAssets.howBuy, text: copy.howBuy },
                  { icon: shopAssets.howProfile, text: copy.howProfile },
                ].map(item => {
                  return (
                    <div key={item.text} className="flex items-center gap-4">
                      <img src={item.icon} alt="" draggable={false} className="h-12 w-12 shrink-0 scale-[1.08] select-none object-contain drop-shadow-[0_8px_12px_rgba(126,34,206,0.12)]" />
                      <span className="font-body text-sm font-bold leading-snug text-purple-500 dark:text-purple-200/80">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-xl shadow-purple-100/45 dark:border-white/10 dark:bg-[#211331] dark:shadow-none">
              <h3 className="font-display text-lg font-black text-purple-700 dark:text-purple-50">{copy.profileTitle}</h3>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden">
                  {equippedAvatar ? <AvatarVisual avatar={equippedAvatar} className="h-full w-full" /> : <InitialAvatar name={userName} />}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-xl font-black text-purple-800 dark:text-purple-50">{userName}</div>
                  <p className="mt-1 font-body text-xs font-bold text-purple-400 dark:text-purple-200/70">{copy.active}</p>
                </div>
              </div>
              {equipped && (
                <button
                  type="button"
                  onClick={handleUnequip}
                  disabled={busy === 'unequip'}
                  className={`shop-action-button relative mt-4 h-10 w-full overflow-hidden rounded-full font-display text-sm font-black text-white shadow-lg shadow-purple-200 transition hover:opacity-90 disabled:opacity-60 dark:shadow-purple-950/30 ${avatarActionButtonClass}`}
                >
                  <span className="shop-action-button__bg" aria-hidden="true" />
                  <span className="relative z-10">{copy.remove}</span>
                </button>
              )}
            </section>

            <section className="relative min-h-[11rem] overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/75 p-5 shadow-xl shadow-purple-100/45 dark:border-0 dark:bg-[#211331] dark:shadow-none">
              <img src={shopAssets.news} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-center dark:hidden" />
              <img src={shopAssets.newsDark} alt="" draggable={false} className="absolute inset-0 hidden h-full w-full object-cover object-center dark:block" />
              <div className="relative z-10 max-w-[12rem]">
                <h3 className="shop-promo-title font-display text-lg font-black leading-tight text-purple-700">{copy.newsTitle}</h3>
                <p className="shop-promo-copy mt-2 font-body text-xs font-bold text-purple-500">{copy.newsDesc}</p>
                <button
                  type="button"
                  onClick={handleShowNewItems}
                  className="-ml-1 mt-5 inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 px-3.5 font-display text-[11px] font-black text-white shadow-lg shadow-pink-100 transition hover:opacity-90 dark:shadow-purple-950/30"
                >
                  <img src={shopAssets.newsGift} alt="" draggable={false} className="h-3.5 w-3.5 scale-[1.95] select-none object-contain" />
                  {copy.newsAction}
                </button>
              </div>
            </section>

            <section className="relative min-h-[10rem] overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/75 p-5 shadow-xl shadow-purple-100/45 dark:border-0 dark:bg-[#211331] dark:shadow-none">
              <img src={shopAssets.tip} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-[center_100%] dark:hidden" />
              <img src={shopAssets.tipDark} alt="" draggable={false} className="absolute inset-0 hidden h-full w-full object-cover object-center dark:block" />
              <div className="relative z-10 max-w-[12rem]">
                <h3 className="shop-promo-title font-display text-lg font-black text-purple-700">{copy.tipTitle}</h3>
                <p className="shop-promo-copy mt-2 font-body text-xs font-bold leading-relaxed text-purple-500">{copy.tipDesc}</p>
              </div>
            </section>
          </aside>
        </div>
      )}
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
          className="star-celebration-card relative rounded-3xl px-10 py-8 text-center shadow-2xl">
          <div className="text-7xl mb-3 animate-bounce-soft">🎉</div>
          <div className="star-celebration-amount font-display font-black text-3xl mb-2">
            +{amount} ⭐
          </div>
          <p className="star-celebration-copy font-body font-700">
            {lang === 'en' ? 'Bonus stars received!' : lang === 'ua' ? 'Бонусні зірки отримано!' : 'Бонусные звёзды получены!'}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
