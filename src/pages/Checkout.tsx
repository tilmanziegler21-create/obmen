import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { CheckCircle2 } from 'lucide-react';
import WebApp from '@twa-dev/sdk';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';

export default function Checkout() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const defaultContact = WebApp.initDataUnsafe?.user?.username ? `@${WebApp.initDataUnsafe.user.username}` : '';
  const { 
    cities, selectedCityId, direction, rates, usdtReserve, checkoutPrefill,
    giveAmount, getAmount, createOrder, clearCheckoutPrefill
  } = useStore();
  const NETWORKS = [
    { id: 'TRC-20', label: 'TRC-20', time: t('checkout.networkTimes.trc20') },
    { id: 'ERC-20', label: 'ERC-20', time: t('checkout.networkTimes.erc20') },
    { id: 'TON', label: 'TON', time: t('checkout.networkTimes.ton') },
  ];

  const [contact, setContact] = useState(checkoutPrefill.contact || defaultContact);
  const [wallet, setWallet] = useState(checkoutPrefill.wallet);
  const [network, setNetwork] = useState(
    NETWORKS.some((item) => item.id === checkoutPrefill.network) ? checkoutPrefill.network : NETWORKS[0].id,
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const city = cities.find(c => c.id === selectedCityId);
  const cityName = city ? t(`cities.${city.cityKey}`) : '-';
  const isGettingUSDT = direction === 'GIVE_CASH';
  const requiredCashReserve = direction === 'GIVE_USDT' ? Number(getAmount) : 0;
  const requiredUsdtReserve = direction === 'GIVE_CASH' ? Number(getAmount) : 0;
  const isReserveBlocked =
    !city ||
    !city.isActive ||
    (direction === 'GIVE_USDT' && requiredCashReserve > city.limitEUR) ||
    (direction === 'GIVE_CASH' && requiredUsdtReserve > usdtReserve);

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
    
    // Формируем данные заявки
    const orderData = {
      action: 'new_order',
      direction: direction === 'GIVE_CASH' ? 'CASH_TO_USDT' : 'USDT_TO_CASH',
      city: cityName,
      giveAmount,
      giveCurrency: direction === 'GIVE_CASH' ? 'EUR' : 'USDT',
      getAmount,
      getCurrency: direction === 'GIVE_CASH' ? 'USDT' : 'EUR',
      rate: effectiveRate.toFixed(4),
      network: isGettingUSDT ? network : null,
      wallet: isGettingUSDT ? wallet : null,
      contact: !isGettingUSDT ? contact : null,
    };

    const BOT_TOKEN = import.meta.env.VITE_BOT_TOKEN;
    const CHAT_ID = import.meta.env.VITE_CHAT_ID;
    const userHandle = WebApp.initDataUnsafe?.user?.username 
      ? `@${WebApp.initDataUnsafe.user.username}` 
      : (WebApp.initDataUnsafe?.user?.first_name || t('checkout.unknownUser'));

    let isSentSuccessfully = false;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        const message = `
🚨 <b>${t('telegram.newOrder')}</b>

🔄 <b>${t('telegram.direction')}</b> ${orderData.direction === 'CASH_TO_USDT' ? t('telegram.cashToUsdt') : t('telegram.usdtToCash')}
🏙 <b>${t('telegram.city')}</b> ${orderData.city}
💰 <b>${t('telegram.give')}</b> ${orderData.giveAmount} ${orderData.giveCurrency}
💸 <b>${t('telegram.get')}</b> ${orderData.getAmount} ${orderData.getCurrency}
📊 <b>${t('telegram.rate')}</b> 1 EUR = ${orderData.rate} USDT

${isGettingUSDT 
  ? `🔗 <b>${t('telegram.network')}</b> ${orderData.network}\n💼 <b>${t('telegram.wallet')}</b> <code>${orderData.wallet}</code>` 
  : `📱 <b>${t('telegram.contact')}</b> ${orderData.contact}`}

👤 <b>${t('telegram.client')}</b> ${userHandle}
        `;

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML',
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Telegram API Error Response:', errorData);
          setSubmitError(t('checkout.telegramApiError', { message: errorData.description }));
          setIsSubmitting(false);
          return;
        }
        
        isSentSuccessfully = true;
      } catch (e) {
        console.error('Ошибка при отправке в Telegram:', e);
        setSubmitError(
          t('checkout.telegramNetworkError', {
            message: e instanceof Error ? e.message : t('checkout.unknownUser'),
          }),
        );
        setIsSubmitting(false);
        return;
      }
    } else {
      console.warn('Telegram BOT_TOKEN or CHAT_ID is not set in environment variables');
      setSubmitError(t('checkout.telegramConfigError'));
      setIsSubmitting(false);
      return;
    }
    
    if (isSentSuccessfully) {
      const createdOrder = createOrder({
        direction,
        cityId: city?.id ?? '',
        cityKey: city?.cityKey ?? 'berlin',
        giveAmount,
        giveCurrency: direction === 'GIVE_CASH' ? 'EUR' : 'USDT',
        getAmount,
        getCurrency: direction === 'GIVE_CASH' ? 'USDT' : 'EUR',
        rate: effectiveRate.toFixed(4),
        network: isGettingUSDT ? network : null,
        wallet: isGettingUSDT ? wallet : null,
        contact: !isGettingUSDT ? contact : null,
        userHandle,
        managerName: null,
      });

      setTimeout(() => {
        WebApp.HapticFeedback.notificationOccurred('success');
        clearCheckoutPrefill();
        setCreatedOrderId(createdOrder.id);
        setIsSuccess(true);
        setIsSubmitting(false);
        
        // Close WebApp after 2 seconds
        setTimeout(() => {
          WebApp.close();
        }, 2000);
      }, 300);
    }
  };
  
  // Basic validation
  const isValid = isGettingUSDT 
    ? wallet.length > 10 // Simple wallet check
    : contact.length > 2;

  const currentRate = rates.EUR_USDT;
  const effectiveRate = direction === 'GIVE_CASH' 
    ? (currentRate * 0.96)
    : (currentRate * 0.96);

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col items-center justify-center p-[24px] space-y-[24px] text-center"
      >
        <div className="w-[96px] h-[96px] bg-green2 rounded-full flex items-center justify-center border border-green3">
          <CheckCircle2 size={48} className="text-green" />
        </div>
        <h1 className="text-[28px] font-[800] text-green">{t('checkout.successTitle')}</h1>
        {createdOrderId && (
          <div className="rounded-r border border-green3 bg-green2 px-[12px] py-[8px] text-[12px] font-[700] text-green">
            {t('home.orderNumber', { id: createdOrderId })}
          </div>
        )}
        <p className="text-[14px] text-muted font-[500]">
          {direction === 'GIVE_CASH' 
            ? t('checkout.successCash') 
            : t('checkout.successUsdt')}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-[16px] pt-[20px]"
    >
      <div className="flex items-center justify-between gap-[12px] mb-[16px]">
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

        {/* Order Summary Card */}
        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <h2 className="text-[14px] font-[700] text-text mb-[16px]">{t('checkout.detailsTitle')}</h2>
          
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-muted font-[500]">{t('checkout.city')}</span>
            <span className="font-[700] text-text">{cityName}</span>
          </div>
          
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-muted font-[500]">{t('checkout.youGive')}</span>
            <span className={`font-mono font-[600] text-[15px] ${direction === 'GIVE_CASH' ? 'text-amber' : 'text-usdt'}`}>{giveAmount} {direction === 'GIVE_CASH' ? 'EUR' : 'USDT'}</span>
          </div>
          
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-muted font-[500]">{t('checkout.youGet')}</span>
            <span className={`font-mono font-[600] text-[15px] ${direction === 'GIVE_CASH' ? 'text-usdt' : 'text-amber'}`}>{getAmount} {direction === 'GIVE_CASH' ? 'USDT' : 'EUR'}</span>
          </div>

          <div className="flex justify-between items-center pt-[16px] border-t border-border text-[12px]">
            <span className="text-muted font-[500]">{t('checkout.fixedRate')}</span>
            <span className="font-mono font-[600] text-text">1 EUR = {effectiveRate.toFixed(4)} USDT</span>
          </div>
        </div>

        {/* Dynamic Inputs based on direction */}
        {isGettingUSDT ? (
          <div className="space-y-[16px]">
            <div className="space-y-[8px]">
              <label className="text-[11px] text-muted font-[600] uppercase tracking-[0.06em] ml-[4px]">{t('checkout.networkLabel')}</label>
              <div className="flex gap-[8px]">
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
        ) : (
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

      <div className="pb-[32px] pt-[16px] mt-auto">
        {submitError && (
          <div className="mb-[16px] p-[12px] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] rounded-r text-[12px] text-error text-center">
            {submitError}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting || isReserveBlocked}
          className={`w-full p-[18px] border-none rounded-r2 font-sans text-[15px] font-[700] cursor-pointer transition-all tracking-[0.02em] flex items-center justify-center gap-[8px] relative overflow-hidden active:scale-[0.985] disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none
            ${isValid 
              ? (direction === 'GIVE_CASH' 
                ? 'bg-gradient-to-br from-[#26A17B] to-[#1B7A5C] text-white shadow-[0_8px_24px_rgba(38,161,123,0.25)]'
                : 'bg-gradient-to-br from-[#F5A623] to-[#E08B00] text-[#0A0B0F] shadow-[0_8px_24px_rgba(245,166,35,0.25)]')
              : 'bg-bg3 text-muted'
            }`}
        >
          {isSubmitting ? (
            <span className="animate-pulse">{t('checkout.submitting')}</span>
          ) : (
            direction === 'GIVE_CASH' ? t('checkout.submitCash') : t('checkout.submitUsdt')
          )}
        </button>
      </div>
    </motion.div>
  );
}
