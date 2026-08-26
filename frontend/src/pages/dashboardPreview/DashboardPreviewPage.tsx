import type { DashboardPreviewRepository, LeadKpiDto } from '../../features/dashboardPreview/contracts';
import { Card, PageHeader } from '../../components/ui';
import { dashboardPreviewCopy } from '../../content/ja';
import './DashboardPreviewPage.css';

// ─── Sub-components ──────────────────────────────────────────────────────────

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

// ─── Lead KPI section ────────────────────────────────────────────────────────

function LeadKpiSection({ kpi }: { kpi: LeadKpiDto }) {
  const c = dashboardPreviewCopy.sections.leadKpi;
  const changeDir = kpi.prevPeriodChange > 0 ? 'up' : kpi.prevPeriodChange < 0 ? 'down' : 'neutral';
  return (
    <section className="dp-section">
      <h2 className="dp-section__title">{c.title}</h2>
      <div className="dp-kpi-grid">
        <KpiTile label={c.totalLeads}      value={kpi.totalLeads.toLocaleString('ja-JP')} />
        <KpiTile label={c.converted}       value={kpi.converted.toLocaleString('ja-JP')} />
        <KpiTile label={c.excluded}        value={kpi.excluded.toLocaleString('ja-JP')} />
        <KpiTile label={c.conversionRate}  value={dashboardPreviewCopy.rateFormat(kpi.conversionRate)} />
        <KpiTile
          label={c.prevChange}
          value={dashboardPreviewCopy.changeLabel(kpi.prevPeriodChange)}
          changeDir={changeDir}
        />
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Props = { repository: DashboardPreviewRepository };

export function DashboardPreviewPage({ repository }: Props) {
  const kpi = repository.getLeadKpi();
  const copy = dashboardPreviewCopy;

  return (
    <div className="dp-page">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={copy.subtitle}
      />
      <div className="dp-sections">
        <Card>
          <LeadKpiSection kpi={kpi} />
        </Card>
      </div>
    </div>
  );
}
