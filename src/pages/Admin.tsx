import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import WebApp from '@twa-dev/sdk';

export default function Admin() {
  const navigate = useNavigate();
  const { cities, updateCityLimit, toggleCityActive } = useStore();
  
  const user = WebApp.initDataUnsafe?.user;
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map(id => id.trim());
  const isAdmin = user?.id ? adminIds.includes(user.id.toString()) : false;

  // Protect route
  if (!isAdmin && process.env.NODE_ENV === 'production') {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <h1 className="text-xl text-error font-bold">Доступ запрещен</h1>
      </div>
    );
  }

  const [editLimits, setEditLimits] = useState<Record<string, string>>(
    cities.reduce((acc, city) => ({ ...acc, [city.id]: city.limitEUR.toString() }), {})
  );

  const handleBack = () => {
    WebApp.HapticFeedback.impactOccurred('light');
    navigate('/');
  };

  const handleSave = (id: string) => {
    WebApp.HapticFeedback.impactOccurred('medium');
    const newLimit = Number(editLimits[id]) || 0;
    updateCityLimit(id, newLimit);
  };

  const handleToggle = (id: string) => {
    WebApp.HapticFeedback.selectionChanged();
    toggleCityActive(id);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-[16px] pt-[20px] pb-[32px]"
    >
      <div className="flex items-center gap-[12px] mb-[24px]">
        <button onClick={handleBack} className="w-[36px] h-[36px] rounded-full bg-bg3 border border-border2 flex items-center justify-center text-muted hover:text-text transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 13l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="text-[20px] font-[700] text-text">Панель администратора</h1>
      </div>

      <div className="space-y-[16px] flex-1">
        <div className="bg-bg2 border-[1.5px] border-border2 rounded-r2 p-[20px] space-y-[16px]">
          <div className="flex justify-between items-center mb-[8px]">
            <h2 className="text-[14px] font-[700] text-text">Управление кассами</h2>
            <span className="text-[10px] bg-[rgba(0,208,132,0.1)] text-green px-[8px] py-[4px] rounded-[6px] uppercase tracking-[0.06em] font-[600]">EUR Only</span>
          </div>

          <div className="space-y-[12px]">
            {cities.map((city) => (
              <div key={city.id} className={`p-[16px] rounded-[16px] border-[1.5px] transition-all bg-bg3 ${city.isActive ? 'border-border2' : 'border-error/30 opacity-60'}`}>
                
                <div className="flex justify-between items-center mb-[12px]">
                  <div className="flex items-center gap-[8px]">
                    <span className="font-[700] text-[15px] text-text">{city.name}</span>
                  </div>
                  
                  <button 
                    onClick={() => handleToggle(city.id)}
                    className={`text-[10px] font-[600] uppercase tracking-[0.06em] px-[8px] py-[4px] rounded-[6px] border transition-colors ${city.isActive ? 'bg-[rgba(0,208,132,0.1)] text-green border-green/30' : 'bg-[rgba(248,113,113,0.1)] text-error border-error/30'}`}
                  >
                    {city.isActive ? 'Активен' : 'Отключен'}
                  </button>
                </div>

                <div className="flex items-center gap-[8px]">
                  <div className="flex-1 relative">
                    <span className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted font-mono">€</span>
                    <input 
                      type="number"
                      value={editLimits[city.id]}
                      onChange={(e) => setEditLimits({ ...editLimits, [city.id]: e.target.value })}
                      className="w-full bg-bg2 border border-border2 rounded-[8px] py-[10px] pl-[28px] pr-[12px] text-[14px] font-mono text-text outline-none focus:border-green transition-colors"
                    />
                  </div>
                  <button 
                    onClick={() => handleSave(city.id)}
                    className="bg-bg2 border border-border2 hover:border-green hover:text-green text-muted px-[16px] py-[10px] rounded-[8px] text-[12px] font-[600] transition-colors"
                  >
                    Сохранить
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      </div>
    </motion.div>
  );
}