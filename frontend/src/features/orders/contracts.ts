import type { OrderRecord } from '../../gas/client';

export type { OrderRecord };

export type OrderLineInput = {
  productId: string;
  productName: string;
  category: string;
  status: string;
  quantity: string;
  unitPrice: string;
};

export type OrderCreatePayload = {
  customerId: string;
  shippingDestinationId: string;
  paymentDestinationId: string;
  currency: string;
  paymentMethod: string;
  paymentDueAt: string;
  orderDate: string;
  exchangeRate: string;
  shippingFee: string;
  duty: string;
  otherFee: string;
  discount: string;
  lines: OrderLineInput[];
};

export type OrderCreateResult = {
  success: boolean;
  orderId: string;
};

export type InventoryProductOption = {
  productId: string;
  productName: string;
  category: string;
  unitPrice: string;
  currency: string;
};

export type OrderRepository = {
  listOrders: (forceRefresh?: boolean) => Promise<readonly OrderRecord[]>;
  listCurrencySymbols: () => Promise<Record<string, string>>;
  createOrder: (payload: OrderCreatePayload) => Promise<OrderCreateResult>;
  listInventoryProducts: () => Promise<readonly InventoryProductOption[]>;
};
