import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useStore } from '../store';
import { useI18n } from '../i18n';

interface OrdersLocationState {
  orderId?: string;
  justCreated?: boolean;
}

export default function Orders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useI18n();
  const { orders, profileSettings, applyOrderTemplate } = useStore();
  const user = WebApp.initDataUnsafe?.user;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));
  const locationState = (location.state as OrdersLocationState | null) ?? null;
  const highlightedOrderId = locationState?.orderId ?? null;

  const currentUserOrders = useMemo(
    () => orders.filter((order) => order.userHandle === currentUserHandle),
    [currentUserHandle, orders],
  );
  const highlightedOrder = useMemo(
    () => currentUserOrders.find((order) => order.id === highlightedOrderId) ?? null,
    [currentUserOrders, highlightedOrderId],
  );

  const handleBack = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate('/');
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
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-[16px] pb-[32px] pt-[20px]"
      style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
    >
      <div className="mb-[20px] flex items-center justify-between gap-[12px]">
        <div className="flex items-center gap-[12px]">
          <button
            onClick={handleBack}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-border2 bg-bg3 text-muted transition-colors hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 13l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[20px] font-[700] text-text">{t('orders.title')}</h1>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="space-y-[16px]">
        {locationState?.justCreated && highlightedOrder && (
          <div className="rounded-r2 border border-green3 bg-green2 p-[16px]">
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-green">{t('orders.createdTitle')}</div>
            <div className="mt-[8px] text-[15px] font-[700] text-text">{t('home.orderNumber', { id: highlightedOrder.id })}</div>
            <div className="mt-[6px] text-[12px] font-[500] leading-relaxed text-text">{t('orders.createdHint')}</div>
          </div>
        )}

        {currentUserOrders.length > 0 ? (
          <div className="space-y-[12px]">
            {currentUserOrders.map((order) => {
              const isHighlighted = order.id === highlightedOrderId;

              return (
                <div
                  key={order.id}
                  className={`rounded-r2 border p-[16px] ${isHighlighted ? 'border-green3 bg-green2/30' : 'border-border2 bg-bg2'}`}
                >
                  <div className="flex items-start justify-between gap-[10px]">
                    <div>
                      <div className="text-[13px] font-[700] text-text">{t('home.orderNumber', { id: order.id })}</div>
                      <div className="mt-[4px] text-[12px] font-[500] text-muted">
                        {t(`cities.${order.cityKey}`)} · {order.giveAmount} {order.giveCurrency} {'->'} {order.getAmount} {order.getCurrency}
                      </div>
                    </div>
                    <div className="rounded-[6px] bg-green2 px-[8px] py-[4px] text-[10px] font-[700] uppercase tracking-[0.06em] text-green">
                      {t(`orderStatus.${order.status}`)}
                    </div>
                  </div>

                  <div className="mt-[10px] grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-2">
                    <div className="rounded-r border border-border bg-bg3 p-[12px]">
                      <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('orders.managerTitle')}</div>
                      <div className="mt-[6px] text-[13px] font-[700] text-text">
                        {order.managerName || t('home.orderPendingManager')}
                      </div>
                    </div>
                    <div className="rounded-r border border-border bg-bg3 p-[12px]">
                      <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('orders.updatedTitle')}</div>
                      <div className="mt-[6px] text-[12px] font-[500] text-text">
                        {new Date(order.createdAt).toLocaleString(language)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-[12px] grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleRepeatOrder(order.id)}
                      className="rounded-r border border-border2 bg-bg3 px-[12px] py-[12px] text-[11px] font-[700] uppercase tracking-[0.05em] text-text transition-colors hover:border-green hover:text-green"
                    >
                      {t('home.repeatOrder')}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenManagerContact}
                      disabled={!profileSettings.managerContact.trim()}
                      className="rounded-r border border-green3 bg-green2 px-[12px] py-[12px] text-[11px] font-[700] uppercase tracking-[0.05em] text-green transition-colors hover:border-green disabled:opacity-50"
                    >
                      {t('orders.contactManager')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-r2 border border-border2 bg-bg2 px-[16px] py-[18px] text-[13px] font-[500] text-muted">
            {t('orders.empty')}
          </div>
        )}
      </div>
    </motion.div>
  );
}
