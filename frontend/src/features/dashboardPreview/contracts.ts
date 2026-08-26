// ─── Follow-up ──────────────────────────────────────────────────────────────
export type FollowUpCategory = 'overdue' | 'today' | 'upcoming';

export type FollowUpItem = {
  id: string;
  customerName: string;
  assignee: string;
  /** Offset in calendar days relative to today. negative=overdue, 0=today, positive=upcoming */
  dayOffset: number;
  category: FollowUpCategory;
};

export type FollowUpData = {
  overdue: readonly FollowUpItem[];
  today: readonly FollowUpItem[];
  upcoming: readonly FollowUpItem[];
};

// ─── Goals ──────────────────────────────────────────────────────────────────
export type GoalUnit = 'yen' | 'count' | 'rate';

export type GoalEntry = {
  key: 'revenue' | 'dealCount' | 'closeRate';
  unit: GoalUnit;
  actual: number;
  target: number;
  /** Pre-computed: (actual / target) * 100, capped at 200 for display */
  achievementRate: number;
};

export type GoalPeriodData = {
  monthly: readonly GoalEntry[];
  weekly: readonly GoalEntry[];
};

// ─── Lead KPI ────────────────────────────────────────────────────────────────
export type LeadKpiDto = {
  totalLeads: number;
  converted: number;
  excluded: number;
  /** Pre-computed: (converted / totalLeads) * 100 */
  conversionRate: number;
  /** Percentage change vs previous period. positive=up, negative=down */
  prevPeriodChange: number;
};

// ─── Sales / Orders KPI ──────────────────────────────────────────────────────
export type SalesKpiDto = {
  confirmedRevenue: number;
  orderCount: number;
  forecastRevenue: number;
  openDealCount: number;
  revenuePrevChange: number;
  orderCountPrevChange: number;
};

// ─── Revenue chart ───────────────────────────────────────────────────────────
export type RevenueChartPoint = {
  /** Month label for X-axis display (e.g. "3M" or localized equivalent from content/ja) */
  label: string;
  actual: number;
  /** Positive only for current month; 0 otherwise */
  remaining: number;
};

// ─── Funnel ──────────────────────────────────────────────────────────────────
export type FunnelStageDto = {
  actual: number;
  target: number;
  /** Pre-computed: (actual / target) * 100 */
  achievementRate: number;
};

export type FunnelDto = {
  monthElapsedPct: number;
  leads: FunnelStageDto;
  conversion: FunnelStageDto & { actualRate: number; targetRate: number };
  activeDeal: { count: number; amount: number; coveragePct: number };
  closed: { won: number; wonTarget: number; wonRate: number; lost: number; achievementRate: number };
};

// ─── AI Recommendations (priority prospects) ─────────────────────────────────
export type AiRecommendedProspect = {
  id: string;
  customerName: string;
  /** Priority score 0–100 */
  score: number;
  /** Short reason displayed as a tag */
  reason: string;
  stage: string;
  assignee: string;
};

export type AiRecommendationData = {
  /** Localized date string supplied by content/ja (e.g. "2026\u5e748\u670826\u65e5 \u66f4\u65b0") */
  updatedAt: string;
  prospects: readonly AiRecommendedProspect[];
};

// ─── Weekly Advisor ───────────────────────────────────────────────────────────
export type AdvisorCardCategory = 'action' | 'alert' | 'insight';

export type WeeklyAdvisorCard = {
  id: string;
  title: string;
  body: string;
  category: AdvisorCardCategory;
};

export type WeeklyAdvisorData = {
  weekLabel: string;
  cards: readonly WeeklyAdvisorCard[];
};

// ─── Repository ──────────────────────────────────────────────────────────────
export type DashboardPreviewRepository = {
  getFollowUps: () => FollowUpData;
  getGoals: () => GoalPeriodData;
  getLeadKpi: () => LeadKpiDto;
  getSalesKpi: () => SalesKpiDto;
  getRevenueChart: () => readonly RevenueChartPoint[];
  getFunnel: () => FunnelDto;
  getAiRecommendations: () => AiRecommendationData;
  getWeeklyAdvisor: () => WeeklyAdvisorData;
};
