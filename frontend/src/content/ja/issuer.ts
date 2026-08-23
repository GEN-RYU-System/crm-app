export const issuerCopy = {
  title: '発行元情報',
  subtitle: '請求書・見積書に印刷される自社情報を管理します。',
  companyName: '会社名',
  contactName: '担当者名',
  addressLine1: '住所1',
  addressLine2: '住所2',
  addressLine3: '住所3',
  city: '市区町村',
  state: '都道府県',
  zip: '郵便番号',
  country: '国',
  phone: '電話番号',
  email: 'メール',
  registrationNo: '登録番号',
  payeeName: '受取名義',
  paymentEmail: '受取先メール',
  paymentNote: '注記',
  closingMessage: '結びの文',
  save: '保存',
  saving: '保存中...',
  saveSuccess: '保存しました',
  saveError: '保存に失敗しました',
  loading: '読み込み中...',
  retry: '再読み込み',
  loadError: '発行元情報の取得に失敗しました',
} as const;

/**
 * Physical header names of the ISSUER table in CoreSchemaRegistry.
 * These are the Japanese column names used in the Google Sheets spreadsheet.
 * Defined here to keep all Japanese strings in content/ja.
 */
export const ISSUER_HEADER = {
  ISSUER_ID: '発行元ID',
  COMPANY_NAME: '会社名',
  CONTACT_NAME: '担当者名',
  ADDRESS_LINE1: 'Address 1',
  ADDRESS_LINE2: 'Address 2',
  ADDRESS_LINE3: 'Address 3',
  CITY: 'City',
  STATE: 'State',
  ZIP: 'Zip',
  COUNTRY: '国',
  PHONE: '電話番号',
  EMAIL: 'メール',
  REGISTRATION_NO: '登録番号',
  PAYEE_NAME: '受取名義',
  PAYMENT_EMAIL: '受取先メール',
  PAYMENT_NOTE: '注記',
  CLOSING_MESSAGE: '結びの文',
  IS_ACTIVE: '有効',
} as const;
