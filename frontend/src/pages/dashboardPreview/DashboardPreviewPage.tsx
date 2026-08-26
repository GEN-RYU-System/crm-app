/**
 * DashboardPreviewPage — demo dashboard (no GAS connection)
 * Ported from Sales Anchor DashboardPage.tsx / FunnelSection.tsx.
 * All data supplied by DashboardPreviewRepository (hardcoded fake data).
 *
 * Source mapping:
 *  Follow-up section     DashboardPage.tsx:472-536
 *  Goal achievement      DashboardPage.tsx:539-580, 206-225 (AchievementBar)
 *  Lead KPI              DashboardPage.tsx:593-617
 *  Sales/Orders KPI      DashboardPage.tsx:628-728
 *  Revenue chart         DashboardPage.tsx:666-723 (recharts -> CSS bars)
 *  Funnel                FunnelSection.tsx:446-543
 */
import { type CSSProperties } from 'react';
import type {
  DashboardPreviewRepository,
  FollowUpData,
  FollowUpItem,
  FunnelDto,
  GoalEntry,
  GoalPeriodData,
  LeadKpiDto,
  RevenueChartPoint,
  SalesKpiDto,
} from '../../features/dashboardPreview/contracts';
import { Card, PageHeader } from '../../components/ui';
import { dashboardPreviewCopy } from '../../content/ja';
import './DashboardPreviewPage.css';

const c = dashboardPreviewCopy;

// ─── Achievement bar (DashboardPage.tsx:206-225) ─────────────────────────────

function AchievementBar({ rate }: { rate: number }) {
  const clamped = Math.min(rate, 100);
  const colorClass =
    clamped >= 100 ? 'dp-bar--success'
    : clamped >= 70 ? 'dp-bar--accent'
    : clamped >= 40 ? 'dp-bar--warning'
    : 'dp-bar--danger';
  return (
    <div className={`dp-achievement-bar ${colorClass}`}>
      <div
        className="dp-achievement-bar__fill"
        style={{ '--_dp-bar-w': `${clamped}%` } as CSSProperties}
      />
    </div>
  );
}

// ─── Follow-up section (DashboardPage.tsx:472-536) ───────────────────────────

function FollowUpRow({ item, variant }: { item: FollowUpItem; variant: 'overdue' | 'today' | 'upcoming' }) {
  const s = c.sections.followUp;
  const badge   = variant === 'overdue' ? s.overdue : variant === 'today' ? s.today : s.upcoming;
  const dateStr =
    variant === 'overdue'  ? s.daysAgo(Math.abs(item.dayOffset))
    : variant === 'today'  ? s.todayLabel
    : s.daysLater(item.dayOffset);
  return (
    <div className={`dp-fu-item dp-fu-item--${variant}`}>
      <span className="dp-fu-badge">{badge}</span>
      <span className="dp-fu-name">{item.customerName}</span>
      <span className="dp-fu-assignee">{s.assignee}: {item.assignee}</span>
      <span className="dp-fu-date">{dateStr}</span>
    </div>
  );
}

function FollowUpSection({ data }: { data: FollowUpData }) {
  const s = c.sections.followUp;
  const urgentCount = data.overdue.length + data.today.length;
  return (
    <section className="dp-section">
      <h2 className="dp-section__title">
        {s.title}
        {urgentCount > 0 && <span className="dp-badge-urgent">{s.urgentBadge(urgentCount)}</span>}
      </h2>
      <div className="dp-fu-list">
        {data.overdue.map(item => <FollowUpRow key={item.id} item={item} variant="overdue" />)}
        {data.today.map(item  => <FollowUpRow key={item.id} item={item} variant="today" />)}
        {data.upcoming.slice(0, 3).map(item => <FollowUpRow key={item.id} item={item} variant="upcoming" />)}
      </div>
    </section>
  );
}

// ─── Goal achievement section (DashboardPage.tsx:539-580) ────────────────────

function formatGoalValue(entry: GoalEntry, value: number): string {
  if (entry.unit === 'yen')  return c.yenFormat(value);
  if (entry.unit === 'rate') return c.rateFormat(value);
  return c.countFormat(value);
}

function GoalRow({ entry }: { entry: GoalEntry }) {
  const s = c.sections.goals;
  return (
    <div className="dp-goal-row">
      <div className="dp-goal-row__header">
        <span className="dp-goal-row__label">{s[entry.key]}</span>
        <span className="dp-goal-row__values">
          {formatGoalValue(entry, entry.actual)}
          <span className="dp-goal-row__sep"> / </span>
          {formatGoalValue(entry, entry.target)}
        </span>
        <span className="dp-goal-row__rate">{c.rateFormat(entry.achievementRate)}</span>
      </div>
      <AchievementBar rate={entry.achievementRate} />
    </div>
  );
}

