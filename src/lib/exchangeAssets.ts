import type { Language } from '../i18n';
import type { Currency, ExchangeAsset, ExchangeDirection, ExchangeOrder } from '../types';

const ASSET_LABELS: Record<Language, Record<ExchangeAsset, string>> = {
  ru: {
    EUR_CASH: 'EUR наличные',
    UAH_CARD: 'UAH карта',
    USDT: 'USDT',
  },
  en: {
    EUR_CASH: 'EUR cash',
    UAH_CARD: 'UAH card',
    USDT: 'USDT',
  },
  uk: {
    EUR_CASH: 'EUR готівка',
    UAH_CARD: 'UAH карта',
    USDT: 'USDT',
  },
  de: {
    EUR_CASH: 'EUR Bargeld',
    UAH_CARD: 'UAH Karte',
    USDT: 'USDT',
  },
};

export function getAssetLabel(asset: ExchangeAsset, language: Language): string {
  return ASSET_LABELS[language]?.[asset] ?? ASSET_LABELS.en[asset];
}

export function getAssetCurrency(asset: ExchangeAsset): Currency {
  if (asset === 'EUR_CASH') {
    return 'EUR';
  }

  if (asset === 'UAH_CARD') {
    return 'UAH';
  }

  return 'USDT';
}

export function getDirectionFromGiveAsset(asset: ExchangeAsset): ExchangeDirection {
  return asset === 'USDT' ? 'GIVE_USDT' : 'GIVE_CASH';
}

export function isCashAsset(asset: ExchangeAsset): boolean {
  return asset === 'EUR_CASH';
}

export function isCardAsset(asset: ExchangeAsset): boolean {
  return asset === 'UAH_CARD';
}

export function isCryptoAsset(asset: ExchangeAsset): boolean {
  return asset === 'USDT';
}

export function getAllowedTargetAssets(giveAsset: ExchangeAsset): ExchangeAsset[] {
  switch (giveAsset) {
    case 'EUR_CASH':
      return ['USDT', 'UAH_CARD'];
    case 'UAH_CARD':
      return ['USDT', 'EUR_CASH'];
    case 'USDT':
      return ['EUR_CASH', 'UAH_CARD'];
    default:
      return ['USDT'];
  }
}

export function getDefaultTargetAsset(giveAsset: ExchangeAsset): ExchangeAsset {
  return getAllowedTargetAssets(giveAsset)[0];
}

export function getRouteLabel(giveAsset: ExchangeAsset, getAsset: ExchangeAsset, language: Language): string {
  return `${getAssetLabel(giveAsset, language)} -> ${getAssetLabel(getAsset, language)}`;
}

export function inferAssetFromCurrency(currency: Currency, counterpartCurrency: Currency): ExchangeAsset {
  if (currency === 'USDT') {
    return 'USDT';
  }

  if (currency === 'UAH') {
    return 'UAH_CARD';
  }

  if (counterpartCurrency === 'UAH') {
    return 'EUR_CASH';
  }

  return 'EUR_CASH';
}

export function inferOrderAssets(order: Pick<ExchangeOrder, 'giveCurrency' | 'getCurrency'>): {
  giveAsset: ExchangeAsset;
  getAsset: ExchangeAsset;
} {
  const giveAsset = inferAssetFromCurrency(order.giveCurrency, order.getCurrency);
  const getAsset = inferAssetFromCurrency(order.getCurrency, order.giveCurrency);
  return { giveAsset, getAsset };
}
