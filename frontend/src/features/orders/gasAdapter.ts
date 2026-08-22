import { createCoreOrder, getCoreOrders, getCoreCurrencies, getInventoryProductOptions } from '../../gas/client';
import type { OrderRepository, OrderCreatePayload, OrderCreateResult, InventoryProductOption } from './contracts';

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
  createOrder: (payload: OrderCreatePayload): Promise<OrderCreateResult> =>
    createCoreOrder(payload),
  listInventoryProducts: async (): Promise<readonly InventoryProductOption[]> => {
    const products = await getInventoryProductOptions();
    return products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      category: p.category,
    }));
  },
};