function GoalSection({ goals }: { goals: GoalPeriodData }) {
  const s = c.sections.goals;
  return (
    <section className="dp-section">
      <h2 className="dp-section__title">{s.title}</h2>
      <div className="dp-goal-blocks">
        <div className="dp-goal-block">
          <div className="dp-goal-block__period">{s.monthly}</div>
          {goals.monthly.map(g => <GoalRow key={g.key} entry={g} />)}
        </div>
        <div className="dp-goal-block">
          <div className="dp-goal-block__period">{s.weekly}</div>
          {goals.weekly.map(g => <GoalRow key={g.key} entry={g} />)}
        </div>
      </div>
    </section>
  );
}

// ─── Lead KPI section (DashboardPage.tsx:593-617) ────────────────────────────

type KpiTileProps = { label: string; value: string; sub?: string; changeDir?: 'up' | 'down' | 'neutral' };
function KpiTile({ label, value, sub, changeDir }: KpiTileProps) {
  const dirClass = changeDir === 'up' ? 'dp-kpi-tile--up' : changeDir === 'down' ? 'dp-kpi-tile--down' : '';
  return (
    <div className={`dp-kpi-tile ${dirClass}`}>
      <div className="dp-kpi-tile__label">{label}</div>
      <div className="dp-kpi-tile__value">{value}</div>
      {sub != null && <div className="dp-kpi-tile__sub">{sub}</div>}
    </div>
  );
}

function LeadKpiSection({ kpi }: { kpi: LeadKpiDto }) {
  const s = c.sections.leadKpi;
  const changeDir = kpi.prevPeriodChange > 0 ? 'up' : kpi.prevPeriodChange < 0 ? 'down' : 'neutral';
  return (
    <section className="dp-section">
      <h2 className="dp-section__title">{s.title}</h2>
      <div className="dp-kpi-grid">
        <KpiTile label={s.totalLeads}     value={kpi.totalLeads.toLocaleString('ja-JP')} />
        <KpiTile label={s.converted}      value={kpi.converted.toLocaleString('ja-JP')} />
        <KpiTile label={s.excluded}       value={kpi.excluded.toLocaleString('ja-JP')} />
        <KpiTile label={s.conversionRate} value={c.rateFormat(kpi.conversionRate)} />
        <KpiTile label={s.prevChange}     value={c.changeLabel(kpi.prevPeriodChange)} changeDir={changeDir} />
      </div>
    </section>
  );
}

// ─── Sales / Orders KPI section (DashboardPage.tsx:628-728) ─────────────────

function SalesKpiSection({ kpi }: { kpi: SalesKpiDto }) {
  const s = c.sections.salesKpi;
  const revDir = kpi.revenuePrevChange    > 0 ? 'up' : kpi.revenuePrevChange    < 0 ? 'down' : 'neutral';
  const cntDir = kpi.orderCountPrevChange > 0 ? 'up' : kpi.orderCountPrevChange < 0 ? 'down' : 'neutral';
  return (
    <section className="dp-section">
      <h2 className="dp-section__title">{s.title}</h2>
      <div className="dp-kpi-grid dp-kpi-grid--3">
        <KpiTile
          label={s.confirmedRevenue}
          value={c.yenFormat(kpi.confirmedRevenue)}
          sub={c.changeLabel(kpi.revenuePrevChange)}
          changeDir={revDir}
        />
        <KpiTile
          label={s.orderCount}
          value={c.countFormat(kpi.orderCount)}
          sub={c.changeLabel(kpi.orderCountPrevChange)}
          changeDir={cntDir}
        />
        <KpiTile
          label={s.forecastRevenue}
          value={c.yenFormat(kpi.forecastRevenue)}
          sub={`${s.openDealCount}: ${c.countFormat(kpi.openDealCount)}`}
        />
      </div>
    </section>
  );
}

// ─── Revenue chart (DashboardPage.tsx:666-723, CSS bars) ─────────────────────

