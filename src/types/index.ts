export type Currency = 'EUR' | 'USDT';
export type OrderStatus = 'accepted' | 'processing' | 'ready' | 'rejected';

export interface City {
  id: string;
  cityKey: string;
  isActive: boolean;
  limitEUR: number;
}

export interface Rates {
  EUR_USDT: number; // e.g., 1 EUR = 1.08 USDT
}

export type ExchangeDirection = 'GIVE_CASH' | 'GIVE_USDT';

export interface ExchangeOrder {
  id: string;
  createdAt: string;
  direction: ExchangeDirection;
  cityId: string;
  cityKey: string;
  giveAmount: string;
  giveCurrency: Currency;
  getAmount: string;
  getCurrency: Currency;
  rate: string;
  network: string | null;
  wallet: string | null;
  contact: string | null;
  userHandle: string;
  managerName: string | null;
  status: OrderStatus;
}

export interface CheckoutPrefill {
  sourceOrderId: string | null;
  contact: string;
  wallet: string;
  network: string;
}

export interface ExchangeState {
  cities: City[];
  rates: Rates;
  rateUpdatedAt: string;
  orders: ExchangeOrder[];
  usdtReserve: number;
  checkoutPrefill: CheckoutPrefill;
  isLoading: boolean;
  
  // User Selection
  selectedCityId: string | null;
  direction: ExchangeDirection;
  
  // Amounts
  giveAmount: string;
  getAmount: string;
  
  // Admin Actions
  updateCityLimit: (id: string, limit: number) => void;
  updateUsdtReserve: (amount: number) => void;
  updateRate: (rate: number) => void;
  toggleCityActive: (id: string) => void;
  setCity: (id: string) => void;
  setDirection: (dir: ExchangeDirection) => void;
  setGiveAmount: (amount: string) => void;
  setGetAmount: (amount: string) => void;
  applyOrderTemplate: (id: string) => void;
  clearCheckoutPrefill: () => void;
  calculateGetAmount: () => void;
  calculateGiveAmount: () => void;
  createOrder: (order: Omit<ExchangeOrder, 'id' | 'createdAt' | 'status'>) => ExchangeOrder;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  updateOrderManager: (id: string, managerName: string | null) => void;
  fetchInitialData: () => Promise<void>;
}
