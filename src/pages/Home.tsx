import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { isOrderOwnedByUser } from '../lib/customer';

export default function Home() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { rates, rateUpdatedAt, orders } = useStore();

  const user = WebApp.initDataUnsafe?.user;
  const currentUserId = user?.id ? String(user.id) : null;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));

  const currentUserOrders = useMemo(
    () => orders.filter((order) => isOrderOwnedByUser(order, currentUserHandle, currentUserId)),
    [currentUserHandle, currentUserId, orders],
  );

  const formattedRateUpdatedAt = new Date(rateUpdatedAt).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleOpenExchange = () => {
    WebApp.HapticFeedback.impactOccurred('medium');
    navigate('/exchange');
  };

  const handleOpenHistory = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate('/orders');
  };

  const handleOpenSupport = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    WebApp.openTelegramLink('https://t.me/cryptobull_manager');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col px-[16px] pb-[24px]"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
    >
      <header className="mb-[24px] flex items-center justify-between">
        <button className="text-[14px] font-[500] text-[#9A9A9A]" onClick={() => WebApp.close()}>
          Закрыть
        </button>
        <div className="text-[14px] font-[600] text-[#FFFFFF]">CryptoBull мини-приложение</div>
        <button className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-[#1A1A1A]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </header>

      <div className="space-y-[12px]">
        {/* Main Commercial Block */}
        <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] p-[20px]">
          <div className="absolute right-0 top-0 h-full w-[45%] opacity-80">
            {/* Bull graphic placeholder */}
            <div className="absolute inset-0 bg-[url('https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=3d%20golden%20bull%20head%20statue%20dark%20background&image_size=square')] bg-cover bg-center bg-no-repeat mix-blend-screen" />
          </div>
          <div className="relative z-10 w-[65%]">
            <div className="inline-flex items-center gap-[6px] rounded-full bg-[#111111]/80 px-[8px] py-[4px] backdrop-blur-sm">
              <div className="h-[6px] w-[6px] rounded-full bg-[#00D084]" />
              <span className="text-[10px] font-[500] text-[#FFFFFF]">{t('home.onlineAverageTime')}</span>
            </div>
            <div className="mt-[16px] text-[12px] font-[500] uppercase tracking-wider text-[#9A9A9A]">
              {t('home.bestRateToday')}
            </div>
            <div className="mt-[4px] text-[24px] font-[700] leading-tight text-[#FFFFFF]">
              1 EUR = <br />{rates.EUR_USDT.toFixed(4)} USDT
            </div>
            <div className="mt-[8px] text-[11px] font-[400] text-[#808080]">
              Обновлено {formattedRateUpdatedAt}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <button
          type="button"
          onClick={handleOpenExchange}
          className="flex w-full items-center justify-between rounded-[16px] bg-gradient-to-r from-[#D4AF37] to-[#B38F26] px-[24px] py-[18px] transition-opacity hover:opacity-90"
        >
          <span className="text-[15px] font-[700] uppercase tracking-wider text-[#000000]">
            {t('home.exchangeNow')}
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        {/* Efficiency Criteria */}
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

        {/* Recent Exchanges */}
        <section className="rounded-[16px] bg-[#111111] p-[20px]">
          <div className="mb-[16px] flex items-center justify-between">
            <h2 className="text-[12px] font-[700] uppercase tracking-wider text-[#9A9A9A]">
              {t('home.recentExchanges')}
            </h2>
            <button onClick={handleOpenHistory} className="text-[12px] font-[500] text-[#D4AF37]">
              {t('home.seeAll')}
            </button>
          </div>
          <div className="space-y-[12px]">
            {currentUserOrders.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-center gap-[12px]">
                <div className="h-[8px] w-[8px] rounded-full bg-[#00D084]" />
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

        {/* Two-Column Block */}
        <section className="flex gap-[8px]">
          <div className="flex flex-1 flex-col justify-between rounded-[16px] bg-[#111111] p-[16px]">
            <div>
              <div className="mb-[8px] text-[20px]">🌍</div>
              <h3 className="mb-[8px] text-[11px] font-[700] uppercase tracking-wider text-[#9A9A9A]">
                {t('home.workingInGermany')}
              </h3>
              <div className="text-[13px] font-[600] leading-snug text-[#FFFFFF]">
                Франкфурт, Берлин,<br />Мюнхен, Гамбург
              </div>
            </div>
            <div className="mt-[12px] text-[11px] font-[500] text-[#808080]">
              {t('home.andMoreCities')}
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-between rounded-[16px] bg-[#1A1A1A] p-[16px]">
            <div>
              <div className="mb-[8px] text-[20px]">👥</div>
              <h3 className="mb-[8px] text-[11px] font-[700] uppercase tracking-wider text-[#D4AF37]">
                {t('home.inviteFriendsTitle')}
              </h3>
              <div className="text-[13px] font-[600] leading-snug text-[#FFFFFF]">
                {t('home.inviteFriendsText')}
              </div>
            </div>
            <button className="mt-[12px] text-left text-[11px] font-[700] text-[#D4AF37]">
              {t('home.learnMoreArrow')}
            </button>
          </div>
        </section>

        {/* Support Panel */}
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
      </div>
    </motion.div>
  );
}
