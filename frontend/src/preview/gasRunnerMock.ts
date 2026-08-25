/**
 * Dev-only mock for window.google.script.run.
 * Installed by main.tsx when ?preview is in the URL and import.meta.env.DEV is true.
 * Never included in production builds.
 */
import { ISSUER_HEADER } from '../content/ja/issuer';
import { leadsCopy } from '../content/ja/leads';
import { SALES_ORDER_STATUS } from '../content/ja/salesOrders';
import { NAVIGATION_BY_ID, type NavigationItemId, type NavigationPermission } from '../app/navigation';

const MOCK_SESSION_ID = 'preview-mock-session';
const mockCallCounts: Record<string, number> = {};
let mockDiscordConnectionStatus = {
  isTokenSet: false,
  tokenMask: 'not-set',
  botName: '',
  botId: '',
  connected: false,
  clientId: '',
};
let previewOrderPaymentConfirmed = false;

type PreviewWindow = Window & { __gasMockCallCounts?: Readonly<Record<string, number>> };

function recordMockCall(functionName: string): void {
  mockCallCounts[functionName] = (mockCallCounts[functionName] ?? 0) + 1;
}

export const PREVIEW_SESSION_ID = MOCK_SESSION_ID;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SESSION_USER = {
  staffId: 'EMP-00001',
  fullNameJa: 'Preview User',
  role: 'admin',
  email: '[preview-user]',
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

const MOCK_QUOTES_ONLY_PERMISSIONS = { lead_view: true };
// The data-management route is rooted at /leads, so its parent guard must remain
// accessible for the quote-only preview profile to render #/quotes.
const QUOTES_ONLY_HIDDEN_NAVIGATION_IDS: readonly NavigationItemId[] = ['customers', 'orders', 'salesOrders', 'inbox'];
const defaultNavigationPermissions = new Map(
  QUOTES_ONLY_HIDDEN_NAVIGATION_IDS.map((id) => [id, NAVIGATION_BY_ID[id].requiredPermission]),
);
let mockPermissions: Record<string, boolean> = MOCK_PERMISSIONS;

function configurePreviewProfile(): void {
  for (const [id, requiredPermission] of defaultNavigationPermissions) {
    NAVIGATION_BY_ID[id].requiredPermission = requiredPermission;
  }

  if (new URLSearchParams(window.location.search).get('previewProfile') !== 'quotes-only') {
    mockPermissions = MOCK_PERMISSIONS;
    return;
  }

  for (const id of QUOTES_ONLY_HIDDEN_NAVIGATION_IDS) {
    NAVIGATION_BY_ID[id].requiredPermission = 'settings' as NavigationPermission;
  }
  mockPermissions = MOCK_QUOTES_ONLY_PERMISSIONS;
}

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
    profile: { customerId: 'CUS-0001', sourceLeadId: '', customerName: 'Preview Customer A', country: 'JP', emailAddress: '', phone: '', countryCode: '', firstTransactionDate: '', registeredAt: '', salesAssigneeName: 'Preview User', contactTool: '', shippingNote: '', discordChannelId: '', shippingAddressCount: 1, paymentProfileCount: 1 },
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
    profile: { customerId: 'CUS-0002', sourceLeadId: '', customerName: 'Preview Customer B', country: 'US', emailAddress: '', phone: '', countryCode: '', firstTransactionDate: '', registeredAt: '', salesAssigneeName: 'Preview User', contactTool: '', shippingNote: '', discordChannelId: 'preview-discord-channel', shippingAddressCount: 1, paymentProfileCount: 1 },
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

const MOCK_QUOTES = [
  {
    quoteId: 'QUO-PREVIEW-0001', leadId: 'LDI-0001', customerId: 'CUS-0002', customerName: 'Preview Customer B', orderId: '', staffId: 'EMP-00001',
    issuedDate: '2026-08-25', expiryDate: '2026-09-24', status: 'ISSUED', currency: 'USD', exchangeRate: 150,
    subtotal: 1000, shippingFee: 0, discount: 0, totalAmount: 1000, totalAmountJpy: 150000, pdfUrl: '', note: '',
    createdAt: '2026-08-25T00:00:00.000Z', updatedAt: '2026-08-25T00:00:00.000Z',
  },
];

const MOCK_LEAD_OPTIONS = [
  { leadId: 'LDI-0001', customerName: 'Preview Lead A' },
  { leadId: 'LDI-0002', customerName: 'Preview Lead B' },
];

const MOCK_LEAD_DETAILS: Record<string, Record<string, unknown>> = {
  'LDI-0001': {
    [leadsCopy.fields.leadId]: 'LDI-0001',
    [leadsCopy.fields.customerName]: 'Preview Lead A',
    [leadsCopy.fields.leadType]: leadsCopy.leadTypes.inbound,
    [leadsCopy.fields.sourceId]: 'preview-source',
    [leadsCopy.fields.source]: 'Preview Source',
    [leadsCopy.fields.country]: 'JP',
    [leadsCopy.fields.productTitle]: 'Preview Product',
    [leadsCopy.fields.responseSpeed]: 'Fast',
    [leadsCopy.fields.csMemo]: 'Preview lead detail not present in list cache.',
  },
};

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
      succeed({ success: true, permissions: mockPermissions });
    },
    getSessionUser(_sessionId: string) { succeed(MOCK_SESSION_USER); },
    getLeadsByType(_sessionId: string | null, _leadType?: string, _force?: boolean) { succeed([]); },
    getLeadDetail(_sessionId: string | null, leadId: string) { succeed(MOCK_LEAD_DETAILS[leadId] ?? null); },
    createLead(_sessionId: string | null, _data: unknown) { succeed({ success: true, leadId: 'LDI-NEW' }); },
    updateLead(_sessionId: string | null, _sheet: string, _leadId: string, _data: unknown) { succeed({ success: true }); },

    getCoreCustomersForFrontend(_sessionId: string | null, _force: boolean) { succeed(MOCK_CUSTOMERS); },
    getCoreCustomerForFrontend(_sessionId: string | null, customerId: string) {
      const agg = MOCK_AGGREGATES[customerId];
      succeed(agg ?? null);
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
    getCoreQuotesForFrontend(_s: string | null, _force: boolean) { succeed(MOCK_QUOTES); },
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
      if (previewOrderPaymentConfirmed) {
        succeed({ success: false, reason: 'INVALID_STATUS' });
        return;
      }
      previewOrderPaymentConfirmed = true;
      succeed({ success: true, status: SALES_ORDER_STATUS.sourcing, paymentStatus: 'PAID' });
    },
    getCoreOrderStatusOptionsForFrontend(_s: string | null) { succeed([]); },
    getCoreOrderDetailForFrontend(_s: string | null, orderId: string) {
      succeed({
        order: {
          ORDER_ID: orderId,
          INVOICE_NUMBER: 'INV-00001',
          ORDER_DATE: '2026-01-10',
          CUSTOMER_ID: 'CUST-00001',
          customerName: 'Preview Customer A',
          shippingDestinationName: 'Preview Destination',
          shippingAddressLine1: '123 Preview St', shippingAddressLine2: '', shippingAddressLine3: '',
          shippingCity: 'Preview City', shippingState: 'Preview State', shippingZip: '12345', shippingCountry: 'Japan',
          paymentDestinationName: 'Preview Payment',
          INVOICE_ISSUED_AT: '2026-01-15T00:00:00.000Z',
          PAYMENT_DUE_AT: '2026-02-15T00:00:00.000Z',
          PAYMENT_METHOD: 'WISE',
          CURRENCY: 'USD',
          EXCHANGE_RATE: 150,
          LINE_TOTAL: 19000,
          SHIPPING_FEE: 500,
          DUTY: 200,
          DISCOUNT: 0,
          OTHER_FEE: 300,
          INVOICE_TOTAL: 20000,
          INVOICE_TOTAL_JPY: 3000000,
          PAYMENT_STATUS: previewOrderPaymentConfirmed ? 'PAID' : 'UNPAID',
          STATUS: previewOrderPaymentConfirmed ? SALES_ORDER_STATUS.sourcing : SALES_ORDER_STATUS.awaitingPayment,
          awaitingPaymentStatus: SALES_ORDER_STATUS.awaitingPayment,
          PAYMENT_CONFIRMED_AT: previewOrderPaymentConfirmed ? '2026-08-25T00:00:00.000Z' : '',
          NOTE: '',
          TRANSACTION_NOTE: '',
          INTERNAL_NOTE: '',
          CANCELLATION_REASON: '',
          CANCELLATION_NOTE: '',
          REGISTERED_AT: '2026-01-10T00:00:00.000Z',
          UPDATED_AT: '2026-01-15T00:00:00.000Z',
        },
        lines: [
          { ORDER_LINE_ID: 'OL-001', LINE_NUMBER: 1, CATEGORY: 'Card', PRODUCT_NAME: 'Pikachu ex SAR', STATUS: 'NM', SKU: '', QUANTITY: 2, UNIT_PRICE: 8000, SUBTOTAL: 16000, PRODUCT_ID: 'PM-001' },
          { ORDER_LINE_ID: 'OL-002', LINE_NUMBER: 2, CATEGORY: 'Card', PRODUCT_NAME: 'Umbreon VMAX Alt', STATUS: 'LP', SKU: '', QUANTITY: 1, UNIT_PRICE: 3000, SUBTOTAL: 3000, PRODUCT_ID: 'PM-002' },
        ],
        purchases: [],
        shipments: [],
      });
    },
    getInboxConversationsForFrontend(_s: string | null, _force: boolean) {
      succeed([
        { id: 'preview-inbox-alpha', customerName: 'Preview Atlas',  platform: 'messenger',  status: 'lead',     summary: 'Preview lead conversation',             updatedAt: '10:20',    unread: true  },
        { id: 'preview-inbox-bravo', customerName: 'Preview Bravo',  platform: 'instagram',  status: 'deal',     summary: 'Preview deal conversation',             updatedAt: '09:45',    unread: false },
        { id: 'preview-inbox-charlie', customerName: 'Preview Charlie', platform: 'discord', status: 'existing', summary: 'Preview existing customer conversation', updatedAt: 'Yesterday', unread: false },
        { id: 'preview-inbox-delta', customerName: 'Preview Delta',  platform: 'messenger',  status: 'followup', summary: 'Preview follow-up conversation',         updatedAt: 'Monday',   unread: true  },
        { id: 'preview-inbox-echo',  customerName: 'Preview Echo',   platform: 'instagram',  status: 'archive',  summary: 'Preview archived conversation',          updatedAt: 'Last week', unread: false },
      ]);
    },
    getInboxConversationDetailForFrontend(_s: string | null, leadId: string) {
      const MOCK_DETAILS: Record<string, unknown> = {
        'preview-inbox-alpha':   { conversation: { id: 'preview-inbox-alpha',   customerName: 'Preview Atlas',   platform: 'messenger',  status: 'lead',     summary: 'Preview lead conversation',             updatedAt: '10:20',     unread: true  }, messages: [{ id: 'alpha-1', sender: 'customer', body: 'Preview message from customer.', sentAt: '10:12' }, { id: 'alpha-2', sender: 'operator', body: 'Preview reply from operator.', sentAt: '10:20' }], karte: { customerName: 'Preview Atlas',   company: 'Preview Company A', platform: 'Messenger',  status: 'Lead',              nextAction: 'Preview follow-up',     note: 'Preview note only.' } },
        'preview-inbox-bravo':   { conversation: { id: 'preview-inbox-bravo',   customerName: 'Preview Bravo',   platform: 'instagram',  status: 'deal',     summary: 'Preview deal conversation',             updatedAt: '09:45',     unread: false }, messages: [{ id: 'bravo-1', sender: 'customer', body: 'Preview deal message.', sentAt: '09:45' }],                                                                                                                                 karte: { customerName: 'Preview Bravo',   company: 'Preview Company B', platform: 'Instagram',  status: 'Deal',              nextAction: 'Preview qualification', note: 'Preview note only.' } },
        'preview-inbox-charlie': { conversation: { id: 'preview-inbox-charlie', customerName: 'Preview Charlie', platform: 'discord',    status: 'existing', summary: 'Preview existing customer conversation', updatedAt: 'Yesterday', unread: false }, messages: [{ id: 'charlie-1', sender: 'operator', body: 'Preview existing customer message.', sentAt: 'Yesterday' }],                                                                                                            karte: { customerName: 'Preview Charlie', company: 'Preview Company C', platform: 'Discord',    status: 'Existing customer', nextAction: 'Preview account review', note: 'Preview note only.' } },
        'preview-inbox-delta':   { conversation: { id: 'preview-inbox-delta',   customerName: 'Preview Delta',   platform: 'messenger',  status: 'followup', summary: 'Preview follow-up conversation',         updatedAt: 'Monday',    unread: true  }, messages: [{ id: 'delta-1', sender: 'customer', body: 'Preview follow-up message.', sentAt: 'Monday' }],                                                                                                                   karte: { customerName: 'Preview Delta',   company: 'Preview Company D', platform: 'Messenger',  status: 'Follow-up',         nextAction: 'Preview follow-up',     note: 'Preview note only.' } },
        'preview-inbox-echo':    { conversation: { id: 'preview-inbox-echo',    customerName: 'Preview Echo',    platform: 'instagram',  status: 'archive',  summary: 'Preview archived conversation',          updatedAt: 'Last week', unread: false }, messages: [{ id: 'echo-1', sender: 'operator', body: 'Preview archived message.', sentAt: 'Last week' }],                                                                                                               karte: { customerName: 'Preview Echo',    company: 'Preview Company E', platform: 'Instagram',  status: 'Archived',          nextAction: 'Preview archive review', note: 'Preview note only.' } },
      };
      succeed(MOCK_DETAILS[leadId] ?? null);
    },
    checkSyncSignals(_s: string | null) { succeed(MOCK_SYNC_SIGNALS); },
    getLeadFormOptions(_s: string | null) {
      succeed({ leadTypes: [], responseSpeeds: [], countries: [], leadSources: [] });
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
          [ISSUER_HEADER.EMAIL]:           '[preview-email]',
          [ISSUER_HEADER.REGISTRATION_NO]: 'T1234567890123',
          [ISSUER_HEADER.PAYEE_NAME]:      'Preview Company Ltd.',
          [ISSUER_HEADER.PAYMENT_EMAIL]:   '[preview-payment-email]',
          [ISSUER_HEADER.PAYMENT_NOTE]:    'Preview payment note.',
          [ISSUER_HEADER.CLOSING_MESSAGE]: 'Thank you for your order.',
          [ISSUER_HEADER.IS_ACTIVE]:       true,
        },
      });
    },
    updateCoreIssuerForFrontend(_s: string | null, _data: unknown) {
      succeed({ success: true });
    },

    // Discord integration
    saveDiscordBotToken(_s: string | null, token: string) {
      if (token === 'preview-save-fail') {
        succeed({ success: false });
        return;
      }
      mockDiscordConnectionStatus = token === 'preview-connection-fail'
        ? { isTokenSet: true, tokenMask: '••••fail', botName: '', botId: '', connected: false, clientId: mockDiscordConnectionStatus.clientId }
        : { isTokenSet: true, tokenMask: '••••mock', botName: 'Preview Bot', botId: 'preview-bot-id', connected: true, clientId: mockDiscordConnectionStatus.clientId };
      succeed({ success: true });
    },
    saveDiscordClientId(_s: string | null, clientId: string) {
      if (clientId === 'preview-client-id-save-fail') {
        succeed({ success: false });
        return;
      }
      mockDiscordConnectionStatus = { ...mockDiscordConnectionStatus, clientId };
      succeed({ success: true });
    },
    getDiscordConnectionStatusForFrontend(_s: string | null) {
      succeed(mockDiscordConnectionStatus);
    },
    saveDiscordChannels(_s: string | null, _channelIds: unknown) {
      succeed({ success: true });
    },
    getDiscordChannelsForFrontend(_s: string | null) {
      succeed({ channels: ['1234567890123456789'] });
    },

    // Discord OAuth Bot invite flow
    generateDiscordOAuthUrl(_s: string | null) {
      succeed({ success: true, url: 'https://discord.com/api/oauth2/authorize?client_id=mock&permissions=805432400&scope=bot%20applications.commands' });
    },
    getDiscordOAuthStatus(_s: string | null) {
      succeed({ status: 'multiple', guildId: null, guilds: [{ id: 'preview-guild-1', name: 'Preview Guild One' }, { id: 'preview-guild-2', name: 'Preview Guild Two' }] });
    },
    saveDiscordGuildId(_s: string | null, guildId: string) {
      succeed({ success: guildId === 'preview-guild-1' || guildId === 'preview-guild-2' });
    },
    runDiscordAutoSetup(_s: string | null) {
      succeed({ success: true, categoryId: 'preview-category', ticketChannelId: 'preview-ticket-channel' });
    },
    getDiscordSetupStatus(_s: string | null) {
      succeed({ guildId: null, categoryId: null, ticketChannelId: null });
    },
    createDiscordTicketForCustomer(_s: string | null, customerId: string) {
      if (customerId === 'CUS-0002') { succeed({ success: true, reused: true, channelId: 'preview-existing-channel', channelName: 'ticket-preview-customer-b-0002' }); return; }
      succeed({ success: true, reused: false, channelId: 'preview-new-channel', channelName: 'ticket-preview-customer-a-0001' });
    },
    upsertCorePurchaseForFrontend(_s: string | null, _payload: unknown) {
      succeed({ success: true, purchaseId: 'PC-00001' });
    },
    getCorePurchaseStatusOptionsForFrontend(_s: string | null) {
      succeed([
        { key: 'NOT_ORDERED', label: 'preview-not-ordered' },
        { key: 'ORDERED',     label: 'preview-ordered' },
        { key: 'CONFIRMED',   label: 'preview-confirmed' },
        { key: 'PAID',        label: 'preview-paid' },
      ]);
    },
  };

  return new Proxy(chain, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string' || typeof value !== 'function' || property === 'withSuccessHandler' || property === 'withFailureHandler') return value;
      return (...args: unknown[]) => {
        recordMockCall(property);
        return value.apply(target, args);
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Public install function
// ---------------------------------------------------------------------------

export function installGASMock(): void {
  for (const name of Object.keys(mockCallCounts)) delete mockCallCounts[name];
  configurePreviewProfile();
  mockDiscordConnectionStatus = { isTokenSet: false, tokenMask: 'not-set', botName: '', botId: '', connected: false, clientId: '' };
  sessionStorage.setItem('crm_session_id', MOCK_SESSION_ID);
  const runner = buildChain(
    () => { /* default no-op success */ },
    () => { /* default no-op error */ },
  );
  const previewWindow = window as PreviewWindow & { google?: unknown };
  previewWindow.__gasMockCallCounts = mockCallCounts;
  previewWindow.google = { script: { run: runner } };
}
