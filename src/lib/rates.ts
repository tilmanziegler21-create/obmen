import type { CashCurrency, Currency, Rates } from '../types';

export const DEFAULT_UAH_PER_USDT = 44.82;
export const DEFAULT_EUR_UAH = 52.01;

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
