"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BatchItemDetail, BatchSourceLineDetail } from "@/lib/types";

interface Props {
  batchId: string;
  items: BatchItemDetail[];
}

export function SourceOrdersList({ batchId, items }: Props) {
  const allLines = items.flatMap((item) =>
    item.sourceLines.map((sl) => ({ ...sl, size: item.size }))
  );

  if (allLines.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-tertiary, #64748b)" }}>
        No source orders linked yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {allLines.map((sl) => (
        <SourceLineRow key={sl.id} batchId={batchId} line={sl} size={sl.size} />
      ))}
    </div>
  );
}

function SourceLineRow({
  batchId,
  line,
  size,
}: {
  batchId: string;
  line: BatchSourceLineDetail;
  size: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(line.quantity);
  const [persText, setPersText] = useState(line.personalisationText ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-source-line",
          lineId: line.id,
          quantity: qty,
          personalisationText: persText.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Save failed");
      } else {
        setExpanded(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const orderName = line.job?.shopifyOrderName ?? line.job?.internalJobId ?? "—";
  const customerName = line.job?.customerName ?? "";

  return (
    <div
      className="rounded-md border transition-colors"
      style={{
        borderColor: expanded ? "var(--accent, #6366f1)" : "var(--border, #334155)",
        background: "var(--bg-base, #0f172a)",
      }}
    >
      {/* Summary row — click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold" style={{ color: "var(--accent, #6366f1)" }}>
            {orderName}
          </span>
          <span style={{ color: "var(--text-secondary, #94a3b8)" }}>
            {customerName}
          </span>
          <span
            className="rounded bg-slate-700 px-1.5 py-0.5 text-xs"
            style={{ color: "var(--text-secondary, #94a3b8)" }}
          >
            {size} × {line.quantity}
          </span>
          {line.personalisationText && (
            <span
              className="rounded px-2 py-0.5 text-xs"
              style={{ background: "#fef3c7", color: "#92400e" }}
            >
              {line.personalisationText}
            </span>
          )}
        </div>
        <svg
          className="h-4 w-4 shrink-0 transition-transform"
          style={{
            color: "var(--text-tertiary, #64748b)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded edit panel */}
      {expanded && (
        <div
          className="border-t px-3 py-3 space-y-3"
          style={{ borderColor: "var(--border, #334155)" }}
        >
          {/* Order details (read-only) */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary, #64748b)" }}>
                Order
              </span>
              <p style={{ color: "var(--text-primary, #e2e8f0)" }}>{orderName}</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary, #64748b)" }}>
                Customer
              </span>
              <p style={{ color: "var(--text-primary, #e2e8f0)" }}>{customerName || "—"}</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary, #64748b)" }}>
                Product
              </span>
              <p style={{ color: "var(--text-primary, #e2e8f0)" }}>
                {line.jobItem?.productTitle ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary, #64748b)" }}>
                Variant
              </span>
              <p style={{ color: "var(--text-primary, #e2e8f0)" }}>
                {line.jobItem?.variantTitle ?? "—"}
              </p>
            </div>
            {line.jobItem?.sku && (
              <div>
                <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary, #64748b)" }}>
                  SKU
                </span>
                <p style={{ color: "var(--text-primary, #e2e8f0)" }}>{line.jobItem.sku}</p>
              </div>
            )}
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-wide"
                style={{ color: "var(--text-tertiary, #64748b)" }}
              >
                Quantity
              </label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  background: "var(--bg-raised, #1e293b)",
                  borderColor: "var(--border, #334155)",
                  color: "var(--text-primary, #e2e8f0)",
                }}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-wide"
                style={{ color: "var(--text-tertiary, #64748b)" }}
              >
                Personalisation
              </label>
              <input
                type="text"
                value={persText}
                onChange={(e) => setPersText(e.target.value)}
                placeholder="e.g. initials, name, number"
                className="w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  background: "var(--bg-raised, #1e293b)",
                  borderColor: "var(--border, #334155)",
                  color: "var(--text-primary, #e2e8f0)",
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "#3b82f6" }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={() => {
                setExpanded(false);
                setQty(line.quantity);
                setPersText(line.personalisationText ?? "");
                setError(null);
              }}
              className="rounded-md px-3 py-1.5 text-sm"
              style={{ color: "var(--text-secondary, #94a3b8)" }}
            >
              Cancel
            </button>
            {line.job?.id && (
              <a
                href={`/jobs/${line.job.id}`}
                className="ml-auto text-xs underline"
                style={{ color: "var(--accent, #6366f1)" }}
              >
                View Full Order →
              </a>
            )}
          </div>

          {error && (
            <div
              className="rounded-md border px-3 py-1.5 text-xs"
              style={{
                borderColor: "#ef4444",
                background: "rgba(239,68,68,0.1)",
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
