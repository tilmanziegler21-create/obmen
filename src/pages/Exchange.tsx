import { useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { isOrderOwnedByUser } from '../lib/customer';
import { getAssetLabel, getAssetCurrency } from '../lib/exchangeAssets';
import { getAssetConversionRate } from '../lib/rates';

export default function Exchange() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { 
    rates, 
    orders, 
    profileSettings,
    selectedGiveAsset,
    selectedGetAsset,
    giveAmount,
    getAmount,
    setGiveAmount,
    setGiveAsset,
    setGetAsset,
    clearCheckoutPrefill,
  } = useStore();

  const user = WebApp.initDataUnsafe?.user;
  const currentUserId = user?.id ? String(user.id) : null;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));
  
  const [isReferralCopied, setIsReferralCopied] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const currentUserOrders = useMemo(
    () => orders.filter((order) => isOrderOwnedByUser(order, currentUserHandle, currentUserId)),
    [currentUserHandle, currentUserId, orders],
  );

  const latestActiveOrder = useMemo(
    () => currentUserOrders.find((order) => order.status === 'accepted' || order.status === 'processing' || order.status === 'ready') ?? null,
    [currentUserOrders],
  );

  const handleOpenExchange = () => {
    WebApp.HapticFeedback.impactOccurred('medium');
    clearCheckoutPrefill();
    navigate('/checkout');
  };

  const handleOpenProfile = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate('/profile');
  };

  const handleCopyReferralCode = async () => {
    const referralCode = profileSettings.referralCode.trim();
    if (!referralCode) return;

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

  const handleSwapDirection = () => {
    WebApp.HapticFeedback.impactOccurred('medium');
    const nextGiveAmount = getAmount || '';
    setGiveAsset(selectedGetAsset);
    setGetAsset(selectedGiveAsset);
    setGiveAmount(nextGiveAmount);
  };

  const currentRate = getAssetConversionRate(selectedGiveAsset, selectedGetAsset, rates);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col px-[16px] pb-[24px]"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
    >
      {/* 1. Верхняя область приветствия и авторизации */}
      <header className="mb-[24px] flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[14px] font-[500] text-[#9A9A9A]">{t('home.goodAfternoon')}</span>
          <span className="text-[20px] font-[800] text-[#FFFFFF]">{t('home.brandName')}</span>
        </div>
        <button 
          onClick={handleOpenProfile}
          className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-gradient-to-br from-[#00CC66] to-[#00994C] text-[18px] font-[700] text-[#000000] shadow-[0_0_15px_rgba(0,204,102,0.3)]"
        >
          {user?.first_name ? user.first_name.charAt(0).toUpperCase() : 'K'}
        </button>
      </header>

      <div className="space-y-[12px] flex-1 flex flex-col">
        {/* 2. Центральный модуль калькулятора и мониторинга */}
        <section className="rounded-[24px] bg-[#111111] p-[20px] shadow-lg">
          {/* Информационная строка курса */}
          <div className="mb-[16px] flex items-center justify-between">
            <span className="text-[12px] font-[600] uppercase tracking-wider text-[#9A9A9A]">{t('home.rateNow')}</span>
            <div className="flex items-center gap-[6px]">
              <div className="h-[6px] w-[6px] rounded-full bg-[#00D084]" />
              <span className="text-[13px] font-[600] text-[#FFFFFF]">
                1 {getAssetLabel(selectedGiveAsset, language)} = {currentRate.toFixed(4)} {getAssetCurrency(selectedGetAsset)}
              </span>
            </div>
          </div>

          {/* Поле ввода (Отдаёте) */}
          <div className="relative rounded-[16px] bg-[#1A1A1A] p-[16px]">
            <div className="mb-[4px] text-[12px] font-[500] text-[#9A9A9A]">{t('home.youGive')}</div>
            <div className="flex items-center justify-between">
              <input
                ref={amountInputRef}
                type="number"
                value={giveAmount}
                onChange={(e) => setGiveAmount(e.target.value)}
                placeholder="0"
                min="0"
                step={selectedGiveAsset === 'EUR_CASH' ? '10' : '0.01'}
                inputMode="decimal"
                className="w-full bg-transparent text-[32px] font-[700] text-[#FFFFFF] outline-none placeholder:text-[#333333]"
              />
              <div className="flex shrink-0 items-center gap-[6px] rounded-[12px] bg-[#222222] px-[12px] py-[8px]">
                <span className="text-[16px]">{selectedGiveAsset === 'EUR_CASH' ? '🇪🇺' : selectedGiveAsset === 'UAH_CARD' ? '🇺🇦' : '₮'}</span>
                <span className="text-[14px] font-[600] text-[#FFFFFF]">{getAssetCurrency(selectedGiveAsset)}</span>
              </div>
            </div>
          </div>

          {/* Указатель направления */}
          <div className="relative z-10 -my-[12px] flex justify-center">
            <button 
              onClick={handleSwapDirection}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-full border-4 border-[#111111] bg-gradient-to-b from-[#00CC66] to-[#00994C] text-[#000000] shadow-md transition-transform hover:scale-105 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Поле вывода (Получаете) */}
          <div className="relative rounded-[16px] bg-[#1A1A1A] p-[16px]">
            <div className="mb-[4px] text-[12px] font-[500] text-[#9A9A9A]">{t('home.youGet')}</div>
            <div className="flex items-center justify-between">
              <div className={`truncate text-[32px] font-[700] ${getAmount ? 'text-[#FFFFFF]' : 'text-[#333333]'}`}>
                {getAmount || '0'}
              </div>
              <div className="flex shrink-0 items-center gap-[6px] rounded-[12px] bg-[#222222] px-[12px] py-[8px]">
                <span className="text-[16px]">{selectedGetAsset === 'EUR_CASH' ? '🇪🇺' : selectedGetAsset === 'UAH_CARD' ? '🇺🇦' : '₮'}</span>
                <span className="text-[14px] font-[600] text-[#FFFFFF]">{getAssetCurrency(selectedGetAsset)}</span>
              </div>
            </div>
          </div>

          {/* Строка статуса (если есть активная заявка) */}
          {latestActiveOrder && (
            <div className="mt-[16px] flex items-center justify-between rounded-[12px] bg-[#1A1A1A]/50 px-[16px] py-[12px] border border-[#222222]">
              <div className="flex items-center gap-[8px]">
                <div className="h-[8px] w-[8px] rounded-full bg-[#00CC66]" />
                <span className="text-[13px] font-[500] text-[#FFFFFF]">
                  {t('home.orderProcessing', { id: latestActiveOrder.id })}
                </span>
              </div>
              <button onClick={() => navigate('/orders')} className="text-[#9A9A9A]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </section>

        {/* 3. Главный орган управления */}
        <button
          type="button"
          onClick={handleOpenExchange}
          disabled={!giveAmount || Number(giveAmount) <= 0}
          className="w-full rounded-[16px] bg-gradient-to-r from-[#00CC66] to-[#00994C] px-[24px] py-[18px] text-[16px] font-[700] uppercase tracking-wider text-[#000000] shadow-[0_4px_14px_rgba(0,204,102,0.25)] transition-opacity disabled:opacity-50 disabled:shadow-none"
        >
          {t('home.quickExchange')}
        </button>

        {/* 4. Информационные карточки остатков */}
        <div className="flex gap-[8px]">
          <div className="flex flex-1 flex-col justify-center rounded-[16px] bg-[#111111] p-[16px]">
            <div className="flex items-center gap-[6px] mb-[8px]">
              <div className="h-[6px] w-[6px] rounded-full bg-[#00D084]" />
              <span className="text-[14px] font-[600] text-[#FFFFFF]">USDT</span>
            </div>
            <div className="text-[13px] font-[500] text-[#9A9A9A]">{t('home.available')}</div>
          </div>
          <div className="flex flex-1 flex-col justify-center rounded-[16px] bg-[#111111] p-[16px]">
            <div className="flex items-center gap-[6px] mb-[8px]">
              <div className="h-[6px] w-[6px] rounded-full bg-[#00D084]" />
              <span className="text-[14px] font-[600] text-[#FFFFFF]">EUR наличные</span>
            </div>
            <div className="text-[13px] font-[500] text-[#9A9A9A]">{t('home.availableUpTo')}</div>
          </div>
        </div>

        <div className="flex-1" /> {/* Spacer */}

        {/* 5. Модуль приглашения (Реферальная система) */}
        <section className="flex items-center justify-between rounded-[16px] bg-[#111111] p-[16px]">
          <span className="text-[14px] font-[500] text-[#9A9A9A]">{t('home.yourCode')}</span>
          <button 
            onClick={handleCopyReferralCode}
            className="flex items-center gap-[8px] rounded-[8px] bg-[#1A1A1A] px-[12px] py-[8px] transition-colors hover:bg-[#222222]"
          >
            <span className="font-mono text-[14px] font-[700] tracking-wider text-[#00CC66]">
              {profileSettings.referralCode}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isReferralCopied ? "#00D084" : "#00CC66"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isReferralCopied ? (
                <path d="M20 6L9 17l-5-5" />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
              )}
            </svg>
          </button>
        </section>
      </div>
    </motion.div>
  );
}
