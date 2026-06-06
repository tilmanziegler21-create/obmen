export type Currency = 'EUR' | 'USDT';

export interface City {
  id: string;
  name: string;
  isActive: boolean;
  limitEUR: number;
}

export interface Rates {
  EUR_USDT: number; // e.g., 1 EUR = 1.08 USDT
}

export type ExchangeDirection = 'GIVE_CASH' | 'GIVE_USDT';

export interface ExchangeState {
  cities: City[];
  rates: Rates;
  isLoading: boolean;
  
  // User Selection
  selectedCityId: string | null;
  direction: ExchangeDirection;
  
  // Amounts
  giveAmount: string;
  getAmount: string;
  
  // Admin Actions
  updateCityLimit: (id: string, limit: number) => void;
  toggleCityActive: (id: string) => void;
  setCity: (id: string) => void;
  setDirection: (dir: ExchangeDirection) => void;
  setGiveAmount: (amount: string) => void;
  setGetAmount: (amount: string) => void;
  calculateGetAmount: () => void;
  calculateGiveAmount: () => void;
  fetchInitialData: () => Promise<void>;
}