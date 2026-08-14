import { errorCopy, leadsCopy } from '../content/ja';

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
      .getDashboardKPIs();
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
      .getCurrentUser();
  });
}

export function getLeadsByType(leadType: LeadType): Promise<LeadRecord[]> {
  const runner = window.google?.script?.run;
  if (!runner) return Promise.reject(new Error(errorCopy.appsScriptOnly));

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => {
        if (!Array.isArray(value)) {
          reject(new Error(errorCopy.communication));
          return;
        }
        resolve(value as LeadRecord[]);
      })
      .withFailureHandler((error) => reject(toError(error)))
      .getLeadsByType(leadType);
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
      .getLeadDetail(leadId);
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
      .createLead(leadData);
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
      .updateLead(sheetName, leadId, updateData);
  });
}
