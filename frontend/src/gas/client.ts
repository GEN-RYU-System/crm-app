import { errorCopy, leadsCopy } from '../content/ja';
import type { CustomerAggregateDto, CustomerAggregatesRecord, CustomerSummaryDto } from '../features/customers/contracts';
import type { InboxConversationDetailDto, InboxConversationDto } from '../features/inbox/contracts';
import type { OrderCreatePayload, OrderCreateResult, OrderUpdatePayload, OrderUpdateResult } from '../features/orders/contracts';
import type { StaffProfileDto, StaffSummaryDto } from '../features/staff/contracts';

export type DashboardKpis = {
  leadsIn: number;
  leadsOut: number;
  totalLeads: number;
  activeDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalRevenue: number;
  conversionRate: number;
  statusCounts: Record<string, number>;
};

export type CurrentUser = {
  success: boolean;
  permissions: Record<string, boolean>;
};

export type LeadType = typeof leadsCopy.leadTypes[keyof typeof leadsCopy.leadTypes];
export type LeadRecord = Record<string, unknown>;
export type LeadCreateResult = { success: true; leadId: string; message?: string };

function getStoredSessionId(): string | null {
  return sessionStorage.getItem('crm_session_id') ?? localStorage.getItem('crm_session_id');
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String(error.message));
  }
  return new Error(errorCopy.communication);
}

export function getDashboardKpis(): Promise<DashboardKpis> {
  const runner = window.google?.script?.run;
  if (!runner) {
    return Promise.reject(new Error(errorCopy.appsScriptOnly));
  }

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DashboardKpis))
      .withFailureHandler((error) => reject(toError(error)))
      .getDashboardKPIs(getStoredSessionId());
  });
}

export function getCurrentUser(): Promise<CurrentUser> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (typeof value !== 'object' || value === null || !('success' in value) || !('permissions' in value) || typeof value.permissions !== 'object' || value.permissions === null) {
          reject(new Error(errorCopy.communication));
          return;
        }
        const user = value as CurrentUser;
        resolve({ success: user.success === true, permissions: user.permissions });
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCurrentUser(getStoredSessionId());
  });
}

export function getLeadsByType(leadType?: LeadType, forceRefresh?: boolean): Promise<LeadRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    const call = runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as LeadRecord[]);
      })
      .withFailureHandler((error) => reject(toError(error)));

    call.getLeadsByType(getStoredSessionId(), leadType, forceRefresh === true);
  });
}

export function getLeadDetail(leadId: string): Promise<LeadRecord | null> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (value === null) {
          resolve(null);
          return;
        }
        if (typeof value !== 'object' || Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as LeadRecord);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getLeadDetail(getStoredSessionId(), leadId);
  });
}

export function createLead(leadData: Record<string, string>): Promise<LeadCreateResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (typeof value !== 'object' || value === null || !('success' in value) || (value as { success?: unknown }).success !== true || typeof (value as { leadId?: unknown }).leadId !== 'string') {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as LeadCreateResult);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .createLead(getStoredSessionId(), leadData);
  });
}

export function updateLead(sheetName: string, leadId: string, updateData: Record<string, string>): Promise<string> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (typeof value !== 'string') {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .updateLead(getStoredSessionId(), sheetName, leadId, updateData);
  });
}

export function getCoreCustomers(forceRefresh?: boolean): Promise<readonly CustomerSummaryDto[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as CustomerSummaryDto[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreCustomersForFrontend(getStoredSessionId(), forceRefresh === true);
  });
}

export function getCoreCustomer(customerId: string): Promise<CustomerAggregateDto | null> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (value === null) {
          resolve(null);
          return;
        }
        if (typeof value !== 'object' || Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as CustomerAggregateDto);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreCustomerForFrontend(getStoredSessionId(), customerId);
  });
}

export function getCoreAllCustomerAggregates(): Promise<CustomerAggregatesRecord> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as CustomerAggregatesRecord);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreAllCustomerAggregatesForFrontend(getStoredSessionId());
  });
}

export function getCoreStaff(forceRefresh?: boolean): Promise<readonly StaffSummaryDto[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as StaffSummaryDto[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreStaffForFrontend(getStoredSessionId(), forceRefresh === true);
  });
}

export function getCoreStaffMember(staffId: string): Promise<StaffProfileDto | null> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (value === null) {
          resolve(null);
          return;
        }
        if (typeof value !== 'object' || Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as StaffProfileDto);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreStaffMemberForFrontend(getStoredSessionId(), staffId);
  });
}

