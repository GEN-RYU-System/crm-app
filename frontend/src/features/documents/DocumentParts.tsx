import './documentStyles.css';

// ── Type definitions ──────────────────────────────────────────────────────────

export type DocColors = {
  barBg?: string;
  barText?: string;
  brandText?: string;
  titleText?: string;
  thanksText?: string;
  bandBg?: string;
  ink?: string;
  inkSub?: string;
  lineColor?: string;
  lineStrongColor?: string;
};

export type IssuerInfo = {
  name: string;
  lines: string[];
};

export type DocLine = {
  no: number;
  name: string;
  qty: string;
  unitPrice: string;
  amount: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export const ROWS_PER_PAGE = 20;

export function padLines(lines: DocLine[], startNo: number): DocLine[] {
  const padded = [...lines];
  while (padded.length < ROWS_PER_PAGE) {
    padded.push({ no: startNo + padded.length, name: '', qty: '', unitPrice: '', amount: '' });
  }
  return padded;
}

export function buildCssVars(colors: DocColors | undefined): React.CSSProperties {
  return {
    '--doc-bar-bg': colors?.barBg,
    '--doc-bar-text': colors?.barText,
    '--doc-brand-text': colors?.brandText,
    '--doc-title-text': colors?.titleText,
    '--doc-thanks-text': colors?.thanksText,
    '--doc-band-bg': colors?.bandBg,
    '--doc-ink': colors?.ink,
    '--doc-ink-sub': colors?.inkSub,
    '--doc-line-color': colors?.lineColor,
    '--doc-line-strong-color': colors?.lineStrongColor,
  } as React.CSSProperties;
}

// ── DocItemsTable ─────────────────────────────────────────────────────────────

type DocItemsTableProps = {
  lines: DocLine[];
  colHeader: string;
};

export function DocItemsTable({ lines, colHeader }: DocItemsTableProps) {
  return (
    <table className="doc-items">
      <thead>
        <tr>
          <th className="doc-col-no">#</th>
          <th className="doc-col-name">{colHeader}</th>
          <th className="doc-col-qty">Qty</th>
          <th className="doc-col-price">Unit Price</th>
          <th className="doc-col-amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) => (
          <tr key={idx}>
            <td className="doc-col-no doc-num">{line.no}</td>
            <td className="doc-col-name">{line.name}</td>
            <td className="doc-col-qty doc-num">{line.qty}</td>
            <td className="doc-col-price doc-num">{line.unitPrice}</td>
            <td className="doc-col-amount doc-num">{line.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── DocHeaderFull ─────────────────────────────────────────────────────────────

type DocHeaderFullMeta = {
  date?: string;
  dueOrValidDate?: string;
  dueOrValidLabel?: string;
  docNumber: string;
  registrationNumber?: string;
};

type DocHeaderFullProps = {
  issuer: IssuerInfo;
  title: string;
  meta: DocHeaderFullMeta;
};

export function DocHeaderFull({ issuer, title, meta }: DocHeaderFullProps) {
  return (
    <div className="doc-head">
      <div>
        <p className="doc-issuer-name">{issuer.name}</p>
        {issuer.lines.map((line, idx) => (
          <p key={idx} className="doc-issuer-line">{line}</p>
        ))}
      </div>
      <div>
        <p className="doc-title">{title}</p>
        <div className="doc-meta">
          {meta.date && (
            <dl className="doc-meta-row">
              <dt>Date</dt>
              <dd className="doc-num">{meta.date}</dd>
            </dl>
          )}
          {meta.dueOrValidDate && (
            <dl className="doc-meta-row">
              <dt>{meta.dueOrValidLabel ?? 'Due date'}</dt>
              <dd className="doc-num">{meta.dueOrValidDate}</dd>
            </dl>
          )}
          <dl className="doc-meta-row">
            <dt>{title} #</dt>
            <dd className="doc-num">{meta.docNumber}</dd>
          </dl>
          {meta.registrationNumber && (
            <dl className="doc-meta-row">
              <dt>Registration number</dt>
              <dd className="doc-num">{meta.registrationNumber}</dd>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DocHeaderSimple ───────────────────────────────────────────────────────────

type DocHeaderSimpleProps = {
  issuerName: string;
  issuerSubLine?: string;
  title: string;
  docNumber: string;
};

export function DocHeaderSimple({ issuerName, issuerSubLine, title, docNumber }: DocHeaderSimpleProps) {
  return (
    <div className="doc-head">
      <div>
        <p className="doc-issuer-name">{issuerName}</p>
        {issuerSubLine && <p className="doc-issuer-line">{issuerSubLine}</p>}
      </div>
      <div>
        <p className="doc-title">{title}</p>
        <div className="doc-meta">
          <dl className="doc-meta-row">
            <dt>{title} #</dt>
            <dd className="doc-num">{docNumber}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ── DocParties ────────────────────────────────────────────────────────────────

type PartyInfo = { name: string; lines: string[] };

type DocPartiesProps = {
  billedTo: PartyInfo;
  shipTo: PartyInfo;
};

export function DocParties({ billedTo, shipTo }: DocPartiesProps) {
  return (
    <div className="doc-parties">
      <DocPartyBlock label="Billed to" party={billedTo} />
      <DocPartyBlock label="Ship to" party={shipTo} />
    </div>
  );
}

function DocPartyBlock({ label, party }: { label: string; party: PartyInfo }) {
  return (
    <div className="doc-party">
      <h2 className="doc-party-heading">{label}</h2>
      <div className="doc-party-body">
        <p>{party.name}</p>
        {party.lines.map((line, idx) => (
          <p key={idx}>{line}</p>
        ))}
      </div>
    </div>
  );
}

// ── DocPartySimple ────────────────────────────────────────────────────────────

type DocPartySimpleProps = {
  customerName: string;
};

export function DocPartySimple({ customerName }: DocPartySimpleProps) {
  return (
    <div className="doc-parties">
      <div className="doc-party">
        <h2 className="doc-party-heading">To</h2>
        <div className="doc-party-body">
          <p>{customerName}</p>
        </div>
      </div>
    </div>
  );
}

// ── DocTotals ─────────────────────────────────────────────────────────────────

type DocTotalsProps = {
  subtotal: string;
  shippingFee: string;
  duty?: string;
  otherFee?: string;
  discount: string;
  total: string;
  currency: string;
  isQuote?: boolean;
};

export function DocTotals({ subtotal, shippingFee, duty, otherFee, discount, total, isQuote }: DocTotalsProps) {
  return (
    <div className="doc-totals">
      <dl><dt>SUBTOTAL</dt><dd className="doc-num">{subtotal}</dd></dl>
      <dl><dt>SHIPPING</dt><dd className="doc-num">{shippingFee}</dd></dl>
      {!isQuote && duty !== undefined && (
        <dl><dt>CUSTOMS DUTY</dt><dd className="doc-num">{duty}</dd></dl>
      )}
      {!isQuote && otherFee !== undefined && (
        <dl><dt>OTHER FEES</dt><dd className="doc-num">{otherFee}</dd></dl>
      )}
      <dl><dt>DISCOUNT</dt><dd className="doc-num">{discount}</dd></dl>
      <dl className="doc-totals-grand"><dt>TOTAL</dt><dd className="doc-num">{total}</dd></dl>
    </div>
  );
}

// ── DocFoot ───────────────────────────────────────────────────────────────────

type DocFootProps = {
  notes?: string;
  exchangeRate?: string;
  totalsNode: React.ReactNode;
  notesLabel: string;
};

export function DocFoot({ notes, exchangeRate, totalsNode, notesLabel }: DocFootProps) {
  return (
    <div className="doc-foot">
      <div className="doc-note-box">
        <h2>{notesLabel}</h2>
        <div className="doc-note-box-content">{notes ?? ''}</div>
        {exchangeRate && (
          <p className="doc-fx doc-num">Exchange Rate: {exchangeRate}</p>
        )}
      </div>
      {totalsNode}
    </div>
  );
}

// ── DocTerms ──────────────────────────────────────────────────────────────────

type DocTermsProps = {
  paymentMethod?: string;
  currency: string;
  dueOrValidDate?: string;
  dueOrValidLabel?: string;
  note?: string;
  thanksMessage?: string;
  paymentMethodLabel: string;
  currencyLabel: string;
  deadlineLabel: string;
  transferFeeNote: string;
  pleaseNoteLabel: string;
  thanksLabel: string;
};

export function DocTerms({
  paymentMethod,
  currency,
  dueOrValidDate,
  dueOrValidLabel,
  note,
  thanksMessage,
  paymentMethodLabel,
  currencyLabel,
  deadlineLabel,
  transferFeeNote,
  pleaseNoteLabel,
  thanksLabel,
}: DocTermsProps) {
  return (
    <div className="doc-terms">
      <h2>{paymentMethodLabel}</h2>
      {paymentMethod && <p>{paymentMethod}</p>}
      <p>{currencyLabel}: {currency}</p>
      {dueOrValidDate && (
        <p>{dueOrValidLabel ?? deadlineLabel}: {dueOrValidDate}</p>
      )}
      <p>{transferFeeNote}</p>
      {note && (
        <div className="doc-terms-gap">
          <h2>{pleaseNoteLabel}</h2>
          <p>{note}</p>
        </div>
      )}
      <p className="doc-thanks">{thanksMessage ?? thanksLabel}</p>
    </div>
  );
}
