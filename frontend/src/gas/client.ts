import { errorCopy, leadsCopy } from '../content/ja';
import type { CustomerAggregateDto, CustomerAggregatesRecord, CustomerSummaryDto } from '../features/customers/contracts';
import type { InboxBulkInitialLoadDto, InboxConversationDetailDto, InboxConversationDto, InboxMessageDto } from '../features/inbox/contracts';
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

export type LeadsBatchRecord = {
  leads: readonly LeadRecord[];
  formOptions: LeadFormOptions;
};

export function getLeadsBatch(forceRefresh?: boolean): Promise<LeadsBatchRecord> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { leads: unknown; formOptions: unknown };
        if (!v || !Array.isArray(v.leads) || !v.formOptions || typeof v.formOptions !== 'object') {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve({ leads: v.leads as LeadRecord[], formOptions: v.formOptions as LeadFormOptions });
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getLeadsBatchForFrontend(getStoredSessionId(), forceRefresh === true);
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
  /** Number of purchase rows for this order. Available from cache V4. */
  purchaseCount?: number;
  /** Key of the least-advanced purchase status (e.g. 'NOT_ORDERED', 'ORDERED'). Empty string when purchaseCount is 0. Available from cache V4. */
  purchaseStatus?: string;
  /** ISO2 country code of the shipping destination (e.g. 'JP', 'US'). Empty string when absent. */
  shippingCountry?: string;
  /** Japanese name of the shipping destination country. Falls back to ISO2 code when not found in country master. Empty string when absent. */
  shippingCountryJa?: string;
  /** Key of the least-advanced shipment stage (e.g. 'NOT_STARTED', 'PREPARING', 'DONE'). */
  shipmentStage?: string;
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
    shippingRecipientName: string;
    shippingAddressLine1: string;
    shippingAddressLine2: string;
    shippingAddressLine3: string;
    shippingCity: string;
    shippingState: string;
    shippingZip: string;
    shippingCountry: string;
    paymentDestinationName: string;
    billingAddressLine1: string;
    billingAddressLine2: string;
    billingAddressLine3: string;
    billingCity: string;
    billingState: string;
    billingZip: string;
    billingCountry: string;
    billingTaxId: string;
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
    ENGLISH_TITLE: string;
    /** @deprecated Legacy column. Prefer CONDITION for display. */
    STATUS: string;
    CONDITION: string;
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
    LENGTH: string | number;
    WIDTH: string | number;
    HEIGHT: string | number;
    WEIGHT: string | number;
    ESTIMATED_SHIPPING_FEE: string | number;
    LABEL_URL: string;
    INVOICE_URL: string;
    INSPECTION: string;
    PACKING: string;
    STORAGE: string;
    PICKUP_REQUEST: string;
    NOTIFICATION: string;
    SHIPPING_ASSIGNEE_ID: string;
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

export type OrdersBatchRecord = {
  orders: readonly OrderRecord[];
  statusOptions: readonly OrderStatusOption[];
};

export function getCoreOrdersBatch(forceRefresh?: boolean): Promise<OrdersBatchRecord> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as OrdersBatchRecord);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getCoreOrdersBatchForFrontend(getStoredSessionId(), forceRefresh === true);
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

export type LeadOption = { leadId: string; customerName: string; countryCode: string };

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

export type InventoryBatchRecord = {
  inventory: readonly SharedInventoryItem[];
  productOptions: readonly InventoryProductOption[];
};

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

export function getInventoryBatch(forceRefresh?: boolean): Promise<InventoryBatchRecord> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        const v = value as { inventory: unknown; productOptions: unknown };
        if (!v || !Array.isArray(v.inventory) || !Array.isArray(v.productOptions)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve({ inventory: v.inventory as SharedInventoryItem[], productOptions: v.productOptions as InventoryProductOption[] });
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getInventoryBatchForFrontend(getStoredSessionId(), forceRefresh === true);
  });
}

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
  inbox: string | null;
};

export function checkSyncSignals(): Promise<SyncSignals> {
  const runner = window.google?.script?.run;
  if (!runner) {
    return Promise.resolve({ leads: null, quotes: null, orders: null, inventory: null, staff: null, customers: null, issuer: null, inbox: null });
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
  contactMethods?: readonly string[];
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

export function pingForLatencyCheck(): Promise<{ ok: boolean; serverTs: number }> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as { ok: boolean; serverTs: number }))
      .withFailureHandler((error) => reject(toError(error)))
      .pingForLatencyCheck();
  });
}

