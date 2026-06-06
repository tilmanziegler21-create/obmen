import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { ExchangeDirection } from '../types';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const { 
    cities, isLoading, selectedCityId, direction, rates,
    setCity, setDirection, giveAmount, getAmount, setGiveAmount
  } = useStore();

  const user = WebApp.initDataUnsafe?.user;

  const getCityFlag = (name: string) => {
    if (name.includes('Берлин')) return '🇩🇪';
    if (name.includes('Мюнхен')) return '🏙️';
    if (name.includes('Гамбург')) return '⚓';
    if (name.includes('Франкфурт')) return '🏦';
    if (name.includes('Кёльн')) return '⛪';
    if (name.includes('Дюссельдорф')) return '🏭';
    if (name.includes('Штутгарт')) return '🎭';
    if (name.includes('Дубай')) return '🇦🇪';
    if (name.includes('Москва')) return '🇷🇺';
    if (name.includes('Лондон')) return '🇬🇧';
    return '📍';
  };

  const currentCity = cities.find(c => c.id === selectedCityId);
  const eurAmount = direction === 'GIVE_CASH' ? Number(giveAmount) : Number(getAmount);
  
  // Strict 500 EUR limit logic
  const isOverLimit = eurAmount > 500;
  
  // EUR is now automatically rounded to nearest 10 in the store when getting cash,
  // but if user manually inputs EUR to give, we should warn them.
  const isEurInvalid = direction === 'GIVE_CASH' && (eurAmount % 10 !== 0 || eurAmount % 1 !== 0);
  const isValid = Number(giveAmount) > 0 && !isOverLimit && (!isEurInvalid || eurAmount === 0);

  const currentRate = rates.EUR_USDT;
  const effectiveRate = direction === 'GIVE_CASH' 
    ? (currentRate * 0.96) // 4% commission for us
    : (currentRate * 1.02); // 2% bonus for client

  const handleNext = () => {
    if (isValid) {
      WebApp.HapticFeedback.impactOccurred('medium');
      navigate('/checkout');
    }
  };

  const setAmount = (val: number) => {
    WebApp.HapticFeedback.selectionChanged();
    setGiveAmount(val.toString());
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col"
    >
      {/* Header */}
      <header className="relative z-10 p-[20px_20px_16px] flex items-center justify-between border-b border-border">
        <div 
          className="flex items-center gap-[10px] cursor-pointer"
          onClick={() => navigate('/admin')}
        >
          <div className="w-[36px] h-[36px] rounded-[10px] bg-gradient-to-br from-[#00D084] to-[#00A86B] flex items-center justify-center shrink-0">
            {/* Bull Icon Logo */}
            <svg viewBox="0 0 24 24" fill="none" className="w-[20px] h-[20px]">
              <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" stroke="#0A0B0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.5 8L5 4" stroke="#0A0B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16.5 8L19 4" stroke="#0A0B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 13H15" stroke="#0A0B0F" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-[17px] font-[800] tracking-[0.06em] text-text ">CryptoBull</div>
            <div className="text-[10px] font-[500] text-muted tracking-[0.1em] mt-[1px]">P2P Exchange</div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <div className="flex items-center gap-[5px] bg-green2 border border-green3 rounded-[20px] px-[10px] py-[5px] text-[10px] font-[600] text-green tracking-[0.06em]">
            <div className="w-[5px] h-[5px] rounded-full bg-green animate-pulse-fast"></div>
            LIVE
          </div>
          <div className="w-[34px] h-[34px] rounded-full bg-bg3 border border-border2 flex items-center justify-center text-[13px] font-[700] text-muted overflow-hidden">
             {user?.photo_url ? (
              <img src={user.photo_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.first_name?.charAt(0) || 'U'
            )}
          </div>
        </div>
      </header>

      {/* Mode Selection */}
      <div className="relative z-10 text-[10px] font-[600] tracking-[0.14em] uppercase text-muted px-[20px] pt-[18px] pb-[10px]">Что хотите сделать?</div>
      <div className="relative z-10 px-[16px] pt-[16px] pb-0">
        <div className="grid grid-cols-2 gap-[8px]">
          
          <div 
            onClick={() => { WebApp.HapticFeedback.selectionChanged(); setDirection('GIVE_CASH'); }}
            className={`bg-bg2 border-[1.5px] rounded-r2 p-[16px_14px] cursor-pointer transition-all relative overflow-hidden text-left ${direction === 'GIVE_CASH' ? 'border-amber bg-amber2' : 'border-border'}`}
          >
            {direction === 'GIVE_CASH' && <div className="absolute inset-0 rounded-r2 bg-gradient-to-br from-[rgba(245,166,35,0.08)] to-transparent"></div>}
            
            <div className={`absolute top-[12px] right-[12px] w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all ${direction === 'GIVE_CASH' ? 'bg-amber border-amber' : 'bg-bg3 border-[1.5px] border-border2'}`}>
              <svg viewBox="0 0 10 10" fill="none" className={`w-[10px] h-[10px] transition-opacity ${direction === 'GIVE_CASH' ? 'opacity-100' : 'opacity-0'}`}>
                <path d="M2 5l2.5 2.5L8 3" stroke="#0A0B0F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <div className={`w-[42px] h-[42px] rounded-[12px] flex items-center justify-center mb-[10px] transition-all ${direction === 'GIVE_CASH' ? 'bg-[rgba(245,166,35,0.15)] border-[rgba(245,166,35,0.3)]' : 'bg-bg3 border border-border'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="13" rx="2" stroke="#F5A623" strokeWidth="1.8"/>
                <circle cx="12" cy="12.5" r="3" stroke="#F5A623" strokeWidth="1.5"/>
                <path d="M2 9.5h2M20 9.5h2M2 15.5h2M20 15.5h2" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            
            <div className={`text-[14px] font-[700] mb-[2px] ${direction === 'GIVE_CASH' ? 'text-amber' : 'text-text'}`}>Отдаю наличные</div>
            <div className="text-[11px] text-muted font-[500]">Получаю USDT</div>
          </div>

          <div 
            onClick={() => { WebApp.HapticFeedback.selectionChanged(); setDirection('GIVE_USDT'); }}
            className={`bg-bg2 border-[1.5px] rounded-r2 p-[16px_14px] cursor-pointer transition-all relative overflow-hidden text-left ${direction === 'GIVE_USDT' ? 'border-usdt bg-usdt2' : 'border-border'}`}
          >
            {direction === 'GIVE_USDT' && <div className="absolute inset-0 rounded-r2 bg-gradient-to-br from-[rgba(38,161,123,0.08)] to-transparent"></div>}
            
            <div className={`absolute top-[12px] right-[12px] w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all ${direction === 'GIVE_USDT' ? 'bg-usdt border-usdt' : 'bg-bg3 border-[1.5px] border-border2'}`}>
              <svg viewBox="0 0 10 10" fill="none" className={`w-[10px] h-[10px] transition-opacity ${direction === 'GIVE_USDT' ? 'opacity-100' : 'opacity-0'}`}>
                <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <div className={`w-[42px] h-[42px] rounded-[12px] flex items-center justify-center mb-[10px] transition-all ${direction === 'GIVE_USDT' ? 'bg-[rgba(38,161,123,0.15)] border-[rgba(38,161,123,0.3)]' : 'bg-bg3 border border-border'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#26A17B" opacity="0.18"/>
                <path d="M8 7h8v2H8V7z" fill="#26A17B"/>
                <path d="M12 9v8" stroke="#26A17B" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8.5 12c0 0 1 1.5 3.5 1.5s3.5-1.5 3.5-1.5" stroke="#26A17B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            
            <div className={`text-[14px] font-[700] mb-[2px] ${direction === 'GIVE_USDT' ? 'text-usdt' : 'text-text'}`}>Отдаю USDT</div>
            <div className="text-[11px] text-muted font-[500]">Получаю наличные</div>
          </div>

        </div>
      </div>

      {/* Rate Banner */}
      <div className="relative z-10 m-[12px_16px_0] bg-bg2 border border-border rounded-r p-[12px_16px] flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="w-[28px] h-[28px] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="#1B3D2F" stroke="#26A17B" strokeWidth="1"/>
              <text x="14" y="18.5" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="10" fontWeight="700" fill="#26A17B">₮</text>
            </svg>
          </div>
          <div>
            <div className="text-[11px] text-muted font-[500]">Курс USDT / EUR</div>
            <div className="font-mono text-[14px] font-[600] text-text mt-[1px]">1 USDT = {(1 / currentRate).toFixed(4)} €</div>
          </div>
        </div>
        <div className="font-mono text-[11px] font-[500] text-green">▲ +0.12%</div>
      </div>

      {/* Amount Input */}
      <div className="relative z-10 text-[10px] font-[600] tracking-[0.14em] uppercase text-muted px-[20px] pt-[18px] pb-[10px]">Сумма</div>
      <div className="relative z-10 mx-[16px]">
        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[18px_18px_14px] transition-colors focus-within:border-green">
          <div className="flex items-center justify-between mb-[14px]">
            <div className="flex items-center gap-[8px] bg-bg3 border border-border2 rounded-[10px] p-[7px_12px_7px_8px] text-[13px] font-[700] tracking-[0.02em]">
              {direction === 'GIVE_CASH' ? (
                 <div className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center shrink-0 bg-[#2A2318] border border-[rgba(245,166,35,0.3)] text-amber">
                    €
                 </div>
              ) : (
                <div className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center shrink-0 bg-[#1E2A20] border border-[rgba(38,161,123,0.3)]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7.5" fill="transparent" stroke="#26A17B" strokeWidth="1"/>
                    <text x="8" y="11.5" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#26A17B">₮</text>
                  </svg>
                </div>
              )}
              <span>{direction === 'GIVE_CASH' ? 'EUR' : 'USDT'}</span>
            </div>
            <div className="text-[11px] text-muted font-[500] tracking-[0.04em]">Вы отдаёте</div>
          </div>
          
          <div className="flex items-baseline gap-[6px]">
            <div className="font-mono text-[26px] font-[600] text-muted">{direction === 'GIVE_CASH' ? '€' : '₮'}</div>
            <input 
              type="number" 
              value={giveAmount}
              onChange={(e) => setGiveAmount(e.target.value)}
              placeholder="0" 
              min="0" 
              step="50" 
              inputMode="decimal"
              className="flex-1 bg-transparent border-none outline-none font-mono text-[34px] font-[600] text-text w-full placeholder:text-dim"
            />
          </div>
          
          <div className="flex gap-[6px] mt-[12px] pt-[12px] border-t border-border">
            {[100, 250, 500, 1000, 5000].map(val => (
              <div 
                key={val} 
                onClick={() => setAmount(val)}
                className="flex-1 py-[7px] bg-bg3 border border-border rounded-[8px] text-[11px] font-[600] text-muted cursor-pointer text-center transition-all hover:border-border3 hover:text-text active:scale-95"
              >
                {val >= 1000 ? `${val/1000}K` : val}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="relative z-10 flex justify-center py-[8px]">
        <div className="w-[36px] h-[36px] rounded-full bg-bg3 border border-border2 flex items-center justify-center text-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M4 9l4 4 4-4" stroke="#4A4F5E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Get Card */}
      <div className="relative z-10 mx-[16px] bg-bg2 border border-border rounded-r2 p-[16px_18px]">
        <div className="flex items-center justify-between mb-[10px]">
          <div className="flex items-center gap-[8px] text-[13px] font-[700] text-text">
            <span>{direction === 'GIVE_CASH' ? 'USDT' : 'EUR'}</span>
          </div>
          <div className={`text-[10px] font-[600] tracking-[0.08em] uppercase p-[3px_8px] rounded-[6px] ${direction === 'GIVE_CASH' ? 'bg-[rgba(38,161,123,0.1)] text-usdt' : 'bg-[rgba(245,166,35,0.1)] text-amber'}`}>
            {direction === 'GIVE_CASH' ? 'Криптовалюта' : 'Наличные'}
          </div>
        </div>
        <div className="font-mono text-[28px] font-[600] mt-[4px]" style={{ color: getAmount ? 'var(--text)' : 'var(--muted)' }}>
          {getAmount || '—'}
        </div>
        <div className="text-[11px] text-muted mt-[8px] pt-[8px] border-t border-border font-[500] leading-relaxed">
          Комиссия {direction === 'GIVE_CASH' ? '4%' : 'доплата 2%'} · {direction === 'GIVE_CASH' ? 'Через 30 минут вы получите место выдачи наличных' : 'Через 30 минут встреча, получение криптовалюты на счет'}
        </div>
      </div>

      {/* City Selection */}
      <div className="relative z-10 text-[10px] font-[600] tracking-[0.14em] uppercase text-muted px-[20px] pt-[18px] pb-[10px]">Город встречи</div>
      <div className="relative z-10 px-[16px]">
        <div className="grid grid-cols-2 gap-[8px]">
          {cities.map(city => (
            <button
              key={city.id}
              onClick={() => { WebApp.HapticFeedback.selectionChanged(); setCity(city.id); }}
              className={`bg-bg2 border-[1.5px] rounded-r p-[13px_12px] cursor-pointer flex items-center gap-[9px] transition-all hover:border-border2 ${selectedCityId === city.id ? 'border-green bg-[rgba(0,208,132,0.05)]' : 'border-border'}`}
            >
              <div className={`w-[28px] h-[28px] rounded-[8px] bg-bg3 border flex items-center justify-center text-[14px] shrink-0 ${selectedCityId === city.id ? 'border-[rgba(0,208,132,0.3)]' : 'border-border'}`}>
                {getCityFlag(city.name)}
              </div>
              <div className={`text-[13px] font-[600] transition-colors ${selectedCityId === city.id ? 'text-text' : 'text-muted'}`}>
                {city.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Error messages inline */}
      {Number(giveAmount) > 0 && (isOverLimit || isEurInvalid) && (
        <div className="px-[16px] mt-[16px]">
          <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] rounded-r p-3 text-[12px] text-error">
            {isOverLimit ? 'Лимит обмена 500 EUR, для большей суммы создайте отдельную заявку' : 'Сумма в EUR должна быть кратна 10 (без копеек).'}
          </div>
        </div>
      )}

      {/* CTA Button */}
      <div className="relative z-10 p-[16px_16px_0] mt-4">
        <button
          onClick={handleNext}
          disabled={!isValid}
          className={`w-full p-[18px] border-none rounded-r2 font-sans text-[15px] font-[700] cursor-pointer transition-all tracking-[0.02em] flex items-center justify-center gap-[8px] relative overflow-hidden active:scale-[0.985] disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none
            ${isValid 
              ? (direction === 'GIVE_CASH' 
                ? 'bg-gradient-to-br from-[#F5A623] to-[#E08B00] text-[#0A0B0F] shadow-[0_8px_24px_rgba(245,166,35,0.25)]' 
                : 'bg-gradient-to-br from-[#26A17B] to-[#1B7A5C] text-white shadow-[0_8px_24px_rgba(38,161,123,0.25)]')
              : 'bg-bg3 text-muted'
            }`}
        >
          {direction === 'GIVE_CASH' ? 'ПЕРЕЙТИ К ОФОРМЛЕНИЮ' : 'ПОДТВЕРДИТЬ ОБМЕН'}
        </button>
      </div>

    </motion.div>
  );
}