import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { calculateCustomerMetrics, getCustomerBenefits, isOrderOwnedByUser } from '../lib/customer';
import { getAllowedTargetAssets, getAssetCurrency, getAssetLabel, getRouteLabel } from '../lib/exchangeAssets';
import { getAssetConversionRate } from '../lib/rates';

function AssetIcon({ asset }: { asset: 'EUR_CASH' | 'UAH_CARD' | 'USDT' }) {
  if (asset === 'EUR_CASH') {
    return (
      <div className="flex h-[20px] w-[20px] items-center justify-center text-[14px]">
        <span>🇪🇺</span>
      </div>
    );
  }

  if (asset === 'UAH_CARD') {
    return (
      <div className="flex h-[20px] w-[20px] items-center justify-center text-[14px]">
        <span>🇺🇦</span>
      </div>
    );
  }

  return (
    <div className="flex h-[20px] w-[20px] items-center justify-center">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="none" stroke="#00CC66" strokeWidth="1.2" />
        <text x="8" y="11.2" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#00CC66">₮</text>
      </svg>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { 
    rates, 
    rateUpdatedAt,
    orders, 
    usdtReserve,
    cities,
    selectedCityId,
    profileSettings,
    selectedGiveAsset,
    selectedGetAsset,
    giveAmount,
    getAmount,
    setCity,
    setGiveAmount,
    setGiveAsset,
    setGetAsset,
    clearCheckoutPrefill,
    setCommissionPercent
  } = useStore();

  const user = WebApp.initDataUnsafe?.user;
  const currentUserId = user?.id ? String(user.id) : null;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));
  
  const [isReferralCopied, setIsReferralCopied] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [activeAssetSheet, setActiveAssetSheet] = useState<'give' | 'get' | null>(null);
  const [isAmountConfirmed, setIsAmountConfirmed] = useState(false);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(!selectedCityId);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(
    () => calculateCustomerMetrics(orders, currentUserHandle, currentUserId),
    [currentUserHandle, currentUserId, orders],
  );
  const benefits = useMemo(
    () => getCustomerBenefits(metrics, profileSettings.activatedReferralCode),
    [metrics, profileSettings.activatedReferralCode],
  );

  useEffect(() => {
    setCommissionPercent(benefits.effectiveCommissionPercent);
  }, [benefits.effectiveCommissionPercent, setCommissionPercent]);

  useEffect(() => {
    if (!selectedCityId) {
      setIsCityPickerOpen(true);
    }
  }, [selectedCityId]);

  const currentUserOrders = useMemo(
    () => orders.filter((order) => isOrderOwnedByUser(order, currentUserHandle, currentUserId)),
    [currentUserHandle, currentUserId, orders],
  );

  const latestActiveOrder = useMemo(
    () => currentUserOrders.find((order) => order.status === 'accepted' || order.status === 'processing' || order.status === 'ready') ?? null,
    [currentUserOrders],
  );

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!query) return cities;
    return cities.filter((city) => t(`cities.${city.cityKey}`).toLowerCase().includes(query));
  }, [cities, citySearch, t]);

  const currentCity = cities.find((city) => city.id === selectedCityId) ?? null;
  const eurCashAmount = selectedGiveAsset === 'EUR_CASH' ? Number(giveAmount) : selectedGetAsset === 'EUR_CASH' ? Number(getAmount) : 0;
  const usdtAmount = selectedGetAsset === 'USDT' ? Number(getAmount) : selectedGiveAsset === 'USDT' ? Number(giveAmount) : 0;
  const isOverLimit = eurCashAmount > 500;
  const isCityMissing = !currentCity;
  const isCityInactive = currentCity ? !currentCity.isActive : false;
  const isCashReserveInsufficient = selectedGetAsset === 'EUR_CASH' ? (currentCity ? eurCashAmount > currentCity.limitEUR : false) : false;
  const isUsdtReserveInsufficient = selectedGetAsset === 'USDT' ? usdtAmount > usdtReserve : false;
  const isEurInvalid = selectedGiveAsset === 'EUR_CASH' && (Number(giveAmount) % 10 !== 0 || Number(giveAmount) % 1 !== 0);
  const isReserveBlocked = isCityMissing || isCityInactive || isCashReserveInsufficient || isUsdtReserveInsufficient;
  const isValid = Number(giveAmount) > 0 && !isOverLimit && !isReserveBlocked && (!isEurInvalid || Number(giveAmount) === 0);
  
  const reserveMessage =
    isCityMissing
      ? t('home.cityRequired')
      : isCityInactive
        ? t('home.cityInactive')
        : isUsdtReserveInsufficient
          ? t('home.usdtReserveError')
          : isCashReserveInsufficient
            ? t('home.cityCashReserveError')
            : null;

  const handleOpenProfile = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate('/profile');
  };

  const handleOpenSupport = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    WebApp.openTelegramLink('https://t.me/cryptobull_manager');
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

  const scrollToCalculator = () => {
    WebApp.HapticFeedback.impactOccurred('medium');
    calculatorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSwapDirection = () => {
    WebApp.HapticFeedback.impactOccurred('medium');
    const nextGiveAmount = getAmount || '';
    setGiveAsset(selectedGetAsset);
    setGetAsset(selectedGiveAsset);
    setGiveAmount(nextGiveAmount);
    setActiveAssetSheet(null);
  };

  const handleSelectAsset = (field: 'give' | 'get', asset: 'EUR_CASH' | 'UAH_CARD' | 'USDT') => {
    WebApp.HapticFeedback.selectionChanged();
    if (field === 'give') {
      const nextGiveAmount = getAmount || '';
      setGiveAsset(asset);
      setGiveAmount(nextGiveAmount);
    } else {
      setGetAsset(asset);
    }
    setActiveAssetSheet(null);
  };

  const handleNext = () => {
    if (!isValid) return;
    WebApp.HapticFeedback.impactOccurred('medium');
    clearCheckoutPrefill();
    navigate('/checkout');
  };

  const handleConfirmAmount = () => {
    amountInputRef.current?.blur();
    if (giveAmount) {
      setIsAmountConfirmed(true);
      WebApp.HapticFeedback.selectionChanged();
    }
  };

  const currentRate = getAssetConversionRate(selectedGiveAsset, selectedGetAsset, rates);
  const formattedRateUpdatedAt = new Date(rateUpdatedAt).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const giveAssetOptions = ['EUR_CASH', 'UAH_CARD', 'USDT'] as const;
  const getAssetOptions = getAllowedTargetAssets(selectedGiveAsset);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col px-[16px] pb-[24px]"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        {/* ВЕРХНИЙ БЛОК: Приветствие и Авторизация */}
        <header className="mb-[24px] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[14px] font-[500] text-[#9A9A9A]">{t('home.goodAfternoon')}</span>
            <div className="flex items-center gap-[8px]">
              <span className="text-[20px] font-[800] text-[#FFFFFF]">{t('home.brandName')}</span>
              <img src="/logo.jpeg" alt="CryptoBull Logo" className="h-[24px] w-[24px] rounded-full object-cover shadow-[0_0_10px_rgba(0,204,102,0.2)]" />
            </div>
          </div>
          <div className="flex items-center gap-[12px]">
            <LanguageSwitcher />
            <button 
              onClick={handleOpenProfile}
              className="flex shrink-0 h-[40px] w-[40px] items-center justify-center rounded-full bg-gradient-to-br from-[#00CC66] to-[#00994C] text-[18px] font-[700] text-[#000000] shadow-[0_0_15px_rgba(0,204,102,0.3)]"
            >
              {user?.first_name ? user.first_name.charAt(0).toUpperCase() : 'K'}
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col space-y-[12px]">
          {/* Главный блок коммерческих показателей */}
          <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] p-[20px]">
            <div className="absolute right-0 top-0 h-full w-[45%] opacity-80">
              <div className="absolute inset-0 bg-[url('https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=3d%20golden%20bull%20head%20statue%20dark%20background&image_size=square')] bg-cover bg-center bg-no-repeat mix-blend-screen" />
            </div>
            <div className="relative z-10 w-[65%]">
              <div className="inline-flex items-center gap-[6px] rounded-full bg-[#111111]/80 px-[8px] py-[4px] backdrop-blur-sm">
                <div className="h-[6px] w-[6px] rounded-full bg-[#00CC66]" />
                <span className="text-[10px] font-[500] text-[#FFFFFF]">{t('home.onlineAverageTime')}</span>
              </div>
              <div className="mt-[16px] text-[12px] font-[500] uppercase tracking-wider text-[#9A9A9A]">
                {t('home.bestRateToday')}
              </div>
              <div className="mt-[4px] text-[24px] font-[700] leading-tight text-[#FFFFFF]">
                1 EUR = <br />{rates.EUR_USDT.toFixed(4)} USDT
              </div>
              <div className="mt-[8px] text-[11px] font-[400] text-[#808080]">
                {t('home.rateUpdated', { time: formattedRateUpdatedAt })}
              </div>
            </div>
          </section>

          {/* Строка статуса (если есть активная заявка) */}
          {latestActiveOrder && (
            <div className="flex items-center justify-between rounded-[12px] bg-[#1A1A1A]/50 px-[16px] py-[12px] border border-[#222222]">
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

          {/* Основной элемент действия (Скролл к калькулятору) */}
          <button
            type="button"
            onClick={scrollToCalculator}
            className="flex w-full items-center justify-between rounded-[16px] bg-gradient-to-r from-[#00CC66] to-[#00994C] px-[24px] py-[18px] transition-opacity hover:opacity-90 shadow-[0_4px_14px_rgba(0,204,102,0.25)]"
          >
            <span className="text-[15px] font-[700] uppercase tracking-wider text-[#000000]">
              {t('home.quickExchange')}
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          {/* Панель критериев эффективности */}
          <section className="flex gap-[8px]">
            <div className="flex flex-1 flex-col items-center justify-center rounded-[16px] bg-[#111111] p-[12px] text-center">
              <div className="mb-[4px] text-[16px]">⭐</div>
              <div className="text-[11px] font-[600] text-[#FFFFFF]">{t('home.ratingLabel')}</div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center rounded-[16px] bg-[#111111] p-[12px] text-center">
              <div className="mb-[4px] text-[16px]">🛡️</div>
              <div className="text-[11px] font-[600] text-[#FFFFFF]">{t('home.successfulExchanges')}</div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center rounded-[16px] bg-[#111111] p-[12px] text-center">
              <div className="mb-[4px] text-[16px]">⏱️</div>
              <div className="text-[11px] font-[600] text-[#FFFFFF]">{t('home.averageExecutionTime')}</div>
            </div>
          </section>

          {/* Блок архивных транзакций */}
          <section className="rounded-[16px] bg-[#111111] p-[20px]">
            <div className="mb-[16px] flex items-center justify-between">
              <h2 className="text-[12px] font-[700] uppercase tracking-wider text-[#9A9A9A]">
                {t('home.recentExchanges')}
              </h2>
              <button onClick={() => navigate('/orders')} className="text-[12px] font-[500] text-[#00CC66]">
                {t('home.seeAll')}
              </button>
            </div>
            <div className="space-y-[12px]">
              {currentUserOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center gap-[12px]">
                  <div className="h-[8px] w-[8px] rounded-full bg-[#00CC66]" />
                  <div className="flex flex-1 items-center justify-between text-[14px]">
                    <span className="font-[600] text-[#FFFFFF]">
                      {order.giveCurrency === 'EUR' ? '€' : ''}{order.giveAmount} → {order.getCurrency}
                    </span>
                    <span className="text-[12px] font-[400] text-[#808080]">
                      {new Date(order.createdAt).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {currentUserOrders.length === 0 && (
                <div className="text-[13px] font-[400] text-[#808080]">
                  {t('home.historyEmpty')}
                </div>
              )}
            </div>
          </section>

          {/* Двухстолбцовый блок */}
          <section className="flex gap-[8px]">
            <div className="flex flex-1 flex-col justify-between rounded-[16px] bg-[#111111] p-[16px]">
              <div>
                <div className="mb-[8px] text-[20px]">🌍</div>
                <h3 className="mb-[8px] text-[11px] font-[700] uppercase tracking-wider text-[#9A9A9A]">
                  {t('home.workingWorldwide')}
                </h3>
                <div className="text-[13px] font-[600] leading-snug text-[#FFFFFF]">
                  {t('home.globalCitiesList')}
                </div>
              </div>
              <div className="mt-[12px] text-[11px] font-[500] text-[#808080]">
                {t('home.andMoreCities')}
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-between rounded-[16px] bg-[#1A1A1A] p-[16px]">
              <div>
                <div className="mb-[8px] text-[20px]">👥</div>
                <h3 className="mb-[8px] text-[11px] font-[700] uppercase tracking-wider text-[#00CC66]">
                  {t('home.inviteFriendsTitle')}
                </h3>
                <div className="text-[13px] font-[600] leading-snug text-[#FFFFFF]">
                  {t('home.inviteFriendsText')}
                </div>
              </div>
              <button className="mt-[12px] text-left text-[11px] font-[700] text-[#00CC66]">
                {t('home.learnMoreArrow')}
              </button>
            </div>
          </section>

          {/* Панель поддержки */}
          <section className="flex items-center justify-between rounded-[16px] bg-[#111111] p-[16px]">
            <div className="flex items-center gap-[12px]">
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[#1A1A1A] text-[20px]">
                🎧
              </div>
              <div>
                <div className="text-[14px] font-[600] text-[#FFFFFF]">{t('home.supportTitle')}</div>
                <div className="text-[12px] font-[400] text-[#808080]">{t('home.supportSubtitle')}</div>
              </div>
            </div>
            <button
              onClick={handleOpenSupport}
              className="flex items-center gap-[6px] rounded-full bg-[#1A1A1A] px-[16px] py-[8px] text-[13px] font-[500] text-[#FFFFFF] transition-colors hover:bg-[#222222]"
            >
              {t('home.writeMessage')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </section>

          {/* НИЖНИЙ БЛОК: Калькулятор обмена */}
          <div ref={calculatorRef} className="pt-[16px]">
            <h3 className="mb-[16px] flex items-center text-[18px] font-[700] text-[#FFFFFF]">
              <span className="mr-[8px] h-[16px] w-[4px] rounded-full bg-[#00CC66]" />
              {t('home.calculatorTitle')}
            </h3>

            <section className="premium-animated-calculator relative overflow-hidden rounded-[24px] border border-[#222222] p-[20px] shadow-lg">
              {/* Декоративный внутренний блик */}
              <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 bg-[#00CC66] opacity-[0.03] blur-3xl" />

              <div className="relative z-10 mb-[16px] flex items-center justify-between">
                <span className="text-[12px] font-[600] uppercase tracking-wider text-[#9A9A9A]">{t('home.rateNow')}</span>
                <div className="flex items-center gap-[6px]">
                  <div className="h-[6px] w-[6px] rounded-full bg-[#00CC66]" />
                  <span className="text-[13px] font-[600] text-[#FFFFFF]">
                    1 {getAssetLabel(selectedGiveAsset, language)} = {currentRate.toFixed(4)} {getAssetCurrency(selectedGetAsset)}
                  </span>
                </div>
              </div>

              {/* Поле ввода (Отдаёте) */}
              <div className="relative z-10">
                <label className="mb-[6px] block text-[12px] font-[500] text-[#9A9A9A]">{t('home.youGive')}</label>
                <div className="glass-input-field flex items-center justify-between gap-[12px] rounded-[16px] p-[12px] transition-all duration-300 focus-within:border-[#00CC66]/50">
                  <input
                    ref={amountInputRef}
                    type="number"
                    value={giveAmount}
                    onChange={(e) => {
                      setIsAmountConfirmed(false);
                      setGiveAmount(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmAmount();
                    }}
                    placeholder="0"
                    min="0"
                    step={selectedGiveAsset === 'EUR_CASH' ? '10' : '0.01'}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-[24px] font-[700] text-[#FFFFFF] outline-none placeholder:text-[#333333]"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveAssetSheet('give')}
                    className="flex shrink-0 items-center gap-[6px] rounded-[12px] border border-white/5 bg-black/60 px-[12px] py-[8px]"
                  >
                    <span className="text-[16px]">{selectedGiveAsset === 'EUR_CASH' ? '🇪🇺' : selectedGiveAsset === 'UAH_CARD' ? '🇺🇦' : '₮'}</span>
                    <span className="text-[14px] font-[600] text-[#FFFFFF]">{getAssetCurrency(selectedGiveAsset)}</span>
                  </button>
                </div>
              </div>

              {/* Указатель направления */}
              <div className="relative z-20 -my-[16px] flex justify-center">
                <button 
                  onClick={handleSwapDirection}
                  className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#00CC66] text-[#000000] shadow-lg shadow-[#00CC66]/30 transition-transform duration-300 hover:scale-110 active:scale-95"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21 16-4 4-4-4" />
                    <path d="M17 20V4" />
                    <path d="m3 8 4-4 4 4" />
                    <path d="M7 4v16" />
                  </svg>
                </button>
              </div>

              {/* Поле вывода (Получаете) */}
              <div className="relative z-10 mt-[16px]">
                <label className="mb-[6px] block text-[12px] font-[500] text-[#9A9A9A]">{t('home.youGet')}</label>
                <div className="glass-input-field flex items-center justify-between gap-[12px] rounded-[16px] p-[12px]">
                  <div className={`min-w-0 flex-1 truncate text-[24px] font-[700] ${getAmount ? 'text-[#FFFFFF] opacity-90' : 'text-[#333333]'}`}>
                    {getAmount || '0'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveAssetSheet('get')}
                    className="flex shrink-0 items-center gap-[6px] rounded-[12px] border border-white/5 bg-black/60 px-[12px] py-[8px]"
                  >
                    <span className="text-[16px]">{selectedGetAsset === 'EUR_CASH' ? '🇪🇺' : selectedGetAsset === 'UAH_CARD' ? '🇺🇦' : '₮'}</span>
                    <span className="text-[14px] font-[600] text-[#00CC66]">{getAssetCurrency(selectedGetAsset)}</span>
                  </button>
                </div>
              </div>
              
              <div className="relative z-10 mt-[16px] flex items-center justify-between border-t border-[#222222] pt-[16px] text-[13px]">
                <div className="flex items-center gap-[8px] text-[#9A9A9A]">
                  <span className="inline-flex h-[20px] w-[20px] items-center justify-center rounded-full border border-[#222222] bg-[#1A1A1A] text-[#00CC66]">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.2l3 3L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="opacity-80">{t('home.commissionIncluded')}</span>
                </div>
                <div className="flex items-center gap-[10px]">
                  <div className="rounded border border-[#00CC66]/20 bg-[#00CC66]/10 px-2 py-0.5 text-right font-[700] tracking-wide text-[#00CC66]">{benefits.effectiveCommissionPercent.toFixed(1)}%</div>
                </div>
              </div>
            </section>

            {/* Выбор города */}
            <section className="mt-[16px] rounded-[24px] border border-[#222222] bg-[#111111] p-[20px]">
              <div className="mb-[16px] text-[12px] font-[600] uppercase tracking-wider text-[#9A9A9A]">{t('home.cityTitle')}</div>
              {currentCity && !isCityPickerOpen ? (
                <div className="mt-[12px] space-y-[12px]">
                  <div className="flex w-full items-center gap-[12px] rounded-[12px] bg-[#1A1A1A] px-[12px] py-[14px] text-left">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-[600] text-[#FFFFFF]">
                        {t(`cities.${currentCity.cityKey}`).startsWith('cities.') ? currentCity.cityKey : t(`cities.${currentCity.cityKey}`)}
                      </div>
                      {!currentCity.isActive && (
                        <div className="mt-[4px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.cityInactive')}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-[12px] font-[400] text-[#00CC66]">{t('home.citySelected')}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      WebApp.HapticFeedback.selectionChanged();
                      setCitySearch('');
                      setIsCityPickerOpen(true);
                    }}
                    className="w-full rounded-[12px] border border-[#222222] bg-transparent px-[14px] py-[12px] text-[13px] font-[400] text-[#FFFFFF] transition-colors hover:border-[#00CC66] hover:text-[#00CC66]"
                  >
                    {t('home.chooseOtherCity')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="sticky top-0 mt-[12px] bg-[#111111] pb-[12px]">
                    <input
                      type="text"
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      placeholder={t('home.searchPlaceholder')}
                      className="w-full rounded-[12px] border border-[#222222] bg-[#1A1A1A] px-[16px] py-[14px] text-[14px] text-[#FFFFFF] outline-none placeholder:text-[#9A9A9A]"
                    />
                  </div>

                  <div className="space-y-[4px] max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredCities.map((city) => (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => {
                          WebApp.HapticFeedback.selectionChanged();
                          setCity(city.id);
                          setCitySearch('');
                          setIsCityPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-[12px] rounded-[12px] border border-transparent px-[12px] py-[14px] text-left transition-colors hover:bg-[#1A1A1A]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-[600] text-[#FFFFFF]">
                            {t(`cities.${city.cityKey}`).startsWith('cities.') ? city.cityKey : t(`cities.${city.cityKey}`)}
                          </div>
                          {!city.isActive && (
                            <div className="mt-[4px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.cityInactive')}</div>
                          )}
                        </div>
                      </button>
                    ))}
                    {filteredCities.length === 0 && (
                      <div className="rounded-[12px] bg-[#1A1A1A] px-[14px] py-[14px] text-[13px] font-[400] text-[#9A9A9A]">
                        {t('home.noCitiesFound')}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {Number(giveAmount) > 0 && (isOverLimit || isEurInvalid || !!reserveMessage) && (
              <div className="mt-[12px] rounded-[16px] border border-[#3A2323] bg-[#1A1010] px-[16px] py-[14px] text-[13px] font-[400] text-[#F1C6C6]">
                {isOverLimit ? t('home.limitError') : reserveMessage ?? t('home.amountError')}
              </div>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!isValid}
              className={`mt-[16px] w-full rounded-[16px] px-[24px] py-[18px] text-[15px] font-[700] uppercase tracking-[0.08em] transition-opacity ${isValid ? 'bg-[#00CC66] text-[#000000] hover:opacity-90 shadow-[0_4px_14px_rgba(0,204,102,0.25)]' : 'bg-[#1A1A1A] text-[#808080]'}`}
            >
              {selectedGiveAsset === 'EUR_CASH' ? t('home.ctaCash') : t('home.ctaUsdt')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Asset Selection Sheet */}
      {activeAssetSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.8)] px-[16px] backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close asset sheet"
            onClick={() => setActiveAssetSheet(null)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-[380px] rounded-[24px] border border-[#222222] bg-[#111111] px-[20px] py-[24px] shadow-2xl">
            <div className="mb-[16px] text-center text-[12px] font-[600] uppercase tracking-[0.12em] text-[#9A9A9A]">
              {activeAssetSheet === 'give' ? t('home.youGive') : t('home.youGet')}
            </div>
            <div className="grid grid-cols-3 gap-[8px]">
              {(activeAssetSheet === 'give' ? giveAssetOptions : getAssetOptions).map((asset: 'EUR_CASH' | 'UAH_CARD' | 'USDT') => {
                const isSelected = (activeAssetSheet === 'give' ? selectedGiveAsset : selectedGetAsset) === asset;

                return (
                  <button
                    key={asset}
                    type="button"
                    onClick={() => handleSelectAsset(activeAssetSheet, asset)}
                    className={`flex min-h-[84px] w-full flex-col items-center justify-center gap-[8px] rounded-[16px] px-[10px] py-[14px] text-center transition-colors ${isSelected ? 'bg-[#1A1A1A] border border-[#00CC66]' : 'bg-[#151515] border border-transparent hover:bg-[#1A1A1A]'}`}
                  >
                    <AssetIcon asset={asset} />
                    <span className="text-[14px] font-[600] text-[#FFFFFF]">{getAssetLabel(asset, language)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}