export type LoginResult = {
  sessionId: string;
  staffId: string;
  fullNameJa: string;
  role: string;
};

export type SessionUser = {
  staffId: string;
  fullNameJa: string;
  role: string;
  email: string;
};

export function loginWithPassword(staffId: string, password: string): Promise<LoginResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as LoginResult))
      .withFailureHandler((error) => reject(toError(error)))
      .loginWithPassword(staffId, password);
  });
}

export function gasLogout(sessionId: string): Promise<void> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler(() => resolve())
      .withFailureHandler((error) => reject(toError(error)))
      .logout(sessionId);
  });
}

export function getSessionUser(sessionId: string): Promise<SessionUser | null> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as SessionUser | null))
      .withFailureHandler((error) => reject(toError(error)))
      .getSessionUser(sessionId);
  });
}

export function changeOwnPasswordForFrontend(currentPassword: string, newPassword: string): Promise<void> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler(() => resolve())
      .withFailureHandler((error) => reject(toError(error)))
      .changeOwnPasswordForFrontend(getStoredSessionId(), currentPassword, newPassword);
  });
}

export type SharedInventoryItem = {
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

export function getSharedInventory(forceRefresh?: boolean): Promise<readonly SharedInventoryItem[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as SharedInventoryItem[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getSharedInventoryForFrontend(getStoredSessionId(), forceRefresh === true);
  });
}

export type QuoteRecord = {
  quoteId: string;
  leadId: string;
  customerId: string;
  customerName: string;
  orderId: string;
  staffId: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
  currency: string;
  exchangeRate: number | null;
  subtotal: number | null;
  shippingFee: number | null;
  discount: number | null;
  totalAmount: number | null;
  totalAmountJpy: number | null;
  pdfUrl: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type QuoteLineRecord = {
  quoteLineId: string;
  quoteId: string;
  lineNo: number | null;
  productId: string;
  productName: string;
  description: string;
  condition: string;
  weight: number | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  note: string;
};

export type QuoteDetailRecord = { quote: QuoteRecord; lines: QuoteLineRecord[] };

export type OrderRecord = {
  orderId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceIssuedAt: string;
  paymentMethod: string;
  invoiceTotal: string;
  currency: string;
  paymentDueAt: string;
  paymentStatus: string;
  invoiceTotalJpy: string;
  status: string;
  paymentConfirmedAt: string;
};

export function getCoreQuotes(forceRefresh?: boolean): Promise<readonly QuoteRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as QuoteRecord[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreQuotesForFrontend(getStoredSessionId(), forceRefresh === true);
  });
}

export function getCoreQuoteDetail(quoteId: string): Promise<QuoteDetailRecord | null> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (value === null) { resolve(null); return; }
        if (typeof value !== 'object' || Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as QuoteDetailRecord);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreQuoteForFrontend(getStoredSessionId(), quoteId);
  });
}

export type OrderDetailRecord = {
  order: {
    ORDER_ID: string;
    INVOICE_NUMBER: string;
    ORDER_DATE: string;
    CUSTOMER_ID: string;
    customerName: string;
    awaitingPaymentStatus: string;
    shippingDestinationName: string;
    shippingAddressLine1: string;
    shippingAddressLine2: string;
    shippingAddressLine3: string;
    shippingCity: string;
    shippingState: string;
    shippingZip: string;
    shippingCountry: string;
    paymentDestinationName: string;
    INVOICE_ISSUED_AT: string;
    PAYMENT_DUE_AT: string;
    PAYMENT_METHOD: string;
    CURRENCY: string;
    EXCHANGE_RATE: string | number;
    LINE_TOTAL: string | number;
    SHIPPING_FEE: string | number;
    DUTY: string | number;
    DISCOUNT: string | number;
    OTHER_FEE: string | number;
    INVOICE_TOTAL: string | number;
    INVOICE_TOTAL_JPY: string | number;
    PAYMENT_STATUS: string;
    STATUS: string;
    PAYMENT_CONFIRMED_AT: string;
    SHIPPING_NOTE: string;
    NOTE: string;
    TRANSACTION_NOTE: string;
    INTERNAL_NOTE: string;
    CANCELLATION_REASON: string;
    CANCELLATION_NOTE: string;
    REGISTERED_AT: string;
    UPDATED_AT: string;
  };
  lines: Array<{
    ORDER_LINE_ID: string;
    LINE_NUMBER: string | number;
    CATEGORY: string;
    PRODUCT_NAME: string;
    STATUS: string;
    SKU: string;
    QUANTITY: string | number;
    UNIT_PRICE: string | number;
    SUBTOTAL: string | number;
    PRODUCT_ID: string;
  }>;
  purchases: Array<{
    PURCHASE_ID: string;
    ORDERED_AT: string;
    TRANSACTION_NUMBER: string;
    SUPPLIER: string;
    SUPPLIER_URL: string;
    QUANTITY: string | number;
    UNIT_PRICE: string | number;
    AMOUNT: string | number;
    SHIPPING_OR_AGENCY_FEE: string | number;
    CARRIER: string;
    TRACKING_NUMBER: string;
    STATUS: string;
    NOTE: string;
  }>;
  shipments: Array<{
    SHIPMENT_ID: string;
    BOX_NUMBER: string | number;
    SHIPPING_METHOD: string;
    SHIPPED_AT: string;
    TRACKING_NUMBER: string;
    WEIGHT: string | number;
    PICKUP_REQUEST: string;
    NOTE: string;
  }>;
};

