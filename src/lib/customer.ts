import type { ExchangeDirection, ExchangeOrder, LoyaltyTier } from '../types';
import { DEFAULT_RATES, convertCurrencyToEur } from './rates';

export interface CustomerMetrics {
  deals: number;
  volumeEUR: number;
  firstOrderAt: string | null;
  providerDeals: number;
  providerVolumeEUR: number;
}

export interface CustomerBenefits {
  tier: LoyaltyTier;
  loyaltyDiscountPercent: number;
  referralDiscountPercent: number;
  totalDiscountPercent: number;
  effectiveCommissionPercent: number;
  hasReferralActivated: boolean;
  isReferralFirstDeal: boolean;
}

const BASE_COMMISSION_PERCENT = 4;

export function isOrderOwnedByUser(order: ExchangeOrder, userHandle: string, userId?: string | number | null): boolean {
  if (userId && order.userId) {
    return String(order.userId) === String(userId);
  }

  return order.userHandle === userHandle;
}

export function calculateCustomerMetrics(
  orders: ExchangeOrder[],
  userHandle: string,
  userId?: string | number | null,
): CustomerMetrics {
  const userOrders = orders.filter((order) => isOrderOwnedByUser(order, userHandle, userId));

  if (userOrders.length === 0) {
    return {
      deals: 0,
      volumeEUR: 0,
      firstOrderAt: null,
      providerDeals: 0,
      providerVolumeEUR: 0,
    };
  }

  const firstOrder = [...userOrders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )[0];

  return userOrders.reduce<CustomerMetrics>(
    (acc, order) => {
      const eurAmount = order.giveCurrency === 'EUR' || order.giveCurrency === 'UAH'
        ? convertCurrencyToEur(Number(order.giveAmount), order.giveCurrency, DEFAULT_RATES)
        : convertCurrencyToEur(Number(order.getAmount), order.getCurrency, DEFAULT_RATES);
      const isProviderDeal = order.direction === 'GIVE_USDT';

      return {
        deals: acc.deals + 1,
        volumeEUR: acc.volumeEUR + eurAmount,
        firstOrderAt: acc.firstOrderAt,
        providerDeals: acc.providerDeals + (isProviderDeal ? 1 : 0),
        providerVolumeEUR: acc.providerVolumeEUR + (isProviderDeal ? eurAmount : 0),
      };
    },
    {
      deals: 0,
      volumeEUR: 0,
      firstOrderAt: firstOrder.createdAt,
      providerDeals: 0,
      providerVolumeEUR: 0,
    },
  );
}

export function generateReferralCode(userHandle: string): string {
  const clean = userHandle.replace(/[@\s]/g, '').toUpperCase().slice(0, 6) || 'BULL';
  return `CB-${clean}`;
}

export function getLoyaltyTier(metrics: CustomerMetrics): LoyaltyTier {
  if (metrics.providerDeals >= 3 || metrics.providerVolumeEUR >= 5000) {
    return 'provider';
  }

  if (metrics.volumeEUR >= 50000 || metrics.deals >= 25) {
    return 'vip';
  }

  if (metrics.volumeEUR >= 5000 || metrics.deals >= 5) {
    return 'gold';
  }

  return 'standard';
}

export function getTierDiscountPercent(tier: LoyaltyTier): number {
  switch (tier) {
    case 'gold':
      return 0.3;
    case 'vip':
      return 0.7;
    case 'provider':
      return 1.0;
    default:
      return 0;
  }
}

export function getCustomerBenefits(
  metrics: CustomerMetrics,
  activatedReferralCode: string,
): CustomerBenefits {
  const tier = getLoyaltyTier(metrics);
  const loyaltyDiscountPercent = getTierDiscountPercent(tier);
  const hasReferralActivated = activatedReferralCode.trim().length > 0;
  const isReferralFirstDeal = hasReferralActivated && metrics.deals === 0;
  const referralDiscountPercent = isReferralFirstDeal ? BASE_COMMISSION_PERCENT : 0;
  const totalDiscountPercent = Math.min(BASE_COMMISSION_PERCENT, loyaltyDiscountPercent + referralDiscountPercent);
  const effectiveCommissionPercent = Math.max(0, BASE_COMMISSION_PERCENT - totalDiscountPercent);

  return {
    tier,
    loyaltyDiscountPercent,
    referralDiscountPercent,
    totalDiscountPercent,
    effectiveCommissionPercent,
    hasReferralActivated,
    isReferralFirstDeal,
  };
}

export function getCommissionMultiplier(commissionPercent: number): number {
  return Math.max(0, 1 - commissionPercent / 100);
}

export function getClientRate(
  direction: ExchangeDirection,
  baseRate: number,
  commissionPercent: number,
): number {
  const multiplier = getCommissionMultiplier(commissionPercent);

  if (multiplier === 0) {
    return 0;
  }

  return direction === 'GIVE_CASH' ? baseRate * multiplier : baseRate / multiplier;
}
