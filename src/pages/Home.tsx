import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';
import { calculateCustomerMetrics, generateReferralCode, getCustomerBenefits } from '../lib/customer';

const CITY_FLAGS: Record<string, string> = {
  berlin: '🇩🇪',
  munich: '🏙️',
  hamburg: '⚓',
  frankfurt: '🏦',
  cologne: '⛪',
  dusseldorf: '🏭',
  stuttgart: '🚗',
  leipzig: '🎼',
  dortmund: '⚽',
  essen: '🏢',
  bremen: '⛵',
  hannover: '🌆',
  nuremberg: '🏰',
};

export default function Home() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { 
    cities, selectedCityId, direction, rates, rateUpdatedAt, orders, usdtReserve, profileSettings,
    setCity, setDirection, giveAmount, getAmount, setGiveAmount, applyOrderTemplate, clearCheckoutPrefill, updateProfileSettings, setCommissionPercent
  } = useStore();

  const user = WebApp.initDataUnsafe?.user;
  const [citySearch, setCitySearch] = useState('');
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));
  
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map((id: string) => id.trim());
  const isAdmin = user?.id ? adminIds.includes(user.id.toString()) : false;

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();

    if (!query) {
      return cities;
    }

    return cities.filter((city) => t(`cities.${city.cityKey}`).toLowerCase().includes(query));
  }, [cities, citySearch, t]);

  const currentUserOrders = useMemo(
    () => orders.filter((order) => order.userHandle === currentUserHandle),
    [currentUserHandle, orders],
  );
  const metrics = useMemo(
    () => calculateCustomerMetrics(orders, currentUserHandle),
    [currentUserHandle, orders],
  );
  const benefits = useMemo(
    () => getCustomerBenefits(metrics, profileSettings.activatedReferralCode),
    [metrics, profileSettings.activatedReferralCode],
  );
  const assignedManagerOrder = useMemo(
    () => currentUserOrders.find((order) => order.managerName && order.status !== 'rejected') ?? null,
    [currentUserOrders],
  );
  const latestUserOrder = currentUserOrders[0] ?? null;

  useEffect(() => {
    setCommissionPercent(benefits.effectiveCommissionPercent);
  }, [benefits.effectiveCommissionPercent, setCommissionPercent]);

  useEffect(() => {
    const expectedReferralCode = generateReferralCode(currentUserHandle);
    if (profileSettings.referralCode !== expectedReferralCode) {
      updateProfileSettings({ referralCode: expectedReferralCode });
    }
  }, [currentUserHandle, profileSettings.referralCode, updateProfileSettings]);

  const currentCity = cities.find((city) => city.id === selectedCityId) ?? null;

  const eurAmount = direction === 'GIVE_CASH' ? Number(giveAmount) : Number(getAmount);
  const usdtAmount = direction === 'GIVE_CASH' ? Number(getAmount) : Number(giveAmount);
  
  const isOverLimit = eurAmount > 500;
  const isCityMissing = !currentCity;
  const isCityInactive = currentCity ? !currentCity.isActive : false;
  const isCashReserveInsufficient = direction === 'GIVE_USDT' ? (currentCity ? eurAmount > currentCity.limitEUR : false) : false;
  const isUsdtReserveInsufficient = direction === 'GIVE_CASH' ? usdtAmount > usdtReserve : false;
  
  const isEurInvalid = direction === 'GIVE_CASH' && (eurAmount % 10 !== 0 || eurAmount % 1 !== 0);
  const isReserveBlocked = isCityMissing || isCityInactive || isCashReserveInsufficient || isUsdtReserveInsufficient;
  const isValid = Number(giveAmount) > 0 && !isOverLimit && !isReserveBlocked && (!isEurInvalid || eurAmount === 0);
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

  const currentRate = rates.EUR_USDT;
  const formattedRateUpdatedAt = new Date(rateUpdatedAt).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const selectedCityReserve = currentCity ? currentCity.limitEUR : 0;

  const handleNext = () => {
    if (isValid) {
      WebApp.HapticFeedback.impactOccurred('medium');
      clearCheckoutPrefill();
      navigate('/checkout');
    }
  };

  const setAmount = (val: number) => {
    WebApp.HapticFeedback.selectionChanged();
    setGiveAmount(val.toString());
  };

  const handleRepeatOrder = (orderId: string) => {
    WebApp.HapticFeedback.impactOccurred('medium');
    applyOrderTemplate(orderId);
    navigate('/checkout');
  };

  const handleOpenManagerContact = () => {
    const rawValue = profileSettings.managerContact.trim();
    if (!rawValue) {
      return;
    }

    const normalizedValue = rawValue
      .replace(/^https?:\/\/t\.me\//, '')
      .replace(/^@/, '')
      .trim();

    if (!normalizedValue) {
      return;
    }

    WebApp.HapticFeedback.impactOccurred('light');
    WebApp.openTelegramLink(`https://t.me/${normalizedValue}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col"
    >
      <header
        className="relative z-10 flex items-start justify-between gap-[12px] border-b border-border px-[16px] pb-[16px] pt-[16px]"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <div 
          className={`min-w-0 flex flex-1 items-center gap-[10px] ${isAdmin ? 'cursor-pointer' : ''}`}
          onClick={() => {
            if (isAdmin) navigate('/admin');
          }}
        >
          <div className="w-[36px] h-[36px] rounded-[10px] bg-gradient-to-br from-[#00D084] to-[#00A86B] flex items-center justify-center shrink-0">
            {/* Bull Icon Logo */}
            <svg viewBox="0 0 24 24" fill="none" className="w-[20px] h-[20px]">
              <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" stroke="#0A0B0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.5 8L5 4" stroke="#0A0B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16.5 8L19 4" stroke="#0A0B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 13H15" stroke="#0A0B0F" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-[800] tracking-[0.04em] text-text min-[360px]:text-[17px]">CryptoBull</div>
            <div className="text-[10px] font-[500] text-muted tracking-[0.1em] mt-[1px]">{t('app.subtitle')}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[8px]">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full border border-border2 bg-bg3 text-[13px] font-[700] text-muted transition-colors hover:border-green"
          >
            {user?.photo_url ? (
              <img src={user.photo_url} alt={t('app.avatarAlt')} className="h-full w-full object-cover" />
            ) : (
              user?.first_name?.charAt(0) || 'U'
            )}
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-[16px] mt-[12px] grid grid-cols-2 gap-[8px]">
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="rounded-r border border-border2 bg-bg2 px-[14px] py-[12px] text-[12px] font-[700] uppercase tracking-[0.05em] text-text transition-colors hover:border-green hover:text-green"
        >
          {t('home.myOrdersAction')}
        </button>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="rounded-r border border-green3 bg-green2 px-[14px] py-[12px] text-[12px] font-[700] uppercase tracking-[0.05em] text-green transition-colors hover:border-green"
          >
            {t('home.adminShortAction')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="rounded-r border border-border2 bg-bg2 px-[14px] py-[12px] text-[12px] font-[700] uppercase tracking-[0.05em] text-text transition-colors hover:border-green hover:text-green"
          >
            {t('home.profileAction')}
          </button>
        )}
      </div>

      {latestUserOrder && (
        <div className="relative z-10 mx-[16px] mt-[12px] rounded-r2 border border-border2 bg-bg2 p-[16px]">
          <div className="flex items-center justify-between gap-[8px]">
            <div>
              <div className="text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('home.latestOrderTitle')}</div>
              <div className="mt-[6px] text-[14px] font-[700] text-text">{t('home.orderNumber', { id: latestUserOrder.id })}</div>
            </div>
            <div className="rounded-[6px] bg-green2 px-[8px] py-[4px] text-[10px] font-[700] uppercase tracking-[0.06em] text-green">
              {t(`orderStatus.${latestUserOrder.status}`)}
            </div>
          </div>
          <div className="mt-[8px] text-[12px] font-[500] text-muted">
            {t(`cities.${latestUserOrder.cityKey}`)} · {latestUserOrder.giveAmount} {latestUserOrder.giveCurrency} {'->'} {latestUserOrder.getAmount} {latestUserOrder.getCurrency}
          </div>
          <div className="mt-[6px] text-[11px] font-[500] text-dim">
            {latestUserOrder.managerName
              ? t('admin.managerAssigned', { name: latestUserOrder.managerName })
              : t('home.orderPendingManager')}
          </div>
          <div className="mt-[12px] grid grid-cols-2 gap-[8px]">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="rounded-r border border-border2 bg-bg3 px-[12px] py-[11px] text-[11px] font-[700] uppercase tracking-[0.05em] text-text transition-colors hover:border-green hover:text-green"
            >
              {t('home.openOrderHistory')}
            </button>
            <button
              type="button"
              onClick={handleOpenManagerContact}
              disabled={!profileSettings.managerContact.trim()}
              className="rounded-r border border-green3 bg-green2 px-[12px] py-[11px] text-[11px] font-[700] uppercase tracking-[0.05em] text-green transition-colors hover:border-green disabled:opacity-50"
            >
              {t('home.contactManager')}
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 text-[10px] font-[600] tracking-[0.14em] uppercase text-muted px-[20px] pt-[18px] pb-[10px]">{t('home.actionTitle')}</div>
      <div className="relative z-10 px-[16px] pt-[16px] pb-0">
        <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-2">
          
          <div 
            onClick={() => { WebApp.HapticFeedback.selectionChanged(); setDirection('GIVE_CASH'); }}
            className={`bg-bg2 border-[1.5px] rounded-r2 p-[16px_14px] cursor-pointer transition-all relative overflow-hidden text-left ${direction === 'GIVE_CASH' ? 'border-amber bg-amber2' : 'border-border'}`}
          >
            {direction === 'GIVE_CASH' && <div className="absolute inset-0 rounded-r2 bg-gradient-to-br from-[rgba(245,166,35,0.08)] to-transparent"></div>}
            
            <div className={`absolute top-[12px] right-[12px] w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all ${direction === 'GIVE_CASH' ? 'bg-amber border-amber' : 'bg-bg3 border-[1.5px] border-border2'}`}>
              <svg viewBox="0 0 10 10" fill="none" className={`w-[10px] h-[10px] transition-opacity ${direction === 'GIVE_CASH' ? 'opacity-100' : 'opacity-0'}`}>
                <path d="M2 5l2.5 2.5L8 3" stroke="#0A0B0F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <div className={`w-[42px] h-[42px] rounded-[12px] flex items-center justify-center mb-[10px] transition-all ${direction === 'GIVE_CASH' ? 'bg-[rgba(245,166,35,0.15)] border-[rgba(245,166,35,0.3)]' : 'bg-bg3 border border-border'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="13" rx="2" stroke="#F5A623" strokeWidth="1.8"/>
                <circle cx="12" cy="12.5" r="3" stroke="#F5A623" strokeWidth="1.5"/>
                <path d="M2 9.5h2M20 9.5h2M2 15.5h2M20 15.5h2" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            
            <div className={`text-[14px] font-[700] mb-[2px] ${direction === 'GIVE_CASH' ? 'text-amber' : 'text-text'}`}>{t('home.giveCashTitle')}</div>
            <div className="text-[11px] text-muted font-[500]">{t('home.giveCashSubtitle')}</div>
          </div>

          <div 
            onClick={() => { WebApp.HapticFeedback.selectionChanged(); setDirection('GIVE_USDT'); }}
            className={`bg-bg2 border-[1.5px] rounded-r2 p-[16px_14px] cursor-pointer transition-all relative overflow-hidden text-left ${direction === 'GIVE_USDT' ? 'border-usdt bg-usdt2' : 'border-border'}`}
          >
            {direction === 'GIVE_USDT' && <div className="absolute inset-0 rounded-r2 bg-gradient-to-br from-[rgba(38,161,123,0.08)] to-transparent"></div>}
            
            <div className={`absolute top-[12px] right-[12px] w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all ${direction === 'GIVE_USDT' ? 'bg-usdt border-usdt' : 'bg-bg3 border-[1.5px] border-border2'}`}>
              <svg viewBox="0 0 10 10" fill="none" className={`w-[10px] h-[10px] transition-opacity ${direction === 'GIVE_USDT' ? 'opacity-100' : 'opacity-0'}`}>
                <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <div className={`w-[42px] h-[42px] rounded-[12px] flex items-center justify-center mb-[10px] transition-all ${direction === 'GIVE_USDT' ? 'bg-[rgba(38,161,123,0.15)] border-[rgba(38,161,123,0.3)]' : 'bg-bg3 border border-border'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#26A17B" opacity="0.18"/>
                <path d="M8 7h8v2H8V7z" fill="#26A17B"/>
                <path d="M12 9v8" stroke="#26A17B" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8.5 12c0 0 1 1.5 3.5 1.5s3.5-1.5 3.5-1.5" stroke="#26A17B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            
            <div className={`text-[14px] font-[700] mb-[2px] ${direction === 'GIVE_USDT' ? 'text-usdt' : 'text-text'}`}>{t('home.giveUsdtTitle')}</div>
            <div className="text-[11px] text-muted font-[500]">{t('home.giveUsdtSubtitle')}</div>
          </div>

        </div>
      </div>

      <div className="relative z-10 m-[12px_16px_0] rounded-r border border-border bg-bg2 p-[12px_16px]">
        <div className="flex min-w-0 items-center gap-[8px]">
          <div className="flex min-w-0 items-center gap-[8px]">
          <div className="w-[28px] h-[28px] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="#1B3D2F" stroke="#26A17B" strokeWidth="1"/>
              <text x="14" y="18.5" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="10" fontWeight="700" fill="#26A17B">₮</text>
            </svg>
          </div>
            <div className="min-w-0">
            <div className="text-[11px] text-muted font-[500]">{t('home.rateLabel')}</div>
              <div className="mt-[1px] break-words font-mono text-[13px] font-[600] text-text min-[360px]:text-[14px]">1 EUR = {currentRate.toFixed(4)} USDT</div>
            <div className="mt-[4px] text-[10px] font-[500] text-dim">{t('home.rateUpdated', { time: formattedRateUpdatedAt })}</div>
            </div>
          </div>
        </div>
      </div>

      {assignedManagerOrder && (
        <div className="relative z-10 mx-[16px] mt-[12px] rounded-r2 border border-border2 bg-bg2 p-[16px]">
          <div className="mb-[10px] flex items-center justify-between gap-[8px]">
            <div className="text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('home.managerCardTitle')}</div>
            <div className="rounded-[6px] bg-green2 px-[8px] py-[4px] text-[10px] font-[700] uppercase tracking-[0.06em] text-green">
              {t(`orderStatus.${assignedManagerOrder.status}`)}
            </div>
          </div>
          <div className="rounded-r border border-border bg-bg3 p-[14px]">
            <div className="flex items-start gap-[12px]">
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-border2 bg-bg2 text-[15px] font-[700] text-muted">
                {(assignedManagerOrder.managerName ?? profileSettings.displayName ?? 'M').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="break-words text-[14px] font-[700] text-text">
                  {assignedManagerOrder.managerName ?? profileSettings.displayName}
                </div>
                <div className="mt-[4px] text-[11px] font-[600] uppercase tracking-[0.05em] text-green">
                  {profileSettings.roleLabel}
                </div>
                <div className="mt-[6px] text-[12px] font-[500] text-muted">
                  {t('home.managerContactValue', { value: profileSettings.managerContact })}
                </div>
                <div className="mt-[4px] text-[11px] font-[500] text-dim">
                  {t('home.managerDealValue', { id: assignedManagerOrder.id })}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenManagerContact}
              disabled={!profileSettings.managerContact.trim()}
              className="mt-[12px] w-full rounded-r border border-green3 bg-green2 px-[14px] py-[12px] text-[12px] font-[700] uppercase tracking-[0.05em] text-green transition-colors hover:border-green disabled:opacity-50"
            >
              {t('home.contactManager')}
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 text-[10px] font-[600] tracking-[0.14em] uppercase text-muted px-[20px] pt-[18px] pb-[10px]">{t('home.amountTitle')}</div>
      <div className="relative z-10 mx-[16px]">
        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[18px_18px_14px] transition-colors focus-within:border-green">
          <div className="flex items-center justify-between mb-[14px]">
            <div className="flex items-center gap-[8px] bg-bg3 border border-border2 rounded-[10px] p-[7px_12px_7px_8px] text-[13px] font-[700] tracking-[0.02em]">
              {direction === 'GIVE_CASH' ? (
                 <div className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center shrink-0 bg-[#2A2318] border border-[rgba(245,166,35,0.3)] text-amber">
                    €
                 </div>
              ) : (
                <div className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center shrink-0 bg-[#1E2A20] border border-[rgba(38,161,123,0.3)]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7.5" fill="transparent" stroke="#26A17B" strokeWidth="1"/>
                    <text x="8" y="11.5" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#26A17B">₮</text>
                  </svg>
                </div>
              )}
              <span>{direction === 'GIVE_CASH' ? 'EUR' : 'USDT'}</span>
            </div>
            <div className="text-[11px] text-muted font-[500] tracking-[0.04em]">{t('home.youGive')}</div>
          </div>
          
          <div className="flex items-baseline gap-[6px]">
            <div className="font-mono text-[26px] font-[600] text-muted">{direction === 'GIVE_CASH' ? '€' : '₮'}</div>
            <input 
              type="number" 
              value={giveAmount}
              onChange={(e) => setGiveAmount(e.target.value)}
              placeholder="0" 
              min="0" 
              step="50" 
              inputMode="decimal"
              className="flex-1 bg-transparent border-none outline-none font-mono text-[28px] font-[600] text-text w-full placeholder:text-dim min-[360px]:text-[34px]"
            />
          </div>
          
          <div className="mt-[12px] flex flex-wrap gap-[6px] border-t border-border pt-[12px]">
            {[100, 250, 500, 1000, 5000].map(val => (
              <div 
                key={val} 
                onClick={() => setAmount(val)}
                className="min-w-[56px] flex-1 py-[7px] bg-bg3 border border-border rounded-[8px] text-[11px] font-[600] text-muted cursor-pointer text-center transition-all hover:border-border3 hover:text-text active:scale-95"
              >
                {val >= 1000 ? `${val/1000}K` : val}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex justify-center py-[8px]">
        <div className="w-[36px] h-[36px] rounded-full bg-bg3 border border-border2 flex items-center justify-center text-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M4 9l4 4 4-4" stroke="#4A4F5E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <div className="relative z-10 mx-[16px] bg-bg2 border border-border rounded-r2 p-[16px_18px]">
        <div className="flex items-center justify-between mb-[10px]">
          <div className="flex items-center gap-[8px] text-[13px] font-[700] text-text">
            <span>{direction === 'GIVE_CASH' ? 'USDT' : 'EUR'}</span>
          </div>
          <div className={`text-[10px] font-[600] tracking-[0.08em] uppercase p-[3px_8px] rounded-[6px] ${direction === 'GIVE_CASH' ? 'bg-[rgba(38,161,123,0.1)] text-usdt' : 'bg-[rgba(245,166,35,0.1)] text-amber'}`}>
            {direction === 'GIVE_CASH' ? t('home.assetCrypto') : t('home.assetCash')}
          </div>
        </div>
        <div className="font-mono text-[28px] font-[600] mt-[4px]" style={{ color: getAmount ? 'var(--text)' : 'var(--muted)' }}>
          {getAmount || '—'}
        </div>
        <div className="text-[11px] text-muted mt-[8px] pt-[8px] border-t border-border font-[500] leading-relaxed">
          {direction === 'GIVE_CASH'
            ? t('home.infoCash', { commission: benefits.effectiveCommissionPercent.toFixed(1) })
            : t('home.infoUsdt', { commission: benefits.effectiveCommissionPercent.toFixed(1) })}
        </div>
      </div>

      <div className="relative z-10 mx-[16px] mt-[12px] rounded-r2 border border-border2 bg-bg2 p-[16px]">
        <div className="mb-[10px] text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('home.exchangeSummaryTitle')}</div>
        <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-3">
          <div className="rounded-r border border-border bg-bg3 p-[12px]">
            <div className="text-[10px] font-[600] uppercase tracking-[0.06em] text-muted">{t('home.commissionLabel')}</div>
            <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{benefits.effectiveCommissionPercent.toFixed(1)}%</div>
          </div>
          <div className="rounded-r border border-border bg-bg3 p-[12px]">
            <div className="text-[10px] font-[600] uppercase tracking-[0.06em] text-muted">{t('home.reserveCash')}</div>
            <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{currentCity ? selectedCityReserve : '—'}</div>
          </div>
          <div className="rounded-r border border-border bg-bg3 p-[12px]">
            <div className="text-[10px] font-[600] uppercase tracking-[0.06em] text-muted">{t('home.reserveUsdt')}</div>
            <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{usdtReserve.toFixed(0)}</div>
          </div>
        </div>
      </div>

      <div className="relative z-10 text-[10px] font-[600] tracking-[0.14em] uppercase text-muted px-[20px] pt-[18px] pb-[10px]">{t('home.cityTitle')}</div>
      <div className="relative z-10 px-[16px]">
        <div className="mb-[12px] rounded-r2 border border-border2 bg-bg2 p-[14px]">
          <div className="mb-[10px] flex flex-col gap-[6px] min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
            <div className="text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('home.searchLabel')}</div>
            <div className="text-[11px] font-[500] text-muted">{t('home.cityCount', { count: filteredCities.length })}</div>
          </div>
          <input
            type="text"
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="w-full rounded-r border border-border bg-bg3 px-[14px] py-[12px] text-[14px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
          />
        </div>

        {filteredCities.length > 0 ? (
          <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-2">
            {filteredCities.map(city => (
              <button
                key={city.id}
                onClick={() => { WebApp.HapticFeedback.selectionChanged(); setCity(city.id); }}
                className={`bg-bg2 border-[1.5px] rounded-r p-[13px_12px] cursor-pointer flex items-center gap-[9px] transition-all hover:border-border2 ${selectedCityId === city.id ? 'border-green bg-[rgba(0,208,132,0.05)]' : 'border-border'}`}
              >
                <div className={`w-[28px] h-[28px] rounded-[8px] bg-bg3 border flex items-center justify-center text-[14px] shrink-0 ${selectedCityId === city.id ? 'border-[rgba(0,208,132,0.3)]' : 'border-border'}`}>
                  {CITY_FLAGS[city.cityKey] ?? '📍'}
                </div>
                <div className={`min-w-0 text-left text-[13px] font-[600] transition-colors ${selectedCityId === city.id ? 'text-text' : 'text-muted'}`}>
                  {t(`cities.${city.cityKey}`)}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-r2 border border-border2 bg-bg2 px-[16px] py-[18px] text-center text-[13px] font-[500] text-muted">
            {t('home.noCitiesFound')}
          </div>
        )}
      </div>

      {Number(giveAmount) > 0 && (isOverLimit || isEurInvalid || !!reserveMessage) && (
        <div className="px-[16px] mt-[16px]">
          <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] rounded-r p-3 text-[12px] text-error">
            {isOverLimit ? t('home.limitError') : reserveMessage ?? t('home.amountError')}
          </div>
        </div>
      )}

      <div className="relative z-10 p-[16px_16px_0] mt-4">
        <button
          onClick={handleNext}
          disabled={!isValid}
          className={`w-full p-[18px] border-none rounded-r2 font-sans text-[15px] font-[700] cursor-pointer transition-all tracking-[0.02em] flex items-center justify-center gap-[8px] relative overflow-hidden active:scale-[0.985] disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none
            ${isValid 
              ? (direction === 'GIVE_CASH' 
                ? 'bg-gradient-to-br from-[#F5A623] to-[#E08B00] text-[#0A0B0F] shadow-[0_8px_24px_rgba(245,166,35,0.25)]' 
                : 'bg-gradient-to-br from-[#26A17B] to-[#1B7A5C] text-white shadow-[0_8px_24px_rgba(38,161,123,0.25)]')
              : 'bg-bg3 text-muted'
            }`}
        >
          {direction === 'GIVE_CASH' ? t('home.ctaCash') : t('home.ctaUsdt')}
        </button>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-[8px] px-[16px] pt-[12px] pb-[20px]">
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="rounded-r border border-border2 bg-bg2 px-[12px] py-[12px] text-[11px] font-[700] uppercase tracking-[0.05em] text-text transition-colors hover:border-green hover:text-green"
        >
          {t('home.openOrderHistory')}
        </button>
        <button
          type="button"
          onClick={() => (latestUserOrder ? handleRepeatOrder(latestUserOrder.id) : navigate('/profile'))}
          className="rounded-r border border-border2 bg-bg2 px-[12px] py-[12px] text-[11px] font-[700] uppercase tracking-[0.05em] text-text transition-colors hover:border-green hover:text-green"
        >
          {latestUserOrder ? t('home.repeatOrder') : t('home.profileAction')}
        </button>
      </div>

    </motion.div>
  );
}
