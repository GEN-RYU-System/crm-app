import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NAVIGATION_BY_ID } from '../../app/navigation';
import { Button, Card, DataTable, EmptyState, PageHeader, PageToolbar, StatusMessage, type DataTableColumn } from '../../components/ui';
import { quotesCopy } from '../../content/ja';
import { getCoreQuoteDetail, type QuoteDetailRecord, type QuoteLineRecord } from '../../gas/client';
import './QuoteDetailPage.css';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

type LineRow = {
  lineNo: string;
  productName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
};

function text(value: unknown): string {
  return value == null || value === '' ? '-' : String(value);
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '-';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('ja-JP') : '-';
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP');
}

function toLineRows(lines: readonly QuoteLineRecord[]): LineRow[] {
  return lines.map((l) => ({
    lineNo:      formatNumber(l.lineNo),
    productName: text(l.productName),
    description: text(l.description),
    quantity:    formatNumber(l.quantity),
    unitPrice:   formatNumber(l.unitPrice),
    amount:      formatNumber(l.amount),
  }));
}

const LINE_COLUMNS: readonly DataTableColumn<LineRow>[] = [
  { key: 'lineNo',      header: quotesCopy.detail.lineColumns.lineNo,      renderCell: (r) => r.lineNo,      cellAlignment: 'center' },
  { key: 'productName', header: quotesCopy.detail.lineColumns.productName, renderCell: (r) => r.productName, cellAlignment: 'center' },
  { key: 'description', header: quotesCopy.detail.lineColumns.description, renderCell: (r) => r.description, cellAlignment: 'center' },
  { key: 'quantity',    header: quotesCopy.detail.lineColumns.quantity,    renderCell: (r) => r.quantity,    cellAlignment: 'center' },
  { key: 'unitPrice',   header: quotesCopy.detail.lineColumns.unitPrice,   renderCell: (r) => r.unitPrice,   cellAlignment: 'center' },
  { key: 'amount',      header: quotesCopy.detail.lineColumns.amount,      renderCell: (r) => r.amount,      cellAlignment: 'center' },
];

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="quote-detail-page__field">
      <span className="quote-detail-page__field-label">{label}</span>
      <span className="quote-detail-page__field-value">{value}</span>
    </div>
  );
}

export function QuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>('loading');
  const [detail, setDetail] = useState<QuoteDetailRecord | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!quoteId) return;
    setState('loading');
    setError('');
    try {
      const result = await getCoreQuoteDetail(quoteId);
      if (result === null) { setState('not-found'); return; }
      setDetail(result);
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '');
      setState('error');
    }
  }, [quoteId]);

  useEffect(() => { void load(); }, [load]);

  const backToList = () => navigate(NAVIGATION_BY_ID.quotes.hash);
  const q = detail?.quote;
  const lineRows = detail ? toLineRows(detail.lines) : [];

  return (
    <>
      <PageHeader eyebrow={quotesCopy.eyebrow} title={quotesCopy.detail.title} subtitle={quotesCopy.detail.subtitle} />
      <PageToolbar start={<Button variant="outline" onClick={backToList}>{quotesCopy.backToList}</Button>} />
      {state === 'loading' && (
        <div className="quote-detail-page__state">
          <StatusMessage variant="loading">{quotesCopy.detailLoading}</StatusMessage>
        </div>
      )}
      {state === 'error' && (
        <div className="quote-detail-page__state">
          <StatusMessage variant="error">
            {quotesCopy.detailLoadErrorPrefix} {error}
            <Button variant="outline" size="sm" onClick={() => void load()}>{quotesCopy.retry}</Button>
          </StatusMessage>
        </div>
      )}
      {state === 'not-found' && (
        <div className="quote-detail-page__state">
          <EmptyState title={quotesCopy.detailNotFoundTitle} description={quotesCopy.detailNotFoundDescription} />
        </div>
      )}
      {state === 'ready' && q && (
        <>
          <Card className="quote-detail-page__card">
            <div className="quote-detail-page__fields">
              <FieldRow label={quotesCopy.columns.quoteId}    value={text(q.quoteId)} />
              <FieldRow label={quotesCopy.detail.leadId}      value={text(q.leadId)} />
              <FieldRow label={quotesCopy.detail.customerId}  value={text(q.customerId)} />
              <FieldRow label={quotesCopy.detail.orderId}     value={text(q.orderId)} />
              <FieldRow label={quotesCopy.detail.staffId}     value={text(q.staffId)} />
              <FieldRow label={quotesCopy.detail.issuedDate}  value={formatDate(q.issuedDate)} />
              <FieldRow label={quotesCopy.detail.expiryDate}  value={formatDate(q.expiryDate)} />
              <FieldRow label={quotesCopy.detail.status}      value={text(q.status)} />
              <FieldRow label={quotesCopy.detail.currency}    value={text(q.currency)} />
              <FieldRow label={quotesCopy.detail.subtotal}    value={formatNumber(q.subtotal)} />
              <FieldRow label={quotesCopy.detail.shippingFee} value={formatNumber(q.shippingFee)} />
              <FieldRow label={quotesCopy.detail.discount}    value={formatNumber(q.discount)} />
              <FieldRow label={quotesCopy.detail.totalAmount} value={formatNumber(q.totalAmount)} />
              <FieldRow label={quotesCopy.detail.totalAmountJpy} value={formatNumber(q.totalAmountJpy)} />
              <FieldRow label={quotesCopy.detail.note}        value={text(q.note)} />
            </div>
          </Card>
          <Card className="quote-detail-page__card">
            <h2 className="quote-detail-page__section-title">{quotesCopy.detail.lines}</h2>
            <DataTable
              ariaLabel={quotesCopy.detail.lines}
              columns={LINE_COLUMNS}
              rows={lineRows}
              rowKey={(row) => row.lineNo}
              surface="embedded"
            />
          </Card>
        </>
      )}
    </>
  );
}
