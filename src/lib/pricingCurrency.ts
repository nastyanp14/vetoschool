import type { Lang, TranslationKey } from './i18n';

export type DisplayCurrency = 'CZK' | 'EUR';

export type PricingPlanId =
  | 'group-lite'
  | 'group-progress'
  | 'group-intensive'
  | 'individual-lite'
  | 'individual-progress'
  | 'individual-intensive';

export type PricingPlanPrice = {
  monthlyCzk: number;
  perLessonCzk: number;
};

export const supportedCurrencies: DisplayCurrency[] = ['CZK', 'EUR'];

// Temporary display rate. Replace later with the approved daily rate source.
export const exchangeRates: Record<DisplayCurrency, number> = {
  CZK: 1,
  EUR: 1 / 25,
};

export const pricingPlanPrices: Record<PricingPlanId, PricingPlanPrice> = {
  'group-lite': { monthlyCzk: 1280, perLessonCzk: 320 },
  'group-progress': { monthlyCzk: 2400, perLessonCzk: 300 },
  'group-intensive': { monthlyCzk: 3420, perLessonCzk: 285 },
  'individual-lite': { monthlyCzk: 1800, perLessonCzk: 450 },
  'individual-progress': { monthlyCzk: 3440, perLessonCzk: 430 },
  'individual-intensive': { monthlyCzk: 4800, perLessonCzk: 400 },
};

export const pricingPlanNameKeys: Record<PricingPlanId, TranslationKey> = {
  'group-lite': 'pricing_group_lite_name',
  'group-progress': 'pricing_group_progress_name',
  'group-intensive': 'pricing_group_intensive_name',
  'individual-lite': 'pricing_individual_lite_name',
  'individual-progress': 'pricing_individual_progress_name',
  'individual-intensive': 'pricing_individual_intensive_name',
};

export function isDisplayCurrency(value: string | null | undefined): value is DisplayCurrency {
  return value === 'CZK' || value === 'EUR';
}

export function normalizeCurrency(value: string | null | undefined): DisplayCurrency {
  return isDisplayCurrency(value) ? value : 'CZK';
}

export function convertPrice(czkAmount: number, currency: DisplayCurrency) {
  return czkAmount * exchangeRates[currency];
}

function localeForLang(lang: Lang) {
  if (lang === 'ua') return 'uk-UA';
  if (lang === 'en') return 'en-GB';
  return 'ru-RU';
}

export function formatCurrencyAmount(czkAmount: number, currency: DisplayCurrency, lang: Lang) {
  const value = convertPrice(czkAmount, currency);
  const locale = localeForLang(lang);

  if (currency === 'CZK') {
    const formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });

    return `${formatter.format(value)} Kč`;
  }

  const formatter = new Intl.NumberFormat(localeForLang(lang), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  return formatter.format(value);
}
