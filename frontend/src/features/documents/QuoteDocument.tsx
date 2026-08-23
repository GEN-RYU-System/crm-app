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
  DocPartySimple,
  DocFoot,
  DocTotals,
  DocTerms,
} from './DocumentParts';
import { catalogCopy } from '../../content/ja/catalog';

// ── Props ─────────────────────────────────────────────────────────────────────

export type QuoteDocumentProps = {
  issuer: IssuerInfo;
  quoteId: string;
  date: string;
  validUntil: string;
  registrationNumber?: string;
  customerName: string;
  lines: DocLine[];
  subtotal: string;
  shippingFee: string;
  discount: string;
  total: string;
  currency: string;
  notes?: string;
  paymentMethod?: string;
  paymentTermsNote?: string;
  thanksMessage?: string;
  colors?: DocColors;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function QuoteDocument(props: QuoteDocumentProps) {
  const {
    issuer,
    quoteId,
    date,
    validUntil,
    registrationNumber,
    customerName,
    lines,
    subtotal,
    shippingFee,
    discount,
    total,
    currency,
    notes,
    paymentMethod,
    paymentTermsNote,
    thanksMessage,
    colors,
  } = props;

  const cssVars = buildCssVars(colors);

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
                title="Quotation"
                meta={{
                  date,
                  dueOrValidDate: validUntil,
                  dueOrValidLabel: 'Valid until',
                  docNumber: quoteId,
                  registrationNumber,
                }}
              />
            ) : (
              <DocHeaderSimple
                issuerName={issuer.name}
                issuerSubLine={issuer.lines[0]}
                title="Quotation"
                docNumber={quoteId}
              />
            )}

            {/* Customer — first page only */}
            {isFirst && <DocPartySimple customerName={customerName} />}

            {/* Items table */}
            <DocItemsTable lines={paddedLines} colHeader={catalogCopy.docProduction} />

            {/* Footer — last page only */}
            {isLast ? (
              <>
                <DocFoot
                  notes={notes}
                  notesLabel={catalogCopy.docNotes}
                  totalsNode={
                    <DocTotals
                      subtotal={subtotal}
                      shippingFee={shippingFee}
                      discount={discount}
                      total={total}
                      currency={currency}
                      isQuote
                    />
                  }
                />
                <DocTerms
                  paymentMethod={paymentMethod}
                  currency={currency}
                  dueOrValidDate={validUntil}
                  dueOrValidLabel={catalogCopy.docValidUntilLabel}
                  note={paymentTermsNote}
                  thanksMessage={thanksMessage}
                  paymentMethodLabel={catalogCopy.docPaymentTerms}
                  currencyLabel={catalogCopy.docCurrency}
                  deadlineLabel={catalogCopy.docValidUntilLabel}
                  transferFeeNote={catalogCopy.docTransferFeeNote}
                  pleaseNoteLabel={catalogCopy.docPleaseNote}
                  thanksLabel={catalogCopy.docThanks}
                />
              </>
            ) : (
              <div className="doc-spacer" />
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
