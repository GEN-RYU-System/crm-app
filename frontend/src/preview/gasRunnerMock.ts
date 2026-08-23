/**
 * Dev-only mock for window.google.script.run.
 * Installed by main.tsx when ?preview is in the URL and import.meta.env.DEV is true.
 * Never included in production builds.
 */
import { ISSUER_HEADER } from '../content/ja/issuer';

const MOCK_SESSION_ID = 'preview-mock-session';

export const PREVIEW_SESSION_ID = MOCK_SESSION_ID;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SESSION_USER = {
  staffId: 'EMP-00001',
  fullNameJa: 'Preview User',
  role: 'admin',
  email: 'preview@preview.local',
};

const MOCK_PERMISSIONS = {
  lead_view: true,
  lead_add: true,
  lead_edit: true,
  dashboard_view: true,
  deal_view_all: true,
  deal_view_own: true,
  admin_access: true,
  staff_manage: true,
  settings: true,
  issuer_manage: true,
};

const MOCK_CUSTOMERS = [
  {
    customerId: 'CUS-0001',
    customerName: 'Preview Customer A',
    country: 'JP',
    salesChannel: 'Web',
    handledTitle: '',
    salesAssigneeName: 'Preview User',
    transactionCount: 2,
    transactionAmounts: [{ currency: 'JPY', amount: 50000 }],
  },
  {
    customerId: 'CUS-0002',
    customerName: 'Preview Customer B',
    country: 'US',
    salesChannel: 'Direct',
    handledTitle: '',
    salesAssigneeName: 'Preview User',
    transactionCount: 1,
    transactionAmounts: [{ currency: 'USD', amount: 1000 }],
  },
];

const MOCK_AGGREGATES: Record<string, unknown> = {
  'CUS-0001': {
    shippingAddresses: [
      {
        addressId: 'SHP-0001',
        displayName: 'Company A - HQ',
        recipient: 'Preview Customer A',
        country: 'JP',
        address: 'Tokyo, Japan',
        phone: '',
        emailAddress: '',
        isDefault: '1',
        isActive: '1',
      },
    ],
    paymentProfiles: [
      {
        paymentProfileId: 'PAY-0001',
        displayName: 'Company A - WISE',
        billingName: 'Preview Customer A',
        country: 'JP',
        address: 'Tokyo, Japan',
        method: 'WISE',
        currency: 'JPY',
        isDefault: '1',
        isActive: '1',
      },
    ],
  },
  'CUS-0002': {
    shippingAddresses: [
      {
        addressId: 'SHP-0002',
        displayName: 'Company B - New York',
        recipient: 'Preview Customer B',
        country: 'US',
        address: 'New York, USA',
        phone: '',
        emailAddress: '',
        isDefault: '1',
        isActive: '1',
      },
    ],
    paymentProfiles: [
      {
        paymentProfileId: 'PAY-0002',
        displayName: 'Company B - PayPal',
        billingName: 'Preview Customer B',
        country: 'US',
        address: 'New York, USA',
        method: 'PAYPAL',
        currency: 'USD',
        isDefault: '1',
        isActive: '1',
      },
    ],
  },
};

const MOCK_PRODUCTS = [
  { productId: 'PM-0001', productName: 'Preview Product Alpha', category: 'Category A' },
  { productId: 'PM-0002', productName: 'Preview Product Beta',  category: 'Category B' },
];

const MOCK_CONDITIONS: Record<string, { condition: string; quantity: number; unitPrice: number; unitWeight: number }[]> = {
  'PM-0001': [
    { condition: 'Sealed box', quantity: 5,  unitPrice: 10000, unitWeight: 500 },
    { condition: 'Case',       quantity: 3,  unitPrice: 7000,  unitWeight: 3000 },
  ],
  'PM-0002': [
    { condition: 'Sealed box', quantity: 10, unitPrice: 5000, unitWeight: 600 },
  ],
};

// Mock data for getSharedInventoryForFrontend (used by the prefetch cache).
const MOCK_SHARED_INVENTORY = Object.entries(MOCK_CONDITIONS).flatMap(([productId, conditions]) => {
  const product = MOCK_PRODUCTS.find((p) => p.productId === productId);
  if (!product) return [];
  return conditions.map((c) => ({
    series: '',
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    condition: c.condition,
    unitWeight: c.unitWeight,
    status: 'In Stock',
    noteJa: '',
    noteEn: '',
    supplier: 'Preview Supplier',
    productId,
    rawName: product.productName,
    exclusionReason: '',
    ipId: '',
    ipName: '',
    releaseDate: '',
    japaneseTitle: product.productName,
    englishTitle: product.productName,
    mark: '',
  }));
});