export function getCoreOrderDetail(orderId: string): Promise<OrderDetailRecord | null> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => {
        const v = value as OrderDetailRecord | { success: false } | null;
        if (v && typeof v === 'object' && 'success' in v && (v as { success: false }).success === false) {
          resolve(null);
          return;
        }
        resolve(v as OrderDetailRecord);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreOrderDetailForFrontend(getStoredSessionId(), orderId);
  });
}

export type ConfirmPaymentResult =
  | { success: true; status: string; paymentStatus: string }
  | { success: false; reason: string };

export function confirmCoreOrderPayment(orderId: string): Promise<ConfirmPaymentResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as ConfirmPaymentResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .confirmCoreOrderPaymentForFrontend(getStoredSessionId(), orderId);
  });
}

export function getCoreOrders(forceRefresh?: boolean): Promise<readonly OrderRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as OrderRecord[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreOrdersForFrontend(getStoredSessionId(), forceRefresh === true);
  });
}

export type OrderStatusOption = {
  key: string;
  label: string;
};

export function getCoreOrderStatusOptions(): Promise<readonly OrderStatusOption[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as OrderStatusOption[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreOrderStatusOptionsForFrontend(getStoredSessionId());
  });
}

export type CurrencyRecord = {
  currencyCode: string;
  symbol: string;
  name: string;
  rateToJpy: number | null;
};

export type LeadOption = { leadId: string; customerName: string };

export function getLeadOptionsForFrontend(): Promise<readonly LeadOption[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as LeadOption[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getLeadOptionsForFrontend(getStoredSessionId());
  });
}

export function getCoreCurrencies(): Promise<readonly CurrencyRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as CurrencyRecord[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreCurrenciesForFrontend(getStoredSessionId());
  });
}

export type QuoteLinePayload = {
  lineNo: number;
  productId?: string;
  productName: string;
  description: string;
  condition?: string;
  quantity: number | null;
  unitPrice: number | null;
  note: string;
};

export type QuotePayload = {
  leadId: string;
  currency: string;
  shippingFee: number | null;
  discount: number | null;
  note: string;
  lines: QuoteLinePayload[];
};

export type QuoteCreateResult = { success: true; quoteId: string; message?: string };

export function createCoreQuote(payload: QuotePayload, isDraft: boolean): Promise<QuoteCreateResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { success?: boolean; quoteId?: string };
        if (!v || v.success !== true || typeof v.quoteId !== 'string') {
          reject(new Error(errorCopy.communication)); return;
        }
        resolve(v as QuoteCreateResult);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .createCoreQuoteForFrontend(getStoredSessionId(), payload as unknown, isDraft);
  });
}

export function updateCoreQuote(quoteId: string, payload: QuotePayload, isDraft: boolean): Promise<{ success: true }> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { success?: boolean };
        if (!v || v.success !== true) {
          reject(new Error(errorCopy.communication)); return;
        }
        resolve(v as { success: true });
      })
      .withFailureHandler((error) => reject(toError(error)))
      .updateCoreQuoteForFrontend(getStoredSessionId(), quoteId, payload as unknown, isDraft);
  });
}

export type InventoryProductOption = {
  productId: string;
  productName: string;
  category: string;
};

export type InventoryConditionOption = {
  condition: string;
  quantity: number;
  unitPrice: number;
  unitWeight: number;
};

export function getInventoryProductOptions(): Promise<readonly InventoryProductOption[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as InventoryProductOption[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getInventoryProductOptions(getStoredSessionId());
  });
}

