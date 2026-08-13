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

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String(error.message));
  }
  return new Error('サーバーとの通信に失敗しました。');
}

export function getDashboardKpis(): Promise<DashboardKpis> {
  const runner = window.google?.script?.run;
  if (!runner) {
    return Promise.reject(new Error('Apps Script の画面として開いてください。'));
  }

  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler((value) => resolve(value as DashboardKpis))
      .withFailureHandler((error) => reject(toError(error)))
      .getDashboardKPIs();
  });
}
