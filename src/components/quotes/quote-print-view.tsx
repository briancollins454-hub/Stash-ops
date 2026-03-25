"use client";

import type { JobDetail } from "@/lib/types";

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtCurrency(minor: number | null | undefined): string {
  if (minor == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export function QuotePrintView({ job }: { job: JobDetail }) {
  const meta = (job.metadata ?? {}) as Record<string, unknown>;
  const shipping = meta.shippingAddress as
    | { line1?: string; line2?: string; city?: string; state?: string; postcode?: string; country?: string }
    | undefined;
  const quoteNote = (meta.note as string) ?? job.orderNotes;
  const items = job.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + (i.totalPriceMinor ?? 0), 0);

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page { margin: 16mm 14mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        .quote-page {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          color: #1a1a1a;
          background: #fff;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          font-size: 13px;
          line-height: 1.5;
        }
        .quote-page * { box-sizing: border-box; }
        .quote-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #1a1a1a;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .quote-brand h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .quote-brand p {
          margin: 4px 0 0;
          color: #666;
          font-size: 12px;
        }
        .quote-meta {
          text-align: right;
          font-size: 12px;
          color: #666;
        }
        .quote-meta .quote-number {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 4px;
        }
        .quote-parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        .quote-party h3 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #999;
          margin: 0 0 6px;
          font-weight: 600;
        }
        .quote-party p { margin: 2px 0; font-size: 13px; }
        .quote-party .name { font-weight: 600; font-size: 14px; }
        .quote-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .quote-table thead th {
          background: #f5f5f5;
          border-top: 1px solid #ddd;
          border-bottom: 1px solid #ddd;
          padding: 8px 10px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #666;
          font-weight: 600;
        }
        .quote-table thead th.right { text-align: right; }
        .quote-table tbody td {
          padding: 10px;
          border-bottom: 1px solid #eee;
          vertical-align: top;
        }
        .quote-table tbody td.right { text-align: right; }
        .quote-table tbody td .product-title { font-weight: 600; }
        .quote-table tbody td .product-detail {
          font-size: 11px;
          color: #777;
          margin-top: 2px;
        }
        .quote-totals {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
        }
        .quote-totals table {
          border-collapse: collapse;
          min-width: 220px;
        }
        .quote-totals td {
          padding: 4px 10px;
          font-size: 13px;
        }
        .quote-totals td.right { text-align: right; font-variant-numeric: tabular-nums; }
        .quote-totals tr.total {
          border-top: 2px solid #1a1a1a;
          font-weight: 700;
          font-size: 15px;
        }
        .quote-notes {
          background: #f9f9f9;
          border: 1px solid #eee;
          border-radius: 4px;
          padding: 12px 16px;
          margin-bottom: 24px;
        }
        .quote-notes h3 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #999;
          margin: 0 0 6px;
          font-weight: 600;
        }
        .quote-notes p {
          margin: 0;
          font-size: 12px;
          white-space: pre-wrap;
          color: #555;
        }
        .quote-footer {
          border-top: 1px solid #ddd;
          padding-top: 12px;
          text-align: center;
          font-size: 11px;
          color: #999;
        }
        .quote-actions {
          position: fixed;
          top: 16px;
          right: 16px;
          display: flex;
          gap: 8px;
          z-index: 1000;
        }
        .quote-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-print {
          background: #1a1a1a;
          color: #fff;
        }
        .btn-print:hover { background: #333; }
        .btn-back {
          background: #f0f0f0;
          color: #333;
        }
        .btn-back:hover { background: #e0e0e0; }
      `}</style>

      {/* Action buttons (hidden when printing) */}
      <div className="quote-actions no-print">
        <button className="btn-back" onClick={() => window.history.back()}>
          ← Back
        </button>
        <button className="btn-print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      <div className="quote-page">
        {/* Header */}
        <div className="quote-header">
          <div className="quote-brand">
            <h1>Marx Corporate</h1>
            <p>20 Church Street, Ballymena, BT43 6DE</p>
            <p>+44 28 2565 6524 · accounts@marxcorporate.com</p>
          </div>
          <div className="quote-meta">
            <div className="quote-number">QUOTE</div>
            <div>{job.internalJobId}</div>
            <div>Date: {fmtDate(job.createdAt)}</div>
            {job.dueAt && <div>Due: {fmtDate(job.dueAt)}</div>}
          </div>
        </div>

        {/* Customer / Shipping */}
        <div className="quote-parties">
          <div className="quote-party">
            <h3>Customer</h3>
            {job.customerName && <p className="name">{job.customerName}</p>}
            {job.customerCompany && <p>{job.customerCompany}</p>}
            {job.customerEmail && <p>{job.customerEmail}</p>}
            {job.customerPhone && <p>{job.customerPhone}</p>}
          </div>
          {shipping?.line1 && (
            <div className="quote-party">
              <h3>Ship To</h3>
              <p className="name">{job.customerName}</p>
              <p>{shipping.line1}</p>
              {shipping.line2 && <p>{shipping.line2}</p>}
              <p>
                {[shipping.city, shipping.state, shipping.postcode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <table className="quote-table">
          <thead>
            <tr>
              <th style={{ width: "5%" }}>#</th>
              <th style={{ width: "40%" }}>Product</th>
              <th style={{ width: "15%" }}>Method</th>
              <th className="right" style={{ width: "10%" }}>Qty</th>
              <th className="right" style={{ width: "15%" }}>Unit Price</th>
              <th className="right" style={{ width: "15%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items
              .filter((i) => i.productTitle)
              .map((item, idx) => {
                const detail = [item.sku, item.variantTitle, item.decorationPlacement]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <div className="product-title">{item.productTitle}</div>
                      {detail && <div className="product-detail">{detail}</div>}
                    </td>
                    <td>{item.decorationMethod ?? "—"}</td>
                    <td className="right">{item.quantity}</td>
                    <td className="right">{fmtCurrency(item.unitPriceMinor)}</td>
                    <td className="right">{fmtCurrency(item.totalPriceMinor)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="quote-totals">
          <table>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="right">{fmtCurrency(subtotal)}</td>
              </tr>
              <tr className="total">
                <td>Total</td>
                <td className="right">{fmtCurrency(job.totalMinor || subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {quoteNote && (
          <div className="quote-notes">
            <h3>Notes</h3>
            <p>{quoteNote}</p>
          </div>
        )}

        {/* Terms */}
        <div className="quote-notes">
          <h3>Terms & Conditions</h3>
          <p>
            25% Deposit · Full payment on collection{"\n"}
            This quote is valid for 30 days from the date of issue.{"\n"}
            All prices are in GBP and exclude VAT unless stated otherwise.
          </p>
        </div>

        {/* Footer */}
        <div className="quote-footer">
          Marx Corporate · 20 Church Street, Ballymena, BT43 6DE · marxcorporate.com
        </div>
      </div>
    </>
  );
}
