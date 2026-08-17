import { errorCopy, leadsCopy } from '../content/ja';
import type { CustomerAggregateDto, CustomerSummaryDto } from '../features/customers/contracts';
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

export function getLeadsByType(leadType?: LeadType): Promise<LeadRecord[]> {
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

    call.getLeadsByType(getStoredSessionId(), leadType);
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

export function getCoreCustomers(): Promise<readonly CustomerSummaryDto[]> {
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
      .getCoreCustomersForFrontend(getStoredSessionId());
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

export function getCoreStaff(): Promise<readonly StaffSummaryDto[]> {
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
      .getCoreStaffForFrontend(getStoredSessionId());
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
