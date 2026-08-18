import { getSharedInventory } from '../../gas/client';
import type { InventoryRepository } from './contracts';

export const inventoryGasRepository: InventoryRepository = {
  listSharedInventory: getSharedInventory
};
