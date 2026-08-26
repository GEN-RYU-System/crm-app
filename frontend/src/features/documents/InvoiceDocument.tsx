import React from 'react';
import {
  type DocColors,
  type DocLine,
  type IssuerInfo,
  ROWS_PER_PAGE,
  buildCssVars,
  DocHeaderFull,
  DocHeaderSimple,
  DocItemsTable,
  DocParties,
  DocFoot,
  DocTotals,
  DocTerms,
} from './DocumentParts';
import { catalogCopy } from '../../content/ja/catalog';

// ── Props ─────────────────────────────────────────────────────────────────────

export type InvoiceDocumentProps = {
  issuer: IssuerInfo;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  registrationNumber?: string;
  billedTo: { name: string; lines: string[] };
  shipTo: { name: string; lines: string[] };
  lines: DocLine[];
  subtotal: string;
  shippingFee: string;
  duty: string;
  otherFee: string;
  discount: string;
  total: string;
  currency: string;
  exchangeRate?: string;
  notes?: string;
  paymentMethod?: string;
  paymentTermsNote?: string;
  thanksMessage?: string;
  colors?: DocColors;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const {
    issuer,
    invoiceNumber,
    date,
    dueDate,
    registrationNumber,
    billedTo,
    shipTo,
    lines,
    subtotal,
    shippingFee,
    duty,
    otherFee,
    discount,
    total,
    currency,
    exchangeRate,
    notes,
    paymentMethod,
    paymentTermsNote,
    thanksMessage,
    colors,
  } = props;

  const cssVars = buildCssVars(colors);

  // DEBUG: key props snapshot (remove after diagnosis)
  const _debugPayload = {
    invoiceNo: invoiceNumber,
    dueDate,
    billedTo: { name: billedTo.name, count: billedTo.lines.length, lines: billedTo.lines },
    shipTo:   { name: shipTo.name,   count: shipTo.lines.length,   lines: shipTo.lines },
    paymentMethod: paymentMethod ?? null,
    paymentTermsNote: paymentTermsNote ?? null,
    orderLinesCount: lines.length,
  };

  // Split lines into pages of ROWS_PER_PAGE
  const pages: DocLine[][] = [];
  if (lines.length === 0) {
    pages.push([]);
  } else {
    for (let i = 0; i < lines.length; i += ROWS_PER_PAGE) {
      pages.push(lines.slice(i, i + ROWS_PER_PAGE));
    }
  }
  const totalPages = pages.length;

  return (
    <div style={cssVars}>
      {pages.map((pageLines, pageIdx) => {
        const isFirst = pageIdx === 0;
        const isLast = pageIdx === totalPages - 1;
        const pageNo = pageIdx + 1;

        // Pad lines to fill ROWS_PER_PAGE
        const startNo = pageIdx * ROWS_PER_PAGE + 1;
        const paddedLines: DocLine[] = [...pageLines];
        while (paddedLines.length < ROWS_PER_PAGE) {
          paddedLines.push({
            no: startNo + paddedLines.length,
            name: '',
            qty: '',
            unitPrice: '',
            amount: '',
          });
        }

        return (
          <div key={pageIdx} className="doc-page">
            {/* Header */}
            {isFirst ? (
              <DocHeaderFull
                issuer={issuer}
                title="Invoice"
                meta={{
                  date,
                  dueOrValidDate: dueDate,
                  dueOrValidLabel: 'Due date',
                  docNumber: invoiceNumber,
                  registrationNumber,
                }}
              />
            ) : (
              <DocHeaderSimple
                issuerName={issuer.name}
                issuerSubLine={issuer.lines[0]}
                title="Invoice"
                docNumber={invoiceNumber}
              />
            )}

            {/* Parties — first page only */}
            {isFirst && (
              <DocParties billedTo={billedTo} shipTo={shipTo} />
            )}

            {/* Items table */}
            <DocItemsTable lines={paddedLines} colHeader={catalogCopy.docProduction} />

            {/* Footer — last page only */}
            {isLast ? (
              <>
                <DocFoot
                  notes={notes}
                  exchangeRate={exchangeRate}
                  notesLabel={catalogCopy.docNotes}
                  totalsNode={
                    <DocTotals
                      subtotal={subtotal}
                      shippingFee={shippingFee}
                      duty={duty}
                      otherFee={otherFee}
                      discount={discount}
                      total={total}
                      currency={currency}
                    />
                  }
                />
                <DocTerms
                  paymentMethod={paymentMethod}
                  currency={currency}
                  dueOrValidDate={dueDate}
                  dueOrValidLabel={catalogCopy.docDeadlineLabel}
                  note={paymentTermsNote}
                  thanksMessage={thanksMessage}
                  paymentMethodLabel={catalogCopy.docPaymentTerms}
                  currencyLabel={catalogCopy.docCurrency}
                  deadlineLabel={catalogCopy.docDeadlineLabel}
                  transferFeeNote={catalogCopy.docTransferFeeNote}
                  pleaseNoteLabel={catalogCopy.docPleaseNote}
                  thanksLabel={catalogCopy.docThanks}
                />
              </>
            ) : (
              <div className="doc-spacer" />
            )}

            {/* DEBUG JSON — remove after diagnosis */}
            {isLast && (
              <pre style={{ fontSize: '5pt', color: '#888', wordBreak: 'break-all', whiteSpace: 'pre-wrap', marginTop: '4pt', lineHeight: 1.3 }}>
                {JSON.stringify(_debugPayload, null, 1)}
              </pre>
            )}

            {/* Pager */}
            <p className="doc-pager doc-num">
              Page {pageNo} / {totalPages}
            </p>
          </div>
        );
      })}
    </div>
  );
}
