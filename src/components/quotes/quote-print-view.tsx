"use client";

import type { JobDetail, EnrichedLineItem, DecoProductDetail } from "@/lib/types";

type QuoteJob = JobDetail & { items: (JobDetail["items"][number] & { productDetail?: DecoProductDetail | null })[] };

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

interface DesignConfig {
  placement?: string;
  decorationMethod?: string;
  artworkUrl?: string;
  artworkName?: string;
  artworkFileType?: string;
  previewUrl?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  stitchCount?: number;
  colorCount?: number;
  threadColors?: string[] | string;
  dimensionWcm?: number;
  dimensionHcm?: number;
  notes?: string;
}

function getItemDesigns(item: QuoteJob["items"][number]): DesignConfig[] {
  // Check customOptions.designs (saved from quote builder)
  const co = item.customOptions as Record<string, unknown> | null;
  if (co?.designs && Array.isArray(co.designs) && co.designs.length > 0) {
    return co.designs as DesignConfig[];
  }
  // Fallback: check metadata.designs (saved from job page "Save decoration")
  const md = item.metadata as Record<string, unknown> | null;
  if (md?.designs && Array.isArray(md.designs) && md.designs.length > 0) {
    return md.designs as DesignConfig[];
  }
  // Fallback: synthesize a design from item-level decoration fields
  if (item.decorationMethod) {
    const placements = item.decorationPlacement
      ? item.decorationPlacement.split(",").map((p) => p.trim()).filter(Boolean)
      : [];
    if (placements.length > 0) {
      return placements.map((p) => ({
        placement: p,
        decorationMethod: item.decorationMethod ?? undefined,
      }));
    }
    return [{
      decorationMethod: item.decorationMethod,
    }];
  }
  return [];
}

function getItemMeta(item: QuoteJob["items"][number]) {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    decoProductId: m.decoProductId as string | undefined,
    selectedColorId: m.selectedColorId as number | undefined,
    sizeBreakdown: m.sizeBreakdown as Record<string, number> | undefined,
  };
}

/** Derive "View" (Front/Back) from a placement string */
function placementView(placement: string): string {
  const p = placement.toLowerCase().replace(/[_-]/g, " ");
  if (p.includes("back") || p.includes("full back")) return "Back";
  if (p.includes("sleeve")) return "Side";
  if (p.includes("collar")) return "Top";
  return "Front";
}

