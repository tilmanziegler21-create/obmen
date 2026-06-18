import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useStore } from './store';
import { useI18n } from './i18n';
import BottomNav from './components/BottomNav';

const Home = lazy(() => import('./pages/Home'));
const Exchange = lazy(() => import('./pages/Exchange'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Admin = lazy(() => import('./pages/Admin'));
const Profile = lazy(() => import('./pages/Profile'));
const Orders = lazy(() => import('./pages/Orders'));

function AppShell() {
  const fetchInitialData = useStore(state => state.fetchInitialData);
  const { t } = useI18n();
  const location = useLocation();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const showBottomNav = location.pathname !== '/checkout' && location.pathname !== '/admin' && !isKeyboardVisible;

  useEffect(() => {
    // Initialize Telegram Web App
    WebApp.ready();
    WebApp.expand();
    
    // Set theme colors from Telegram if needed, but we force dark mode per requirements
    document.documentElement.classList.add('dark');
    document.title = t('app.title');
    
    fetchInitialData();
  }, [fetchInitialData, t]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

    const handleFocusIn = (event: FocusEvent) => {
      if (isEditableTarget(event.target)) {
        setIsKeyboardVisible(true);
      }
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        const activeElement = document.activeElement;
        if (!isEditableTarget(activeElement)) {
          setIsKeyboardVisible(false);
        }
      }, 100);
    };

    const viewport = window.visualViewport;
    const initialHeight = viewport?.height ?? window.innerHeight;

    const handleViewportResize = () => {
      const currentHeight = viewport?.height ?? window.innerHeight;
      const hasEditableFocus = isEditableTarget(document.activeElement);
      if (hasEditableFocus && currentHeight < initialHeight - 120) {
        setIsKeyboardVisible(true);
        return;
      }

      if (!hasEditableFocus) {
        setIsKeyboardVisible(false);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    viewport?.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      viewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  return (
    <div className="min-h-screen w-full max-w-[420px] mx-auto relative flex flex-col bg-[#000000] text-[#FFFFFF]">
      <div
        className="relative z-10 flex-1 flex flex-col"
        style={{ paddingBottom: showBottomNav ? 'calc(78px + env(safe-area-inset-bottom))' : '0px' }}
      >
        <Suspense fallback={<div className="flex-1 bg-bg2" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/exchange" element={<Exchange />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Suspense>
      </div>

      {showBottomNav && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