export function getInboxBulkLoad(): Promise<InboxBulkInitialLoadDto> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) { reject(new Error(errorCopy.communication)); return; }
        resolve(value as InboxBulkInitialLoadDto);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getInboxBulkInitialLoad(getStoredSessionId(), 0, 0);
  });
}

export function getInboxMoreMessagesChunk(conversationId: string, offsetIndex: number): Promise<{ messages: readonly InboxMessageDto[]; hasMore: boolean }> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!value || typeof value !== 'object') { reject(new Error(errorCopy.communication)); return; }
        const result = value as { conversationId: string; messages: InboxMessageDto[]; hasMore: boolean };
        resolve({ messages: result.messages, hasMore: result.hasMore });
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getInboxMoreMessages(getStoredSessionId(), conversationId, offsetIndex, 0);
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

// ─── Package Master ───────────────────────────────────────────────────────────

export type SizeRecord = { sizeId: string; sizeName: string; length: string; width: string; height: string; isActive: string };
export type WeightRecord = { weightId: string; weightName: string; weight: string; isActive: string };
export type PackageRecord = {
  packageId: string; packageName: string; unit: string; quantityPerUnit: string; isActive: string;
  sizeId: string; sizeName: string; length: string; width: string; height: string;
  weightId: string; weightName: string; weight: string;
};

export function getCoreSizes(): Promise<SizeRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as SizeRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreSizesForFrontend(getStoredSessionId());
  });
}

export function getCoreWeights(): Promise<WeightRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as WeightRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreWeightsForFrontend(getStoredSessionId());
  });
}

export function getCorePackages(): Promise<PackageRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as PackageRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCorePackagesForFrontend(getStoredSessionId());
  });
}

export function getCorePackageUnitOptions(): Promise<string[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as string[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCorePackageUnitOptionsForFrontend();
  });
}

export type UpsertSizePayload = { sizeId?: string; sizeName?: string; length?: string; width?: string; height?: string; isActive?: boolean };
export type UpsertSizeResult = { success: true; sizeId: string };

export function upsertCoreSize(payload: UpsertSizePayload): Promise<UpsertSizeResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertSizeResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreSizeForFrontend(getStoredSessionId(), payload);
  });
}

export type UpsertWeightPayload = { weightId?: string; weightName?: string; weight?: string; isActive?: boolean };
export type UpsertWeightResult = { success: true; weightId: string };

export function upsertCoreWeight(payload: UpsertWeightPayload): Promise<UpsertWeightResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertWeightResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreWeightForFrontend(getStoredSessionId(), payload);
  });
}

export type UpsertPackagePayload = { packageId?: string; packageName?: string; unit?: string; quantityPerUnit?: string; sizeId?: string; weightId?: string; isActive?: boolean };
export type UpsertPackageResult = { success: true; packageId: string };

export function upsertCorePackage(payload: UpsertPackagePayload): Promise<UpsertPackageResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertPackageResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCorePackageForFrontend(getStoredSessionId(), payload);
  });
}

// ─── Own Master ───────────────────────────────────────────────────────────────

export type OwnCategoryRecord = { categoryId: string; nameEn: string; nameJa: string; isActive: string };
export type OwnWorkRecord     = { workId: string; nameEn: string; nameJa: string; isActive: string };
export type OwnManufacturerRecord = { manufacturerId: string; nameEn: string; nameJa: string; isActive: string };

export function getCoreOwnCategories(): Promise<OwnCategoryRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as OwnCategoryRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreOwnCategoriesForFrontend(getStoredSessionId());
  });
}

export function getCoreOwnWorks(): Promise<OwnWorkRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as OwnWorkRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreOwnWorksForFrontend(getStoredSessionId());
  });
}

export function getCoreOwnManufacturers(): Promise<OwnManufacturerRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as OwnManufacturerRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreOwnManufacturersForFrontend(getStoredSessionId());
  });
}

export type UpsertOwnCategoryPayload = { categoryId?: string; nameEn?: string; nameJa?: string; isActive?: boolean };
export type UpsertOwnCategoryResult  = { success: true; categoryId: string };

