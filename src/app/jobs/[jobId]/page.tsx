import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { CollapsibleSection } from "@/components/collapsible-section";
import { formatCurrency } from "@/lib/format";
import { orderTone } from "@/lib/presentation";
import { getJob } from "@/lib/data-repository";
import type { JobDetail, JobLineItem, OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// ── Status helpers ──

function lifecycleToUiStatus(lifecycle: string, approvalStatus: string): OrderStatus {
  switch (lifecycle) {
    case "COMPLETED": return "Complete";
    case "CANCELLED": return "Cancelled";
    case "ON_HOLD": return "On hold";
    case "IN_PRODUCTION": return "Printing";
    case "PRODUCTION_QUEUED":
    case "STOCK_RECEIVED": return "Queued";
    case "AWAITING_STOCK": return "Stock";
    default: break;
  }
  if (approvalStatus === "AWAITING_CUSTOMER" || approvalStatus === "PROOF_SENT") return "Approval";
  if (lifecycle === "PUSHED_TO_DECO") return "Artwork";
  return "New";
}

function humanLifecycle(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function humanStatus(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function stockStatusTone(status: string): string {
  switch (status) {
    case "FULLY_RECEIVED": return "border-[#0ea5a0]/35 bg-[#0ea5a0]/18 text-[#b9fff5]";
    case "ORDERED":
    case "AWAITING_ARRIVAL": return "border-[#e3c96e]/35 bg-[#e3c96e]/14 text-[#f6e8bc]";
    case "STOCK_ISSUE": return "border-[#f97366]/35 bg-[#f97366]/14 text-[#ffd1c8]";
    default: return "border-white/20 bg-white/[0.08] text-white/80";
  }
}

// ── Sub-components ──

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${tone}`}>
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value ?? "—"}</p>
    </div>
  );
}

function WorkflowTracker({ job }: { job: JobDetail }) {
  const stages = [
    { key: "INGESTED", label: "Ingested" },
    { key: "CLASSIFIED", label: "Classified" },
    { key: "CONFIGURED", label: "Configured" },
    { key: "PUSHED_TO_DECO", label: "Sent to Deco" },
    { key: "AWAITING_STOCK", label: "Awaiting Stock" },
    { key: "STOCK_RECEIVED", label: "Stock Received" },
    { key: "PRODUCTION_QUEUED", label: "Production Queued" },
    { key: "IN_PRODUCTION", label: "In Production" },
    { key: "COMPLETED", label: "Completed" },
  ];

  const currentIndex = stages.findIndex((s) => s.key === job.lifecycle);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stages.map((stage, i) => {
        const isActive = stage.key === job.lifecycle;
        const isPast = i < currentIndex;
        const isFuture = i > currentIndex;
        return (
          <div key={stage.key} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-px w-4 sm:w-6 ${isPast ? "bg-[#0ea5a0]" : "bg-white/15"}`} />
            )}
            <span
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] transition ${
                isActive
                  ? "border-[#0ea5a0]/50 bg-[#0ea5a0]/22 text-[#b9fff5] font-semibold"
                  : isPast
                    ? "border-[#0ea5a0]/25 bg-[#0ea5a0]/8 text-[#0ea5a0]/80"
                    : isFuture
                      ? "border-white/10 bg-white/[0.03] text-white/30"
                      : "border-white/14 bg-white/[0.06] text-white/50"
              }`}
            >
              {stage.label}
            </span>
          </div>
        );
      })}
      {(job.lifecycle === "ON_HOLD" || job.lifecycle === "CANCELLED") && (
        <div className="flex items-center gap-2">
          <div className="h-px w-4 sm:w-6 bg-white/15" />
          <span className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold ${
            job.lifecycle === "ON_HOLD"
              ? "border-[#fb923c]/35 bg-[#fb923c]/14 text-[#fed7aa]"
              : "border-white/14 bg-white/[0.06] text-white/50"
          }`}>
            {humanLifecycle(job.lifecycle)}
          </span>
        </div>
      )}
    </div>
  );
}

