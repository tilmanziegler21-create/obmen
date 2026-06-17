import { useLocation, useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useI18n } from '../i18n';

const ITEMS = [
  {
    path: '/',
    key: 'home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M3 8.5L10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1V8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/exchange',
    key: 'exchange',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M5 6h10M5 6l2.5-2.5M5 6l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 14H5M15 14l-2.5-2.5M15 14l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/orders',
    key: 'history',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/profile',
    key: 'profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.5 16c1.3-2.7 3.3-4 5.5-4s4.2 1.3 5.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  return (
    <div
      className="sticky bottom-0 z-20 mt-auto border-t border-[#222222] bg-[rgba(0,0,0,0.9)] px-[8px] pt-[8px] backdrop-blur-xl"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <div className="grid grid-cols-4 gap-[6px]">
        {ITEMS.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                WebApp.HapticFeedback.selectionChanged();
                navigate(item.path);
              }}
              className={`flex flex-col items-center justify-center gap-[4px] rounded-[12px] px-[8px] py-[10px] text-[9px] font-[400] leading-none transition-colors ${
                isActive ? 'text-[#D4AF37]' : 'text-[#808080]'
              }`}
            >
              <span className={`flex h-[20px] w-[20px] items-center justify-center ${isActive ? 'text-[#D4AF37]' : 'text-[#808080]'}`}>
                {item.icon}
              </span>
              <span>{t(`nav.${item.key}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