export function getInventoryConditions(productId: string): Promise<readonly InventoryConditionOption[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as InventoryConditionOption[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getInventoryConditions(getStoredSessionId(), productId);
  });
}

export type SyncSignals = {
  leads: string | null;
  quotes: string | null;
  orders: string | null;
  inventory: string | null;
  staff: string | null;
  customers: string | null;
  issuer: string | null;
  discord: string | null;
  inbox: string | null;
};

export function checkSyncSignals(): Promise<SyncSignals> {
  const runner = window.google?.script?.run;
  if (!runner) {
    return Promise.resolve({ leads: null, quotes: null, orders: null, inventory: null, staff: null, customers: null, issuer: null, discord: null, inbox: null });
  }
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as SyncSignals))
      .withFailureHandler((error) => reject(toError(error)))
      .checkSyncSignals(getStoredSessionId());
  });
}

export { OrderCreatePayload, OrderCreateResult };

export function createCoreOrder(payload: OrderCreatePayload): Promise<OrderCreateResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { success?: boolean; orderId?: string };
        if (!v || v.success !== true || typeof v.orderId !== 'string') {
          reject(new Error(errorCopy.communication)); return;
        }
        resolve(v as OrderCreateResult);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .createCoreOrderForFrontend(getStoredSessionId(), payload as unknown);
  });
}

export function updateCoreOrder(orderId: string, payload: OrderUpdatePayload): Promise<OrderUpdateResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { success?: boolean; orderId?: string };
        if (!v || v.success !== true || typeof v.orderId !== 'string') {
          reject(new Error(errorCopy.communication)); return;
        }
        resolve(v as OrderUpdateResult);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .updateCoreOrderForFrontend(getStoredSessionId(), orderId, payload as unknown);
  });
}

export type LeadFormCountry = {
  name: string;
  dialCode: string;
  stateRequired: boolean;
  postalRequired: boolean;
};

export type LeadSource = {
  sourceId: string;
  name: string;
  isInbound: boolean;
  isOutbound: boolean;
};

export type LeadFormOptions = {
  leadTypes: readonly string[];
  responseSpeeds: readonly string[];
  countries: readonly LeadFormCountry[];
  leadSources: readonly LeadSource[];
};

export function getLeadFormOptions(): Promise<LeadFormOptions> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!value || typeof value !== 'object') { reject(new Error(errorCopy.communication)); return; }
        resolve(value as LeadFormOptions);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getLeadFormOptions(getStoredSessionId());
  });
}

export type IssuerRecord = Record<string, string | boolean | number>;

export function getCoreIssuer(): Promise<IssuerRecord> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { success?: boolean; issuer?: IssuerRecord } | null;
        if (!v || typeof v !== 'object' || v.success !== true || !v.issuer || typeof v.issuer !== 'object') {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(v.issuer);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreIssuerForFrontend(getStoredSessionId());
  });
}

export function getInboxConversations(forceRefresh?: boolean): Promise<readonly InboxConversationDto[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as InboxConversationDto[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getInboxConversationsForFrontend(getStoredSessionId(), forceRefresh === true);
  });
}

export function getInboxConversationDetail(leadId: string): Promise<InboxConversationDetailDto | null> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (value === null) { resolve(null); return; }
        if (typeof value !== 'object' || Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as InboxConversationDetailDto);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getInboxConversationDetailForFrontend(getStoredSessionId(), leadId);
  });
}

export function updateCoreIssuer(issuerData: IssuerRecord): Promise<void> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { success?: boolean } | null;
        if (!v || v.success !== true) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve();
      })
      .withFailureHandler((error) => reject(toError(error)))
      .updateCoreIssuerForFrontend(getStoredSessionId(), issuerData as unknown);
  });
}

// ============================================================
// Discord integration settings
// ============================================================

export type DiscordSaveResult = { success: boolean; error?: string };
export type DiscordConnectionStatus = {
  isTokenSet: boolean;
  tokenMask: string;
  botName: string;
  botId: string;
  connected: boolean;
  clientId: string;
};
export type DiscordChannelsResult = { channels: string[] };

export function saveDiscordBotToken(token: string): Promise<DiscordSaveResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DiscordSaveResult))
      .withFailureHandler((error) => reject(toError(error)))
      .saveDiscordBotToken(getStoredSessionId(), token);
  });
}

export function saveDiscordClientId(clientId: string): Promise<DiscordSaveResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DiscordSaveResult))
      .withFailureHandler((error) => reject(toError(error)))
      .saveDiscordClientId(getStoredSessionId(), clientId);
  });
}

