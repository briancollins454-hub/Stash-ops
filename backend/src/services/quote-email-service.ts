import nodemailer from "nodemailer";
import { env, isSmtpConfigured } from "../config/env";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

function fmtCurrency(minor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function fmtDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function emailQuote(jobId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS." };
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { items: true, account: true },
  });

  if (!job) return { ok: false, error: "Job not found." };
  if (!job.customerEmail) return { ok: false, error: "No customer email address on this job." };

  const meta = (job.metadata ?? {}) as Record<string, unknown>;
  const shipping = meta.shippingAddress as
    | { line1?: string; line2?: string; city?: string; state?: string; postcode?: string }
    | undefined;
  const quoteNote = (meta.note as string) ?? "";
  const items = job.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + (i.totalPriceMinor ?? 0), 0);
  const total = job.totalMinor || subtotal;

  // Build item rows
  const itemRows = items
    .filter((i) => i.productTitle)
    .map((item, idx) => {
      const detail = [item.sku, item.variantTitle, item.decorationMethod, item.decorationPlacement]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${idx + 1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">
            <strong>${escapeHtml(item.productTitle)}</strong>
            ${detail ? `<br><span style="font-size:11px;color:#777">${escapeHtml(detail)}</span>` : ""}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${item.quantity}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${fmtCurrency(item.unitPriceMinor ?? 0)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${fmtCurrency(item.totalPriceMinor ?? 0)}</td>
        </tr>`;
    })
    .join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:4px;overflow:hidden">
    <!-- Header -->
    <div style="background:#1a1a1a;color:#fff;padding:24px 30px">
      <h1 style="margin:0;font-size:20px;font-weight:700">Marx Corporate</h1>
      <p style="margin:4px 0 0;font-size:12px;color:#bbb">20 Church Street, Ballymena, BT43 6DE</p>
    </div>

    <div style="padding:24px 30px">
      <!-- Quote header -->
      <table style="width:100%;margin-bottom:20px">
        <tr>
          <td>
            <h2 style="margin:0;font-size:18px;color:#1a1a1a">Quote ${escapeHtml(job.internalJobId)}</h2>
            <p style="margin:4px 0 0;font-size:12px;color:#999">Date: ${fmtDate(job.createdAt)}${job.dueAt ? ` · Due: ${fmtDate(job.dueAt)}` : ""}</p>
          </td>
        </tr>
      </table>

      <!-- Customer -->
      <p style="margin:0 0 4px;font-size:13px"><strong>${escapeHtml(job.customerName ?? "")}</strong></p>
      ${job.customerCompany ? `<p style="margin:0 0 2px;font-size:13px">${escapeHtml(job.customerCompany)}</p>` : ""}
      ${shipping?.line1 ? `<p style="margin:0 0 2px;font-size:12px;color:#666">${escapeHtml([shipping.line1, shipping.line2, shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(", "))}</p>` : ""}

      <!-- Items -->
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#666;border-top:1px solid #ddd;border-bottom:1px solid #ddd">#</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#666;border-top:1px solid #ddd;border-bottom:1px solid #ddd">Product</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#666;border-top:1px solid #ddd;border-bottom:1px solid #ddd">Qty</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#666;border-top:1px solid #ddd;border-bottom:1px solid #ddd">Unit</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#666;border-top:1px solid #ddd;border-bottom:1px solid #ddd">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals -->
      <table style="margin-left:auto;min-width:200px;border-collapse:collapse">
        <tr>
          <td style="padding:4px 10px;font-size:13px">Subtotal</td>
          <td style="padding:4px 10px;font-size:13px;text-align:right">${fmtCurrency(subtotal)}</td>
        </tr>
        <tr style="border-top:2px solid #1a1a1a;font-weight:700">
          <td style="padding:6px 10px;font-size:15px">Total</td>
          <td style="padding:6px 10px;font-size:15px;text-align:right">${fmtCurrency(total)}</td>
        </tr>
      </table>

      ${quoteNote ? `
      <div style="background:#f9f9f9;border:1px solid #eee;border-radius:4px;padding:12px 16px;margin:20px 0">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:600">Notes</p>
        <p style="margin:6px 0 0;font-size:12px;color:#555;white-space:pre-wrap">${escapeHtml(quoteNote)}</p>
      </div>` : ""}

      <!-- Terms -->
      <div style="margin:20px 0;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px">
        <p style="margin:0"><strong>Terms:</strong> 25% Deposit · Full payment on collection</p>
        <p style="margin:2px 0 0">This quote is valid for 30 days from the date of issue.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9f9f9;padding:12px 30px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee">
      Marx Corporate · 20 Church Street, Ballymena, BT43 6DE · +44 28 2565 6524
    </div>
  </div>
</body>
</html>`;

  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to: job.customerEmail,
      subject: `Quote ${job.internalJobId} — Marx Corporate`,
      html,
    });

    logger.info({ jobId, to: job.customerEmail, quoteId: job.internalJobId }, "Quote email sent");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ jobId, to: job.customerEmail, error: msg }, "Failed to send quote email");
    return { ok: false, error: `Email send failed: ${msg}` };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
