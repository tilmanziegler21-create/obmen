import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { CheckCircle2 } from 'lucide-react';
import WebApp from '@twa-dev/sdk';

const NETWORKS = [
  { id: 'TRC-20', label: 'TRC-20', time: '3 мин' },
  { id: 'ERC-20', label: 'ERC-20', time: '10 мин' },
  { id: 'TON', label: 'TON', time: '1 мин' },
];

export default function Checkout() {
  const navigate = useNavigate();
  const { 
    cities, selectedCityId, direction, rates,
    giveAmount, getAmount
  } = useStore();

  const [contact, setContact] = useState(WebApp.initDataUnsafe?.user?.username ? `@${WebApp.initDataUnsafe.user.username}` : '');
  const [wallet, setWallet] = useState('');
  const [network, setNetwork] = useState(NETWORKS[0].id);
  const [isSuccess, setIsSuccess] = useState(false);

  const city = cities.find(c => c.id === selectedCityId);

  const handleBack = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate(-1);
  };

  const handleSubmit = async () => {
    WebApp.HapticFeedback.impactOccurred('heavy');
    // Here we would typically send the data to our backend
    // await fetch('/api/orders', { ... })
    
    setTimeout(() => {
      WebApp.HapticFeedback.notificationOccurred('success');
      setIsSuccess(true);
      
      // Close WebApp after 3 seconds
      setTimeout(() => {
        WebApp.close();
      }, 3000);
    }, 500);
  };

  const isGettingUSDT = direction === 'GIVE_CASH';
  
  // Basic validation
  const isValid = isGettingUSDT 
    ? wallet.length > 10 // Simple wallet check
    : contact.length > 2;

  const currentRate = rates.EUR_USDT;
  const effectiveRate = direction === 'GIVE_CASH' 
    ? (currentRate * 0.96)
    : (currentRate * 0.96);

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col items-center justify-center p-[24px] space-y-[24px] text-center"
      >
        <div className="w-[96px] h-[96px] bg-green2 rounded-full flex items-center justify-center border border-green3">
          <CheckCircle2 size={48} className="text-green" />
        </div>
        <h1 className="text-[28px] font-[800] text-green">Заявка создана!</h1>
        <p className="text-[14px] text-muted font-[500]">
          {direction === 'GIVE_CASH' 
            ? 'Через 30 минут вы получите координаты места выдачи наличных. Окно закроется автоматически.' 
            : 'Через 30 минут встреча, получение криптовалюты на счет. Окно закроется автоматически.'}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-[16px] pt-[20px]"
    >
      <div className="flex items-center gap-[12px] mb-[16px]">
        <button onClick={handleBack} className="w-[36px] h-[36px] rounded-full bg-bg3 border border-border2 flex items-center justify-center text-muted hover:text-text transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 13l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="text-[20px] font-[700] text-text">Оформление</h1>
      </div>

      <div className="space-y-[16px] flex-1">
        {/* Order Summary Card */}
        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <h2 className="text-[14px] font-[700] text-text mb-[16px]">Детали сделки</h2>
          
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-muted font-[500]">Город</span>
            <span className="font-[700] text-text">{city?.name}</span>
          </div>
          
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-muted font-[500]">Вы отдаете</span>
            <span className={`font-mono font-[600] text-[15px] ${direction === 'GIVE_CASH' ? 'text-amber' : 'text-usdt'}`}>{giveAmount} {direction === 'GIVE_CASH' ? 'EUR' : 'USDT'}</span>
          </div>
          
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-muted font-[500]">Вы получаете</span>
            <span className={`font-mono font-[600] text-[15px] ${direction === 'GIVE_CASH' ? 'text-usdt' : 'text-amber'}`}>{getAmount} {direction === 'GIVE_CASH' ? 'USDT' : 'EUR'}</span>
          </div>

          <div className="flex justify-between items-center pt-[16px] border-t border-border text-[12px]">
            <span className="text-muted font-[500]">Курс фиксации</span>
            <span className="font-mono font-[600] text-text">1 EUR = {effectiveRate.toFixed(4)} USDT</span>
          </div>
        </div>

        {/* Dynamic Inputs based on direction */}
        {isGettingUSDT ? (
          <div className="space-y-[16px]">
            <div className="space-y-[8px]">
              <label className="text-[11px] text-muted font-[600] uppercase tracking-[0.06em] ml-[4px]">Сеть перевода USDT</label>
              <div className="flex gap-[8px]">
                {NETWORKS.map((net) => (
                  <button
                    key={net.id}
                    onClick={() => {
                      WebApp.HapticFeedback.selectionChanged();
                      setNetwork(net.id);
                    }}
                    className={`flex-1 py-[12px] rounded-[12px] transition-all flex flex-col items-center justify-center border-[1.5px] ${
                      network === net.id
                        ? 'border-usdt bg-usdt2 text-usdt'
                        : 'border-border bg-bg2 text-muted hover:border-border2'
                    }`}
                  >
                    <span className="font-[700] text-[13px]">{net.label}</span>
                    <span className="text-[10px] font-[500] mt-[2px] opacity-80">{net.time}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-[8px]">
              <label className="text-[11px] text-muted font-[600] uppercase tracking-[0.06em] ml-[4px]">Адрес кошелька ({network})</label>
              <input 
                type="text"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="T9yD14Nj9yD14N..."
                className="w-full bg-bg2 border-[1.5px] border-border2 focus:border-usdt rounded-r p-[16px] text-[14px] text-text outline-none transition-all font-mono placeholder:text-dim"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-[8px]">
            <label className="text-[11px] text-muted font-[600] uppercase tracking-[0.06em] ml-[4px]">Контакт для связи (Telegram)</label>
            <input 
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="@username"
              className="w-full bg-bg2 border-[1.5px] border-border2 focus:border-amber rounded-r p-[16px] text-[14px] text-text outline-none transition-all placeholder:text-dim"
            />
          </div>
        )}
      </div>

      <div className="pb-[32px] pt-[16px] mt-auto">
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={`w-full p-[18px] border-none rounded-r2 font-sans text-[15px] font-[700] cursor-pointer transition-all tracking-[0.02em] flex items-center justify-center gap-[8px] relative overflow-hidden active:scale-[0.985] disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none
            ${isValid 
              ? (direction === 'GIVE_CASH' 
                ? 'bg-gradient-to-br from-[#26A17B] to-[#1B7A5C] text-white shadow-[0_8px_24px_rgba(38,161,123,0.25)]'
                : 'bg-gradient-to-br from-[#F5A623] to-[#E08B00] text-[#0A0B0F] shadow-[0_8px_24px_rgba(245,166,35,0.25)]')
              : 'bg-bg3 text-muted'
            }`}
        >
          {direction === 'GIVE_CASH' ? 'ПОЛУЧИТЬ USDT' : 'ПОЛУЧИТЬ НАЛИЧНЫЕ'}
        </button>
      </div>
    </motion.div>
  );
}