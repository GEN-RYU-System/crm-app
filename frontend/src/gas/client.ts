import { errorCopy, leadsCopy } from '../content/ja';
import type { CustomerAggregateDto, CustomerAggregatesRecord, CustomerSummaryDto } from '../features/customers/contracts';
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
  conditions: readonly InventoryConditionOption[];
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
};

export function checkSyncSignals(): Promise<SyncSignals> {
  const runner = window.google?.script?.run;
  if (!runner) {
    return Promise.resolve({ leads: null, quotes: null, orders: null, inventory: null, staff: null, customers: null });
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
