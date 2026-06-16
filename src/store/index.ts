import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ExchangeState, City, Rates, ExchangeOrder } from '../types';
import { generateReferralCode, getCommissionMultiplier } from '../lib/customer';

type SharedServerState = Pick<
  ExchangeState,
  'cities' | 'rates' | 'rateUpdatedAt' | 'orders' | 'usdtReserve' | 'antiPhishingCode'
>;

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

const LEGACY_CITY_NAME_TO_KEY: Record<string, string> = {
  'Берлин': 'berlin',
  'Мюнхен': 'munich',
  'Гамбург': 'hamburg',
  'Франкфурт': 'frankfurt',
  'Кёльн': 'cologne',
  'Дюссельдорф': 'dusseldorf',
};

const INITIAL_CITIES: City[] = [
  { id: '1', cityKey: 'berlin', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '2', cityKey: 'munich', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '3', cityKey: 'hamburg', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '4', cityKey: 'frankfurt', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '5', cityKey: 'cologne', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '6', cityKey: 'dusseldorf', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '7', cityKey: 'stuttgart', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '8', cityKey: 'leipzig', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '9', cityKey: 'dortmund', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '10', cityKey: 'essen', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '11', cityKey: 'bremen', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '12', cityKey: 'hannover', isActive: true, limitEUR: 500, groupChatId: '' },
  { id: '13', cityKey: 'nuremberg', isActive: true, limitEUR: 500, groupChatId: '' },
];

const MOCK_RATES: Rates = {
  EUR_USDT: 1.08, // 1 EUR = 1.08 USDT
};

const DEFAULT_CHECKOUT_PREFILL = {
  sourceOrderId: null,
  contact: '',
  wallet: '',
  network: 'TRC-20',
} as const;
const DEFAULT_ANTI_PHISHING_CODE = 'BULL';
const DEFAULT_PROFILE_SETTINGS = {
  displayName: 'CryptoBull Manager',
  roleLabel: 'Manager',
  bio: 'Премиальный обмен EUR и USDT в Telegram.',
  managerContact: '@cryptobull_manager',
  referralCode: generateReferralCode('cryptobull'),
  activatedReferralCode: '',
} as const;

