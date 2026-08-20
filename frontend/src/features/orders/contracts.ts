import type { OrderRecord } from '../../gas/client';

export type { OrderRecord };

export type OrderCurrencyRecord = {
  currencyCode: string;
  symbol: string;
  name: string;
};

export type OrderInventoryProductOption = {
  productId: string;
  productName: string;
};

export type OrderInventoryConditionOption = {
  condition: string;
  quantity: number;
  unitPrice: number;
  unitWeight: number;
};

export type OrderLinePayload = {
  lineNo: number;
  productId: string;
  productName: string;
  condition: string;
  quantity: number | null;
  unitPrice: number | null;
};

export type OrderCreatePayload = {
  customerId: string;
  shippingDestinationId: string;
  paymentDestinationId: string;
  sourceLeadId: string;
  currency: string;
  shippingFee: number | null;
  duty: number | null;
  otherFee: number | null;
  discount: number | null;
  paymentMethod: string;
  paymentTerms: string;
  paymentDueAt: string;
  note: string;
  lines: OrderLinePayload[];
};

export type OrderCreateResult = {
  orderId: string;
};

export type OrderRepository = {
  listOrders: (forceRefresh?: boolean) => Promise<readonly OrderRecord[]>;
  listCurrencySymbols: () => Promise<Record<string, string>>;
  listCurrencies: () => Promise<readonly OrderCurrencyRecord[]>;
  listInventoryProducts: () => Promise<readonly OrderInventoryProductOption[]>;
  getInventoryConditions: (productId: string) => Promise<readonly OrderInventoryConditionOption[]>;
  createOrder: (payload: OrderCreatePayload) => Promise<OrderCreateResult>;
};
