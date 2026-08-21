export type SharedInventoryDto = {
  series: string;
  quantity: number;
  unitPrice: number;
  condition: string;
  status: string;
  noteJa: string;
  noteEn: string;
  supplier: string;
  productId: string;
  rawName: string;
  exclusionReason: string;
  ipId: string;
  ipName: string;
  releaseDate: string;
  japaneseTitle: string;
  englishTitle: string;
  mark: string;
};

export type InventoryRepository = {
  listSharedInventory: (forceRefresh?: boolean) => Promise<readonly SharedInventoryDto[]>;
};
