export const inventoryCopy = {
  eyebrow: 'Shared inventory',
  title: '共用在庫一覧',
  subtitle: '在庫解析システムから取り込んだ共用在庫を閲覧できます。',
  searchLabel: '在庫を検索',
  searchPlaceholder: '表示中の項目から検索',
  loading: '共用在庫を読み込んでいます。',
  loadErrorPrefix: '共用在庫の読み込みに失敗しました:',
  retry: '再試行',
  emptyTitle: '表示できる在庫はありません',
  emptyDescription: '現在の条件に該当する在庫はありません。',
  searchEmptyTitle: '検索条件に一致する在庫はありません',
  searchEmptyDescription: '検索語を変更またはクリアしてください。',
  tableLabel: '共用在庫一覧',
  sortAscending: '昇順',
  sortDescending: '降順',
  sortNone: '未選択',
  sortLabel: (label: string, direction: string) => `${label}を${direction}で並べ替え`,
  columns: {
    series:    'Series',
    quantity:  'Quantity',
    unitPrice: 'Unit Price',
    condition: 'Condition',
    status:    'Status',
    supplier:  '提供者'
  }
} as const;
