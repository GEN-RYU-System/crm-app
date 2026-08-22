export type SharedInventoryDto = {
  series: string;
  quantity: number;
  unitPrice: number;
  condition: string;
  /** Unit weight in grams (Condition=Case uses Case weight; otherwise Box weight). 0 means not set. */
  unitWeight: number;
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