export function upsertCoreOwnCategory(payload: UpsertOwnCategoryPayload): Promise<UpsertOwnCategoryResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertOwnCategoryResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreOwnCategoryForFrontend(getStoredSessionId(), payload);
  });
}

export type UpsertOwnWorkPayload = { workId?: string; nameEn?: string; nameJa?: string; isActive?: boolean };
export type UpsertOwnWorkResult  = { success: true; workId: string };

export function upsertCoreOwnWork(payload: UpsertOwnWorkPayload): Promise<UpsertOwnWorkResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertOwnWorkResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreOwnWorkForFrontend(getStoredSessionId(), payload);
  });
}

export type UpsertOwnManufacturerPayload = { manufacturerId?: string; nameEn?: string; nameJa?: string; isActive?: boolean };
export type UpsertOwnManufacturerResult  = { success: true; manufacturerId: string };

export function upsertCoreOwnManufacturer(payload: UpsertOwnManufacturerPayload): Promise<UpsertOwnManufacturerResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertOwnManufacturerResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreOwnManufacturerForFrontend(getStoredSessionId(), payload);
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

export type UpsertShipmentPayload = {
  orderId: string;
  shipmentId?: string;
  boxNumber?: string;
  shippingMethod?: string;
  shippedAt?: string;
  trackingNumber?: string;
  length?: string;
  width?: string;
  height?: string;
  weight?: string;
  estimatedShippingFee?: string;
  inspection?: string;
  packing?: string;
  storage?: string;
  pickupRequest?: string;
  notification?: string;
  note?: string;
};

export type UpsertShipmentResult = { success: true; shipmentId: string };

export function upsertCoreShipment(payload: UpsertShipmentPayload): Promise<UpsertShipmentResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertShipmentResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreShipmentForFrontend(getStoredSessionId(), payload);
  });
}

export type UploadShipmentFilePayload = {
  shipmentId: string;
  fileType: 'label' | 'invoice';
  fileBase64: string;
};

export type UploadShipmentFileResult = { success: true; url: string };

export function uploadCoreShipmentFile(payload: UploadShipmentFilePayload): Promise<UploadShipmentFileResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UploadShipmentFileResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .uploadCoreShipmentFileForFrontend(getStoredSessionId(), payload);
  });
}

// ─── Product Master ───────────────────────────────────────────────────────────

export type SharedProductRecord = {
  productId: string; englishTitle: string; japaneseTitle: string;
  category: string; item: string; hsCode: string; material: string;
};

export type ProductPackageRecord = {
  productPackageId: string;
  sharedProductId: string; sharedProductEnglishTitle: string; sharedProductJapaneseTitle: string;
  ownProductId: string; ownProductNameEn: string; ownProductNameJa: string;
  casePackageId: string; casePackageName: string;
  boxPackageId: string;  boxPackageName: string;
  packPackageId: string; packPackageName: string;
  itemId: string; itemNameEn: string; itemNameJa: string;
  htsCodeId: string; htsCode: string; htsDescriptionEn: string;
  materialId: string; materialNameEn: string; materialNameJa: string;
  isActive: string;
};

export type OwnProductRecord = {
  ownProductId: string;
  sharedProductId: string; sharedProductEnglishTitle: string; sharedProductJapaneseTitle: string;
  nameEn: string; nameJa: string;
  ownCategoryId: string; categoryNameEn: string; categoryNameJa: string;
  ownWorkId: string; workNameEn: string; workNameJa: string;
  ownManufacturerId: string; manufacturerNameEn: string; manufacturerNameJa: string;
  note: string; isActive: string;
};

export type UpsertProductPackagePayload = {
  productPackageId?: string;
  sharedProductId?: string; ownProductId?: string;
  casePackageId?: string; boxPackageId?: string; packPackageId?: string;
  itemId?: string; htsCodeId?: string; materialId?: string;
  isActive?: boolean;
};
export type UpsertProductPackageResult = { success: true; productPackageId: string };

export type UpsertOwnProductWithPackagePayload = {
  product: {
    ownProductId?: string;
    sharedProductId?: string; nameEn?: string; nameJa?: string;
    ownCategoryId?: string; ownWorkId?: string; ownManufacturerId?: string;
    note?: string; isActive?: boolean;
  };
  package?: {
    productPackageId?: string;
    casePackageId?: string; boxPackageId?: string; packPackageId?: string;
    itemId?: string; htsCodeId?: string; materialId?: string;
    isActive?: boolean;
  };
};
export type UpsertOwnProductWithPackageResult = {
  success: true; ownProductId: string; productPackageId: string | null; failedStep: null;
};