const MOCK_CURRENCIES = [
  { currencyCode: 'USD', symbol: '$',  name: 'US Dollar',      rateToJpy: 150 },
  { currencyCode: 'JPY', symbol: 'JPY', name: 'Japanese Yen', rateToJpy: 1 },
  { currencyCode: 'EUR', symbol: 'EUR', name: 'Euro',         rateToJpy: 165 },
];

const MOCK_LEAD_OPTIONS = [
  { leadId: 'LDI-0001', customerName: 'Preview Lead A' },
  { leadId: 'LDI-0002', customerName: 'Preview Lead B' },
];

const MOCK_SYNC_SIGNALS = {
  leads: null, quotes: null, orders: null,
  inventory: null, staff: null, customers: null,
};

const MOCK_KPIS = {
  leadsIn: 5, leadsOut: 3, totalLeads: 20, activeDeals: 4,
  wonDeals: 2, lostDeals: 1, totalRevenue: 500000,
  conversionRate: 0.4, statusCounts: {},
};

// ---------------------------------------------------------------------------
// Mock runner builder (immutable chain)
// ---------------------------------------------------------------------------

type SuccessHandler = (value: unknown) => void;
type ErrorHandler = (error: { message?: string; name?: string; stack?: string }) => void;

function buildChain(onSuccess: SuccessHandler, onError: ErrorHandler) {
  function succeed(data: unknown) {
    setTimeout(() => onSuccess(data), 0);
  }

  const chain = {
    withSuccessHandler(h: SuccessHandler) {
      return buildChain(h, onError);
    },
    withFailureHandler(h: ErrorHandler) {
      return buildChain(onSuccess, h);
    },

    getDashboardKPIs(_sessionId: string | null) { succeed(MOCK_KPIS); },
    getCurrentUser(_sessionId: string | null) {
      succeed({ success: true, permissions: MOCK_PERMISSIONS });
    },
    getSessionUser(_sessionId: string) { succeed(MOCK_SESSION_USER); },
    getLeadsByType(_sessionId: string | null, _leadType?: string, _force?: boolean) { succeed([]); },
    getLeadDetail(_sessionId: string | null, _leadId: string) { succeed(null); },
    createLead(_sessionId: string | null, _data: unknown) { succeed({ success: true, leadId: 'LDI-NEW' }); },
    updateLead(_sessionId: string | null, _sheet: string, _leadId: string, _data: unknown) { succeed({ success: true }); },

    getCoreCustomersForFrontend(_sessionId: string | null, _force: boolean) { succeed(MOCK_CUSTOMERS); },
    getCoreCustomerForFrontend(_sessionId: string | null, customerId: string) {
      const agg = MOCK_AGGREGATES[customerId];
      succeed(agg ? { ...MOCK_CUSTOMERS.find((c) => c.customerId === customerId), ...agg } : null);
    },
    getCoreAllCustomerAggregatesForFrontend(_sessionId: string | null) { succeed(MOCK_AGGREGATES); },
    getCoreStaffForFrontend(_sessionId: string | null, _force: boolean) { succeed([]); },
    getCoreStaffMemberForFrontend(_sessionId: string | null, _staffId: string) { succeed(null); },

    loginWithPassword(_staffId: string, _password: string) {
      succeed({ success: false, message: 'Preview mode: login disabled' });
    },
    logout(_sessionId: string) { succeed(null); },
    changeOwnPasswordForFrontend(_s: string | null, _c: string, _n: string) { succeed({ success: true }); },

    getSharedInventoryForFrontend(_s: string | null, _force: boolean) { succeed(MOCK_SHARED_INVENTORY); },
    getCoreQuotesForFrontend(_s: string | null, _force: boolean) { succeed([]); },
    getCoreQuoteForFrontend(_s: string | null, _quoteId: string) { succeed(null); },
    getCoreOrdersForFrontend(_s: string | null, _force: boolean) {
      succeed([
        {
          orderId: 'ORD-00001',
          customerName: 'Preview Customer A',
          invoiceNumber: 'INV-00001',
          invoiceIssuedAt: '',
          paymentMethod: 'WISE',
          invoiceTotal: '20000',
          currency: 'USD',
          paymentDueAt: '',
          paymentStatus: 'UNPAID',
          invoiceTotalJpy: '3000000',
          status: 'AWAITING_PAYMENT',
        },
        {
          orderId: 'ORD-00002',
          customerName: 'Preview Customer B',
          invoiceNumber: 'INV-00002',
          invoiceIssuedAt: '2026-01-15',
          paymentMethod: 'PAYPAL',
          invoiceTotal: '5000',
          currency: 'USD',
          paymentDueAt: '2026-02-15',
          paymentStatus: 'PAID',
          invoiceTotalJpy: '750000',
          status: 'COMPLETED',
        },
      ]);
    },
    getCoreCurrenciesForFrontend(_s: string | null) { succeed(MOCK_CURRENCIES); },
    getLeadOptionsForFrontend(_s: string | null) { succeed(MOCK_LEAD_OPTIONS); },

    createCoreQuoteForFrontend(_s: string | null, _data: unknown, _isDraft: boolean) {
      succeed({ success: true, quoteId: 'QUO-PREVIEW-0001' });
    },
    updateCoreQuoteForFrontend(_s: string | null, _id: string, _data: unknown, _isDraft: boolean) {
      succeed({ success: true });
    },

    getInventoryProductOptions(_s: string | null) { succeed(MOCK_PRODUCTS); },
    getInventoryConditions(_s: string | null, productId: string) {
      succeed(MOCK_CONDITIONS[productId] ?? []);
    },
    createCoreOrderForFrontend(_s: string | null, _payload: unknown) {
      succeed({ success: true, orderId: 'ORD-PREVIEW-0001' });
    },
    updateCoreOrderForFrontend(_s: string | null, _orderId: string, _data: unknown) {
      succeed({ success: true, orderId: _orderId });
    },
    confirmCoreOrderPaymentForFrontend(_s: string | null, _orderId: string) {
      succeed({ success: false, reason: 'INVALID_STATUS' });
    },
    getCoreOrderStatusOptionsForFrontend(_s: string | null) { succeed([]); },
    getCoreOrderDetailForFrontend(_s: string | null, _orderId: string) { succeed({ success: false }); },
    checkSyncSignals(_s: string | null) { succeed(MOCK_SYNC_SIGNALS); },
    getLeadFormOptions(_s: string | null) {
      succeed({ leadTypes: [], responseSpeeds: [], countries: [] });
    },
    getCoreIssuerForFrontend(_s: string | null) {
      succeed({
        success: true,
        issuer: {
          [ISSUER_HEADER.ISSUER_ID]:       'ISS-0001',
          [ISSUER_HEADER.COMPANY_NAME]:    'Preview Company Ltd.',
          [ISSUER_HEADER.CONTACT_NAME]:    'Preview Tanaka',
          [ISSUER_HEADER.ADDRESS_LINE1]:   '1-2-3 Preview Street',
          [ISSUER_HEADER.ADDRESS_LINE2]:   '',
          [ISSUER_HEADER.ADDRESS_LINE3]:   '',
          [ISSUER_HEADER.CITY]:            'Tokyo',
          [ISSUER_HEADER.STATE]:           'Tokyo',
          [ISSUER_HEADER.ZIP]:             '100-0001',
          [ISSUER_HEADER.COUNTRY]:         'Japan',
          [ISSUER_HEADER.PHONE]:           '+81-3-0000-0000',
          [ISSUER_HEADER.EMAIL]:           'info@preview.example.com',
          [ISSUER_HEADER.REGISTRATION_NO]: 'T1234567890123',
          [ISSUER_HEADER.PAYEE_NAME]:      'Preview Company Ltd.',
          [ISSUER_HEADER.PAYMENT_EMAIL]:   'payment@preview.example.com',
          [ISSUER_HEADER.PAYMENT_NOTE]:    'Preview payment note.',
          [ISSUER_HEADER.CLOSING_MESSAGE]: 'Thank you for your order.',
          [ISSUER_HEADER.IS_ACTIVE]:       true,
        },
      });
    },
    updateCoreIssuerForFrontend(_s: string | null, _data: unknown) {
      succeed({ success: true });
    },
  };

  return chain;
}

// ---------------------------------------------------------------------------
// Public install function
// ---------------------------------------------------------------------------

export function installGASMock(): void {
  sessionStorage.setItem('crm_session_id', MOCK_SESSION_ID);
  const runner = buildChain(
    () => { /* default no-op success */ },
    () => { /* default no-op error */ },
  );
  (window as Window & { google?: unknown }).google = { script: { run: runner } };
}
