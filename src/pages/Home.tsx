import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { calculateCustomerMetrics, generateReferralCode, getCustomerBenefits } from '../lib/customer';

export default function Home() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const {
    rates,
    rateUpdatedAt,
    orders,
    usdtReserve,
    cities,
    profileSettings,
    updateProfileSettings,
  } = useStore();
  const [isReferralCopied, setIsReferralCopied] = useState(false);

  const user = WebApp.initDataUnsafe?.user;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map((id: string) => id.trim());
  const isAdmin = user?.id ? adminIds.includes(user.id.toString()) : false;

  const metrics = useMemo(
    () => calculateCustomerMetrics(orders, currentUserHandle),
    [currentUserHandle, orders],
  );
  const benefits = useMemo(
    () => getCustomerBenefits(metrics, profileSettings.activatedReferralCode),
    [metrics, profileSettings.activatedReferralCode],
  );
  const currentUserOrders = useMemo(
    () => orders.filter((order) => order.userHandle === currentUserHandle),
    [currentUserHandle, orders],
  );
  const invitedUsersCount = useMemo(
    () =>
      new Set(
        orders
          .filter(
            (order) =>
              order.referralCodeUsed === profileSettings.referralCode &&
              order.userHandle !== currentUserHandle,
          )
          .map((order) => order.userHandle),
      ).size,
    [currentUserHandle, orders, profileSettings.referralCode],
  );
  const latestActiveOrder = useMemo(
    () => currentUserOrders.find((order) => order.status === 'accepted' || order.status === 'processing' || order.status === 'ready') ?? null,
    [currentUserOrders],
  );
  const totalCashReserve = useMemo(
    () => cities.filter((city) => city.isActive).reduce((sum, city) => sum + city.limitEUR, 0),
    [cities],
  );
  const activeOrderStatusDotClass = latestActiveOrder?.status === 'ready'
    ? 'bg-[#D4AF37]'
    : latestActiveOrder?.status === 'processing'
      ? 'bg-[#FFFFFF]'
      : latestActiveOrder?.status === 'rejected'
        ? 'bg-[#808080]'
        : 'bg-[#D4AF37]';

  useEffect(() => {
    const expectedReferralCode = generateReferralCode(currentUserHandle);
    if (profileSettings.referralCode !== expectedReferralCode) {
      updateProfileSettings({ referralCode: expectedReferralCode });
    }
  }, [currentUserHandle, profileSettings.referralCode, updateProfileSettings]);

  const formattedRateUpdatedAt = new Date(rateUpdatedAt).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleOpenExchange = () => {
    WebApp.HapticFeedback.impactOccurred('medium');
    navigate('/');
  };

  const handleOpenHistory = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate('/orders');
  };

  const handleCopyReferralCode = async () => {
    const referralCode = profileSettings.referralCode.trim();
    if (!referralCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralCode);
      WebApp.HapticFeedback.notificationOccurred('success');
      setIsReferralCopied(true);
      window.setTimeout(() => setIsReferralCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy referral code', error);
      WebApp.HapticFeedback.notificationOccurred('error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 px-[16px] pb-[24px]"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
    >
      <header className="mb-[16px] flex items-start justify-between gap-[12px]">
        <div
          className={`min-w-0 flex items-center gap-[12px] ${isAdmin ? 'cursor-pointer' : ''}`}
          onClick={() => {
            if (isAdmin) {
              navigate('/admin');
            }
          }}
        >
          <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-[#111111] border border-[#222222]">
            <svg viewBox="0 0 24 24" fill="none" className="h-[20px] w-[20px]">
              <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7.5 8L5 4" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16.5 8L19 4" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 13H15" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[18px] font-[800] tracking-[0.04em] text-text">CryptoBull</div>
            <div className="mt-[3px] text-[11px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">{t('app.subtitle')}</div>
          </div>
        </div>

        <div className="flex items-center gap-[8px]">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-[36px] w-[36px] items-center justify-center overflow-hidden rounded-full border border-[#222222] bg-[#111111] text-[13px] font-[700] text-[#FFFFFF]"
          >
            {user?.photo_url ? (
              <img src={user.photo_url} alt={t('app.avatarAlt')} className="h-full w-full object-cover" />
            ) : (
              user?.first_name?.charAt(0) || 'U'
            )}
          </button>
        </div>
      </header>

      <div className="space-y-[16px]">
        <button
          type="button"
          onClick={handleCopyReferralCode}
          className="w-full rounded-[16px] border border-[#222222] bg-[#111111] px-[24px] py-[24px] text-left transition-colors hover:border-[#D4AF37]"
        >
          <div className="flex items-start justify-between gap-[16px]">
            <div>
              <div className="text-[12px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">{t('home.referralProgramTitle')}</div>
              <div className="mt-[10px] text-[24px] font-[600] leading-[1.1] text-[#FFFFFF]">
                {profileSettings.referralCode}
              </div>
              <div className="mt-[8px] text-[13px] font-[400] leading-[1.6] text-[#9A9A9A]">
                {isReferralCopied ? t('home.referralCopied') : t('home.referralCopyHint')}
              </div>
            </div>
            <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[12px] border border-[#222222] bg-[#1A1A1A] text-[#D4AF37]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="5" y="3" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3 11V5a2 2 0 0 1 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className="mt-[18px] grid grid-cols-2 gap-[12px] border-t border-[#222222] pt-[18px]">
            <div>
              <div className="text-[12px] font-[400] text-[#9A9A9A]">{t('home.invitedUsersLabel')}</div>
              <div className="mt-[6px] text-[20px] font-[600] text-[#FFFFFF]">{invitedUsersCount}</div>
            </div>
            <div>
              <div className="text-[12px] font-[400] text-[#9A9A9A]">{t('home.discountLabel')}</div>
              <div className="mt-[6px] text-[20px] font-[600] text-[#FFFFFF]">{benefits.totalDiscountPercent.toFixed(1)}%</div>
            </div>
          </div>
        </button>

        <section className="rounded-[16px] border border-[#222222] bg-[#111111] px-[24px] py-[24px]">
          <div className="flex items-center gap-[8px] text-[12px] font-[400] text-[#9A9A9A]">
            <span className={`h-[8px] w-[8px] rounded-full ${latestActiveOrder ? activeOrderStatusDotClass : 'bg-[#222222]'}`}></span>
            <span>{latestActiveOrder ? t(`orderStatus.${latestActiveOrder.status}`) : t('home.orderPendingManager')}</span>
          </div>
          {latestActiveOrder ? (
            <>
              <div className="mt-[12px] text-[18px] font-[600] text-[#FFFFFF]">{t('home.orderNumber', { id: latestActiveOrder.id })}</div>
              <div className="mt-[8px] text-[14px] font-[400] leading-[1.7] text-[#9A9A9A]">
                {latestActiveOrder.giveAmount} {latestActiveOrder.giveCurrency} {'->'} {latestActiveOrder.getAmount} {latestActiveOrder.getCurrency}
              </div>
              <div className="mt-[8px] text-[12px] font-[400] text-[#9A9A9A]">
                {t(`cities.${latestActiveOrder.cityKey}`)} · {new Date(latestActiveOrder.createdAt).toLocaleString(language)}
              </div>
              <button
                type="button"
                onClick={handleOpenHistory}
                className="mt-[16px] rounded-[12px] border border-[#222222] px-[14px] py-[11px] text-[12px] font-[400] text-[#FFFFFF] transition-colors hover:border-[#D4AF37] hover:text-[#D4AF37]"
              >
                {t('home.openOrderHistory')}
              </button>
            </>
          ) : (
            <div className="mt-[12px] text-[14px] font-[400] leading-[1.7] text-[#9A9A9A]">
              {t('home.historyEmpty')}
            </div>
          )}
        </section>

        <section className="px-[8px] py-[4px]">
          <div className="text-[11px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">{t('home.rateLabel')}</div>
          <div className="mt-[10px] text-left text-[28px] font-[600] leading-[1.15] text-[#FFFFFF]">1 EUR = {rates.EUR_USDT.toFixed(4)} USDT</div>
          <div className="mt-[8px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.rateUpdated', { time: formattedRateUpdatedAt })}</div>
        </section>

        <section className="space-y-[12px] px-[8px] py-[4px] text-[14px]">
          <div className="flex items-center justify-between gap-[12px]">
            <span className="font-[400] text-[#9A9A9A]">{t('home.commissionLabel')}</span>
            <span className="text-right font-[600] text-[#FFFFFF]">{benefits.effectiveCommissionPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between gap-[12px]">
            <span className="font-[400] text-[#9A9A9A]">{t('home.discountLabel')}</span>
            <span className="text-right font-[600] text-[#FFFFFF]">{benefits.totalDiscountPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between gap-[12px]">
            <span className="font-[400] text-[#9A9A9A]">{t('home.reserveUsdt')}</span>
            <span className="text-right font-[600] text-[#FFFFFF]">{usdtReserve.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between gap-[12px]">
            <span className="font-[400] text-[#9A9A9A]">{t('home.reserveCash')}</span>
            <span className="text-right font-[600] text-[#FFFFFF]">{totalCashReserve.toFixed(0)}€</span>
          </div>
        </section>

        <button
          type="button"
          onClick={handleOpenExchange}
          className="w-full rounded-[12px] bg-[#D4AF37] px-[24px] py-[16px] text-[13px] font-[600] uppercase tracking-[0.08em] text-[#000000] transition-opacity hover:opacity-90"
        >
          {t('home.quickExchangeAction')}
        </button>
      </div>
    </motion.div>
  );
}
