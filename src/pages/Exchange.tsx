import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { calculateCustomerMetrics, getCustomerBenefits } from '../lib/customer';
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
    rates,
    rateUpdatedAt,
    orders,
    usdtReserve,
    profileSettings,
    setCity,
    selectedGiveAsset,
    selectedGetAsset,
    setGiveAsset,
    setGetAsset,
    giveAmount,
    getAmount,
    setGiveAmount,
    clearCheckoutPrefill,
    setCommissionPercent,
  } = useStore();

  const user = WebApp.initDataUnsafe?.user;
  const currentUserId = user?.id ? String(user.id) : null;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));
  const [citySearch, setCitySearch] = useState('');
  const [activeAssetSheet, setActiveAssetSheet] = useState<'give' | 'get' | null>(null);
  const [isAmountConfirmed, setIsAmountConfirmed] = useState(false);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(!selectedCityId);
  const amountInputRef = useRef<HTMLInputElement>(null);

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

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();

    if (!query) {
      return cities;
    }

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

  const currentRate = getAssetConversionRate(selectedGiveAsset, selectedGetAsset, rates);
  const formattedRateUpdatedAt = new Date(rateUpdatedAt).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const giveAssetOptions = ['EUR_CASH', 'UAH_CARD', 'USDT'] as const;
  const getAssetOptions = getAllowedTargetAssets(selectedGiveAsset);

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

  const routeHint = getRouteLabel(selectedGiveAsset, selectedGetAsset, language);
  const routeInfo =
    selectedGetAsset === 'USDT'
      ? `Комиссия ${benefits.effectiveCommissionPercent.toFixed(1)}% · Перевод USDT на ваш кошелек`
      : selectedGetAsset === 'UAH_CARD'
        ? `Комиссия ${benefits.effectiveCommissionPercent.toFixed(1)}% · Перевод на карту UAH`
        : `Комиссия ${benefits.effectiveCommissionPercent.toFixed(1)}% · Через 30 минут выдача наличных EUR`;

  const handleNext = () => {
    if (!isValid) {
      return;
    }

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
              {routeHint}
            </div>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="space-y-[16px]">
          <section className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="grid grid-cols-3 gap-[8px] rounded-[12px] bg-[#0D0D0D] p-[4px]">
              {giveAssetOptions.map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => {
                    WebApp.HapticFeedback.selectionChanged();
                    setGiveAsset(asset);
                  }}
                  className={`rounded-[12px] px-[12px] py-[14px] text-left transition-colors ${selectedGiveAsset === asset ? 'bg-[#1A1A1A]' : 'bg-transparent'}`}
                >
                  <div className="text-[13px] font-[600] text-[#FFFFFF]">{getAssetLabel(asset, language)}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="flex items-center justify-between gap-[12px]">
              <div className="text-[11px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">{t('home.rateLabel')}</div>
              <div className="text-[12px] font-[400] text-[#9A9A9A]">{t('home.rateUpdated', { time: formattedRateUpdatedAt })}</div>
            </div>
            <div className="mt-[10px] text-[24px] font-[600] leading-[1.15] text-[#FFFFFF]">
              1 {getAssetLabel(selectedGiveAsset, language)} = {currentRate.toFixed(4)} {getAssetCurrency(selectedGetAsset)}
            </div>
            <div className="mt-[8px] text-[13px] font-[400] text-[#9A9A9A]">{routeInfo}</div>
          </section>

          <section className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="relative space-y-[16px] py-[4px]">
              <div>
                <div className="mb-[8px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.youGive')}</div>
                <div className="flex h-[64px] items-center justify-between gap-[12px] rounded-[12px] bg-[#1A1A1A] px-[16px]">
                  <input
                    ref={amountInputRef}
                    type="number"
                    value={giveAmount}
                    onChange={(e) => {
                      setIsAmountConfirmed(false);
                      setGiveAmount(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleConfirmAmount();
                      }
                    }}
                    placeholder="0"
                    min="0"
                    step={selectedGiveAsset === 'EUR_CASH' ? '10' : selectedGiveAsset === 'USDT' ? '0.01' : '1'}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-[28px] font-[600] text-[#FFFFFF] outline-none placeholder:text-[#9A9A9A]"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmAmount}
                    className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                      giveAmount
                        ? 'border-[#D4AF37] bg-[#D4AF37] text-[#000000]'
                        : 'border-[#222222] bg-[#111111] text-[#808080]'
                    }`}
                    aria-label="Confirm amount"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.2l3 3L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAssetSheet('give')}
                    className="flex shrink-0 items-center gap-[8px] text-[#FFFFFF]"
                  >
                    <AssetIcon asset={selectedGiveAsset} />
                    <span className="text-[14px] font-[600]">{getAssetLabel(selectedGiveAsset, language)}</span>
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
                    <AssetIcon asset={selectedGetAsset} />
                    <span className="text-[14px] font-[600]">{getAssetLabel(selectedGetAsset, language)}</span>
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
              <div className="flex items-center gap-[10px]">
                {giveAmount && (
                  <span className={`text-[12px] font-[400] ${isAmountConfirmed ? 'text-[#D4AF37]' : 'text-[#9A9A9A]'}`}>
                    {isAmountConfirmed ? t('home.amountConfirmed') : t('home.amountEditing')}
                  </span>
                )}
                <div className="text-right font-[600] text-[#FFFFFF]">{benefits.effectiveCommissionPercent.toFixed(1)}%</div>
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="text-[11px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">{t('home.cityTitle')}</div>
            {currentCity && !isCityPickerOpen ? (
              <div className="mt-[12px] space-y-[12px]">
                <div className="flex w-full items-center gap-[12px] rounded-[12px] bg-[#1A1A1A] px-[12px] py-[14px] text-left">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-[600] text-[#FFFFFF]">{t(`cities.${currentCity.cityKey}`)}</div>
                    {!currentCity.isActive && (
                      <div className="mt-[4px] text-[12px] font-[400] text-[#9A9A9A]">{t('home.cityInactive')}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-[12px] font-[400] text-[#D4AF37]">{t('home.citySelected')}</div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    WebApp.HapticFeedback.selectionChanged();
                    setCitySearch('');
                    setIsCityPickerOpen(true);
                  }}
                  className="w-full rounded-[12px] border border-[#222222] bg-transparent px-[14px] py-[12px] text-[13px] font-[400] text-[#FFFFFF] transition-colors hover:border-[#D4AF37] hover:text-[#D4AF37]"
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

                <div className="space-y-[4px]">
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
                      className="flex w-full items-center gap-[12px] rounded-[12px] border border-transparent px-[12px] py-[14px] text-left transition-colors hover:bg-[#151515]"
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
              </>
            )}

            <div className="mt-[16px] flex items-center justify-between gap-[12px] border-t border-[#222222] pt-[16px] text-[13px]">
              <div className="flex items-center gap-[8px] text-[#9A9A9A]">
                <span>{currentCity ? t('home.selectedCitySummary', { city: t(`cities.${currentCity.cityKey}`) }) : t('home.cityRequired')}</span>
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.7)] px-[16px]">
          <button
            type="button"
            aria-label="Close asset sheet"
            onClick={() => setActiveAssetSheet(null)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-[380px] rounded-[16px] border border-[#222222] bg-[#111111] px-[20px] py-[20px] shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
            <div className="text-[12px] font-[400] uppercase tracking-[0.12em] text-[#9A9A9A]">
              {activeAssetSheet === 'give' ? t('home.youGive') : t('checkout.youGet')}
            </div>
            <div className="mt-[14px] grid grid-cols-3 gap-[8px]">
              {(activeAssetSheet === 'give' ? giveAssetOptions : getAssetOptions).map((asset: 'EUR_CASH' | 'UAH_CARD' | 'USDT') => {
                const isSelected = (activeAssetSheet === 'give' ? selectedGiveAsset : selectedGetAsset) === asset;

                return (
                  <button
                    key={asset}
                    type="button"
                    onClick={() => handleSelectAsset(activeAssetSheet, asset)}
                    className={`flex min-h-[84px] w-full flex-col items-center justify-center gap-[8px] rounded-[12px] px-[10px] py-[14px] text-center transition-colors ${isSelected ? 'bg-[#1A1A1A]' : 'bg-[#151515] hover:bg-[#1A1A1A]'}`}
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
