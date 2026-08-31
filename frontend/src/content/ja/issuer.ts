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
 * These are the snake_case column names used in the Google Sheets spreadsheet.
 * Defined here to keep all Japanese strings in content/ja.
 * Updated to new physical names (address-rename PR-1).
 */
export const ISSUER_HEADER = {
  ISSUER_ID: 'issuer_id',
  COMPANY_NAME: 'company_name',
  CONTACT_NAME: 'contact_name',
  ADDRESS_LINE1: 'address_line_1',
  ADDRESS_LINE2: 'address_line_2',
  ADDRESS_LINE3: 'address_line_3',
  CITY: 'city',
  STATE: 'state',
  ZIP: 'zip',
  COUNTRY: 'country',
  PHONE: 'phone',
  EMAIL: 'email',
  REGISTRATION_NO: 'registration_no',
  PAYEE_NAME: 'payee_name',
  PAYMENT_EMAIL: 'payment_email',
  PAYMENT_NOTE: 'note',
  CLOSING_MESSAGE: 'closing_message',
  IS_ACTIVE: 'is_active',
} as const;