export function getDiscordConnectionStatus(): Promise<DiscordConnectionStatus> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DiscordConnectionStatus))
      .withFailureHandler((error) => reject(toError(error)))
      .getDiscordConnectionStatusForFrontend(getStoredSessionId());
  });
}

export function saveDiscordChannels(channelIds: string[]): Promise<DiscordSaveResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DiscordSaveResult))
      .withFailureHandler((error) => reject(toError(error)))
      .saveDiscordChannels(getStoredSessionId(), channelIds as unknown);
  });
}

export function getDiscordChannels(): Promise<DiscordChannelsResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { channels?: unknown } | null;
        if (!v || !Array.isArray(v.channels)) {
          resolve({ channels: [] });
          return;
        }
        resolve({ channels: v.channels as string[] });
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getDiscordChannelsForFrontend(getStoredSessionId());
  });
}

// ============================================================
// Discord OAuth Bot invite flow
// ============================================================

export type DiscordOAuthUrlResult = { success: boolean; url?: string; error?: string };
export type DiscordOAuthStatusResult = {
  status: 'linked' | 'unlinked' | 'multiple' | 'error';
  guildId: string | null;
  guilds: readonly { id: string; name: string }[];
  error?: string;
};

export function generateDiscordOAuthUrl(): Promise<DiscordOAuthUrlResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DiscordOAuthUrlResult))
      .withFailureHandler((error) => reject(toError(error)))
      .generateDiscordOAuthUrl(getStoredSessionId());
  });
}

export function getDiscordOAuthStatus(): Promise<DiscordOAuthStatusResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DiscordOAuthStatusResult))
      .withFailureHandler((error) => reject(toError(error)))
      .getDiscordOAuthStatus(getStoredSessionId());
  });
}

export function saveDiscordGuildId(guildId: string): Promise<DiscordSaveResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DiscordSaveResult))
      .withFailureHandler((error) => reject(toError(error)))
      .saveDiscordGuildId(getStoredSessionId(), guildId);
  });
}

// ============================================================
// Discord channel setup (auto-setup)
// ============================================================

export type DiscordAutoSetupResult = {
  success: boolean;
  categoryId?: string;
  ticketChannelId?: string;
  error?: string;
};

export type DiscordSetupStatus = {
  guildId: string | null;
  categoryId: string | null;
  ticketChannelId: string | null;
};
export type DiscordTicketResult = { success: boolean; reused?: boolean; channelId?: string; channelName?: string; error?: string; };
export function createDiscordTicketForCustomer(customerId: string): Promise<DiscordTicketResult> { const runner = window.google?.script?.run; if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly)); return new Promise((resolve, reject) => { runner.withSuccessHandler((value) => resolve(value as DiscordTicketResult)).withFailureHandler((error) => reject(toError(error))).createDiscordTicketForCustomer(getStoredSessionId(), customerId); }); }

export function runDiscordAutoSetup(): Promise<DiscordAutoSetupResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DiscordAutoSetupResult))
      .withFailureHandler((error) => reject(toError(error)))
      .runDiscordAutoSetup(getStoredSessionId());
  });
}

export function getDiscordSetupStatus(): Promise<DiscordSetupStatus> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { guildId?: unknown; categoryId?: unknown; ticketChannelId?: unknown } | null;
        resolve({
          guildId: (v?.guildId as string | null) ?? null,
          categoryId: (v?.categoryId as string | null) ?? null,
          ticketChannelId: (v?.ticketChannelId as string | null) ?? null,
        });
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getDiscordSetupStatus(getStoredSessionId());
  });
}

// --- Purchase API ---

export type PurchaseStatusOption = { key: string; label: string };

export type UpsertPurchasePayload = {
  orderId: string;
  purchaseId?: string;
  orderedAt?: string;
  supplier?: string;
  supplierUrl?: string;
  quantity?: string;
  unitPrice?: string;
  amount?: string;
  shippingOrAgencyFee?: string;
  carrier?: string;
  trackingNumber?: string;
  status?: string;
  note?: string;
};

export function getCorePurchaseStatusOptions(): Promise<readonly PurchaseStatusOption[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as PurchaseStatusOption[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCorePurchaseStatusOptionsForFrontend(getStoredSessionId());
  });
}

export type UpsertPurchaseResult = { success: true; purchaseId: string };

export function upsertCorePurchase(payload: UpsertPurchasePayload): Promise<UpsertPurchaseResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertPurchaseResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCorePurchaseForFrontend(getStoredSessionId(), payload);
  });
}
