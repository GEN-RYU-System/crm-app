import { getCoreOrders, getCoreCurrencies, getInventoryProductOptions, getInventoryConditions, createCoreOrder } from '../../gas/client';
import type { OrderRepository } from './contracts';

export const orderGasRepository: OrderRepository = {
  listOrders: (forceRefresh) => getCoreOrders(forceRefresh),
  listCurrencySymbols: async () => {
    const currencies = await getCoreCurrencies();
    const map: Record<string, string> = {};
    for (const c of currencies) {
      if (c.symbol) map[c.currencyCode] = c.symbol;
    }
    return map;
  },
  listCurrencies: async () => {
    const currencies = await getCoreCurrencies();
    return currencies.map((c) => ({ currencyCode: c.currencyCode, symbol: c.symbol, name: c.name }));
  },
  listInventoryProducts: () => getInventoryProductOptions(),
  getInventoryConditions: (productId) => getInventoryConditions(productId),
  createOrder: (payload) => createCoreOrder(payload),
};
