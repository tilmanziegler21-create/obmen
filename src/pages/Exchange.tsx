import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { calculateCustomerMetrics, getCustomerBenefits } from '../lib/customer';
import type { CashCurrency } from '../types';
import { getBaseRateForCashCurrency } from '../lib/rates';

function AssetIcon({ asset }: { asset: 'EUR' | 'UAH' | 'USDT' }) {
  if (asset === 'EUR') {
    return (
      <div className="flex h-[20px] w-[20px] items-center justify-center text-[14px]">
        <span>🇪🇺</span>
      </div>
    );
  }

  if (asset === 'UAH') {
    return (
      <div className="flex h-[20px] w-[20px] items-center justify-center text-[14px]">
        <span>🇺🇦</span>
      </div>
    );
  }

  return (
    <div className="flex h-[20px] w-[20px] items-center justify-center">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="none" stroke="#D4AF37" strokeWidth="1.2" />
        <text x="8" y="11.2" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#D4AF37">₮</text>
      </svg>
    </div>
  );
}

export default function Exchange() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const {
    cities,
    selectedCityId,
    direction,
    rates,
    rateUpdatedAt,
    orders,
    usdtReserve,
    profileSettings,
    setCity,
    setDirection,
    setCashCurrency,
    giveAmount,
    getAmount,
    setGiveAmount,
    clearCheckoutPrefill,
    setCommissionPercent,
    selectedCashCurrency,
  } = useStore();

  const user = WebApp.initDataUnsafe?.user;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));
  const [citySearch, setCitySearch] = useState('');
  const [activeAssetSheet, setActiveAssetSheet] = useState<'give' | 'get' | null>(null);

  const metrics = useMemo(
    () => calculateCustomerMetrics(orders, currentUserHandle),
    [currentUserHandle, orders],
  );
  const benefits = useMemo(
    () => getCustomerBenefits(metrics, profileSettings.activatedReferralCode),
    [metrics, profileSettings.activatedReferralCode],
  );

  useEffect(() => {
    setCommissionPercent(benefits.effectiveCommissionPercent);
  }, [benefits.effectiveCommissionPercent, setCommissionPercent]);

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();

    if (!query) {
      return cities;
    }

    return cities.filter((city) => t(`cities.${city.cityKey}`).toLowerCase().includes(query));
  }, [cities, citySearch, t]);

  const currentCity = cities.find((city) => city.id === selectedCityId) ?? null;
  const eurAmount = direction === 'GIVE_CASH' ? Number(giveAmount) : Number(getAmount);
  const usdtAmount = direction === 'GIVE_CASH' ? Number(getAmount) : Number(giveAmount);
  const isOverLimit = eurAmount > 500;
  const isCityMissing = !currentCity;
  const isCityInactive = currentCity ? !currentCity.isActive : false;
  const isCashReserveInsufficient = direction === 'GIVE_USDT' && selectedCashCurrency === 'EUR'
    ? (currentCity ? eurAmount > currentCity.limitEUR : false)
    : false;
  const isUsdtReserveInsufficient = direction === 'GIVE_CASH' ? usdtAmount > usdtReserve : false;
  const isEurInvalid = direction === 'GIVE_CASH' && selectedCashCurrency === 'EUR' && (eurAmount % 10 !== 0 || eurAmount % 1 !== 0);
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

  const giveCurrency = direction === 'GIVE_CASH' ? selectedCashCurrency : 'USDT';
  const getCurrency = direction === 'GIVE_CASH' ? 'USDT' : selectedCashCurrency;
  const currentRate = getBaseRateForCashCurrency(selectedCashCurrency, rates);
  const formattedRateUpdatedAt = new Date(rateUpdatedAt).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const assetOptions = [
    { code: 'USDT', label: 'USDT' },
    { code: 'EUR', label: 'EUR' },
    { code: 'UAH', label: 'UAH' },
  ] as const;

  const handleSwapDirection = () => {
    WebApp.HapticFeedback.impactOccurred('medium');
    const nextDirection = direction === 'GIVE_CASH' ? 'GIVE_USDT' : 'GIVE_CASH';
    const nextGiveAmount = getAmount || '';
    setDirection(nextDirection);
    setGiveAmount(nextGiveAmount);
    setActiveAssetSheet(null);
  };

  const handleSelectAsset = (field: 'give' | 'get', asset: 'EUR' | 'UAH' | 'USDT') => {
    WebApp.HapticFeedback.selectionChanged();

    if (asset === 'USDT') {
      const expectedDirection = field === 'give' ? 'GIVE_USDT' : 'GIVE_CASH';

      if (expectedDirection === direction) {
        setActiveAssetSheet(null);
        return;
      }

      const nextGiveAmount = getAmount || '';
      setDirection(expectedDirection);
      setGiveAmount(nextGiveAmount);
      setActiveAssetSheet(null);
      return;
    }

    const cashCurrency = asset as CashCurrency;

    if (field === 'give') {
      if (direction === 'GIVE_CASH') {
        setCashCurrency(cashCurrency);
      } else {
        const nextGiveAmount = getAmount || '';
        setDirection('GIVE_CASH');
        setCashCurrency(cashCurrency);
        setGiveAmount(nextGiveAmount);
      }
    } else if (direction === 'GIVE_USDT') {
      setCashCurrency(cashCurrency);
    } else {
      const nextGiveAmount = getAmount || '';
      setDirection('GIVE_USDT');
      setCashCurrency(cashCurrency);
      setGiveAmount(nextGiveAmount);
    }

    setActiveAssetSheet(null);
  };

  const handleNext = () => {
    if (!isValid) {
      return;
    }

    WebApp.HapticFeedback.impactOccurred('medium');
    clearCheckoutPrefill();
    navigate('/checkout');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 px-[16px] pb-[24px]"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <header className="mb-[24px] flex items-center justify-between gap-[12px]">
          <div>
            <div className="text-[24px] font-[800] text-[#FFFFFF]">{t('nav.exchange')}</div>
            <div className="mt-[4px] text-[12px] font-[400] uppercase tracking-[0.12em] text-[#808080]">
              {direction === 'GIVE_CASH' ? t('home.giveCashSubtitle') : t('home.giveUsdtSubtitle')}
            </div>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="space-y-[16px]">
          <section className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="grid grid-cols-2 gap-[8px] rounded-[12px] bg-[#0D0D0D] p-[4px]">
              <button
                type="button"
                onClick={() => {
                  WebApp.HapticFeedback.selectionChanged();
                  setDirection('GIVE_CASH');
                }}
                className={`rounded-[12px] px-[16px] py-[14px] text-left transition-colors ${direction === 'GIVE_CASH' ? 'bg-[#1A1A1A]' : 'bg-transparent'}`}
              >
                <div className="text-[14px] font-[600] text-[#FFFFFF]">{t('home.giveCashTitle')}</div>
                <div className="mt-[4px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.giveCashSubtitle')}</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  WebApp.HapticFeedback.selectionChanged();
                  setDirection('GIVE_USDT');
                }}
                className={`rounded-[12px] px-[16px] py-[14px] text-left transition-colors ${direction === 'GIVE_USDT' ? 'bg-[#1A1A1A]' : 'bg-transparent'}`}
              >
                <div className="text-[14px] font-[600] text-[#FFFFFF]">{t('home.giveUsdtTitle')}</div>
                <div className="mt-[4px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.giveUsdtSubtitle')}</div>
              </button>
            </div>
          </section>

          <section className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="flex items-center justify-between gap-[12px]">
              <div className="text-[11px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">{t('home.rateLabel')}</div>
              <div className="text-[12px] font-[400] text-[#9A9A9A]">{t('home.rateUpdated', { time: formattedRateUpdatedAt })}</div>
            </div>
            <div className="mt-[10px] text-[24px] font-[600] leading-[1.15] text-[#FFFFFF]">1 {selectedCashCurrency} = {currentRate.toFixed(4)} USDT</div>
            <div className="mt-[8px] text-[13px] font-[400] text-[#9A9A9A]">
              {direction === 'GIVE_CASH'
                ? t('home.infoCash', { commission: benefits.effectiveCommissionPercent.toFixed(1) })
                : t('home.infoUsdt', { commission: benefits.effectiveCommissionPercent.toFixed(1) })}
            </div>
          </section>

          <section className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="relative space-y-[16px] py-[4px]">
              <div>
                <div className="mb-[8px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.youGive')}</div>
                <div className="flex h-[64px] items-center justify-between gap-[12px] rounded-[12px] bg-[#1A1A1A] px-[16px]">
                  <input
                    type="number"
                    value={giveAmount}
                    onChange={(e) => setGiveAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step={direction === 'GIVE_CASH' ? (selectedCashCurrency === 'EUR' ? '10' : '1') : '0.01'}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-[28px] font-[600] text-[#FFFFFF] outline-none placeholder:text-[#9A9A9A]"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveAssetSheet('give')}
                    className="flex shrink-0 items-center gap-[8px] text-[#FFFFFF]"
                  >
                    <AssetIcon asset={giveCurrency} />
                    <span className="text-[14px] font-[600]">{giveCurrency}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSwapDirection}
                className="absolute left-1/2 top-1/2 z-10 flex h-[32px] w-[32px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#222222] bg-[#111111] text-[#D4AF37]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 5h8M4 5l2-2M4 5l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 11H4M12 11l-2-2M12 11l-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div>
                <div className="mb-[8px] text-[12px] font-[400] text-[#9A9A9A]">{t('checkout.youGet')}</div>
                <div className="flex h-[64px] items-center justify-between gap-[12px] rounded-[12px] bg-[#1A1A1A] px-[16px]">
                  <div className={`min-w-0 flex-1 truncate text-[28px] font-[600] ${getAmount ? 'text-[#FFFFFF]' : 'text-[#9A9A9A]'}`}>
                    {getAmount || '0'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveAssetSheet('get')}
                    className="flex shrink-0 items-center gap-[8px] text-[#FFFFFF]"
                  >
                    <AssetIcon asset={getCurrency} />
                    <span className="text-[14px] font-[600]">{getCurrency}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-[16px] flex items-center justify-between gap-[12px] border-t border-[#222222] pt-[16px] text-[13px]">
              <div className="flex items-center gap-[8px] text-[#9A9A9A]">
                <span className="inline-flex h-[20px] w-[20px] items-center justify-center rounded-full border border-[#222222] bg-[#1A1A1A] text-[#D4AF37]">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.2l3 3L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>{t('home.commissionIncluded')}</span>
              </div>
              <div className="text-right font-[600] text-[#FFFFFF]">{benefits.effectiveCommissionPercent.toFixed(1)}%</div>
            </div>
          </section>

          <section className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="text-[11px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">{t('home.cityTitle')}</div>
            <div className="sticky top-0 mt-[12px] bg-[#111111] pb-[12px]">
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder={t('home.searchPlaceholder')}
                className="w-full rounded-[12px] border border-[#222222] bg-[#1A1A1A] px-[16px] py-[14px] text-[14px] text-[#FFFFFF] outline-none placeholder:text-[#9A9A9A]"
              />
            </div>

            <div className="space-y-[4px]">
              {filteredCities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => {
                    WebApp.HapticFeedback.selectionChanged();
                    setCity(city.id);
                  }}
                  className={`flex w-full items-center rounded-[12px] px-[12px] py-[14px] text-left transition-colors ${selectedCityId === city.id ? 'bg-[#1A1A1A]' : 'bg-transparent hover:bg-[#151515]'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-[600] text-[#FFFFFF]">{t(`cities.${city.cityKey}`)}</div>
                    {!city.isActive && (
                      <div className="mt-[4px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.cityInactive')}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {filteredCities.length === 0 && (
              <div className="mt-[12px] rounded-[12px] bg-[#1A1A1A] px-[14px] py-[14px] text-[13px] font-[400] text-[#9A9A9A]">
                {t('home.noCitiesFound')}
              </div>
            )}

            <div className="mt-[16px] flex items-center justify-between gap-[12px] border-t border-[#222222] pt-[16px] text-[13px]">
              <div className="flex items-center gap-[8px] text-[#9A9A9A]">
                <span>{currentCity ? t(`cities.${currentCity.cityKey}`) : t('home.cityRequired')}</span>
              </div>
              <div className="text-right font-[400] text-[#9A9A9A]">
                {currentCity && !currentCity.isActive ? t('home.cityInactive') : ''}
              </div>
            </div>
          </section>

          {Number(giveAmount) > 0 && (isOverLimit || isEurInvalid || !!reserveMessage) && (
            <div className="rounded-[16px] border border-[#3A2323] bg-[#1A1010] px-[16px] py-[14px] text-[13px] font-[400] text-[#F1C6C6]">
              {isOverLimit ? t('home.limitError') : reserveMessage ?? t('home.amountError')}
            </div>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={!isValid}
            className={`w-full rounded-[12px] px-[24px] py-[16px] text-[13px] font-[600] uppercase tracking-[0.08em] transition-opacity ${isValid ? 'bg-[#D4AF37] text-[#000000] hover:opacity-90' : 'bg-[#1A1A1A] text-[#808080]'}`}
          >
            {t('home.ctaCash')}
          </button>
        </div>
      </motion.div>

      {activeAssetSheet && (
        <div className="fixed inset-0 z-40 flex items-end bg-[rgba(0,0,0,0.7)]">
          <button
            type="button"
            aria-label="Close asset sheet"
            onClick={() => setActiveAssetSheet(null)}
            className="absolute inset-0"
          />
          <div className="relative w-full rounded-t-[24px] border-t border-[#222222] bg-[#111111] px-[24px] pb-[32px] pt-[16px]">
            <div className="mx-auto h-[4px] w-[40px] rounded-full bg-[#222222]"></div>
            <div className="mt-[16px] text-[12px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">
              {activeAssetSheet === 'give' ? t('home.youGive') : t('checkout.youGet')}
            </div>
            <div className="mt-[16px] space-y-[8px]">
              {assetOptions.map((asset) => {
                const isSelected = (activeAssetSheet === 'give' ? giveCurrency : getCurrency) === asset.code;

                return (
                  <button
                    key={asset.code}
                    type="button"
                    onClick={() => handleSelectAsset(activeAssetSheet, asset.code)}
                    className={`flex w-full items-center rounded-[12px] px-[16px] py-[16px] text-left ${isSelected ? 'bg-[#1A1A1A]' : 'bg-[#151515]'}`}
                  >
                    <div className="flex items-center gap-[12px]">
                      <AssetIcon asset={asset.code} />
                      <span className="text-[15px] font-[600] text-[#FFFFFF]">{asset.label}</span>
                    </div>
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
