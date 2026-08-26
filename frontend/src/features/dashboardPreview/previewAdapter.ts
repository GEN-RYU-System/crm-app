import { dashboardPreviewCopy } from '../../content/ja/dashboardPreview';
import type {
  DashboardPreviewRepository,
  FollowUpData,
  FunnelDto,
  GoalPeriodData,
  LeadKpiDto,
  RevenueChartPoint,
  SalesKpiDto,
} from './contracts';

// ─── helpers ────────────────────────────────────────────────────────────────

function rate(actual: number, target: number): number {
  return Math.round((actual / target) * 1000) / 10;
}

function monthLabel(offsetMonths: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getMonth() + 1}${dashboardPreviewCopy.monthSuffix}`;
}

function monthElapsedPct(): number {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.min(100, Math.floor((today.getDate() / daysInMonth) * 100));
}

const cx = dashboardPreviewCopy.fakeCustomers;
const ax = dashboardPreviewCopy.fakeAssignees;

// ─── follow-ups ─────────────────────────────────────────────────────────────

function getFollowUps(): FollowUpData {
  return {
    overdue: [
      { id: 'fu-1', customerName: cx[0], assignee: ax[0], dayOffset: -5, category: 'overdue' },
      { id: 'fu-2', customerName: cx[1], assignee: ax[1], dayOffset: -2, category: 'overdue' },
      { id: 'fu-3', customerName: cx[2], assignee: ax[2], dayOffset: -1, category: 'overdue' },
    ],
    today: [
      { id: 'fu-4', customerName: cx[3], assignee: ax[3], dayOffset: 0, category: 'today' },
      { id: 'fu-5', customerName: cx[4], assignee: ax[4], dayOffset: 0, category: 'today' },
    ],
    upcoming: [
      { id: 'fu-6', customerName: cx[5], assignee: ax[0], dayOffset: 2, category: 'upcoming' },
      { id: 'fu-7', customerName: cx[6], assignee: ax[1], dayOffset: 3, category: 'upcoming' },
      { id: 'fu-8', customerName: cx[7], assignee: ax[2], dayOffset: 5, category: 'upcoming' },
      { id: 'fu-9', customerName: cx[8], assignee: ax[3], dayOffset: 6, category: 'upcoming' },
      { id: 'fu-10', customerName: cx[9], assignee: ax[4], dayOffset: 7, category: 'upcoming' },
    ],
  };
}

// ─── goals ──────────────────────────────────────────────────────────────────

function getGoals(): GoalPeriodData {
  return {
    monthly: [
      { key: 'revenue',   unit: 'yen',   actual: 8_240_000, target: 10_000_000, achievementRate: rate(8_240_000, 10_000_000) },
      { key: 'dealCount', unit: 'count', actual: 28,        target: 35,         achievementRate: rate(28, 35) },
      { key: 'closeRate', unit: 'rate',  actual: 32,        target: 40,         achievementRate: rate(32, 40) },
    ],
    weekly: [
      { key: 'revenue',   unit: 'yen',   actual: 1_840_000, target: 2_500_000, achievementRate: rate(1_840_000, 2_500_000) },
      { key: 'dealCount', unit: 'count', actual: 7,         target: 9,         achievementRate: rate(7, 9) },
      { key: 'closeRate', unit: 'rate',  actual: 28,        target: 40,        achievementRate: rate(28, 40) },
    ],
  };
}

// ─── lead KPI ────────────────────────────────────────────────────────────────

function getLeadKpi(): LeadKpiDto {
  const totalLeads = 62;
  const converted  = 8;
  return {
    totalLeads,
    converted,
    excluded: 5,
    conversionRate: Math.round((converted / totalLeads) * 1000) / 10,
    prevPeriodChange: 15.3,
  };
}

// ─── sales / orders KPI ──────────────────────────────────────────────────────

function getSalesKpi(): SalesKpiDto {
  return {
    confirmedRevenue:      8_240_000,
    orderCount:            28,
    forecastRevenue:       9_800_000,
    openDealCount:         12,
    revenuePrevChange:     12.4,
    orderCountPrevChange:  8.0,
  };
}

// ─── revenue chart ───────────────────────────────────────────────────────────

function getRevenueChart(): readonly RevenueChartPoint[] {
  const actuals = [6_200_000, 7_800_000, 6_900_000, 8_100_000, 9_200_000];
  const currentActual    = 8_240_000;
  const currentRemaining = 1_560_000;

  return [
    ...actuals.map((actual, i) => ({
      label:     monthLabel(i - 5),
      actual,
      remaining: 0,
    })),
    { label: monthLabel(0), actual: currentActual, remaining: currentRemaining },
  ];
}

// ─── funnel ──────────────────────────────────────────────────────────────────

function getFunnel(): FunnelDto {
  const leadsActual = 62;
  const leadsTarget = 80;
  const wonActual   = 8;
  const wonTarget   = 12;
  const convActual  = 12.9;
  const convTarget  = 15.0;

  return {
    monthElapsedPct: monthElapsedPct(),
    leads: {
      actual:          leadsActual,
      target:          leadsTarget,
      achievementRate: rate(leadsActual, leadsTarget),
    },
    conversion: {
      actual:          Math.round(leadsActual * (convActual / 100)),
      target:          Math.round(leadsTarget * (convTarget / 100)),
      achievementRate: rate(convActual, convTarget),
      actualRate:      convActual,
      targetRate:      convTarget,
    },
    activeDeal: {
      count:       12,
      amount:      6_840_000,
      coveragePct: 68,
    },
    closed: {
      won:             wonActual,
      wonTarget:       wonTarget,
      wonRate:         Math.round((wonActual / leadsActual) * 1000) / 10,
      lost:            5,
      achievementRate: rate(wonActual, wonTarget),
    },
  };
}

// ─── export ──────────────────────────────────────────────────────────────────

export const dashboardPreviewRepository: DashboardPreviewRepository = {
  getFollowUps,
  getGoals,
  getLeadKpi,
  getSalesKpi,
  getRevenueChart,
  getFunnel,
};
