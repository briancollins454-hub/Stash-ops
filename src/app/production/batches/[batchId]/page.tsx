import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getProductionBatchDetail } from "@/lib/data-repository";
import { BatchActions } from "@/components/production/batch-actions";
import { SourceOrdersList } from "@/components/production/source-orders-list";
import type { ProductionBatchDetail, BatchItemDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ batchId: string }>;
}

const CONFIDENCE_STYLES: Record<string, { bg: string; fg: string }> = {
  Auto: { bg: "#dcfce7", fg: "#166534" },
  Review: { bg: "#fef9c3", fg: "#854d0e" },
  Manual: { bg: "#fee2e2", fg: "#991b1b" },
};

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  Draft: { bg: "#1e293b", fg: "#94a3b8" },
  "Pending Review": { bg: "#fef9c3", fg: "#854d0e" },
  Configured: { bg: "#dbeafe", fg: "#1e40af" },
  Personalisation: { bg: "#f3e8ff", fg: "#6b21a8" },
  "Ready to Order": { bg: "#fef3c7", fg: "#92400e" },
  Ordered: { bg: "#e0e7ff", fg: "#3730a3" },
  "Awaiting Stock": { bg: "#fef3c7", fg: "#92400e" },
  "In Production": { bg: "#dcfce7", fg: "#166534" },
  QC: { bg: "#cffafe", fg: "#155e75" },
  Complete: { bg: "#dcfce7", fg: "#166534" },
  "On Hold": { bg: "#fee2e2", fg: "#991b1b" },
  Cancelled: { bg: "#fee2e2", fg: "#991b1b" },
};

export default async function BatchDetailPage({ params }: Props) {
  const { batchId } = await params;
  const batch = await getProductionBatchDetail(batchId);

  if (!batch) {
    notFound();
  }

  const confStyle = CONFIDENCE_STYLES[batch.confidence] ?? CONFIDENCE_STYLES.Manual;
  const statusStyle = STATUS_STYLES[batch.status] ?? STATUS_STYLES.Draft;

  return (
    <AppShell title={batch.displayTitle}>
      <div className="space-y-6">
        {/* Header card */}
        <SectionCard kicker="Batch Detail" title={batch.displayTitle}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoField label="Account" value={batch.accountName} />
            <InfoField label="Colour" value={batch.colour ?? "N/A"} />
            <InfoField label="Decoration" value={batch.decorationMethod ?? "Not set"} />
            <InfoField label="Total Qty" value={String(batch.totalQuantity)} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: statusStyle.bg, color: statusStyle.fg }}
            >
              {batch.status}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: confStyle.bg, color: confStyle.fg }}
            >
              {batch.confidence}
            </span>
            {batch.hasPersonalisation && (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                Personalised ({batch.personalisationCount})
              </span>
            )}
          </div>

          {batch.notes && (
            <p
              className="mt-3 rounded-md border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border, #334155)",
                color: "var(--text-secondary, #94a3b8)",
              }}
            >
              {batch.notes}
            </p>
          )}
        </SectionCard>

        {/* Actions — transitions, edit method, notes */}
        <SectionCard kicker="Actions" title="Batch Actions">
          <div className="mb-6 flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border, #334155)" }}>
            <div>
              <h4 className="text-sm font-medium" style={{ color: "var(--text-primary, #e2e8f0)" }}>Batch Decorator</h4>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary, #94a3b8)" }}>
                Apply logos and configure initials for this batch. The system uses logic to map input variables to garment positions automatically.
              </p>
            </div>
            <Link
              href={`/production/batches/${batch.id}/designer`}
              className="inline-block rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#6366f1", color: "#fff" }}
            >
              Open Decorator
            </Link>
          </div>

          <BatchActions
            batchId={batch.id}
            currentStatus={batch.status}
            notes={batch.notes}
            decorationMethod={batch.decorationMethod}
          />
        </SectionCard>

        {/* Decoration Profile */}
        {batch.decorationProfile && (
          <SectionCard kicker="Decoration" title={batch.decorationProfile.name}>
            <div className="flex items-start gap-4">
              {batch.decorationProfile.artworkAsset?.assetUrl && (
                <img
                  src={batch.decorationProfile.artworkAsset.assetUrl}
                  alt="Artwork"
                  className="h-24 w-24 rounded border object-contain"
                  style={{ borderColor: "var(--border, #334155)", background: "#fff" }}
                />
              )}
              <div>
                <InfoField label="Method" value={batch.decorationProfile.decorationMethod ?? "Not set"} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* Size Breakdown */}
        <SectionCard kicker="Sizes" title="Size Breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: "var(--border, #334155)" }}
                >
                  <th className="pb-2 font-medium" style={{ color: "var(--text-tertiary, #64748b)" }}>
                    Size
                  </th>
                  <th className="pb-2 font-medium" style={{ color: "var(--text-tertiary, #64748b)" }}>
                    Qty
                  </th>
                  <th className="pb-2 font-medium" style={{ color: "var(--text-tertiary, #64748b)" }}>
                    Source Orders
                  </th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map((item) => (
                  <SizeRow key={item.id} item={item} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold" style={{ borderColor: "var(--border, #334155)" }}>
                  <td className="pt-2" style={{ color: "var(--text-primary, #e2e8f0)" }}>
                    Total
                  </td>
                  <td className="pt-2" style={{ color: "var(--text-primary, #e2e8f0)" }}>
                    {batch.totalQuantity}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>

        {/* Source Orders — clickable & editable */}
        <SectionCard kicker="Source" title="Contributing Orders">
          <SourceOrdersList batchId={batch.id} items={batch.items} />
        </SectionCard>
      </div>
    </AppShell>
  );
}

function SizeRow({ item }: { item: BatchItemDetail }) {
  return (
    <tr className="border-b" style={{ borderColor: "var(--border, #334155)" }}>
      <td className="py-2" style={{ color: "var(--text-primary, #e2e8f0)" }}>
        {item.size}
      </td>
      <td className="py-2 tabular-nums" style={{ color: "var(--text-primary, #e2e8f0)" }}>
        {item.quantity}
      </td>
      <td className="py-2" style={{ color: "var(--text-tertiary, #64748b)" }}>
        {item.sourceLines.length} order{item.sourceLines.length !== 1 ? "s" : ""}
      </td>
    </tr>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--text-tertiary, #64748b)" }}
      >
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-primary, #e2e8f0)" }}>
        {value}
      </dd>
    </div>
  );
}
