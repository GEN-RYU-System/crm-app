export const DRIVE_FOLDER_KEYS = {
  quote: '帳票_見積書保存先フォルダID',
  invoice: '帳票_請求書保存先フォルダID',
  shipping: '帳票_発送ラベル保存先フォルダID',
  purchase: '帳票_仕入請求書保存先フォルダID',
} as const;

export const driveCopy = {
  title: 'Google Drive 保存先設定',
  subtitle: '帳票PDFの保存先Google DriveフォルダをフォルダIDまたはURLで登録します。',
  quoteFolder: '見積書PDFの保存先',
  invoiceFolder: '請求書PDFの保存先',
  shippingFolder: '発送ラベルの保存先',
  purchaseFolder: '仕入元請求書の保存先',
  placeholder: 'フォルダIDまたはURLを入力',
  register: '登録',
  change: '変更',
  delete: '削除',
  registered: '登録済み',
  notRegistered: '未登録',
  errorNotFound: 'フォルダが見つかりません',
  errorNoPermission: '編集権限がありません',
  loading: '読み込み中...',
  loadError: 'Drive設定の取得に失敗しました',
  retry: '再読み込み',
  saving: '保存中...',
} as const;
