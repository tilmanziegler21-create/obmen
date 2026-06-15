import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import WebApp from '@twa-dev/sdk';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';
import type { ExchangeDirection, OrderStatus } from '../types';

export default function Admin() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const {
    cities,
    rates,
    rateUpdatedAt,
    orders,
    usdtReserve,
    updateCityLimit,
    updateUsdtReserve,
    updateRate,
    toggleCityActive,
    updateOrderStatus,
    updateOrderManager,
  } = useStore();
  
  const user = WebApp.initDataUnsafe?.user;
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map(id => id.trim());
  const isAdmin = user?.id ? adminIds.includes(user.id.toString()) : false;

  const [editLimits, setEditLimits] = useState<Record<string, string>>(
    cities.reduce((acc, city) => ({ ...acc, [city.id]: city.limitEUR.toString() }), {})
  );
  const [editRate, setEditRate] = useState(rates.EUR_USDT.toString());
  const [editUsdtReserve, setEditUsdtReserve] = useState(usdtReserve.toString());
  const [editManagers, setEditManagers] = useState<Record<string, string>>(
    orders.reduce((acc, order) => ({ ...acc, [order.id]: order.managerName ?? '' }), {}),
  );
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [cityFilter, setCityFilter] = useState<'all' | string>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | ExchangeDirection>('all');
  const formattedRateUpdatedAt = useMemo(
    () => new Date(rateUpdatedAt).toLocaleString(language),
    [language, rateUpdatedAt],
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

      return matchesSearch && matchesStatus && matchesCity && matchesDirection;
    });
  }, [cityFilter, directionFilter, orderSearch, orders, statusFilter]);
  const clientStatsMap = useMemo(() => {
    const stats = new Map<string, { deals: number; volumeEUR: number; firstOrderAt: string }>();

    orders.forEach((order) => {
      const existing = stats.get(order.userHandle);
      const eurAmount = order.giveCurrency === 'EUR' ? Number(order.giveAmount) : Number(order.getAmount);

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

  const handleSave = (id: string) => {
    WebApp.HapticFeedback.impactOccurred('medium');
    const newLimit = Number(editLimits[id]) || 0;
    updateCityLimit(id, newLimit);
  };

  const handleToggle = (id: string) => {
    WebApp.HapticFeedback.selectionChanged();
    toggleCityActive(id);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-[16px] pt-[20px] pb-[32px]"
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
            <h2 className="text-[14px] font-[700] text-text">{t('admin.cashManagement')}</h2>
            <span className="text-[10px] bg-[rgba(0,208,132,0.1)] text-green px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">{t('admin.eurOnly')}</span>
          </div>

          <div className="space-y-[12px]">
            {cities.map((city) => (
              <div key={city.id} className={`p-[16px] rounded-[16px] border-[1.5px] transition-all bg-bg3 ${city.isActive ? 'border-border2' : 'border-error/30 opacity-60'}`}>
                
                <div className="flex justify-between items-center mb-[12px]">
                  <div className="flex items-center gap-[8px]">
                    <span className="font-[700] text-[15px] text-text">{t(`cities.${city.cityKey}`)}</span>
                  </div>
                  
                  <button 
                    onClick={() => handleToggle(city.id)}
                    className={`text-[10px] font-[600] uppercase tracking-[0.06em] px-[8px] py-[4px] rounded-[6px] border transition-colors ${city.isActive ? 'bg-[rgba(0,208,132,0.1)] text-green border-green/30' : 'bg-[rgba(248,113,113,0.1)] text-error border-error/30'}`}
                  >
                    {city.isActive ? t('admin.active') : t('admin.disabled')}
                  </button>
                </div>

                <div className="flex items-center gap-[8px]">
                  <div className="flex-1 relative">
                    <span className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted font-mono">€</span>
                    <input 
                      type="number"
                      value={editLimits[city.id]}
                      onChange={(e) => setEditLimits({ ...editLimits, [city.id]: e.target.value })}
                      className="w-full bg-bg2 border border-border2 rounded-[8px] py-[10px] pl-[28px] pr-[12px] text-[14px] font-mono text-text outline-none focus:border-green transition-colors"
                    />
                  </div>
                  <button 
                    onClick={() => handleSave(city.id)}
                    className="bg-bg2 border border-border2 hover:border-green hover:text-green text-muted px-[16px] py-[10px] rounded-[8px] text-[12px] font-[600] transition-colors"
                  >
                    {t('admin.save')}
                  </button>
                </div>

              </div>
            ))}
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
                onClick={() => updateRate(Number(editRate) || rates.EUR_USDT)}
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

          <div className="flex items-center gap-[8px]">
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
              onClick={() => updateUsdtReserve(Number(editUsdtReserve) || 0)}
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
          <div className="flex items-center justify-between mb-[8px]">
            <h2 className="text-[14px] font-[700] text-text">{t('admin.ordersTitle')}</h2>
            <span className="text-[10px] bg-bg3 text-muted px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">
              {filteredOrders.length}
            </span>
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
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {t(`cities.${city.cityKey}`)}
                    </option>
                  ))}
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
                  <option value="GIVE_CASH">{t('directions.giveCash')}</option>
                  <option value="GIVE_USDT">{t('directions.giveUsdt')}</option>
                </select>
              </div>
            </div>

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
                        {t(`cities.${order.cityKey}`)} · {order.giveAmount} {order.giveCurrency} {'->'} {order.getAmount} {order.getCurrency}
                      </div>
                      <div className="mt-[4px] text-[11px] font-[500] text-dim">
                        {t(order.direction === 'GIVE_CASH' ? 'directions.giveCash' : 'directions.giveUsdt')}
                      </div>
                    </div>
                    <div className="rounded-[6px] bg-[rgba(0,208,132,0.1)] px-[8px] py-[4px] text-[10px] font-[700] uppercase tracking-[0.06em] text-green">
                      {t(`orderStatus.${order.status}`)}
                    </div>
                  </div>

                  <div className="mb-[10px] text-[11px] font-[500] text-dim">
                    {new Date(order.createdAt).toLocaleString()} · {order.userHandle}
                  </div>

                  {clientStats && (
                    <div className="mb-[10px] rounded-[10px] border border-border2 bg-bg2 px-[12px] py-[10px]">
                      <div className="mb-[8px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                        {t('admin.clientStatsTitle')}
                      </div>
                      <div className="grid grid-cols-3 gap-[8px]">
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
                            {new Date(clientStats.firstOrderAt).toLocaleDateString(language, { month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-[10px] rounded-[10px] border border-border2 bg-bg2 px-[12px] py-[10px]">
                    <div className="mb-[8px] text-[11px] font-[600] uppercase tracking-[0.06em] text-muted">
                      {t('admin.managerLabel')}
                    </div>
                    <div className="flex items-center gap-[8px]">
                      <input
                        type="text"
                        value={editManagers[order.id] ?? order.managerName ?? ''}
                        onChange={(e) => setEditManagers((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder={t('admin.managerPlaceholder')}
                        className="flex-1 rounded-[10px] border border-border2 bg-bg3 px-[12px] py-[10px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
                      />
                      <button
                        type="button"
                        onClick={() => updateOrderManager(order.id, editManagers[order.id] ?? '')}
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
                        onClick={() => updateOrderStatus(order.id, status)}
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
