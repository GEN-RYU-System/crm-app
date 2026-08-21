import type { BadgeVariant } from '../../components/ui/Badge/Badge';

// 支払いステータスのバッジ色（/orders の PAYMENT_STATUS_BADGE_VARIANT と共通）
export const SALES_ORDER_PAYMENT_STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  '入金済み': 'success',
  '未入金':   'warning',
  '一部入金': 'warning',
  '遅延':     'danger',
  'キャンセル': 'neutral',
  '保留':     'info',
} as const;

export const salesOrdersCopy = {
  eyebrow: 'Sales order management',
  title: '受注管理',
  subtitle: '仕入・発送を一元管理します。',
  loading: '受注データを読み込んでいます。',
  refreshing: '受注データを更新しています。',
  refresh: '更新',
  retry: '再試行',
  loadErrorPrefix: '受注データの読み込みに失敗しました:',
  searchLabel: '受注を検索',
  searchPlaceholder: '検索',
  emptyTitle: '受注はありません',
  emptyDescription: '受注データが見つかりませんでした。',
  searchEmptyTitle: '検索条件に一致する受注はありません',
  searchEmptyDescription: '検索語を変更またはクリアしてください。',
  tableLabel: '受注一覧',
  permissionsChecking: '受注の表示権限を確認しています。',
  sortAscending: '昇順',
  sortDescending: '降順',
  sortNone: '未選択',
  sortLabel: (label: string, direction: string) => `${label}を${direction}で並べ替え`,
  allTab: 'すべて',
  unknownStatus: '不明',
  statusOptionsLoading: 'タブを読み込んでいます。',
  columns: {
    orderId:         '受注番号',
    customerName:    '名前',
    shippingAddress: '発送先',
    currency:        '通貨',
    invoiceTotal:    '金額',
    status:          'ステータス',
    invoiceIssuedAt: '作成日',
  },
} as const;
