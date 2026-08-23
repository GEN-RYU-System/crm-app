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
  shippingFee: string;
  duty: string;
  otherFee: string;
  discount: string;
  shippingNote: string;
  internalNote: string;
  lines: OrderLineInput[];
};

export type OrderCreateResult = {
  success: boolean;
  orderId: string;
};

export type OrderUpdatePayload = {
  // Amount fields (editable only before invoice is issued)
  shippingFee?: string;
  duty?: string;
  otherFee?: string;
  discount?: string;
  lines?: OrderLineInput[];
  // Always editable fields
  paymentConfirmedAt?: string;
  shippedAt?: string;
  trackingNumber?: string;
  shippingMethod?: string;
  note?: string;
  shippingNote?: string;
  transactionNote?: string;
  internalNote?: string;
  cancellationReason?: string;
  cancellationNote?: string;
};

export type OrderUpdateResult = {
  success: boolean;
  orderId: string;
};

export type InventoryProductOption = {
  productId: string;
  productName: string;
  category: string;
};

export type OrderRepository = {
  listOrders: (forceRefresh?: boolean) => Promise<readonly OrderRecord[]>;
  listCurrencySymbols: () => Promise<Record<string, string>>;
  createOrder: (payload: OrderCreatePayload) => Promise<OrderCreateResult>;
  updateOrder: (orderId: string, payload: OrderUpdatePayload) => Promise<OrderUpdateResult>;
  listInventoryProducts: () => Promise<readonly InventoryProductOption[]>;
};