function LineItemCard({ item, index }: { item: JobLineItem; index: number }) {
  const stock = item.stockRequirement;
  return (
    <div className="record-card space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Line {index + 1}</p>
          <p className="mt-1 text-base font-semibold text-white">{item.productTitle}</p>
          {item.variantTitle && (
            <p className="mt-0.5 text-sm text-white/60">{item.variantTitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="data-pill">Qty {item.quantity}</span>
          {item.totalPriceMinor != null && (
            <span className="data-pill">{formatCurrency(item.totalPriceMinor / 100)}</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="SKU" value={item.sku || "No SKU"} />
        <Field label="Decoration" value={item.decorationMethod || "Not set"} />
        <Field label="Placement" value={item.decorationPlacement || "Not set"} />
      </div>

      {item.garmentReference && (
        <Field label="Garment reference" value={item.garmentReference} />
      )}

      {/* Stock requirement */}
      {stock && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">Stock requirement</p>
            <StatusPill label={humanStatus(stock.status)} tone={stockStatusTone(stock.status)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Required" value={stock.requiredQuantity} />
            <Field label="Received" value={stock.receivedQuantity} />
            <Field label="Supplier" value={stock.supplierName || "Not ordered"} />
            <Field label="ETA" value={stock.eta ? formatDate(stock.eta) : "—"} />
          </div>
          {stock.supplierReference && (
            <Field label="Supplier ref" value={stock.supplierReference} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) notFound();

  const uiStatus = lifecycleToUiStatus(job.lifecycle, job.approvalStatus);
  const totalValue = job.totalMinor / 100;

  return (
    <AppShell title={job.internalJobId}>
      {/* ── Back link ── */}
      <div className="mb-4">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to jobs
        </Link>
      </div>

      {/* ── Header ── */}
      <SectionCard title={job.internalJobId} kicker="Job detail">
        <div className="space-y-5">
          {/* Status & key info */}
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label={uiStatus} tone={orderTone(uiStatus)} />
            <StatusPill
              label={humanStatus(job.fulfillmentStatus)}
              tone={job.fulfillmentStatus === "FULFILLED"
                ? "border-[#3b82f6]/35 bg-[#3b82f6]/16 text-[#d6e8ff]"
                : "border-white/20 bg-white/[0.08] text-white/80"}
            />
            {job.assignedDepartment && (
              <StatusPill label={job.assignedDepartment} tone="border-[#c084fc]/30 bg-[#c084fc]/14 text-[#e9d5ff]" />
            )}
            {job.requiresReview && (
              <StatusPill label="Needs review" tone="border-[#f97366]/35 bg-[#f97366]/14 text-[#ffd1c8]" />
            )}
          </div>

          {/* Workflow tracker */}
          <WorkflowTracker job={job} />

          {/* Customer & order grid */}
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Customer" value={job.customerCompany || job.customerName} />
            <Field label="Contact" value={job.customerName} />
            <Field label="Email" value={job.customerEmail} />
            <Field label="Channel" value={humanStatus(job.source)} />
            <Field label="Order placed" value={formatDate(job.orderPlacedAt)} />
            <Field label="Due date" value={formatDate(job.dueAt)} />
            <Field label="Total value" value={formatCurrency(totalValue)} />
            <Field label="Owner" value={job.owner || "Unassigned"} />
          </div>

          {/* Account & source group */}
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Account" value={job.account?.name || "Unassigned"} />
            <Field label="Source group" value={job.sourceGroupLabel || "—"} />
            {job.schoolName && <Field label="School" value={job.schoolName} />}
            {job.clubName && <Field label="Club" value={job.clubName} />}
            {job.leaversYear && <Field label="Leavers year" value={job.leaversYear} />}
          </div>

          {/* Shopify / Deco refs */}
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            {job.shopifyOrderName && <Field label="Shopify order" value={job.shopifyOrderName} />}
            {job.decoOrderId && <Field label="Deco order ID" value={job.decoOrderId} />}
            {job.externalLinks.length > 0 && (
              <div className="min-w-0">
                <p className="eyebrow">External links</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {job.externalLinks.map((link) => (
                    <span key={`${link.provider}-${link.externalId}`} className="data-pill">
                      {humanStatus(link.provider)}: {link.externalId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {job.orderNotes && (
            <div className="min-w-0">
              <p className="eyebrow">Order notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{job.orderNotes}</p>
            </div>
          )}
          {job.reviewReason && (
            <div className="min-w-0">
              <p className="eyebrow">Review reason</p>
              <p className="mt-1 text-sm text-[#ffd1c8]">{job.reviewReason}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Sub-status overview ── */}
      <SectionCard title="Status breakdown" kicker="Workflow tracks">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="record-card px-4 py-3 sm:px-5">
            <p className="eyebrow">Classification</p>
            <p className="mt-1 text-sm font-medium text-white">{humanStatus(job.classificationStatus)}</p>
          </div>
          <div className="record-card px-4 py-3 sm:px-5">
            <p className="eyebrow">Configuration</p>
            <p className="mt-1 text-sm font-medium text-white">{humanStatus(job.configurationStatus)}</p>
          </div>
          <div className="record-card px-4 py-3 sm:px-5">
            <p className="eyebrow">Stock</p>
            <p className="mt-1 text-sm font-medium text-white">{humanStatus(job.stockStatus)}</p>
          </div>
          <div className="record-card px-4 py-3 sm:px-5">
            <p className="eyebrow">Production</p>
            <p className="mt-1 text-sm font-medium text-white">{humanStatus(job.productionStatus)}</p>
          </div>
          <div className="record-card px-4 py-3 sm:px-5">
            <p className="eyebrow">Approval</p>
            <p className="mt-1 text-sm font-medium text-white">{humanStatus(job.approvalStatus)}</p>
          </div>
          <div className="record-card px-4 py-3 sm:px-5">
            <p className="eyebrow">Fulfillment</p>
            <p className="mt-1 text-sm font-medium text-white">{humanStatus(job.fulfillmentStatus)}</p>
          </div>
        </div>
      </SectionCard>

      {/* ── Line items & stock ── */}
      <CollapsibleSection
        title={`Line items (${job.items.length})`}
        kicker="Garments & decoration"
        detail={`${job.items.reduce((sum, i) => sum + i.quantity, 0)} units total`}
        defaultOpen
      >
        {job.items.length === 0 ? (
          <p className="text-sm text-white/50">No line items on this job.</p>
        ) : (
          <div className="space-y-4">
            {job.items.map((item, i) => (
              <LineItemCard key={item.id} item={item} index={i} />
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Production info ── */}
      {(job.productionStatus !== "NOT_READY" || job.productionStartedAt) && (
        <SectionCard title="Production" kicker="Decoration & output">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Department" value={job.assignedDepartment || "Not assigned"} />
            <Field label="Production status" value={humanStatus(job.productionStatus)} />
            <Field label="Started" value={formatDateTime(job.productionStartedAt)} />
            <Field label="Completed" value={formatDateTime(job.productionCompletedAt)} />
          </div>
          {job.productionNotes && (
            <div className="mt-4 min-w-0">
              <p className="eyebrow">Production notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{job.productionNotes}</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Approval / artwork ── */}
      {job.approvalStatus !== "NOT_REQUIRED" && (
        <SectionCard title="Artwork & approval" kicker="Proofing">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Approval status" value={humanStatus(job.approvalStatus)} />
            <Field label="Proof version" value={job.proofVersion || "—"} />
            <Field label="Proof sent" value={formatDateTime(job.proofSentAt)} />
            <Field label="Approved" value={formatDateTime(job.approvedAt)} />
          </div>
        </SectionCard>
      )}

      {/* ── Account info ── */}
      {job.account && (
        <CollapsibleSection title={job.account.name} kicker="Account details">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Account type" value={humanStatus(job.account.type)} />
            <Field label="Default decoration" value={job.account.defaultDecorationMethod || "—"} />
            <Field label="Production notes" value={job.account.defaultProductionNotes || "—"} />
          </div>
        </CollapsibleSection>
      )}

      {/* ── Activity log ── */}
      <CollapsibleSection
        title="Activity log"
        kicker="History"
        detail={`${job.activityLogs.length} events`}
      >
        {job.activityLogs.length === 0 ? (
          <p className="text-sm text-white/50">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {job.activityLogs.map((entry) => (
              <div key={entry.id} className="record-card flex items-start gap-4 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{entry.message}</p>
                  <p className="mt-0.5 text-xs text-white/40">{humanStatus(entry.eventType)}</p>
                </div>
                <p className="shrink-0 text-xs text-white/40">
                  {formatDateTime(entry.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </AppShell>
  );
}
