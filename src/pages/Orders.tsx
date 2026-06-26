import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { isOrderOwnedByUser } from '../lib/customer';

interface OrdersLocationState {
  orderId?: string;
  justCreated?: boolean;
}

export default function Orders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { orders, supportLink, applyOrderTemplate } = useStore();
  const user = WebApp.initDataUnsafe?.user;
  const currentUserId = user?.id ? String(user.id) : null;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));
  const locationState = (location.state as OrdersLocationState | null) ?? null;
  const highlightedOrderId = locationState?.orderId ?? null;

  const currentUserOrders = useMemo(
    () => orders.filter((order) => isOrderOwnedByUser(order, currentUserHandle, currentUserId)),
    [currentUserHandle, currentUserId, orders],
  );
  const highlightedOrder = useMemo(
    () => currentUserOrders.find((order) => order.id === highlightedOrderId) ?? null,
    [currentUserOrders, highlightedOrderId],
  );
  const sortedOrders = useMemo(
    () => [...currentUserOrders].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [currentUserOrders],
  );
  const latestOrder = sortedOrders[0] ?? null;

  const handleRepeatOrder = (orderId: string) => {
    WebApp.HapticFeedback.impactOccurred('medium');
    applyOrderTemplate(orderId);
    navigate('/checkout');
  };

  const handleOpenManagerContact = () => {
    const rawValue = supportLink.trim();
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

  const getStatusDotClass = (status: string) => {
    if (status === 'ready') {
      return 'bg-[#00CC66]';
    }

    if (status === 'processing') {
      return 'bg-[#FFFFFF]';
    }

    if (status === 'rejected') {
      return 'bg-[#808080]';
    }

    return 'bg-[#00CC66]';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 px-[16px] pb-[32px]"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
    >
      <div className="mb-[24px] flex items-center justify-between gap-[12px]">
        <div>
          <h1 className="text-[24px] font-[800] text-[#FFFFFF]">{t('orders.title')}</h1>
          <div className="mt-[4px] text-[12px] font-[400] uppercase tracking-[0.12em] text-[#808080]">
            {sortedOrders.length > 0 ? `${sortedOrders.length}` : t('common.empty')}
          </div>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="space-y-[16px]">
        {locationState?.justCreated && highlightedOrder && (
          <div className="rounded-[16px] border border-[#222222] bg-[#111111] p-[24px]">
            <div className="text-[11px] font-[400] uppercase tracking-[0.12em] text-[#808080]">{t('orders.createdTitle')}</div>
            <div className="mt-[10px] text-[18px] font-[600] text-[#FFFFFF]">{t('home.orderNumber', { id: highlightedOrder.id })}</div>
            <div className="mt-[8px] text-[13px] font-[400] leading-[1.7] text-[#808080]">{t('orders.createdHint')}</div>
          </div>
        )}

        {sortedOrders.length > 0 ? (
          <>
            <div className="flex gap-[8px]">
              <button
                type="button"
                onClick={() => latestOrder && handleRepeatOrder(latestOrder.id)}
                disabled={!latestOrder}
                className="flex-1 rounded-[12px] border border-[#222222] bg-[#111111] px-[14px] py-[12px] text-[12px] font-[400] text-[#FFFFFF] transition-colors hover:border-[#00CC66] hover:text-[#00CC66] disabled:text-[#808080]"
              >
                {t('home.repeatOrder')}
              </button>
              <button
                type="button"
                onClick={handleOpenManagerContact}
                disabled={!supportLink.trim()}
                className="flex-1 rounded-[12px] bg-[#00CC66] px-[14px] py-[12px] text-[12px] font-[600] text-[#000000] transition-opacity hover:opacity-90 disabled:bg-[#1A1A1A] disabled:text-[#808080]"
              >
                {t('orders.contactManager')}
              </button>
            </div>

            <div className="rounded-[16px] border border-[#222222] bg-[#111111] px-[24px]">
              {sortedOrders.map((order, index) => (
                <div
                  key={order.id}
                  className={`py-[16px] ${index === 0 ? '' : 'border-t border-[#222222]'}`}
                >
                  <div className="flex items-start justify-between gap-[16px]">
                    <div className="min-w-0">
                      <div className="text-[13px] font-[600] text-[#FFFFFF]">
                        {new Date(order.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-[6px] text-[13px] font-[400] text-[#808080]">
                        {order.giveCurrency} {'->'} {order.getCurrency}
                      </div>
                      <div className="mt-[6px] text-[12px] font-[400] text-[#808080]">
                        {t('home.orderNumber', { id: order.id })} · {t(`cities.${order.cityKey}`).startsWith('cities.') ? order.cityKey : t(`cities.${order.cityKey}`)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[14px] font-[600] text-[#FFFFFF]">
                        {order.giveAmount} {order.giveCurrency}
                      </div>
                      <div className="mt-[6px] flex items-center justify-end gap-[8px] text-[12px] font-[400] text-[#808080]">
                        <span>{t(`orderStatus.${order.status}`)}</span>
                        <span className={`h-[8px] w-[8px] rounded-full ${getStatusDotClass(order.status)}`}></span>
                      </div>
                      <div className="mt-[6px] text-[12px] font-[400] text-[#808080]">
                        {order.getAmount} {order.getCurrency}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[16px] border border-[#222222] bg-[#111111] px-[24px] py-[20px] text-[13px] font-[400] text-[#808080]">
            {t('orders.empty')}
          </div>
        )}
      </div>
    </motion.div>
  );
}