export const useStore = create<ExchangeState>()(
  persist(
    (set, get) => ({
      cities: INITIAL_CITIES,
      rates: MOCK_RATES,
      rateUpdatedAt: new Date().toISOString(),
      orders: [],
      usdtReserve: 2500,
      antiPhishingCode: DEFAULT_ANTI_PHISHING_CODE,
      profileSettings: DEFAULT_PROFILE_SETTINGS,
      reviews: [],
      commissionPercent: 4,
      checkoutPrefill: DEFAULT_CHECKOUT_PREFILL,
      isLoading: false,
      
      selectedCityId: null,
      direction: 'GIVE_CASH',
      
      giveAmount: '',
      getAmount: '',
      
      updateCityLimit: async (id, limit) => {
        const city = get().cities.find((item) => item.id === id);
        if (!city) {
          return;
        }

        try {
          const response = await fetch(`/api/admin/cities/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              limitEUR: limit,
              groupChatId: city.groupChatId,
              isActive: city.isActive,
            }),
          });
          const data = await readJsonResponse<{ state: SharedServerState }>(response);

          if (response.ok && data?.state) {
            set({ ...data.state });
          }
        } catch (error) {
          console.error('Failed to update city limit', error);
        }
      },

      updateCityGroupChatId: async (id, groupChatId) => {
        const city = get().cities.find((item) => item.id === id);
        if (!city) {
          return;
        }

        try {
          const response = await fetch(`/api/admin/cities/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              limitEUR: city.limitEUR,
              groupChatId,
              isActive: city.isActive,
            }),
          });
          const data = await readJsonResponse<{ state: SharedServerState }>(response);

          if (response.ok && data?.state) {
            set({ ...data.state });
          }
        } catch (error) {
          console.error('Failed to update city group chat id', error);
        }
      },

      updateUsdtReserve: async (amount) => {
        try {
          const response = await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usdtReserve: amount }),
          });
          const data = await readJsonResponse<{ state: SharedServerState }>(response);

          if (response.ok && data?.state) {
            set({ ...data.state });
          }
        } catch (error) {
          console.error('Failed to update USDT reserve', error);
        }
      },

      updateRate: async (rate) => {
        try {
          const response = await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rate }),
          });
          const data = await readJsonResponse<{ state: SharedServerState }>(response);

          if (response.ok && data?.state) {
            set({ ...data.state });
          }
        } catch (error) {
          console.error('Failed to update rate', error);
        }
      },

      updateAntiPhishingCode: async (code) => {
        try {
          const response = await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ antiPhishingCode: code.trim() || DEFAULT_ANTI_PHISHING_CODE }),
          });
          const data = await readJsonResponse<{ state: SharedServerState }>(response);

          if (response.ok && data?.state) {
            set({ ...data.state });
          }
        } catch (error) {
          console.error('Failed to update anti-phishing code', error);
        }
      },

      updateProfileSettings: (settings) =>
        set((state) => ({
          profileSettings: {
            ...state.profileSettings,
            ...settings,
            referralCode:
              settings.referralCode !== undefined
                ? settings.referralCode.trim().toUpperCase()
                : state.profileSettings.referralCode,
            activatedReferralCode:
              settings.activatedReferralCode !== undefined
                ? settings.activatedReferralCode.trim().toUpperCase()
                : state.profileSettings.activatedReferralCode,
          },
        })),

      setCommissionPercent: (value) => {
        const commissionPercent = Math.max(0, Math.min(4, Number(value) || 0));
        set({ commissionPercent });

        const { giveAmount, getAmount } = get();
        if (giveAmount) {
          get().calculateGetAmount();
        } else if (getAmount) {
          get().calculateGiveAmount();
        }
      },

      addReview: (review) =>
        set((state) => ({
          reviews: [
            {
              ...review,
              id: `RV-${Date.now().toString().slice(-8)}`,
              createdAt: new Date().toISOString(),
            },
            ...state.reviews,
          ].slice(0, 20),
        })),

      removeReview: (id) =>
        set((state) => ({
          reviews: state.reviews.filter((review) => review.id !== id),
        })),
      
      toggleCityActive: async (id) => {
        const city = get().cities.find((item) => item.id === id);
        if (!city) {
          return;
        }

        try {
          const response = await fetch(`/api/admin/cities/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              limitEUR: city.limitEUR,
              groupChatId: city.groupChatId,
              isActive: !city.isActive,
            }),
          });
          const data = await readJsonResponse<{ state: SharedServerState }>(response);

          if (response.ok && data?.state) {
            set({ ...data.state });
          }
        } catch (error) {
          console.error('Failed to toggle city state', error);
        }
      },
      
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

      applyOrderTemplate: (id) => set((state) => {
        const order = state.orders.find((item) => item.id === id);

        if (!order) {
          return state;
        }

        return {
          selectedCityId: order.cityId,
          direction: order.direction,
          giveAmount: order.giveAmount,
          getAmount: order.getAmount,
          checkoutPrefill: {
            sourceOrderId: order.id,
            contact: order.contact ?? '',
            wallet: order.wallet ?? '',
            network: order.network ?? DEFAULT_CHECKOUT_PREFILL.network,
          },
        };
      }),

      clearCheckoutPrefill: () => set({ checkoutPrefill: DEFAULT_CHECKOUT_PREFILL }),

      createOrder: (order) => {
        const createdOrder: ExchangeOrder = {
          ...order,
          id: `CB-${Date.now().toString().slice(-8)}`,
          createdAt: new Date().toISOString(),
          status: 'accepted',
        };

        set((state) => ({
          usdtReserve:
            order.direction === 'GIVE_CASH'
              ? Math.max(0, state.usdtReserve - Number(order.getAmount))
              : state.usdtReserve,
          cities:
            order.direction === 'GIVE_USDT'
              ? state.cities.map((city) =>
                  city.id === order.cityId
                    ? { ...city, limitEUR: Math.max(0, city.limitEUR - Number(order.getAmount)) }
                    : city,
                )
              : state.cities,
          orders: [createdOrder, ...state.orders],
        }));

        return createdOrder;
      },

      updateOrderStatus: async (id, status) => {
        try {
          const response = await fetch(`/api/admin/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });
          const data = await readJsonResponse<{ state: SharedServerState }>(response);

          if (response.ok && data?.state) {
            set({ ...data.state });
          }
        } catch (error) {
          console.error('Failed to update order status', error);
        }
      },

      updateOrderManager: async (id, managerName) => {
        try {
          const response = await fetch(`/api/admin/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              managerName: managerName && managerName.trim().length > 0 ? managerName.trim() : null,
            }),
          });
          const data = await readJsonResponse<{ state: SharedServerState }>(response);

          if (response.ok && data?.state) {
            set({ ...data.state });
          }
        } catch (error) {
          console.error('Failed to update order manager', error);
        }
      },
      
      calculateGetAmount: () => {
        const { giveAmount, direction, rates, commissionPercent } = get();
        if (!giveAmount || isNaN(Number(giveAmount))) {
          set({ getAmount: '' });
          return;
        }
        
        const amount = Number(giveAmount);
        let result = 0;
        
        // COMMISSION LOGIC
        // Client gives EUR (GIVE_CASH) -> Service takes 4% commission (Client gets less USDT)
        // Client gives USDT (GIVE_USDT) -> Service takes 4% commission (Client gets less EUR)
        
        const multiplier = getCommissionMultiplier(commissionPercent);

        if (direction === 'GIVE_CASH') {
          // Buy USDT with EUR. Client gets less USDT because of 4% fee
          result = (amount * rates.EUR_USDT) * multiplier;
          set({ getAmount: result > 0 ? result.toFixed(2) : '' });
        } else {
          // Sell USDT for EUR. Client gets less EUR because of 4% fee
          result = (amount / rates.EUR_USDT) * multiplier;
          // Round EUR to nearest 10
          result = Math.floor(result / 10) * 10;
          set({ getAmount: result > 0 ? result.toString() : '' });
        }
      },
      
      calculateGiveAmount: () => {
        const { getAmount, direction, rates, commissionPercent } = get();
        if (!getAmount || isNaN(Number(getAmount))) {
          set({ giveAmount: '' });
          return;
        }
        
        const amount = Number(getAmount);
        let result = 0;
        
        const multiplier = getCommissionMultiplier(commissionPercent);

        if (direction === 'GIVE_CASH') {
          result = amount / (rates.EUR_USDT * multiplier);
          set({ giveAmount: result > 0 ? result.toFixed(2) : '' });
        } else {
          result = (amount * rates.EUR_USDT) / multiplier;
          // When giving USDT to get exact EUR, round the required USDT to 2 decimals
          set({ giveAmount: result > 0 ? result.toFixed(2) : '' });
        }
      },
      
      fetchInitialData: async () => {
        set({ isLoading: true });

        try {
          const response = await fetch('/api/bootstrap');
          const data = await readJsonResponse<SharedServerState>(response);

          if (response.ok && data) {
            set({
              ...data,
              isLoading: false,
            });
            return;
          }
        } catch (error) {
          console.error('Failed to fetch initial shared data', error);
        }

        set({ isLoading: false });
      }
    }),
    {
      name: 'cryptobull-storage',
      version: 9,
      // Persist core admin and order data, reset user inputs on reload
      partialize: (state) => ({
        cities: state.cities,
        rates: state.rates,
        rateUpdatedAt: state.rateUpdatedAt,
        orders: state.orders,
        usdtReserve: state.usdtReserve,
        antiPhishingCode: state.antiPhishingCode,
        profileSettings: state.profileSettings,
        reviews: state.reviews,
      }),
      migrate: (persistedState) => {
        const state = persistedState as ExchangeState & {
          cities?: Array<City & { name?: string }>;
          orders?: ExchangeOrder[];
          usdtReserve?: number;
          rateUpdatedAt?: string;
          antiPhishingCode?: string;
          profileSettings?: Partial<ExchangeState['profileSettings']>;
          reviews?: ExchangeState['reviews'];
        };

        if (!state?.cities) {
          return persistedState as ExchangeState;
        }

        return {
          ...state,
          orders: (state.orders ?? []).map((order) => ({
            ...order,
            managerName: order.managerName ?? null,
            antiPhishingCode: order.antiPhishingCode ?? state.antiPhishingCode ?? DEFAULT_ANTI_PHISHING_CODE,
            commissionPercent: order.commissionPercent ?? 4,
            discountPercent: order.discountPercent ?? 0,
            referralCodeUsed: order.referralCodeUsed ?? null,
          })),
          usdtReserve: state.usdtReserve ?? 2500,
          rateUpdatedAt: state.rateUpdatedAt ?? new Date().toISOString(),
          antiPhishingCode: state.antiPhishingCode ?? DEFAULT_ANTI_PHISHING_CODE,
          profileSettings: {
            ...DEFAULT_PROFILE_SETTINGS,
            ...(state.profileSettings ?? {}),
          },
          reviews: state.reviews ?? [],
          commissionPercent: 4,
          cities: state.cities.map((city) => {
            const legacyCity = city as City & { name?: string };

            return {
              ...city,
              cityKey: legacyCity.cityKey ?? LEGACY_CITY_NAME_TO_KEY[legacyCity.name ?? ''] ?? 'berlin',
              groupChatId: legacyCity.groupChatId ?? '',
            };
          }),
        } satisfies ExchangeState;
      },
    }
  )
);
