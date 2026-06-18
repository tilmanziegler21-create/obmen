export type CashCurrency = 'EUR' | 'UAH';
export type Currency = CashCurrency | 'USDT';
export type ExchangeAsset = 'EUR_CASH' | 'UAH_CARD' | 'USDT';
export type OrderStatus = 'accepted' | 'processing' | 'ready' | 'rejected';
export type LoyaltyTier = 'standard' | 'gold' | 'vip' | 'provider';

export interface City {
  id: string;
  cityKey: string;
  isActive: boolean;
  limitEUR: number;
  groupChatId: string;
}

export interface Rates {
  EUR_USDT: number;
  UAH_USDT: number;
  EUR_UAH: number;
}

export type ExchangeDirection = 'GIVE_CASH' | 'GIVE_USDT';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export interface ExchangeOrder {
  id: string;
  createdAt: string;
  direction: ExchangeDirection;
  giveAsset: ExchangeAsset;
  cityId: string;
  cityKey: string;
  giveAmount: string;
  giveCurrency: Currency;
  getAsset: ExchangeAsset;
  getAmount: string;
  getCurrency: Currency;
  rate: string;
  network: string | null;
  wallet: string | null;
  contact: string | null;
  cardNumber: string | null;
  userHandle: string;
  userId?: string | null;
  managerName: string | null;
  antiPhishingCode: string | null;
  commissionPercent: number;
  discountPercent: number;
  referralCodeUsed: string | null;
  telegramChatId?: string | null;
  telegramMessageId?: number | null;
  status: OrderStatus;
}

export interface CheckoutPrefill {
  sourceOrderId: string | null;
  contact: string;
  wallet: string;
  network: string;
  cardNumber: string;
}

export interface ProfileSettings {
  displayName: string;
  roleLabel: string;
  bio: string;
  managerContact: string;
  referralCode: string;
  activatedReferralCode: string;
}

export interface Review {
  id: string;
  userHandle: string;
  cityKey: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface ExchangeState {
  cities: City[];
  rates: Rates;
  rateUpdatedAt: string;
  orders: ExchangeOrder[];
  usdtReserve: number;
  antiPhishingCode: string;
  profileSettings: ProfileSettings;
  reviews: Review[];
  commissionPercent: number;
  checkoutPrefill: CheckoutPrefill;
  isLoading: boolean;
  
  // User Selection
  selectedCityId: string | null;
  direction: ExchangeDirection;
  selectedGiveAsset: ExchangeAsset;
  selectedGetAsset: ExchangeAsset;
  
  // Amounts
  giveAmount: string;
  getAmount: string;
  
  // Admin Actions
  saveCityConfig: (id: string, config: Partial<Pick<City, 'limitEUR' | 'groupChatId' | 'isActive'>>) => Promise<SaveResult>;
  updateCityLimit: (id: string, limit: number) => Promise<void>;
  updateCityGroupChatId: (id: string, groupChatId: string) => Promise<void>;
  updateUsdtReserve: (amount: number) => Promise<void>;
  updateRate: (rate: number) => Promise<void>;
  updateAntiPhishingCode: (code: string) => Promise<void>;
  updateProfileSettings: (settings: Partial<ProfileSettings>) => void;
  setCommissionPercent: (value: number) => void;
  addReview: (review: Omit<Review, 'id' | 'createdAt'>) => void;
  removeReview: (id: string) => void;
  toggleCityActive: (id: string) => Promise<void>;
  setCity: (id: string) => void;
  setDirection: (dir: ExchangeDirection) => void;
  setGiveAsset: (asset: ExchangeAsset) => void;
  setGetAsset: (asset: ExchangeAsset) => void;
  setGiveAmount: (amount: string) => void;
  setGetAmount: (amount: string) => void;
  applyOrderTemplate: (id: string) => void;
  clearCheckoutPrefill: () => void;
  calculateGetAmount: () => void;
  calculateGiveAmount: () => void;
  createOrder: (order: Omit<ExchangeOrder, 'id' | 'createdAt' | 'status'>) => ExchangeOrder;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  updateOrderManager: (id: string, managerName: string | null) => Promise<void>;
  fetchInitialData: () => Promise<void>;
}
