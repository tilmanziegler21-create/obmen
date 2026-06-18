import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import WebApp from '@twa-dev/sdk';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';
import { calculateCustomerMetrics, getClientRate, getCustomerBenefits } from '../lib/customer';
import { getAssetConversionRate } from '../lib/rates';
import { getAssetCurrency, getAssetLabel, getDirectionFromGiveAsset } from '../lib/exchangeAssets';

export default function Checkout() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const defaultContact = WebApp.initDataUnsafe?.user?.username ? `@${WebApp.initDataUnsafe.user.username}` : '';
  const telegramInitData = WebApp.initData || '';
  const telegramUserId = WebApp.initDataUnsafe?.user?.id ?? null;
  const { 
    cities, selectedCityId, selectedGiveAsset, selectedGetAsset, rates, usdtReserve, antiPhishingCode, checkoutPrefill, orders, profileSettings,
    giveAmount, getAmount, clearCheckoutPrefill, setCommissionPercent, fetchInitialData
  } = useStore();
  const NETWORKS = [
    { id: 'TRC-20', label: 'TRC-20', time: t('checkout.networkTimes.trc20') },
    { id: 'ERC-20', label: 'ERC-20', time: t('checkout.networkTimes.erc20') },
    { id: 'TON', label: 'TON', time: t('checkout.networkTimes.ton') },
  ];

  const [contact, setContact] = useState(checkoutPrefill.contact || defaultContact);
  const [wallet, setWallet] = useState(checkoutPrefill.wallet);
  const [cardNumber, setCardNumber] = useState(checkoutPrefill.cardNumber || '');
  const [network, setNetwork] = useState(
    NETWORKS.some((item) => item.id === checkoutPrefill.network) ? checkoutPrefill.network : NETWORKS[0].id,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentUserId = telegramUserId ? String(telegramUserId) : null;
  const userHandle = WebApp.initDataUnsafe?.user?.username 
    ? `@${WebApp.initDataUnsafe.user.username}` 
    : (WebApp.initDataUnsafe?.user?.first_name || t('checkout.unknownUser'));

  const city = cities.find(c => c.id === selectedCityId);
  const cityName = city ? t(`cities.${city.cityKey}`) : '-';
  const direction = getDirectionFromGiveAsset(selectedGiveAsset);
  const requiresWallet = selectedGetAsset === 'USDT';
  const requiresContact = selectedGetAsset === 'EUR_CASH';
  const requiresCardNumber = selectedGiveAsset === 'UAH_CARD' || selectedGetAsset === 'UAH_CARD';
  const requiredCashReserve = selectedGetAsset === 'EUR_CASH' ? Number(getAmount) : 0;
  const requiredUsdtReserve = selectedGetAsset === 'USDT' ? Number(getAmount) : 0;
  const isReserveBlocked =
    !city ||
    !city.isActive ||
    (selectedGetAsset === 'EUR_CASH' && requiredCashReserve > city.limitEUR) ||
    (selectedGetAsset === 'USDT' && requiredUsdtReserve > usdtReserve);
  const metrics = useMemo(
    () => calculateCustomerMetrics(orders, userHandle, currentUserId),
    [currentUserId, orders, userHandle],
  );
  const benefits = useMemo(
    () => getCustomerBenefits(metrics, profileSettings.activatedReferralCode),
    [metrics, profileSettings.activatedReferralCode],
  );

  const handleBack = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate(-1);
  };

  const handleSubmit = async () => {
    if (isReserveBlocked) {
      setSubmitError(t('checkout.reserveError'));
      return;
    }

    WebApp.HapticFeedback.impactOccurred('heavy');
    setIsSubmitting(true);
    setSubmitError(null);
    
    let isSentSuccessfully = false;

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramInitData,
          order: {
            direction,
            giveAsset: selectedGiveAsset,
            cityId: city?.id ?? '',
            city: cityName,
            cityKey: city?.cityKey ?? 'berlin',
            giveAmount,
            giveCurrency: getAssetCurrency(selectedGiveAsset),
            getAsset: selectedGetAsset,
            getAmount,
            getCurrency: getAssetCurrency(selectedGetAsset),
            rate: effectiveRate.toFixed(4),
            network: requiresWallet ? network : null,
            wallet: requiresWallet ? wallet : null,
            contact: requiresContact ? contact : null,
            cardNumber: requiresCardNumber ? cardNumber : null,
            userHandle,
            userId: telegramUserId,
            antiPhishingCode,
            commissionPercent: benefits.effectiveCommissionPercent,
            discountPercent: benefits.totalDiscountPercent,
            referralCodeUsed: benefits.hasReferralActivated ? profileSettings.activatedReferralCode : null,
            managerName: null,
          },
        }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          responseData && typeof responseData.error === 'string'
            ? responseData.error
            : t('checkout.unknownUser');
        setSubmitError(t('checkout.telegramApiError', { message }));
        setIsSubmitting(false);
        return;
      }

      if (responseData?.state) {
        useStore.setState((state) => ({
          ...state,
          ...responseData.state,
          isLoading: false,
        }));
      } else {
        await fetchInitialData();
      }

      const createdOrder = responseData?.createdOrder;
      isSentSuccessfully = true;

      setTimeout(() => {
        WebApp.HapticFeedback.notificationOccurred('success');
        clearCheckoutPrefill();
        setIsSubmitting(false);

        navigate('/orders', {
          state: {
            orderId: createdOrder?.id ?? null,
            justCreated: true,
          },
        });
      }, 300);
    } catch (e) {
      console.error('Ошибка при отправке в backend:', e);
      setSubmitError(
        t('checkout.telegramNetworkError', {
          message: e instanceof Error ? e.message : t('checkout.unknownUser'),
        }),
      );
      setIsSubmitting(false);
      return;
    }

    if (!isSentSuccessfully) {
      setIsSubmitting(false);
    }
  };
  
  // Basic validation
  const isValid =
    (!requiresWallet || wallet.length > 10) &&
    (!requiresContact || contact.length > 2) &&
    (!requiresCardNumber || cardNumber.replace(/\s+/g, '').length >= 12);

  const currentRate = getAssetConversionRate(selectedGiveAsset, selectedGetAsset, rates);
  const effectiveRate = getClientRate(direction, currentRate, benefits.effectiveCommissionPercent);

  useEffect(() => {
    setCommissionPercent(benefits.effectiveCommissionPercent);
  }, [benefits.effectiveCommissionPercent, setCommissionPercent]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-[16px] pt-[20px]"
    >
      <div
        className="mb-[16px] flex items-center justify-between gap-[12px]"
        style={{ paddingTop: 'max(4px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-[12px]">
          <button onClick={handleBack} className="w-[36px] h-[36px] rounded-full bg-bg3 border border-border2 flex items-center justify-center text-muted hover:text-text transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 13l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-[20px] font-[700] text-text">{t('checkout.title')}</h1>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="space-y-[16px] flex-1">
        {checkoutPrefill.sourceOrderId && (
          <div className="rounded-r border border-green3 bg-green2 px-[16px] py-[12px] text-[12px] font-[700] text-green">
            <div>{t('checkout.quickExchangeBadge')}</div>
            <div className="mt-[4px] text-[11px] font-[600] uppercase tracking-[0.06em]">
              {t('checkout.repeatSource', { id: checkoutPrefill.sourceOrderId })}
            </div>
          </div>
        )}

        <div className="rounded-r border border-green3 bg-green2 px-[16px] py-[12px]">
          <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-green">{t('checkout.securityCodeTitle')}</div>
          <div className="mt-[6px] flex flex-col gap-[6px] min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
            <div className="text-[12px] font-[500] leading-relaxed text-text">{t('checkout.securityCodeHint')}</div>
            <div className="self-start rounded-[8px] border border-green3 bg-[rgba(10,11,15,0.35)] px-[10px] py-[6px] font-mono text-[13px] font-[700] tracking-[0.12em] text-green">
              {antiPhishingCode}
            </div>
          </div>
        </div>

        {/* Order Summary Card */}
        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <h2 className="text-[14px] font-[700] text-text mb-[16px]">{t('checkout.detailsTitle')}</h2>
          
          <div className="flex items-center justify-between gap-[12px] text-[13px]">
            <span className="text-muted font-[500]">{t('checkout.city')}</span>
            <span className="text-right font-[700] text-text">{cityName}</span>
          </div>
          
          <div className="flex items-center justify-between gap-[12px] text-[13px]">
            <span className="text-muted font-[500]">{t('checkout.youGive')}</span>
            <span className="text-right font-mono text-[15px] font-[600] text-text">
              {giveAmount} {getAssetLabel(selectedGiveAsset, language)}
            </span>
          </div>
          
          <div className="flex items-center justify-between gap-[12px] text-[13px]">
            <span className="text-muted font-[500]">{t('checkout.youGet')}</span>
            <span className="text-right font-mono text-[15px] font-[600] text-text">
              {getAmount} {getAssetLabel(selectedGetAsset, language)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-[12px] border-t border-border pt-[16px] text-[12px]">
            <span className="text-muted font-[500]">{t('checkout.fixedRate')}</span>
            <span className="text-right font-mono font-[600] text-text">
              1 {getAssetLabel(selectedGiveAsset, language)} = {effectiveRate.toFixed(4)} {getAssetCurrency(selectedGetAsset)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-[12px] text-[12px]">
            <span className="text-muted font-[500]">{t('checkout.personalCommission')}</span>
            <span className="text-right font-mono font-[600] text-text">{benefits.effectiveCommissionPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between gap-[12px] text-[12px]">
            <span className="text-muted font-[500]">{t('checkout.yourBenefit')}</span>
            <span className="text-right font-mono font-[600] text-green">{benefits.totalDiscountPercent.toFixed(1)}%</span>
          </div>
        </div>

        <div className="space-y-[16px]">
          {requiresCardNumber && (
            <div className="space-y-[8px]">
              <label className="ml-[4px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">Номер карты UAH</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="5375 4141 1234 5678"
                className="w-full rounded-r border-[1.5px] border-border2 bg-bg2 p-[16px] text-[14px] text-text outline-none transition-all placeholder:text-dim"
              />
            </div>
          )}

          {requiresWallet && (
            <div className="space-y-[16px]">
            <div className="space-y-[8px]">
              <label className="text-[11px] text-muted font-[600] uppercase tracking-[0.06em] ml-[4px]">{t('checkout.networkLabel')}</label>
              <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-3">
                {NETWORKS.map((net) => (
                  <button
                    key={net.id}
                    onClick={() => {
                      WebApp.HapticFeedback.selectionChanged();
                      setNetwork(net.id);
                    }}
                    className={`flex-1 py-[12px] rounded-[12px] transition-all flex flex-col items-center justify-center border-[1.5px] ${
                      network === net.id
                        ? 'border-usdt bg-usdt2 text-usdt'
                        : 'border-border bg-bg2 text-muted hover:border-border2'
                    }`}
                  >
                    <span className="font-[700] text-[13px]">{net.label}</span>
                    <span className="text-[10px] font-[500] mt-[2px] opacity-80">{net.time}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-[8px]">
              <label className="text-[11px] text-muted font-[600] uppercase tracking-[0.06em] ml-[4px]">{t('checkout.walletLabel', { network })}</label>
              <input 
                type="text"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder={t('checkout.walletPlaceholder')}
                className="w-full bg-bg2 border-[1.5px] border-border2 focus:border-usdt rounded-r p-[16px] text-[14px] text-text outline-none transition-all font-mono placeholder:text-dim"
              />
            </div>
          </div>
          )}

          {requiresContact && (
            <div className="space-y-[8px]">
            <label className="text-[11px] text-muted font-[600] uppercase tracking-[0.06em] ml-[4px]">{t('checkout.contactLabel')}</label>
            <input 
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('checkout.contactPlaceholder')}
              className="w-full bg-bg2 border-[1.5px] border-border2 focus:border-amber rounded-r p-[16px] text-[14px] text-text outline-none transition-all placeholder:text-dim"
            />
          </div>
          )}
        </div>
      </div>

      <div className="pb-[32px] pt-[16px] mt-auto">
        {submitError && (
          <div className="mb-[16px] p-[12px] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] rounded-r text-[12px] text-error text-center">
            {submitError}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting || isReserveBlocked}
          className={`w-full p-[18px] border-none rounded-r2 font-sans text-[15px] font-[700] cursor-pointer transition-all tracking-[0.02em] flex items-center justify-center gap-[8px] relative overflow-hidden active:scale-[0.985] disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none ${
            isValid ? 'bg-[#00CC66] text-[#000000]' : 'bg-bg3 text-muted'
          }`}
        >
          {isSubmitting ? (
            <span className="animate-pulse">{t('checkout.submitting')}</span>
          ) : (
            `ПОЛУЧИТЬ ${getAssetLabel(selectedGetAsset, language).toUpperCase()}`
          )}
        </button>
      </div>
    </motion.div>
  );
}
