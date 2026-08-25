import { createCoreOrder, getCoreOrders, getInventoryProductOptions, updateCoreOrder } from '../../gas/client';
import type { OrderRepository, OrderCreatePayload, OrderCreateResult, OrderUpdatePayload, OrderUpdateResult, InventoryProductOption } from './contracts';

export const orderGasRepository: OrderRepository = {
  listOrders: (forceRefresh) => getCoreOrders(forceRefresh),
  createOrder: (payload: OrderCreatePayload): Promise<OrderCreateResult> =>
    createCoreOrder(payload),
  updateOrder: (orderId: string, payload: OrderUpdatePayload): Promise<OrderUpdateResult> =>
    updateCoreOrder(orderId, payload),
  listInventoryProducts: async (): Promise<readonly InventoryProductOption[]> => {
    const products = await getInventoryProductOptions();
    return products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      englishTitle: p.englishTitle,
      category: p.category,
    }));
  },
};
