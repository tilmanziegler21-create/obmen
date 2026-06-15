import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import Home from './pages/Home';
import Checkout from './pages/Checkout';
import Admin from './pages/Admin';
import { useStore } from './store';
import { useI18n } from './i18n';

function App() {
  const fetchInitialData = useStore(state => state.fetchInitialData);
  const { t } = useI18n();

  useEffect(() => {
    // Initialize Telegram Web App
    WebApp.ready();
    WebApp.expand();
    
    // Set theme colors from Telegram if needed, but we force dark mode per requirements
    document.documentElement.classList.add('dark');
    document.title = t('app.title');
    
    fetchInitialData();
  }, [fetchInitialData, t]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-text flex flex-col max-w-[420px] mx-auto relative overflow-hidden">
        {/* Background Orbs */}
        <div className="fixed rounded-full blur-[80px] pointer-events-none z-0 w-[260px] h-[260px] bg-[rgba(0,208,132,0.07)] -top-[80px] -right-[60px]"></div>
        <div className="fixed rounded-full blur-[80px] pointer-events-none z-0 w-[200px] h-[200px] bg-[rgba(79,142,247,0.05)] bottom-[120px] -left-[60px]"></div>
        
        {/* Noise overlay */}
        <div className="fixed inset-0 opacity-[0.022] pointer-events-none z-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`
        }}></div>

        <div className="relative z-10 flex-1 flex flex-col pb-20">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
