import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { calculateCustomerMetrics, getBenefitsForGiveAsset, COMMISSION_DEFAULT_PERCENT, COMMISSION_SELL_USDT_PERCENT } from '../lib/customer';

export default function Profile() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { orders, antiPhishingCode, profileSettings, updateProfileSettings } = useStore();
  const user = WebApp.initDataUnsafe?.user;
  const currentUserId = user?.id ? String(user.id) : null;
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map((id: string) => id.trim());
  const isAdmin = user?.id ? adminIds.includes(user.id.toString()) : false;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));

  const [draft, setDraft] = useState(profileSettings);

  const metrics = useMemo(
    () => calculateCustomerMetrics(orders, currentUserHandle, currentUserId),
    [currentUserHandle, currentUserId, orders],
  );
  const benefits = useMemo(
    () => getBenefitsForGiveAsset(metrics, profileSettings.activatedReferralCode, 'EUR_CASH'),
    [metrics, profileSettings.activatedReferralCode],
  );
  const currentUserStats = useMemo(
    () =>
      metrics.deals > 0
        ? {
            deals: metrics.deals,
            volumeEUR: metrics.volumeEUR,
            firstOrderAt: metrics.firstOrderAt as string,
          }
        : null,
    [metrics],
  );
  const managerAssignedOrders = useMemo(
    () => orders.filter((order) => order.managerName === (profileSettings.displayName.trim() || currentUserHandle)),
    [currentUserHandle, orders, profileSettings.displayName],
  );
  const managerAssignedActive = useMemo(
    () => managerAssignedOrders.filter((order) => order.status === 'accepted' || order.status === 'processing').length,
    [managerAssignedOrders],
  );

  const effectiveName = profileSettings.displayName.trim() || user?.first_name || 'CryptoBull';
  const effectiveRole = profileSettings.roleLabel.trim() || t('profile.defaultRole');
  const showProfileName = effectiveName !== currentUserHandle && effectiveName !== t('checkout.unknownUser');

  const handleSave = () => {
    WebApp.HapticFeedback.notificationOccurred('success');
    updateProfileSettings(draft);
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

  const infoRows = [
    { label: t('profile.telegramLabel'), value: currentUserHandle },
    { label: t('profile.loyaltyTier'), value: t(`loyalty.${benefits.tier}`) },
    { label: t('home.clientDeals'), value: currentUserStats ? String(currentUserStats.deals) : '-' },
    { label: t('home.clientVolume'), value: currentUserStats ? `${currentUserStats.volumeEUR.toFixed(0)} EUR` : '-' },
    {
      label: t('home.clientSince'),
      value: currentUserStats
        ? new Date(currentUserStats.firstOrderAt).toLocaleDateString(language, { month: 'short', year: 'numeric' })
        : '-',
    },
    { label: t('profile.managerContactLabel'), value: profileSettings.managerContact || '-' },
    { label: t('profile.securityCodeLabel'), value: antiPhishingCode || '-' },
    { label: t('profile.referralCodeTitle'), value: profileSettings.referralCode || '-' },
    { label: t('profile.discountLabel'), value: `${benefits.totalDiscountPercent.toFixed(1)}%` },
    { label: t('profile.commissionLabel'), value: `${COMMISSION_DEFAULT_PERCENT}% / USDT ${COMMISSION_SELL_USDT_PERCENT}%` },
  ];

  const adminRows = isAdmin
    ? [
        { label: t('profile.managerOrdersTotal'), value: String(managerAssignedOrders.length) },
        { label: t('profile.managerOrdersActive'), value: String(managerAssignedActive) },
      ]
    : [];

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
          <h1 className="text-[24px] font-[800] text-[#FFFFFF]">{t('profile.title')}</h1>
          <div className="mt-[4px] text-[12px] font-[400] uppercase tracking-[0.12em] text-[#808080]">{effectiveRole}</div>
        </div>
        <LanguageSwitcher />
      </div>

      <section className="rounded-[16px] border border-[#222222] bg-[#111111] px-[24px] py-[24px]">
        <div className="flex items-start gap-[16px] border-b border-[#222222] pb-[20px]">
          <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#222222] bg-[#1A1A1A] text-[20px] font-[600] text-[#FFFFFF]">
            {user?.photo_url ? (
              <img src={user.photo_url} alt={t('app.avatarAlt')} className="h-full w-full object-cover" />
            ) : (
              user?.first_name?.charAt(0) || 'U'
            )}
          </div>
          <div className="min-w-0 flex-1">
            {showProfileName && <div className="text-[14px] font-[400] text-[#9A9A9A]">{effectiveName}</div>}
            <div className="mt-[6px] break-all text-[24px] font-[600] leading-[1.2] text-[#FFFFFF]">{currentUserHandle}</div>
            {isAdmin && (
              <div className="mt-[10px] inline-flex items-center rounded-[12px] bg-[#1A1A1A] px-[10px] py-[6px] text-[11px] font-[400] uppercase tracking-[0.08em] text-[#00CC66]">
                {t('profile.adminBadge')}
              </div>
            )}
          </div>
        </div>

        <div className="divide-y divide-[#222222]">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-[16px] py-[14px]">
              <span className="text-[14px] font-[400] text-[#9A9A9A]">{row.label}</span>
              <span className="max-w-[60%] break-words text-right text-[14px] font-[600] text-[#FFFFFF]">{row.value}</span>
            </div>
          ))}

          {adminRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-[16px] py-[14px]">
              <span className="text-[14px] font-[400] text-[#9A9A9A]">{row.label}</span>
              <span className="text-right text-[14px] font-[600] text-[#FFFFFF]">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-[20px] flex gap-[8px]">
          <button
            type="button"
            onClick={handleOpenManagerContact}
            disabled={!profileSettings.managerContact.trim()}
            className="flex-1 rounded-[12px] border border-[#222222] bg-[#1A1A1A] px-[14px] py-[12px] text-[12px] font-[400] text-[#FFFFFF] transition-colors hover:border-[#00CC66] hover:text-[#00CC66] disabled:text-[#9A9A9A]"
          >
            {t('orders.contactManager')}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="flex-1 rounded-[12px] bg-[#00CC66] px-[14px] py-[12px] text-[12px] font-[600] text-[#000000] transition-opacity hover:opacity-90"
            >
              {t('profile.openAdmin')}
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="mt-[20px] border-t border-[#222222] pt-[20px]">
            <div className="space-y-[10px]">
              <input
                type="text"
                value={draft.displayName}
                onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder={t('profile.displayNamePlaceholder')}
                className="w-full rounded-[12px] border border-[#222222] bg-[#1A1A1A] px-[14px] py-[13px] text-[14px] text-[#FFFFFF] outline-none placeholder:text-[#9A9A9A]"
              />
              <input
                type="text"
                value={draft.roleLabel}
                onChange={(e) => setDraft((prev) => ({ ...prev, roleLabel: e.target.value }))}
                placeholder={t('profile.rolePlaceholder')}
                className="w-full rounded-[12px] border border-[#222222] bg-[#1A1A1A] px-[14px] py-[13px] text-[14px] text-[#FFFFFF] outline-none placeholder:text-[#9A9A9A]"
              />
              <input
                type="text"
                value={draft.managerContact}
                onChange={(e) => setDraft((prev) => ({ ...prev, managerContact: e.target.value }))}
                placeholder={t('profile.contactPlaceholder')}
                className="w-full rounded-[12px] border border-[#222222] bg-[#1A1A1A] px-[14px] py-[13px] text-[14px] text-[#FFFFFF] outline-none placeholder:text-[#9A9A9A]"
              />
              <textarea
                value={draft.bio}
                onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder={t('profile.bioPlaceholder')}
                rows={3}
                className="w-full resize-none rounded-[12px] border border-[#222222] bg-[#1A1A1A] px-[14px] py-[13px] text-[14px] text-[#FFFFFF] outline-none placeholder:text-[#9A9A9A]"
              />
              <button
                type="button"
                onClick={handleSave}
                className="w-full rounded-[12px] bg-[#00CC66] px-[14px] py-[13px] text-[12px] font-[600] uppercase tracking-[0.08em] text-[#000000] transition-opacity hover:opacity-90"
              >
                {t('profile.save')}
              </button>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}