function RevenueChart({ data }: { data: readonly RevenueChartPoint[] }) {
  const s = c.sections.chart;
  const maxTotal = Math.max(...data.map(d => d.actual + d.remaining), 1);

  return (
    <section className="dp-section">
      <h2 className="dp-section__title">{s.title}</h2>
      <div className="dp-chart">
        <div className="dp-chart__yaxis">
          <span className="dp-chart__ylabel">{s.unit(maxTotal)}</span>
          <span className="dp-chart__ylabel dp-chart__ylabel--zero">0</span>
        </div>
        <div className="dp-chart__bars">
          {data.map(point => {
            const actualPct  = (point.actual    / maxTotal) * 100;
            const remainPct  = (point.remaining / maxTotal) * 100;
            return (
              <div key={point.label} className="dp-chart__bar-group">
                <div className="dp-chart__bar-wrap">
                  {point.remaining > 0 && (
                    <div
                      className="dp-chart__bar dp-chart__bar--remaining"
                      style={{ '--_dp-bar-h': `${remainPct}%` } as CSSProperties}
                    />
                  )}
                  <div
                    className="dp-chart__bar dp-chart__bar--actual"
                    style={{ '--_dp-bar-h': `${actualPct}%` } as CSSProperties}
                  />
                </div>
                <div className="dp-chart__xlabel">{point.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="dp-chart__legend">
        <span className="dp-chart__legend-item dp-chart__legend-item--actual">{s.confirmed}</span>
        <span className="dp-chart__legend-item dp-chart__legend-item--remaining">{s.forecast}</span>
      </div>
    </section>
  );
}

// ─── Funnel section (FunnelSection.tsx:446-543) ──────────────────────────────

type FunnelCardProps = {
  title: string;
  actualLabel: string;
  targetLabel: string;
  rate: number;
  isBottleneck: boolean;
  extra?: string;
};
function FunnelCard({ title, actualLabel, targetLabel, rate, isBottleneck, extra }: FunnelCardProps) {
  const s = c.sections.funnel;
  return (
    <div className={`dp-funnel-card${isBottleneck ? ' dp-funnel-card--bottleneck' : ''}`}>
      <div className="dp-funnel-card__title">{title}</div>
      <div className="dp-funnel-card__actual">{actualLabel}</div>
      <div className="dp-funnel-card__target">{s.target}: {targetLabel}</div>
      {extra != null && <div className="dp-funnel-card__extra">{extra}</div>}
      <AchievementBar rate={rate} />
      <div className="dp-funnel-card__rate">{c.rateFormat(rate)}</div>
    </div>
  );
}

function FunnelSection({ funnel }: { funnel: FunnelDto }) {
  const s = c.sections.funnel;

  const candidates = [
    { key: 'leads',      rate: funnel.leads.achievementRate },
    { key: 'conversion', rate: funnel.conversion.achievementRate },
    { key: 'closed',     rate: funnel.closed.achievementRate },
  ].filter(x => x.rate < 100);
  const bottleneck = candidates.length === 0 ? null
    : candidates.reduce((min, x) => x.rate < min.rate ? x : min).key;

  return (
    <section className="dp-section">
      <h2 className="dp-section__title">
        {s.title}
        <span className="dp-funnel-elapsed">{s.monthElapsed(funnel.monthElapsedPct)}</span>
      </h2>
      <div className="dp-funnel-row">
        <FunnelCard
          title={s.leads}
          actualLabel={`${funnel.leads.actual}${s.count}`}
          targetLabel={`${funnel.leads.target}${s.count}`}
          rate={funnel.leads.achievementRate}
          isBottleneck={bottleneck === 'leads'}
        />
        <span className="dp-funnel-arrow" aria-hidden="true">›</span>
        <FunnelCard
          title={s.conversion}
          actualLabel={c.rateFormat(funnel.conversion.actualRate)}
          targetLabel={c.rateFormat(funnel.conversion.targetRate)}
          rate={funnel.conversion.achievementRate}
          isBottleneck={bottleneck === 'conversion'}
        />
        <span className="dp-funnel-arrow" aria-hidden="true">›</span>
        <div className="dp-funnel-card">
          <div className="dp-funnel-card__title">{s.activeDeal}</div>
          <div className="dp-funnel-card__actual">{funnel.activeDeal.count}{s.count}</div>
          <div className="dp-funnel-card__target">{s.amount}: {c.yenFormat(funnel.activeDeal.amount)}</div>
          <div className="dp-funnel-card__extra">{s.coverage}: {funnel.activeDeal.coveragePct}%</div>
        </div>
        <span className="dp-funnel-arrow" aria-hidden="true">›</span>
        <FunnelCard
          title={s.closed}
          actualLabel={`${funnel.closed.won}${s.count}`}
          targetLabel={`${funnel.closed.wonTarget}${s.count}`}
          rate={funnel.closed.achievementRate}
          isBottleneck={bottleneck === 'closed'}
          extra={`${s.lost}: ${funnel.closed.lost}${s.count}`}
        />
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Props = { repository: DashboardPreviewRepository };

export function DashboardPreviewPage({ repository }: Props) {
  const followUps = repository.getFollowUps();
  const goals     = repository.getGoals();
  const leadKpi   = repository.getLeadKpi();
  const salesKpi  = repository.getSalesKpi();
  const chartData = repository.getRevenueChart();
  const funnel    = repository.getFunnel();

  return (
    <div className="dp-page">
      <PageHeader eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />

      <div className="dp-top-row">
        <Card className="dp-top-row__card">
          <FollowUpSection data={followUps} />
        </Card>
        <Card className="dp-top-row__card">
          <GoalSection goals={goals} />
        </Card>
      </div>

      <div className="dp-kpi-row">
        <Card className="dp-kpi-row__card">
          <LeadKpiSection kpi={leadKpi} />
        </Card>
        <Card className="dp-kpi-row__card">
          <SalesKpiSection kpi={salesKpi} />
        </Card>
      </div>

      <Card>
        <RevenueChart data={chartData} />
      </Card>

      <Card>
        <FunnelSection funnel={funnel} />
      </Card>
    </div>
  );
}
