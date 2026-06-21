import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import WebApp from '@twa-dev/sdk';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';
import type { ExchangeDirection, OrderStatus } from '../types';
import { DEFAULT_RATES, convertCurrencyToEur } from '../lib/rates';
import { getRouteLabel, inferOrderAssets } from '../lib/exchangeAssets';

export default function Admin() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const {
    cities,
    rates,
    rateUpdatedAt,
    orders,
    usdtReserve,
    antiPhishingCode,
    profileSettings,
    saveCityConfig,
    updateUsdtReserve,
    updateRate,
    updateAntiPhishingCode,
    updateSupportLink,
    updateOrderStatus,
    updateOrderManager,
    addCity,
    removeCity,
  } = useStore();
  
  const user = WebApp.initDataUnsafe?.user;
  const managerFallbackName = user?.username
    ? `@${user.username}`
    : [user?.first_name, user?.last_name].filter(Boolean).join(' ') || t('checkout.unknownUser');
  const managerSelfName = profileSettings.displayName.trim() || managerFallbackName;
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map((id: string) => id.trim());
  const isAdmin = user?.id ? adminIds.includes(user.id.toString()) : false;

  const [editLimits, setEditLimits] = useState<Record<string, string>>(
    cities.reduce((acc, city) => ({ ...acc, [city.id]: city.limitEUR.toString() }), {})
  );
  const [editRate, setEditRate] = useState(rates.EUR_USDT.toString());
  const [editUsdtReserve, setEditUsdtReserve] = useState(usdtReserve.toString());
  const [editAntiPhishingCode, setEditAntiPhishingCode] = useState(antiPhishingCode);
  const [editSupportLink, setEditSupportLink] = useState(useStore.getState().supportLink || 'cryptobull_manager');
  const [editManagers, setEditManagers] = useState<Record<string, string>>(
    orders.reduce((acc, order) => ({ ...acc, [order.id]: order.managerName ?? '' }), {}),
  );
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [cityFilter, setCityFilter] = useState<'all' | string>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | ExchangeDirection>('all');
  const [onlyMyOrders, setOnlyMyOrders] = useState(false);
  const [citySaveState, setCitySaveState] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [citySaveErrorMessage, setCitySaveErrorMessage] = useState<Record<string, string>>({});
  const [newCityName, setNewCityName] = useState('');
  const [isAddingCity, setIsAddingCity] = useState(false);

  useEffect(() => {
    setEditLimits(cities.reduce((acc, city) => ({ ...acc, [city.id]: city.limitEUR.toString() }), {}));
  }, [cities]);

  useEffect(() => {
    setEditManagers(orders.reduce((acc, order) => ({ ...acc, [order.id]: order.managerName ?? '' }), {}));
  }, [orders]);

  const formattedRateUpdatedAt = useMemo(
    () => new Date(rateUpdatedAt).toLocaleString(language),
    [language, rateUpdatedAt],
  );
  const incomingOrdersCount = useMemo(
    () => orders.filter((order) => order.status === 'accepted').length,
    [orders],
  );
  const myOrdersCount = useMemo(
    () => orders.filter((order) => order.managerName === managerSelfName).length,
    [managerSelfName, orders],
  );
  const myActiveOrdersCount = useMemo(
    () => orders.filter((order) => order.managerName === managerSelfName && (order.status === 'accepted' || order.status === 'processing')).length,
    [managerSelfName, orders],
  );

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.id.toLowerCase().includes(query) ||
        order.userHandle.toLowerCase().includes(query) ||
        (order.managerName ?? '').toLowerCase().includes(query) ||
        (order.contact ?? '').toLowerCase().includes(query) ||
        (order.wallet ?? '').toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesCity = cityFilter === 'all' || order.cityId === cityFilter;
      const matchesDirection = directionFilter === 'all' || order.direction === directionFilter;
      const matchesManager = !onlyMyOrders || order.managerName === managerSelfName;

      return matchesSearch && matchesStatus && matchesCity && matchesDirection && matchesManager;
    });
  }, [cityFilter, directionFilter, managerSelfName, onlyMyOrders, orderSearch, orders, statusFilter]);
  const clientStatsMap = useMemo(() => {
    const stats = new Map<string, { deals: number; volumeEUR: number; firstOrderAt: string }>();

    orders.forEach((order) => {
      const existing = stats.get(order.userHandle);
      const eurAmount = order.giveCurrency === 'EUR' || order.giveCurrency === 'UAH'
        ? convertCurrencyToEur(Number(order.giveAmount), order.giveCurrency, DEFAULT_RATES)
        : convertCurrencyToEur(Number(order.getAmount), order.getCurrency, DEFAULT_RATES);

      if (!existing) {
        stats.set(order.userHandle, {
          deals: 1,
          volumeEUR: eurAmount,
          firstOrderAt: order.createdAt,
        });
        return;
      }

      stats.set(order.userHandle, {
        deals: existing.deals + 1,
        volumeEUR: existing.volumeEUR + eurAmount,
        firstOrderAt:
          new Date(order.createdAt).getTime() < new Date(existing.firstOrderAt).getTime()
            ? order.createdAt
            : existing.firstOrderAt,
      });
    });

    return stats;
  }, [orders]);

  // Protect route
  if (!isAdmin && import.meta.env.PROD) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <h1 className="text-xl text-error font-bold">{t('admin.accessDenied')}</h1>
      </div>
    );
  }

  const handleBack = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate('/');
  };

  const handleSave = async (id: string) => {
    WebApp.HapticFeedback.impactOccurred('medium');
    const newLimit = Number(editLimits[id]) || 0;
    setCitySaveState((prev) => ({ ...prev, [id]: 'saving' }));
    setCitySaveErrorMessage((prev) => ({ ...prev, [id]: '' }));
    const result = await saveCityConfig(id, {
      limitEUR: newLimit,
    });
    setCitySaveState((prev) => ({ ...prev, [id]: result.ok ? 'saved' : 'error' }));
    if (!result.ok) {
      setCitySaveErrorMessage((prev) => ({ ...prev, [id]: result.error ?? '' }));
    }
  };

  const handleToggle = async (id: string) => {
    WebApp.HapticFeedback.selectionChanged();
    const city = cities.find((item) => item.id === id);
    if (!city) {
      return;
    }
    setCitySaveState((prev) => ({ ...prev, [id]: 'saving' }));
    setCitySaveErrorMessage((prev) => ({ ...prev, [id]: '' }));
    const result = await saveCityConfig(id, {
      isActive: !city.isActive,
    });
    setCitySaveState((prev) => ({ ...prev, [id]: result.ok ? 'saved' : 'error' }));
    if (!result.ok) {
      setCitySaveErrorMessage((prev) => ({ ...prev, [id]: result.error ?? '' }));
    }
  };

  const handleAddCity = async () => {
    if (!newCityName.trim()) return;
    WebApp.HapticFeedback.impactOccurred('medium');
    setIsAddingCity(true);
    await addCity(newCityName.trim());
    setNewCityName('');
    setIsAddingCity(false);
  };

  const handleRemoveCity = async (id: string) => {
    WebApp.HapticFeedback.impactOccurred('medium');
    await removeCity(id);
  };

  const handleClaimOrder = async (orderId: string) => {
    WebApp.HapticFeedback.impactOccurred('medium');
    await updateOrderManager(orderId, managerSelfName);
    await updateOrderStatus(orderId, 'processing');
    setEditManagers((prev) => ({ ...prev, [orderId]: managerSelfName }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-[16px] pb-[32px] pt-[20px]"
      style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between gap-[12px] mb-[24px]">
        <div className="flex items-center gap-[12px]">
          <button onClick={handleBack} className="w-[36px] h-[36px] rounded-full bg-bg3 border border-border2 flex items-center justify-center text-muted hover:text-text transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 13l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-[20px] font-[700] text-text">{t('admin.title')}</h1>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="space-y-[16px] flex-1">
        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <div className="flex justify-between items-center mb-[8px]">
            <h2 className="text-[14px] font-[700] text-text">{t('admin.cityManagement')}</h2>
          </div>

          <div className="space-y-[12px]">
            {cities.map((city) => {
              const translatedName = t(`cities.${city.cityKey}`);
              const displayName = translatedName.startsWith('cities.') ? city.cityKey : translatedName;
              return (
              <div key={city.id} className={`p-[16px] rounded-[16px] border-[1.5px] transition-all bg-bg3 flex items-center justify-between ${city.isActive ? 'border-border2' : 'border-error/30 opacity-60'}`}>
                
                <div className="flex items-center gap-[8px]">
                  <span className="font-[700] text-[15px] text-text">{displayName}</span>
                </div>
                
                <div className="flex items-center gap-[8px]">
                  <button 
                    onClick={() => handleToggle(city.id)}
                    className={`text-[10px] font-[600] uppercase tracking-[0.06em] px-[8px] py-[4px] rounded-[6px] border transition-colors ${city.isActive ? 'bg-[rgba(0,208,132,0.1)] text-green border-green/30' : 'bg-[rgba(248,113,113,0.1)] text-error border-error/30'}`}
                  >
                    {city.isActive ? t('admin.active') : t('admin.disabled')}
                  </button>
                  <button 
                    onClick={() => handleRemoveCity(city.id)}
                    className="text-error opacity-70 hover:opacity-100 transition-opacity p-[4px]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            )})}
          </div>

          <div className="flex items-center gap-[8px] mt-[16px]">
            <input 
              type="text"
              value={newCityName}
              onChange={(e) => setNewCityName(e.target.value)}
              placeholder="Добавить город"
              className="flex-1 bg-bg3 border border-border2 rounded-[8px] py-[10px] px-[12px] text-[14px] text-text outline-none focus:border-green transition-colors"
            />
            <button 
              onClick={handleAddCity}
              disabled={isAddingCity || !newCityName.trim()}
              className="bg-green hover:bg-[#00B359] text-black px-[16px] py-[10px] rounded-[8px] text-[12px] font-[700] uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>

        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <div className="flex justify-between items-center mb-[8px]">
            <h2 className="text-[14px] font-[700] text-text">{t('admin.rateManagement')}</h2>
            <span className="text-[10px] bg-[rgba(79,142,247,0.12)] text-[#4F8EF7] px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">
              EUR/USDT
            </span>
          </div>

          <div className="space-y-[8px]">
            <div className="text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
              {t('admin.rateInputLabel')}
            </div>
            <div className="flex items-center gap-[8px]">
              <div className="flex-1 relative">
                <span className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted font-mono">€</span>
                <input
                  type="number"
                  step="0.0001"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="w-full bg-bg3 border border-border2 rounded-[8px] py-[10px] pl-[28px] pr-[12px] text-[14px] font-mono text-text outline-none focus:border-[#4F8EF7] transition-colors"
                />
              </div>
              <button
                onClick={() => void updateRate(Number(editRate) || rates.EUR_USDT)}
                className="bg-bg3 border border-border2 hover:border-[#4F8EF7] hover:text-[#4F8EF7] text-muted px-[16px] py-[10px] rounded-[8px] text-[12px] font-[600] transition-colors"
              >
                {t('admin.save')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2">
            <div className="rounded-[12px] border border-border2 bg-bg3 px-[12px] py-[10px]">
              <div className="text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">{t('admin.rateCurrentLabel')}</div>
              <div className="mt-[6px] font-mono text-[16px] font-[700] text-text">1 EUR = {rates.EUR_USDT.toFixed(4)} USDT</div>
            </div>
            <div className="rounded-[12px] border border-border2 bg-bg3 px-[12px] py-[10px]">
              <div className="text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">{t('admin.rateUpdatedLabel')}</div>
              <div className="mt-[6px] text-[13px] font-[500] text-text">{formattedRateUpdatedAt}</div>
            </div>
          </div>
        </div>

        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <div className="flex justify-between items-center mb-[8px]">
            <h2 className="text-[14px] font-[700] text-text">{t('admin.reserveManagement')}</h2>
            <span className="text-[10px] bg-[rgba(38,161,123,0.12)] text-usdt px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">USDT</span>
          </div>

          <div className="flex flex-col gap-[8px] min-[360px]:flex-row min-[360px]:items-center">
            <div className="flex-1 relative">
              <span className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted font-mono">₮</span>
              <input
                type="number"
                value={editUsdtReserve}
                onChange={(e) => setEditUsdtReserve(e.target.value)}
                className="w-full bg-bg3 border border-border2 rounded-[8px] py-[10px] pl-[28px] pr-[12px] text-[14px] font-mono text-text outline-none focus:border-usdt transition-colors"
              />
            </div>
            <button
              onClick={() => void updateUsdtReserve(Number(editUsdtReserve) || 0)}
              className="bg-bg3 border border-border2 hover:border-usdt hover:text-usdt text-muted px-[16px] py-[10px] rounded-[8px] text-[12px] font-[600] transition-colors"
            >
              {t('admin.save')}
            </button>
          </div>

          <div className="text-[12px] font-[500] text-muted">
            {t('admin.usdtReserveLabel')}: <span className="font-mono text-text">{usdtReserve.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <div className="flex justify-between items-center mb-[8px]">
            <h2 className="text-[14px] font-[700] text-text">Настройки безопасности и связи</h2>
            <span className="text-[10px] bg-green2 text-green px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">
              {antiPhishingCode}
            </span>
          </div>

          <div className="text-[12px] font-[500] leading-relaxed text-muted">
            Anti-Phishing код (до 16 символов):
          </div>

          <div className="flex flex-col gap-[8px] min-[360px]:flex-row min-[360px]:items-center">
            <input
              type="text"
              value={editAntiPhishingCode}
              onChange={(e) => setEditAntiPhishingCode(e.target.value.toUpperCase())}
              placeholder={t('admin.securityCodePlaceholder')}
              maxLength={16}
              className="w-full flex-1 rounded-[10px] border border-border2 bg-bg3 px-[12px] py-[10px] text-[13px] font-mono uppercase tracking-[0.12em] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
            />
            <button
              type="button"
              onClick={() => void updateAntiPhishingCode(editAntiPhishingCode)}
              className="rounded-[10px] border border-border2 bg-bg3 px-[14px] py-[10px] text-[11px] font-[700] uppercase tracking-[0.05em] text-muted transition-colors hover:border-green hover:text-green"
            >
              {t('admin.save')}
            </button>
          </div>

          <div className="text-[12px] font-[500] leading-relaxed text-muted mt-[16px]">
            Ссылка на менеджера / поддержку (без @ и https://t.me/):
          </div>

          <div className="flex flex-col gap-[8px] min-[360px]:flex-row min-[360px]:items-center">
            <input
              type="text"
              value={editSupportLink}
              onChange={(e) => setEditSupportLink(e.target.value.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').trim())}
              placeholder="cryptobull_manager"
              className="w-full flex-1 rounded-[10px] border border-border2 bg-bg3 px-[12px] py-[10px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
            />
            <button
              type="button"
              onClick={() => void updateSupportLink(editSupportLink)}
              className="rounded-[10px] border border-border2 bg-bg3 px-[14px] py-[10px] text-[11px] font-[700] uppercase tracking-[0.05em] text-muted transition-colors hover:border-green hover:text-green"
            >
              {t('admin.save')}
            </button>
          </div>
        </div>

        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <div className="flex items-center justify-between mb-[8px]">
            <h2 className="text-[14px] font-[700] text-text">{t('admin.ordersTitle')}</h2>
            <div className="flex items-center gap-[6px]">
              <span className="text-[10px] bg-green2 text-green px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">
                {t('admin.incomingCount', { count: incomingOrdersCount })}
              </span>
              <span className="text-[10px] bg-[rgba(79,142,247,0.12)] text-[#4F8EF7] px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">
                {t('admin.myOrdersCount', { count: myOrdersCount })}
              </span>
              <span className="text-[10px] bg-bg3 text-muted px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">
                {filteredOrders.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-2">
            <div className="rounded-[12px] border border-border2 bg-bg3 px-[12px] py-[10px]">
              <div className="text-[10px] font-[600] uppercase tracking-[0.06em] text-muted">{t('admin.managerProfileTitle')}</div>
              <div className="mt-[6px] text-[13px] font-[700] text-text">{managerSelfName}</div>
              <div className="mt-[4px] text-[11px] font-[500] text-dim">{profileSettings.managerContact}</div>
            </div>
            <div className="rounded-[12px] border border-border2 bg-bg3 px-[12px] py-[10px]">
              <div className="text-[10px] font-[600] uppercase tracking-[0.06em] text-muted">{t('admin.myActiveOrders')}</div>
              <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{myActiveOrdersCount}</div>
              <div className="mt-[4px] text-[11px] font-[500] text-dim">{t('admin.myOrdersHint')}</div>
            </div>
          </div>

          <div className="space-y-[12px] rounded-[16px] border border-border2 bg-bg3 p-[14px]">
            <div>
              <div className="mb-[8px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                {t('admin.searchLabel')}
              </div>
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder={t('admin.searchPlaceholder')}
                className="w-full rounded-[10px] border border-border2 bg-bg2 px-[12px] py-[11px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
              />
            </div>

            <div className="grid grid-cols-1 gap-[10px] md:grid-cols-3">
              <div>
                <div className="mb-[6px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                  {t('admin.statusFilterLabel')}
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
                  className="w-full rounded-[10px] border border-border2 bg-bg2 px-[12px] py-[11px] text-[13px] text-text outline-none transition-colors focus:border-green"
                >
                  <option value="all">{t('admin.allStatuses')}</option>
                  {(['accepted', 'processing', 'ready', 'rejected'] as const).map((status) => (
                    <option key={status} value={status}>
                      {t(`orderStatus.${status}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-[6px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                  {t('admin.cityFilterLabel')}
                </div>
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="w-full rounded-[10px] border border-border2 bg-bg2 px-[12px] py-[11px] text-[13px] text-text outline-none transition-colors focus:border-green"
                >
                  <option value="all">{t('admin.allCities')}</option>
                  {cities.map((city) => {
                    const translatedName = t(`cities.${city.cityKey}`);
                    const displayName = translatedName.startsWith('cities.') ? city.cityKey : translatedName;
                    return (
                    <option key={city.id} value={city.id}>
                      {displayName}
                    </option>
                  )})}
                </select>
              </div>

              <div>
                <div className="mb-[6px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                  {t('admin.directionFilterLabel')}
                </div>
                <select
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value as 'all' | ExchangeDirection)}
                  className="w-full rounded-[10px] border border-border2 bg-bg2 px-[12px] py-[11px] text-[13px] text-text outline-none transition-colors focus:border-green"
                >
                  <option value="all">{t('admin.allDirections')}</option>
                  <option value="GIVE_CASH">{t('directions.eurToUsdt')}</option>
                  <option value="GIVE_USDT">{t('directions.usdtToEur')}</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOnlyMyOrders((prev) => !prev)}
              className={`w-full rounded-[10px] border px-[14px] py-[11px] text-[12px] font-[700] uppercase tracking-[0.05em] transition-colors ${
                onlyMyOrders
                  ? 'border-green bg-green2 text-green'
                  : 'border-border2 bg-bg2 text-text hover:border-green hover:text-green'
              }`}
            >
              {onlyMyOrders ? t('admin.showAllOrders') : t('admin.showOnlyMyOrders')}
            </button>

            <div className="text-[12px] font-[500] text-muted">
              {t('admin.filteredCount', { count: filteredOrders.length })}
            </div>
          </div>

          {orders.length > 0 ? (
            <div className="space-y-[12px]">
              {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                <div key={order.id} className="rounded-[16px] border border-border2 bg-bg3 p-[16px]">
                  {(() => {
                    const clientStats = clientStatsMap.get(order.userHandle);

                    return (
                      <>
                  <div className="flex items-start justify-between gap-[12px] mb-[10px]">
                    <div>
                      <div className="text-[13px] font-[700] text-text">{order.id}</div>
                      <div className="mt-[4px] text-[12px] font-[500] text-muted">
                        {t(`cities.${order.cityKey}`).startsWith('cities.') ? order.cityKey : t(`cities.${order.cityKey}`)} · {order.giveAmount} {order.giveCurrency} {'->'} {order.getAmount} {order.getCurrency}
                      </div>
                      <div className="mt-[4px] text-[11px] font-[500] text-dim">
                        {getRouteLabel(
                          order.giveAsset ?? inferOrderAssets(order).giveAsset,
                          order.getAsset ?? inferOrderAssets(order).getAsset,
                          language,
                        )}
                      </div>
                    </div>
                    <div className="rounded-[6px] bg-[rgba(0,208,132,0.1)] px-[8px] py-[4px] text-[10px] font-[700] uppercase tracking-[0.06em] text-green">
                      {t(`orderStatus.${order.status}`)}
                    </div>
                  </div>

                  <div className="mb-[10px] text-[11px] font-[500] text-dim">
                    {new Date(order.createdAt).toLocaleString()} · {order.userHandle}
                  </div>

                  <div className="mb-[10px]">
                    <button
                      type="button"
                      onClick={() => handleClaimOrder(order.id)}
                      className={`w-full rounded-[10px] border px-[14px] py-[12px] text-[12px] font-[700] uppercase tracking-[0.05em] transition-colors ${
                        order.managerName === managerSelfName
                          ? 'border-green bg-green2 text-green'
                          : 'border-border2 bg-bg2 text-text hover:border-green hover:text-green'
                      }`}
                    >
                      {order.managerName === managerSelfName ? t('admin.myExchange') : t('admin.claimOrder')}
                    </button>
                  </div>

                  {clientStats && (
                    <div className="mb-[10px] rounded-[10px] border border-border2 bg-bg2 px-[12px] py-[10px]">
                      <div className="mb-[8px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                        {t('admin.clientStatsTitle')}
                      </div>
                      <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-3">
                        <div className="rounded-[8px] border border-border2 bg-bg3 px-[10px] py-[8px]">
                          <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('home.clientDeals')}</div>
                          <div className="mt-[4px] font-mono text-[15px] font-[700] text-text">{clientStats.deals}</div>
                        </div>
                        <div className="rounded-[8px] border border-border2 bg-bg3 px-[10px] py-[8px]">
                          <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('home.clientVolume')}</div>
                          <div className="mt-[4px] font-mono text-[15px] font-[700] text-text">{clientStats.volumeEUR.toFixed(0)}€</div>
                        </div>
                        <div className="rounded-[8px] border border-border2 bg-bg3 px-[10px] py-[8px]">
                          <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('home.clientSince')}</div>
                          <div className="mt-[4px] text-[11px] font-[700] text-text">
                            {new Date(clientStats.firstOrderAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-[10px] rounded-[10px] border border-border2 bg-bg2 px-[12px] py-[10px]">
                    <div className="mb-[8px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                      {t('admin.managerLabel')}
                    </div>
                    <div className="flex flex-col gap-[8px] min-[360px]:flex-row min-[360px]:items-center">
                      <input
                        type="text"
                        value={editManagers[order.id] ?? order.managerName ?? ''}
                        onChange={(e) => setEditManagers((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder={t('admin.managerPlaceholder')}
                        className="flex-1 rounded-[10px] border border-border2 bg-bg3 px-[12px] py-[10px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
                      />
                      <button
                        type="button"
                        onClick={() => void updateOrderManager(order.id, editManagers[order.id] ?? '')}
                        className="rounded-[10px] border border-border2 bg-bg3 px-[14px] py-[10px] text-[11px] font-[700] uppercase tracking-[0.05em] text-muted transition-colors hover:border-green hover:text-green"
                      >
                        {t('admin.save')}
                      </button>
                    </div>
                    <div className="mt-[8px] text-[11px] font-[500] text-dim">
                      {order.managerName
                        ? t('admin.managerAssigned', { name: order.managerName })
                        : t('admin.managerEmpty')}
                    </div>
                  </div>

                  <div className="mb-[8px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                    {t('admin.statusLabel')}
                  </div>

                  <div className="grid grid-cols-2 gap-[8px]">
                    {(['accepted', 'processing', 'ready', 'rejected'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void updateOrderStatus(order.id, status)}
                        className={`rounded-[10px] border px-[10px] py-[10px] text-[11px] font-[700] uppercase tracking-[0.05em] transition-colors ${
                          order.status === status
                            ? 'border-green bg-[rgba(0,208,132,0.1)] text-green'
                            : 'border-border2 bg-bg2 text-muted hover:border-border3 hover:text-text'
                        }`}
                      >
                        {t(`orderStatus.${status}`)}
                      </button>
                    ))}
                  </div>
                      </>
                    );
                  })()}
                </div>
              )) : (
                <div className="rounded-[16px] border border-border2 bg-bg3 px-[16px] py-[18px] text-[13px] font-[500] text-muted">
                  {t('admin.ordersNotFound')}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[16px] border border-border2 bg-bg3 px-[16px] py-[18px] text-[13px] font-[500] text-muted">
              {t('admin.ordersEmpty')}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
