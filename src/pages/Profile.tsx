import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { calculateCustomerMetrics, getCustomerBenefits } from '../lib/customer';

export default function Profile() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { orders, antiPhishingCode, profileSettings, reviews, updateProfileSettings, addReview, removeReview } = useStore();
  const user = WebApp.initDataUnsafe?.user;
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map((id: string) => id.trim());
  const isAdmin = user?.id ? adminIds.includes(user.id.toString()) : false;
  const currentUserHandle = user?.username ? `@${user.username}` : (user?.first_name || t('checkout.unknownUser'));

  const [draft, setDraft] = useState(profileSettings);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);

  const currentUserOrders = useMemo(
    () => orders.filter((order) => order.userHandle === currentUserHandle),
    [currentUserHandle, orders],
  );
  const currentUserReviews = useMemo(
    () => reviews.filter((review) => review.userHandle === currentUserHandle),
    [currentUserHandle, reviews],
  );

  const metrics = useMemo(
    () => calculateCustomerMetrics(orders, currentUserHandle),
    [currentUserHandle, orders],
  );
  const benefits = useMemo(
    () => getCustomerBenefits(metrics, profileSettings.activatedReferralCode),
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

  const handleBack = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate(-1);
  };

  const handleSave = () => {
    WebApp.HapticFeedback.notificationOccurred('success');
    updateProfileSettings(draft);
  };

  const handleAddReview = () => {
    if (!reviewText.trim() || currentUserOrders.length === 0) {
      return;
    }

    WebApp.HapticFeedback.notificationOccurred('success');
    addReview({
      userHandle: currentUserHandle,
      cityKey: currentUserOrders[0]?.cityKey ?? 'berlin',
      rating: reviewRating,
      text: reviewText.trim(),
    });
    setReviewText('');
    setReviewRating(5);
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
          <h1 className="text-[20px] font-[700] text-text">{t('profile.title')}</h1>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="space-y-[16px]">
        <div className="rounded-r2 border border-border2 bg-bg2 p-[18px]">
          <div className="flex items-start gap-[14px]">
            <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-border2 bg-bg3 text-[20px] font-[700] text-muted">
              {user?.photo_url ? (
                <img src={user.photo_url} alt={t('app.avatarAlt')} className="h-full w-full object-cover" />
              ) : (
                user?.first_name?.charAt(0) || 'U'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="break-words text-[20px] font-[800] text-text">{effectiveName}</div>
              <div className="mt-[4px] text-[12px] font-[600] uppercase tracking-[0.06em] text-green">{effectiveRole}</div>
              <div className="mt-[6px] text-[12px] font-[500] text-muted">
                {t('profile.telegramLabel')}: {currentUserHandle}
              </div>
              {isAdmin && (
                <div className="mt-[10px] inline-flex rounded-[8px] border border-green3 bg-green2 px-[10px] py-[6px] text-[11px] font-[700] uppercase tracking-[0.05em] text-green">
                  {t('profile.adminBadge')}
                </div>
              )}
            </div>
          </div>
          <div className="mt-[14px] rounded-r border border-border bg-bg3 px-[12px] py-[10px] text-[13px] font-[500] leading-relaxed text-muted">
            {profileSettings.bio}
          </div>
        </div>

        <div className="rounded-r2 border border-border2 bg-bg2 p-[16px]">
          <div className="mb-[10px] text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('profile.statsTitle')}</div>
          {currentUserStats ? (
            <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-3">
              <div className="rounded-r border border-border bg-bg3 p-[12px]">
                <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('home.clientDeals')}</div>
                <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{currentUserStats.deals}</div>
              </div>
              <div className="rounded-r border border-border bg-bg3 p-[12px]">
                <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('home.clientVolume')}</div>
                <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{currentUserStats.volumeEUR.toFixed(0)}€</div>
              </div>
              <div className="rounded-r border border-border bg-bg3 p-[12px]">
                <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('home.clientSince')}</div>
                <div className="mt-[6px] text-[12px] font-[700] text-text">
                  {new Date(currentUserStats.firstOrderAt).toLocaleDateString(language, { month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[13px] font-[500] text-muted">{t('profile.statsEmpty')}</div>
          )}
        </div>

        <div className="rounded-r2 border border-border2 bg-bg2 p-[16px]">
          <div className="mb-[10px] text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('profile.contactTitle')}</div>
          <div className="space-y-[10px]">
            <div className="rounded-r border border-border bg-bg3 px-[12px] py-[10px]">
              <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('profile.managerContactLabel')}</div>
              <div className="mt-[4px] text-[13px] font-[600] text-text">{profileSettings.managerContact}</div>
            </div>
            <div className="rounded-r border border-green3 bg-green2 px-[12px] py-[10px]">
              <div className="text-[10px] font-[700] uppercase tracking-[0.05em] text-green">{t('profile.securityCodeLabel')}</div>
              <div className="mt-[4px] font-mono text-[14px] font-[700] tracking-[0.12em] text-text">{antiPhishingCode}</div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="w-full rounded-r border border-border2 bg-bg3 px-[14px] py-[12px] text-[12px] font-[700] uppercase tracking-[0.05em] text-text transition-colors hover:border-green hover:text-green"
              >
                {t('profile.openAdmin')}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-r2 border border-border2 bg-bg2 p-[16px]">
          <div className="mb-[10px] text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('profile.benefitsTitle')}</div>
          <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-3">
            <div className="rounded-r border border-border bg-bg3 p-[12px]">
              <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('profile.loyaltyTier')}</div>
              <div className="mt-[6px] text-[13px] font-[700] text-text">{t(`loyalty.${benefits.tier}`)}</div>
            </div>
            <div className="rounded-r border border-border bg-bg3 p-[12px]">
              <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('profile.discountLabel')}</div>
              <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{benefits.totalDiscountPercent.toFixed(1)}%</div>
            </div>
            <div className="rounded-r border border-border bg-bg3 p-[12px]">
              <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('profile.commissionLabel')}</div>
              <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{benefits.effectiveCommissionPercent.toFixed(1)}%</div>
            </div>
          </div>
          <div className="mt-[10px] rounded-r border border-border bg-bg3 p-[12px]">
            <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('profile.referralCodeTitle')}</div>
            <div className="mt-[6px] font-mono text-[18px] font-[700] tracking-[0.08em] text-text">{profileSettings.referralCode}</div>
            <div className="mt-[4px] text-[11px] font-[500] text-dim">
              {profileSettings.activatedReferralCode
                ? t('profile.referralActivated', { code: profileSettings.activatedReferralCode })
                : t('profile.referralNotActivated')}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-r2 border border-border2 bg-bg2 p-[16px]">
            <div className="mb-[10px] text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('profile.managerOrdersTitle')}</div>
            <div className="grid grid-cols-1 gap-[8px] min-[360px]:grid-cols-2">
              <div className="rounded-r border border-border bg-bg3 p-[12px]">
                <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('profile.managerOrdersTotal')}</div>
                <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{managerAssignedOrders.length}</div>
              </div>
              <div className="rounded-r border border-border bg-bg3 p-[12px]">
                <div className="text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('profile.managerOrdersActive')}</div>
                <div className="mt-[6px] font-mono text-[18px] font-[700] text-text">{managerAssignedActive}</div>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="rounded-r2 border border-border2 bg-bg2 p-[16px]">
            <div className="mb-[12px] text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('profile.editTitle')}</div>
            <div className="space-y-[10px]">
              <input
                type="text"
                value={draft.displayName}
                onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder={t('profile.displayNamePlaceholder')}
                className="w-full rounded-r border border-border2 bg-bg3 px-[12px] py-[12px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
              />
              <input
                type="text"
                value={draft.roleLabel}
                onChange={(e) => setDraft((prev) => ({ ...prev, roleLabel: e.target.value }))}
                placeholder={t('profile.rolePlaceholder')}
                className="w-full rounded-r border border-border2 bg-bg3 px-[12px] py-[12px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
              />
              <input
                type="text"
                value={draft.managerContact}
                onChange={(e) => setDraft((prev) => ({ ...prev, managerContact: e.target.value }))}
                placeholder={t('profile.contactPlaceholder')}
                className="w-full rounded-r border border-border2 bg-bg3 px-[12px] py-[12px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
              />
              <textarea
                value={draft.bio}
                onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder={t('profile.bioPlaceholder')}
                rows={4}
                className="w-full resize-none rounded-r border border-border2 bg-bg3 px-[12px] py-[12px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
              />
              <button
                type="button"
                onClick={handleSave}
                className="w-full rounded-r border border-green3 bg-green2 px-[14px] py-[12px] text-[12px] font-[700] uppercase tracking-[0.05em] text-green transition-colors hover:border-green"
              >
                {t('profile.save')}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-r2 border border-border2 bg-bg2 p-[16px]">
          <div className="mb-[12px] text-[11px] font-[600] uppercase tracking-[0.08em] text-muted">{t('profile.reviewsTitle')}</div>
          {currentUserOrders.length > 0 && (
            <div className="mb-[12px] rounded-r border border-border bg-bg3 p-[12px]">
              <div className="mb-[8px] text-[10px] font-[600] uppercase tracking-[0.05em] text-muted">{t('profile.leaveReview')}</div>
              <div className="mb-[10px] flex gap-[6px]">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className={`rounded-[8px] border px-[10px] py-[8px] text-[12px] font-[700] transition-colors ${
                      reviewRating === value
                        ? 'border-amber bg-[rgba(245,166,35,0.12)] text-amber'
                        : 'border-border2 bg-bg2 text-muted'
                    }`}
                  >
                    {value}★
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder={t('profile.reviewPlaceholder')}
                rows={3}
                className="w-full resize-none rounded-r border border-border2 bg-bg2 px-[12px] py-[12px] text-[13px] text-text outline-none transition-colors placeholder:text-dim focus:border-green"
              />
              <button
                type="button"
                onClick={handleAddReview}
                className="mt-[10px] w-full rounded-r border border-green3 bg-green2 px-[14px] py-[12px] text-[12px] font-[700] uppercase tracking-[0.05em] text-green transition-colors hover:border-green"
              >
                {t('profile.publishReview')}
              </button>
            </div>
          )}

          {currentUserReviews.length > 0 ? (
            <div className="space-y-[10px]">
              {currentUserReviews.map((review) => (
                <div key={review.id} className="rounded-r border border-border bg-bg3 p-[12px]">
                  <div className="flex items-center justify-between gap-[8px]">
                    <div className="text-[12px] font-[700] text-text">{'★'.repeat(review.rating)}</div>
                    <button
                      type="button"
                      onClick={() => removeReview(review.id)}
                      className="text-[11px] font-[700] uppercase tracking-[0.05em] text-muted transition-colors hover:text-error"
                    >
                      {t('profile.removeReview')}
                    </button>
                  </div>
                  <div className="mt-[6px] text-[12px] font-[500] text-muted">{review.text}</div>
                  <div className="mt-[6px] text-[11px] font-[500] text-dim">
                    {new Date(review.createdAt).toLocaleDateString(language)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] font-[500] text-muted">{t('profile.reviewsEmpty')}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
