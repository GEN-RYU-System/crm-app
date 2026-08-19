import type { OrderRecord } from '../../gas/client';

export type { OrderRecord };

export type OrderRepository = {
  listOrders: (forceRefresh?: boolean) => Promise<readonly OrderRecord[]>;
  listCurrencySymbols: () => Promise<Record<string, string>>;
};