/** Human-readable placement/area label */
function humanPlacement(placement: string): string {
  return placement
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parse threadColors which can be string or string[] */
function parseThreadColors(tc: string[] | string | undefined): string[] {
  if (!tc) return [];
  if (Array.isArray(tc)) return tc;
  return tc.split(",").map((s) => s.trim()).filter(Boolean);
}

export function QuotePrintView({ job }: { job: QuoteJob }) {
  const meta = (job.metadata ?? {}) as Record<string, unknown>;
  const shipping = meta.shippingAddress as
    | { line1?: string; line2?: string; city?: string; state?: string; postcode?: string; country?: string }
    | undefined;
  const quoteNote = (meta.note as string) ?? job.orderNotes;
  const items = job.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + (i.totalPriceMinor ?? 0), 0);
  const grandTotal = job.totalMinor || subtotal;

  // Items that have product details get their own pages
  const enrichedItems = items.filter(
    (i) => (i as EnrichedLineItem).productDetail || getItemDesigns(i).length > 0,
  );

  return (
    <>
      <style>{printStyles}</style>

      {/* Action buttons (hidden when printing) */}
      <div className="quote-actions no-print">
        <button className="btn-back" onClick={() => window.history.back()}>
          ← Back
        </button>
        <button className="btn-print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ═══════════════════ PAGE 1: ORDER SUMMARY ═══════════════════ */}
      <div className="quote-page">
        {/* Header */}
        <div className="quote-header">
          <div className="quote-brand">
            <h1>Marx Corporate</h1>
            <p className="brand-address">20 Church Street, Ballymena, BT43 6DE</p>
            <p className="brand-contact">+44 28 2565 6524 · accounts@marxcorporate.com</p>
          </div>
          <div className="quote-meta">
            <div className="quote-label">QUOTE</div>
            <div className="quote-number">{job.internalJobId}</div>
            <div className="quote-date">Date: {fmtDate(job.createdAt)}</div>
            {job.dueAt && <div className="quote-date">Due: {fmtDate(job.dueAt)}</div>}
          </div>
        </div>

        {/* Customer / Shipping */}
        <div className="parties-row">
          <div className="party-box">
            <h3>Customer</h3>
            {job.customerName && <p className="name">{job.customerName}</p>}
            {job.customerCompany && <p>{job.customerCompany}</p>}
            {job.customerEmail && <p>{job.customerEmail}</p>}
            {job.customerPhone && <p>{job.customerPhone}</p>}
          </div>
          {shipping?.line1 && (
            <div className="party-box">
              <h3>Ship To</h3>
              <p className="name">{job.customerName}</p>
              <p>{shipping.line1}</p>
              {shipping.line2 && <p>{shipping.line2}</p>}
              <p>{[shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(", ")}</p>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: "5%" }}>#</th>
              <th style={{ width: "30%" }}>Product</th>
              <th style={{ width: "12%" }}>Colour</th>
              <th style={{ width: "13%" }}>Size / Qty</th>
              <th className="r" style={{ width: "10%" }}>Unit Price</th>
              <th className="r" style={{ width: "8%" }}>Tax</th>
              <th className="r" style={{ width: "8%" }}>Qty</th>
              <th className="r" style={{ width: "14%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items
              .filter((i) => i.productTitle)
              .map((item, idx) => {
                const itemMeta = getItemMeta(item);
                const pd = (item as EnrichedLineItem).productDetail;
                const selectedColor = pd?.colors.find((c) => c.id === itemMeta.selectedColorId);
                const colorName = selectedColor?.name ?? item.variantTitle ?? "—";
                const sizeBreakdown = itemMeta.sizeBreakdown;

                // Format size/qty breakdown
                let sizeQtyStr = `${item.quantity}`;
                if (sizeBreakdown && Object.keys(sizeBreakdown).length > 0) {
                  sizeQtyStr = Object.entries(sizeBreakdown)
                    .map(([size, qty]) => `${size}: ${qty}`)
                    .join(", ");
                }

                return (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <div className="product-title">{item.productTitle}</div>
                      {item.sku && <div className="product-sku">{item.sku}</div>}
                      {item.decorationMethod && (
                        <div className="product-sku">
                          {item.decorationMethod}
                          {item.decorationPlacement ? ` · ${item.decorationPlacement}` : ""}
                        </div>
                      )}
                    </td>
                    <td>{colorName}</td>
                    <td>{sizeQtyStr}</td>
                    <td className="r">{fmtCurrency(item.unitPriceMinor)}</td>
                    <td className="r">—</td>
                    <td className="r">{item.quantity}</td>
                    <td className="r">{fmtCurrency(item.totalPriceMinor)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="totals-section">
          <table className="totals-table">
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="r">{fmtCurrency(subtotal)}</td>
              </tr>
              <tr>
                <td>Shipping</td>
                <td className="r">—</td>
              </tr>
              <tr className="grand-total">
                <td>Grand Total</td>
                <td className="r">{fmtCurrency(grandTotal)}</td>
              </tr>
              <tr className="separator">
                <td colSpan={2} />
              </tr>
              <tr>
                <td>Taxes</td>
                <td className="r">—</td>
              </tr>
              <tr>
                <td>Payments</td>
                <td className="r">{fmtCurrency(0)}</td>
              </tr>
              <tr className="balance-row">
                <td>Balance Due</td>
                <td className="r">{fmtCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Details */}
        <div className="payment-section">
          <h3>Payment Details</h3>
          <div className="payment-grid">
            <div className="payment-method">
              <h4>Bank Transfer</h4>
              <p>Bank: <strong>Bank of Ireland</strong></p>
              <p>Account Name: <strong>Marx Corporate Ltd</strong></p>
              <p>Sort Code: <strong>90-21-27</strong></p>
              <p>Account No: <strong>14698432</strong></p>
              <p>IBAN: <strong>GB68BOFI90212714698432</strong></p>
              <p className="payment-ref">Reference: <strong>{job.internalJobId}</strong></p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quoteNote && (
          <div className="notes-box">
            <h3>Notes</h3>
            <p>{quoteNote}</p>
          </div>
        )}

        {/* Terms */}
        <div className="terms-section">
          <h3>Terms & Conditions</h3>
          <p>
            25% Deposit · Full payment on collection{"\n"}
            This quote is valid for 30 days from the date of issue.{"\n"}
            All prices are in GBP and exclude VAT unless stated otherwise.
          </p>
        </div>

        {/* Signature */}
        <div className="signature-section">
          <div className="sig-line">
            <div className="sig-label">Customer Signature</div>
          </div>
          <div className="sig-line">
            <div className="sig-label">Date</div>
          </div>
        </div>

        {/* Footer */}
        <div className="page-footer">
          Marx Corporate · 20 Church Street, Ballymena, BT43 6DE · marxcorporate.com
        </div>
      </div>

      {/* ═══════════════ PAGES 2+: PRODUCT DETAIL PAGES ═══════════════ */}
      {enrichedItems.map((item, idx) => (
        <ProductDetailPage key={item.id} item={item} index={idx + 1} jobId={job.internalJobId} />
      ))}
    </>
  );
}

// ── Product Detail Page (one per enriched line item) ──
function ProductDetailPage({
  item,
  index,
  jobId,
}: {
  item: QuoteJob["items"][number];
  index: number;
  jobId: string;
}) {
  const pd = (item as EnrichedLineItem).productDetail;
  const itemMeta = getItemMeta(item);
  const designs = getItemDesigns(item);
  const selectedColor = pd?.colors.find((c) => c.id === itemMeta.selectedColorId);
  const sizeBreakdown = itemMeta.sizeBreakdown;

  // Compute total from sizeBreakdown (more reliable than item.quantity which can drift)
  const sizeTotal = sizeBreakdown
    ? Object.values(sizeBreakdown).reduce((sum, qty) => sum + qty, 0)
    : item.quantity;

  // Resolve color name: prefer matched color from product detail, fall back to variantTitle
  const colorName = selectedColor?.name ?? item.variantTitle ?? null;

  // Pick the best product image
  const mainImage =
    pd?.images.find((img) => img.color?.toLowerCase() === selectedColor?.name.toLowerCase()) ??
    pd?.images.find((img) => img.type === "front") ??
    pd?.images[0];

  return (
    <div className="quote-page product-page">
      {/* Product header */}
      <div className="product-header">
        <div className="product-header-left">
          <h2>
            {item.sku && <span className="product-code">{item.sku}</span>}
            {item.productTitle}
          </h2>
          <p className="product-supplier">
            {pd?.supplier && `${pd.supplier} · `}
            {pd?.brand && `${pd.brand} · `}
            {pd?.category}
          </p>
        </div>
        <div className="product-header-right">
          <span className="product-ref">Quote {jobId} · Item {index}</span>
        </div>
      </div>

      <div className="product-content">
        {/* Left: Product Image */}
        <div className="product-image-col">
          {mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainImage.url}
              alt={item.productTitle}
              className="product-image"
            />
          ) : (
            <div className="product-image-placeholder">No Image Available</div>
          )}
        </div>

        {/* Right: Details */}
        <div className="product-detail-col">
          {/* Size / Qty */}
          {sizeBreakdown && Object.keys(sizeBreakdown).length > 0 && (
            <div className="detail-block">
              <h4>Size / Qty</h4>
              <table className="size-qty-table">
                <tbody>
                  {Object.entries(sizeBreakdown).map(([size, qty]) => (
                    <tr key={size}>
                      <td>{size}</td>
                      <td className="r">{qty}</td>
                    </tr>
                  ))}
                  <tr className="size-total">
                    <td>Total</td>
                    <td className="r">{sizeTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Colour */}
          {colorName && (
            <div className="detail-block">
              <h4>Colour</h4>
              <span className="color-chip selected">{colorName}</span>
            </div>
          )}

          {/* Product Description */}
          {pd && (
            <div className="detail-block">
              <h4>Product Description</h4>
              <p className="product-desc">
                {pd.productName}
                {pd.brand ? ` by ${pd.brand}` : ""}
                {pd.category ? ` — ${pd.category}` : ""}
              </p>
            </div>
          )}

          {/* Size Chart */}
          {pd && pd.sizes.length > 0 && (
            <div className="detail-block">
              <h4>Available Sizes</h4>
              <div className="size-chips">
                {pd.sizes
                  .filter((s) => s.code !== "MS")
                  .map((s) => (
                    <span key={s.id} className="size-chip">
                      {s.name}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Graphics Used Section */}
      {designs.length > 0 && (
        <div className="graphics-section">
          <h3>Graphics Used for {item.productTitle}</h3>
          {designs.map((design, di) => {
            const colors = parseThreadColors(design.threadColors);
            return (
              <div key={di} className="graphic-row">
                <div className="graphic-image">
                  {(design.previewUrl || design.artworkUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={design.previewUrl || design.artworkUrl || ""}
                      alt={design.artworkName || "Design"}
                    />
                  ) : (
                    <div className="graphic-placeholder">No Preview</div>
                  )}
                </div>
                <div className="graphic-details">
                  <table className="graphic-info-table">
                    <tbody>
                      {design.artworkName && (
                        <tr>
                          <td className="label">Graphic Name</td>
                          <td>{design.artworkName}</td>
                        </tr>
                      )}
                      {(design.dimensionWcm || design.dimensionHcm) && (
                        <tr>
                          <td className="label">Size</td>
                          <td>
                            {design.dimensionWcm?.toFixed(2) ?? "—"}cm × {design.dimensionHcm?.toFixed(2) ?? "—"}cm
                          </td>
                        </tr>
                      )}
                      {design.placement && (
                        <>
                          <tr>
                            <td className="label">View</td>
                            <td>{placementView(design.placement)}</td>
                          </tr>
                          <tr>
                            <td className="label">Area</td>
                            <td>{humanPlacement(design.placement)}</td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td className="label">Process</td>
                        <td>{design.decorationMethod ?? item.decorationMethod ?? "—"}</td>
                      </tr>
                      {design.stitchCount != null && design.stitchCount > 0 && (
                        <tr>
                          <td className="label">Stitch Count</td>
                          <td>{design.stitchCount.toLocaleString()}</td>
                        </tr>
                      )}
                      {colors.length > 0 && (
                        <tr>
                          <td className="label">Colorway Colors</td>
                          <td>
                            <div className="thread-colors">
                              {colors.map((tc, ci) => (
                                <span key={ci} className="thread-swatch">
                                  <span className="swatch-dot" style={{ background: tc.startsWith("#") ? tc : undefined }} />
                                  {tc}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {design.colorCount != null && design.colorCount > 0 && !colors.length && (
                        <tr>
                          <td className="label">Color Count</td>
                          <td>{design.colorCount}</td>
                        </tr>
                      )}
                      {design.notes && (
                        <tr>
                          <td className="label">Notes</td>
                          <td>{design.notes}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="page-footer">
        Marx Corporate · 20 Church Street, Ballymena, BT43 6DE · marxcorporate.com
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════

const printStyles = `
  @media print {
    @page { margin: 16mm 14mm; size: A4; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .quote-page { page-break-after: always; }
    .quote-page:last-child { page-break-after: auto; }
  }

  * { box-sizing: border-box; }

  .quote-page {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    max-width: 800px;
    margin: 0 auto 40px;
    padding: 40px;
    font-size: 13px;
    line-height: 1.5;
  }

  /* ── Action buttons ── */
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
  .btn-print { background: #1a1a1a; color: #fff; }
  .btn-print:hover { background: #333; }
  .btn-back { background: #f0f0f0; color: #333; }
  .btn-back:hover { background: #e0e0e0; }

  /* ── Page 1: Header ── */
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
  .brand-address, .brand-contact {
    margin: 3px 0 0;
    color: #666;
    font-size: 11px;
  }
  .quote-meta { text-align: right; }
  .quote-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #999;
  }
  .quote-number {
    font-size: 18px;
    font-weight: 700;
    margin: 2px 0 4px;
  }
  .quote-date { font-size: 12px; color: #666; }

  /* ── Parties ── */
  .parties-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
  .party-box h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #999;
    margin: 0 0 6px;
    font-weight: 600;
  }
  .party-box p { margin: 2px 0; font-size: 13px; }
  .party-box .name { font-weight: 600; font-size: 14px; }

  /* ── Items Table ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  .items-table thead th {
    background: #f5f5f5;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
    padding: 8px 8px;
    text-align: left;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #666;
    font-weight: 600;
  }
  .items-table thead th.r { text-align: right; }
  .items-table tbody td {
    padding: 10px 8px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
    font-size: 12px;
  }
  .items-table tbody td.r { text-align: right; }
  .product-title { font-weight: 600; }
  .product-sku { font-size: 11px; color: #888; margin-top: 1px; }

  /* ── Totals ── */
  .totals-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 24px;
  }
  .totals-table { border-collapse: collapse; min-width: 250px; }
  .totals-table td { padding: 5px 10px; font-size: 13px; }
  .totals-table td.r { text-align: right; font-variant-numeric: tabular-nums; }
  .totals-table .grand-total {
    border-top: 2px solid #1a1a1a;
    font-weight: 700;
    font-size: 15px;
  }
  .totals-table .separator td { padding: 2px; }
  .totals-table .balance-row { font-weight: 600; color: #c00; }

  /* ── Payment ── */
  .payment-section {
    background: #f9f9f9;
    border: 1px solid #eee;
    border-radius: 4px;
    padding: 16px;
    margin-bottom: 20px;
  }
  .payment-section h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #999;
    margin: 0 0 10px;
    font-weight: 600;
  }
  .payment-grid { display: flex; gap: 32px; }
  .payment-method h4 { margin: 0 0 6px; font-size: 13px; }
  .payment-method p { margin: 2px 0; font-size: 12px; color: #555; }
  .payment-ref { margin-top: 6px !important; }

  /* ── Notes & Terms ── */
  .notes-box, .terms-section {
    background: #f9f9f9;
    border: 1px solid #eee;
    border-radius: 4px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .notes-box h3, .terms-section h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #999;
    margin: 0 0 6px;
    font-weight: 600;
  }
  .notes-box p, .terms-section p {
    margin: 0;
    font-size: 12px;
    white-space: pre-wrap;
    color: #555;
  }

  /* ── Signature ── */
  .signature-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin: 32px 0 20px;
  }
  .sig-line {
    border-bottom: 1px solid #bbb;
    padding-bottom: 6px;
  }
  .sig-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #999;
    margin-top: 4px;
  }

  /* ── Footer ── */
  .page-footer {
    border-top: 1px solid #ddd;
    padding-top: 10px;
    text-align: center;
    font-size: 11px;
    color: #999;
    margin-top: auto;
  }

  /* ════════════════════════════════════════════════════════════════════
     PAGE 2+: PRODUCT DETAIL PAGES
     ════════════════════════════════════════════════════════════════════ */

  .product-page {
    display: flex;
    flex-direction: column;
  }

  .product-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1a1a1a;
    padding-bottom: 14px;
    margin-bottom: 20px;
  }
  .product-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }
  .product-code {
    color: #888;
    margin-right: 8px;
    font-weight: 400;
    font-size: 14px;
  }
  .product-supplier {
    margin: 4px 0 0;
    font-size: 12px;
    color: #888;
  }
  .product-ref {
    font-size: 11px;
    color: #999;
  }

  .product-content {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 28px;
    margin-bottom: 24px;
  }

  /* Product Image */
  .product-image-col {
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .product-image {
    max-width: 300px;
    max-height: 380px;
    object-fit: contain;
    border: 1px solid #eee;
    border-radius: 4px;
  }
  .product-image-placeholder {
    width: 300px;
    height: 300px;
    background: #f5f5f5;
    border: 1px dashed #ddd;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #bbb;
    font-size: 13px;
  }

  /* Detail blocks */
  .product-detail-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .detail-block h4 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #999;
    margin: 0 0 6px;
    font-weight: 600;
  }

  /* Size/Qty table */
  .size-qty-table {
    border-collapse: collapse;
    width: 100%;
    max-width: 200px;
  }
  .size-qty-table td {
    padding: 4px 8px;
    border-bottom: 1px solid #eee;
    font-size: 12px;
  }
  .size-qty-table td.r { text-align: right; }
  .size-qty-table .size-total {
    border-top: 2px solid #ccc;
    font-weight: 700;
  }

  /* Color chips */
  .color-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .color-chip {
    display: inline-block;
    padding: 3px 10px;
    border: 1px solid #ddd;
    border-radius: 12px;
    font-size: 11px;
    background: #f9f9f9;
  }
  .color-chip.selected {
    background: #1a1a1a;
    color: #fff;
    border-color: #1a1a1a;
    font-weight: 600;
  }

  /* Product description */
  .product-desc {
    margin: 0;
    font-size: 12px;
    color: #555;
    line-height: 1.5;
  }

  /* Size chips */
  .size-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .size-chip {
    display: inline-block;
    padding: 2px 8px;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
  }

  /* ── Graphics Section ── */
  .graphics-section {
    margin-top: 4px;
    padding-top: 16px;
    border-top: 1px solid #ddd;
  }
  .graphics-section h3 {
    font-size: 12px;
    font-weight: 700;
    margin: 0 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .graphic-row {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 20px;
    margin-bottom: 16px;
    padding: 16px;
    background: #f9f9f9;
    border: 1px solid #eee;
    border-radius: 4px;
  }

  /* Garment overlay */
  .garment-overlay-container {
    position: relative;
    width: 200px;
    height: 240px;
    border: 1px solid #ddd;
    border-radius: 3px;
    background: #fff;
    overflow: hidden;
  }
  .garment-overlay-bg {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .garment-overlay-graphic {
    position: absolute;
    object-fit: contain;
    pointer-events: none;
  }

  .graphic-image img:not(.garment-overlay-bg):not(.garment-overlay-graphic) {
    max-width: 200px;
    max-height: 200px;
    object-fit: contain;
    border: 1px solid #ddd;
    border-radius: 3px;
    background: #fff;
  }
  .graphic-placeholder {
    width: 160px;
    height: 120px;
    background: #eee;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #bbb;
  }

  .graphic-info-table {
    border-collapse: collapse;
    width: 100%;
  }
  .graphic-info-table td {
    padding: 3px 8px;
    font-size: 12px;
    vertical-align: top;
  }
  .graphic-info-table td.label {
    font-weight: 600;
    color: #666;
    width: 120px;
    white-space: nowrap;
  }

  .thread-colors {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .thread-swatch {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 10px;
  }
  .swatch-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid #ccc;
    flex-shrink: 0;
  }
`;
