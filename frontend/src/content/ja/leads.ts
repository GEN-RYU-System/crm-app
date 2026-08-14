export const leadsCopy = {
  eyebrow: 'Read-only leads',
  title: 'リード一覧',
  subtitle: '既存のリード管理から読取り専用で表示します。',
  inbound: 'インバウンド',
  outbound: 'アウトバウンド',
  leadTypes: { inbound: 'インバウンド', outbound: 'アウトバウンド' },
  loading: 'リードを読み込んでいます。',
  refreshing: 'リードを更新しています。',
  refresh: '更新',
  permissionsChecking: 'リードの表示権限を確認しています。',
  loadErrorPrefix: 'リードの読み込みに失敗しました:',
  retry: '再試行',
  emptyTitle: '表示できるリードはありません',
  emptyDescription: '選択中のリード種別に該当するデータはありません。',
  tableLabel: 'リード一覧',
  fields: { customerName: '顧客名', responseSpeed: '返信速度', updatedAt: 'シート更新日', csMemo: 'CSメモ' },
  columns: { customerName: '顧客名', responseSpeed: '返信速度', updatedAt: '更新日', csMemo: 'CSメモ' }
} as const;
