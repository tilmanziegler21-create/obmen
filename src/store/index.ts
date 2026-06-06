import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ExchangeState, City, Rates } from '../types';

const INITIAL_CITIES: City[] = [
  { id: '1', name: 'Берлин', isActive: true, limitEUR: 500 },
  { id: '2', name: 'Мюнхен', isActive: true, limitEUR: 500 },
  { id: '3', name: 'Гамбург', isActive: true, limitEUR: 500 },
  { id: '4', name: 'Франкфурт', isActive: true, limitEUR: 500 },
  { id: '5', name: 'Кёльн', isActive: true, limitEUR: 500 },
  { id: '6', name: 'Дюссельдорф', isActive: true, limitEUR: 500 },
];

const MOCK_RATES: Rates = {
  EUR_USDT: 1.08, // 1 EUR = 1.08 USDT
};

export const useStore = create<ExchangeState>()(
  persist(
    (set, get) => ({
      cities: INITIAL_CITIES,
      rates: MOCK_RATES,
      isLoading: false,
      
      selectedCityId: null,
      direction: 'GIVE_CASH',
      
      giveAmount: '',
      getAmount: '',
      
      updateCityLimit: (id, limit) => set((state) => ({
        cities: state.cities.map(city => 
          city.id === id ? { ...city, limitEUR: limit } : city
        )
      })),
      
      toggleCityActive: (id) => set((state) => ({
        cities: state.cities.map(city => 
          city.id === id ? { ...city, isActive: !city.isActive } : city
        )
      })),
      
      setCity: (id) => set({ selectedCityId: id }),
      setDirection: (dir) => set({ direction: dir, giveAmount: '', getAmount: '' }),
      
      setGiveAmount: (amount) => {
        set({ giveAmount: amount });
        get().calculateGetAmount();
      },
      
      setGetAmount: (amount) => {
        set({ getAmount: amount });
        get().calculateGiveAmount();
      },
      
      calculateGetAmount: () => {
        const { giveAmount, direction, rates } = get();
        if (!giveAmount || isNaN(Number(giveAmount))) {
          set({ getAmount: '' });
          return;
        }
        
        const amount = Number(giveAmount);
        let result = 0;
        
        // COMMISSION LOGIC
        // Client gives EUR (GIVE_CASH) -> Service takes 4% commission (Client gets less USDT)
        // Client gives USDT (GIVE_USDT) -> Service takes 4% commission (Client gets less EUR)
        
        if (direction === 'GIVE_CASH') {
          // Buy USDT with EUR. Client gets less USDT because of 4% fee
          result = (amount * rates.EUR_USDT) * 0.96;
          set({ getAmount: result > 0 ? result.toFixed(2) : '' });
        } else {
          // Sell USDT for EUR. Client gets less EUR because of 4% fee
          result = (amount / rates.EUR_USDT) * 0.96;
          // Round EUR to nearest 10
          result = Math.floor(result / 10) * 10;
          set({ getAmount: result > 0 ? result.toString() : '' });
        }
      },
      
      calculateGiveAmount: () => {
        const { getAmount, direction, rates } = get();
        if (!getAmount || isNaN(Number(getAmount))) {
          set({ giveAmount: '' });
          return;
        }
        
        const amount = Number(getAmount);
        let result = 0;
        
        if (direction === 'GIVE_CASH') {
          result = amount / (rates.EUR_USDT * 0.96);
          set({ giveAmount: result > 0 ? result.toFixed(2) : '' });
        } else {
          result = (amount * rates.EUR_USDT) / 0.96;
          // When giving USDT to get exact EUR, round the required USDT to 2 decimals
          set({ giveAmount: result > 0 ? result.toFixed(2) : '' });
        }
      },
      
      fetchInitialData: async () => {
        // Data is now loaded instantly from localStorage via persist middleware
        // This function is kept for API compatibility, but we just make sure isLoading is false
        set({ isLoading: false });
      }
    }),
    {
      name: 'cryptobull-storage',
      // Only persist cities and rates, reset user inputs on reload
      partialize: (state) => ({ cities: state.cities, rates: state.rates }),
    }
  )
);