export function getCoreSharedProducts(): Promise<SharedProductRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as SharedProductRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreSharedProductsForFrontend(getStoredSessionId());
  });
}

export function getCoreProductPackages(): Promise<ProductPackageRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as ProductPackageRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreProductPackagesForFrontend(getStoredSessionId());
  });
}

export function upsertCoreProductPackage(payload: UpsertProductPackagePayload): Promise<UpsertProductPackageResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertProductPackageResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreProductPackageForFrontend(getStoredSessionId(), payload);
  });
}

export function getCoreOwnProducts(): Promise<OwnProductRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as OwnProductRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreOwnProductsForFrontend(getStoredSessionId());
  });
}

export function upsertCoreOwnProductWithPackage(payload: UpsertOwnProductWithPackagePayload): Promise<UpsertOwnProductWithPackageResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertOwnProductWithPackageResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreOwnProductWithPackageForFrontend(getStoredSessionId(), payload);
  });
}

export type AdvanceShipmentResult =
  | { success: true; newStage: string; needsInput?: true }
  | { success: false; error: string };

export function advanceCoreShipmentStage(orderId: string): Promise<AdvanceShipmentResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as AdvanceShipmentResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .advanceCoreShipmentStageForFrontend(getStoredSessionId(), orderId);
  });
}

export type ShippingFeeBox = {
  length: number;
  width: number;
  height: number;
  actualWeight: number;
};

export type ShippingFeeCarrierResult = {
  carrierId: string;
  carrierName: string;
  zone: string | null;
  totalFee: number | null;
  boxes: Array<{ chargeableWeight: number; fee: number }>;
  error: string | null;
  calcSource: string;
  feeType: string;
};

export type EstimateShippingFeePayload = {
  countryCode: string;
  postalCode?: string;
  boxes: ShippingFeeBox[];
  linkType: 'QUOTE' | 'INVOICE' | 'SHIPMENT';
  linkId: string;
  save?: boolean;
};

export type EstimateShippingFeeResult = { success: true; results: ShippingFeeCarrierResult[] };

export function estimateShippingFee(payload: EstimateShippingFeePayload): Promise<EstimateShippingFeeResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as EstimateShippingFeeResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .estimateShippingFeeForFrontend(getStoredSessionId(), payload);
  });
}

export type ShippingFeeSkippedLine = {
  productId: string;
  condition: string;
  reason: string;
};

export type ShippingFeeEstimateResult =
  | { success: true; results: ShippingFeeCarrierResult[]; skipped: ShippingFeeSkippedLine[] }
  | { success: false; reason: string; skipped: ShippingFeeSkippedLine[] };

/** @deprecated Use ShippingFeeSkippedLine */
export type QuoteShippingFeeSkippedLine = ShippingFeeSkippedLine;
/** @deprecated Use ShippingFeeEstimateResult */
export type QuoteShippingFeeResult = ShippingFeeEstimateResult;

export function estimateShippingFeeForQuote(quoteId: string): Promise<QuoteShippingFeeResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as QuoteShippingFeeResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .estimateShippingFeeForQuoteForFrontend(getStoredSessionId(), quoteId);
  });
}

export function estimateShippingFeeForOrder(orderId: string): Promise<ShippingFeeEstimateResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as ShippingFeeEstimateResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .estimateShippingFeeForOrderForFrontend(getStoredSessionId(), orderId);
  });
}

export type EstimateShippingFeeForLinesPayload = {
  lines: { productId: string; condition: string; quantity: number }[];
  countryCode: string;
  postalCode?: string;
};

export function estimateShippingFeeForLines(payload: EstimateShippingFeeForLinesPayload): Promise<ShippingFeeEstimateResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as ShippingFeeEstimateResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .estimateShippingFeeForLinesForFrontend(getStoredSessionId(), payload);
  });
}

// ─── Export Master ─────────────────────────────────────────────────────────────

export type ItemRecord     = { itemId: string; nameEn: string; nameJa: string; isActive: string };
export type HtsCodeRecord  = { htsCodeId: string; htsCode: string; descriptionEn: string; descriptionJa: string; isActive: string };
export type MaterialRecord = { materialId: string; nameEn: string; nameJa: string; isActive: string };

