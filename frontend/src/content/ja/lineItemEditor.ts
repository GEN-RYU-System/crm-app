export const lineItemEditorCopy = {
  product:             '商品名',
  productPlaceholder:  '商品名で検索',
  productNoResults:    '商品が見つかりません',
  condition:           '状態',
  conditionPlaceholder: '商品を先に選択',
  quantity:            '数量',
  unitPrice:           '単価',
  amount:              '金額',
  weight:              '重量(g)',
  remove:              '削除',
  conditionOptionLabel: (condition: string, quantity: number): string =>
    `${condition}（在庫: ${quantity}）`,
} as const;
