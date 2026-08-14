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