export function getCoreItems(): Promise<ItemRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as ItemRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreItemsForFrontend(getStoredSessionId());
  });
}

export function getCoreHtsCodes(): Promise<HtsCodeRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as HtsCodeRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreHtsCodesForFrontend(getStoredSessionId());
  });
}

export function getCoreMaterials(): Promise<MaterialRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as MaterialRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreMaterialsForFrontend(getStoredSessionId());
  });
}

export type UpsertItemPayload     = { itemId?: string; nameEn?: string; nameJa?: string; isActive?: boolean };
export type UpsertItemResult      = { success: true; itemId: string };

export function upsertCoreItem(payload: UpsertItemPayload): Promise<UpsertItemResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertItemResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreItemForFrontend(getStoredSessionId(), payload);
  });
}

export type UpsertHtsCodePayload  = { htsCodeId?: string; htsCode?: string; descriptionEn?: string; descriptionJa?: string; isActive?: boolean };
export type UpsertHtsCodeResult   = { success: true; htsCodeId: string };

export function upsertCoreHtsCode(payload: UpsertHtsCodePayload): Promise<UpsertHtsCodeResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertHtsCodeResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreHtsCodeForFrontend(getStoredSessionId(), payload);
  });
}

export type UpsertMaterialPayload = { materialId?: string; nameEn?: string; nameJa?: string; isActive?: boolean };
export type UpsertMaterialResult  = { success: true; materialId: string };

export function upsertCoreMaterial(payload: UpsertMaterialPayload): Promise<UpsertMaterialResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertMaterialResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreMaterialForFrontend(getStoredSessionId(), payload);
  });
}

export type CountryRecord = { countryCode: string; displayName: string; nameJa: string; isActive: string };

export function getCoreCountries(): Promise<CountryRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as CountryRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreCountriesForFrontend(getStoredSessionId());
  });
}

// ─── Shipment Lines ────────────────────────────────────────────────────────────

export type ShipmentLineRecord = {
  shipmentLineId: string;
  shipmentId: string;
  orderLineId: string;
  lineNumber: string;
  sharedProductId: string;
  sharedProductEnglishTitle: string;
  sharedProductJapaneseTitle: string;
  ownProductId: string;
  ownProductNameEn: string;
  ownProductNameJa: string;
  itemId: string;
  itemNameEn: string;
  itemNameJa: string;
  htsCodeId: string;
  htsCode: string;
  htsCodeDescriptionEn: string;
  htsCodeDescriptionJa: string;
  materialId: string;
  materialNameEn: string;
  materialNameJa: string;
  originCountry: string;
  originCountryDisplayName: string;
  originCountryNameJa: string;
  quantity: string;
  registeredAt: string;
  updatedAt: string;
};

export function getCoreShipmentLines(shipmentId: string): Promise<ShipmentLineRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as ShipmentLineRecord[]))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getCoreShipmentLinesForFrontend(getStoredSessionId(), shipmentId);
  });
}

export type ProductExportDefaults = {
  found: boolean;
  itemId: string;
  htsCodeId: string;
  materialId: string;
  originCountry: string;
};

export type GetProductExportDefaultsPayload = {
  sharedProductId?: string;
  ownProductId?: string;
};

export function getProductExportDefaults(payload: GetProductExportDefaultsPayload): Promise<ProductExportDefaults> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as ProductExportDefaults))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .getProductExportDefaultsForFrontend(getStoredSessionId(), payload);
  });
}

export type UpsertShipmentLinePayload = {
  shipmentLineId?: string;
  shipmentId: string;
  sharedProductId?: string;
  ownProductId?: string;
  itemId?: string;
  htsCodeId?: string;
  materialId?: string;
  originCountry?: string;
  quantity?: number | string;
  saveToProductMaster?: boolean;
};

export type UpsertShipmentLineResult = {
  success: true;
  shipmentLineId: string;
  savedToProductMaster: boolean;
  failedStep: string | null;
};

export function upsertCoreShipmentLine(payload: UpsertShipmentLinePayload): Promise<UpsertShipmentLineResult> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value: unknown) => resolve(value as UpsertShipmentLineResult))
      .withFailureHandler((error: unknown) => reject(toError(error)))
      .upsertCoreShipmentLineForFrontend(getStoredSessionId(), payload);
  });
}
