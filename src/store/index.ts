import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ExchangeState, City, Rates, ExchangeOrder, OrderStatus } from '../types';

const LEGACY_CITY_NAME_TO_KEY: Record<string, string> = {
  'Берлин': 'berlin',
  'Мюнхен': 'munich',
  'Гамбург': 'hamburg',
  'Франкфурт': 'frankfurt',
  'Кёльн': 'cologne',
  'Дюссельдорф': 'dusseldorf',
};

const INITIAL_CITIES: City[] = [
  { id: '1', cityKey: 'berlin', isActive: true, limitEUR: 500 },
  { id: '2', cityKey: 'munich', isActive: true, limitEUR: 500 },
  { id: '3', cityKey: 'hamburg', isActive: true, limitEUR: 500 },
  { id: '4', cityKey: 'frankfurt', isActive: true, limitEUR: 500 },
  { id: '5', cityKey: 'cologne', isActive: true, limitEUR: 500 },
  { id: '6', cityKey: 'dusseldorf', isActive: true, limitEUR: 500 },
  { id: '7', cityKey: 'stuttgart', isActive: true, limitEUR: 500 },
  { id: '8', cityKey: 'leipzig', isActive: true, limitEUR: 500 },
  { id: '9', cityKey: 'dortmund', isActive: true, limitEUR: 500 },
  { id: '10', cityKey: 'essen', isActive: true, limitEUR: 500 },
  { id: '11', cityKey: 'bremen', isActive: true, limitEUR: 500 },
  { id: '12', cityKey: 'hannover', isActive: true, limitEUR: 500 },
  { id: '13', cityKey: 'nuremberg', isActive: true, limitEUR: 500 },
];

const MOCK_RATES: Rates = {
  EUR_USDT: 1.08, // 1 EUR = 1.08 USDT
};

const ACTIVE_ORDER_STATUSES: Set<OrderStatus> = new Set(['accepted', 'processing']);
const DEFAULT_CHECKOUT_PREFILL = {
  sourceOrderId: null,
  contact: '',
  wallet: '',
  network: 'TRC-20',
} as const;
const DEFAULT_ANTI_PHISHING_CODE = 'BULL';

export const useStore = create<ExchangeState>()(
  persist(
    (set, get) => ({
      cities: INITIAL_CITIES,
      rates: MOCK_RATES,
      rateUpdatedAt: new Date().toISOString(),
      orders: [],
      usdtReserve: 2500,
      antiPhishingCode: DEFAULT_ANTI_PHISHING_CODE,
      checkoutPrefill: DEFAULT_CHECKOUT_PREFILL,
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

      updateUsdtReserve: (amount) => set({ usdtReserve: amount }),

      updateRate: (rate) => set({
        rates: { EUR_USDT: rate },
        rateUpdatedAt: new Date().toISOString(),
      }),

      updateAntiPhishingCode: (code) =>
        set({ antiPhishingCode: code.trim() || DEFAULT_ANTI_PHISHING_CODE }),
      
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

      updateOrderStatus: (id, status) => set((state) => {
        const existingOrder = state.orders.find((order) => order.id === id);

        if (!existingOrder || existingOrder.status === status) {
          return state;
        }

        const wasActive = ACTIVE_ORDER_STATUSES.has(existingOrder.status);
        const isActive = ACTIVE_ORDER_STATUSES.has(status);
        const shouldReleaseReserve = wasActive && !isActive && status === 'rejected';
        const shouldReserveAgain = !wasActive && isActive && existingOrder.status === 'rejected';

        return {
          usdtReserve:
            existingOrder.direction === 'GIVE_CASH'
              ? shouldReleaseReserve
                ? state.usdtReserve + Number(existingOrder.getAmount)
                : shouldReserveAgain
                  ? Math.max(0, state.usdtReserve - Number(existingOrder.getAmount))
                  : state.usdtReserve
              : state.usdtReserve,
          cities:
            existingOrder.direction === 'GIVE_USDT'
              ? state.cities.map((city) => {
                  if (city.id !== existingOrder.cityId) {
                    return city;
                  }

                  if (shouldReleaseReserve) {
                    return { ...city, limitEUR: city.limitEUR + Number(existingOrder.getAmount) };
                  }

                  if (shouldReserveAgain) {
                    return { ...city, limitEUR: Math.max(0, city.limitEUR - Number(existingOrder.getAmount)) };
                  }

                  return city;
                })
              : state.cities,
          orders: state.orders.map((order) =>
            order.id === id ? { ...order, status } : order
          ),
        };
      }),

      updateOrderManager: (id, managerName) => set((state) => ({
        orders: state.orders.map((order) =>
          order.id === id
            ? {
                ...order,
                managerName: managerName && managerName.trim().length > 0 ? managerName.trim() : null,
              }
            : order,
        ),
      })),
      
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
      version: 6,
      // Persist core admin and order data, reset user inputs on reload
      partialize: (state) => ({
        cities: state.cities,
        rates: state.rates,
        rateUpdatedAt: state.rateUpdatedAt,
        orders: state.orders,
        usdtReserve: state.usdtReserve,
        antiPhishingCode: state.antiPhishingCode,
      }),
      migrate: (persistedState) => {
        const state = persistedState as ExchangeState & {
          cities?: Array<City & { name?: string }>;
          orders?: ExchangeOrder[];
          usdtReserve?: number;
          rateUpdatedAt?: string;
          antiPhishingCode?: string;
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
          })),
          usdtReserve: state.usdtReserve ?? 2500,
          rateUpdatedAt: state.rateUpdatedAt ?? new Date().toISOString(),
          antiPhishingCode: state.antiPhishingCode ?? DEFAULT_ANTI_PHISHING_CODE,
          cities: state.cities.map((city) => {
            const legacyCity = city as City & { name?: string };

            return {
              ...city,
              cityKey: legacyCity.cityKey ?? LEGACY_CITY_NAME_TO_KEY[legacyCity.name ?? ''] ?? 'berlin',
            };
          }),
        } satisfies ExchangeState;
      },
    }
  )
);
