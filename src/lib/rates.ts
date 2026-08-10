import type { CashCurrency, Currency, ExchangeAsset, Rates } from '../types';
import { getAssetCurrency } from './exchangeAssets';

export const DEFAULT_UAH_PER_USDT = 44.82;
export const DEFAULT_EUR_UAH = 52.01;
export const MIN_EXCHANGE_EUR = 100;

export const DEFAULT_RATES: Rates = {
  EUR_USDT: DEFAULT_EUR_UAH / DEFAULT_UAH_PER_USDT,
  UAH_USDT: 1 / DEFAULT_UAH_PER_USDT,
  EUR_UAH: DEFAULT_EUR_UAH,
};

export function getBaseRateForCashCurrency(currency: CashCurrency, rates: Rates): number {
  return currency === 'UAH' ? rates.UAH_USDT : rates.EUR_USDT;
}

export function convertCashToUsdt(amount: number, currency: CashCurrency, rates: Rates): number {
  return amount * getBaseRateForCashCurrency(currency, rates);
}

export function convertUsdtToCash(amount: number, currency: CashCurrency, rates: Rates): number {
  const baseRate = getBaseRateForCashCurrency(currency, rates);
  if (baseRate === 0) {
    return 0;
  }

  return amount / baseRate;
}

export function convertCurrencyToEur(amount: number, currency: Currency, rates: Rates): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  if (currency === 'EUR') {
    return amount;
  }

  if (currency === 'UAH') {
    return rates.EUR_UAH === 0 ? 0 : amount / rates.EUR_UAH;
  }

  return rates.EUR_USDT === 0 ? 0 : amount / rates.EUR_USDT;
}

export function getGiveAmountInEur(amount: number, giveAsset: ExchangeAsset, rates: Rates): number {
  return convertCurrencyToEur(amount, getAssetCurrency(giveAsset), rates);
}

export function isBelowMinExchange(amount: number, giveAsset: ExchangeAsset, rates: Rates): boolean {
  if (!Number.isFinite(amount) || amount <= 0) {
    return true;
  }

  return getGiveAmountInEur(amount, giveAsset, rates) + 1e-9 < MIN_EXCHANGE_EUR;
}

export function getConversionRate(fromCurrency: Currency, toCurrency: Currency, rates: Rates): number {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  if (fromCurrency === 'EUR' && toCurrency === 'USDT') {
    return rates.EUR_USDT;
  }

  if (fromCurrency === 'UAH' && toCurrency === 'USDT') {
    return rates.UAH_USDT;
  }

  if (fromCurrency === 'USDT' && toCurrency === 'EUR') {
    return rates.EUR_USDT === 0 ? 0 : 1 / rates.EUR_USDT;
  }

  if (fromCurrency === 'USDT' && toCurrency === 'UAH') {
    return rates.UAH_USDT === 0 ? 0 : 1 / rates.UAH_USDT;
  }

  if (fromCurrency === 'EUR' && toCurrency === 'UAH') {
    return rates.EUR_UAH;
  }

  if (fromCurrency === 'UAH' && toCurrency === 'EUR') {
    return rates.EUR_UAH === 0 ? 0 : 1 / rates.EUR_UAH;
  }

  return 0;
}

export function getAssetConversionRate(fromAsset: ExchangeAsset, toAsset: ExchangeAsset, rates: Rates): number {
  return getConversionRate(getAssetCurrency(fromAsset), getAssetCurrency(toAsset), rates);
}

export function convertBetweenAssets(amount: number, fromAsset: ExchangeAsset, toAsset: ExchangeAsset, rates: Rates): number {
  return amount * getAssetConversionRate(fromAsset, toAsset, rates);
}

export function roundAmountForAsset(asset: ExchangeAsset, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  // Оставляем 2 знака после запятой для всех валют, чтобы учитывалась любая "мелочь" (центы, копейки)
  return Number(amount.toFixed(2));
}
