"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProductionBatch,
  ProductionBatchStats,
  BatchStatusLabel,
  BatchConfidenceLabel,
} from "@/lib/types";

// ── Status lane definitions ──

type Lane = {
  key: string;
  label: string;
  statuses: BatchStatusLabel[];
  colour: string;
};

const LANES: Lane[] = [
  { key: "setup", label: "Setup", statuses: ["Draft", "Pending Review", "Configured"], colour: "var(--accent-blue, #3b82f6)" },
  { key: "personalisation", label: "Personalisation", statuses: ["Personalisation"], colour: "var(--accent-purple, #8b5cf6)" },
  { key: "ordering", label: "Ordering", statuses: ["Ready to Order", "Ordered", "Awaiting Stock"], colour: "var(--accent-amber, #f59e0b)" },
  { key: "production", label: "Production", statuses: ["In Production", "QC"], colour: "var(--accent-green, #22c55e)" },
  { key: "done", label: "Complete", statuses: ["Complete"], colour: "var(--accent-teal, #14b8a6)" },
  { key: "held", label: "On Hold / Cancelled", statuses: ["On Hold", "Cancelled"], colour: "var(--text-tertiary, #94a3b8)" },
];

const CONFIDENCE_STYLES: Record<BatchConfidenceLabel, { bg: string; fg: string; label: string }> = {
  Auto: { bg: "#dcfce7", fg: "#166534", label: "Auto" },
  Review: { bg: "#fef9c3", fg: "#854d0e", label: "Review" },
  Manual: { bg: "#fee2e2", fg: "#991b1b", label: "Manual" },
};

const METHOD_STYLES: Record<string, { bg: string; fg: string }> = {
  embroidery: { bg: "#dbeafe", fg: "#1e40af" },
  dtf: { bg: "#fce7f3", fg: "#9d174d" },
  dtg: { bg: "#e0e7ff", fg: "#3730a3" },
  screen_print: { bg: "#f3e8ff", fg: "#6b21a8" },
};

// ── Component ──

interface Props {
  batches: ProductionBatch[];
  stats: ProductionBatchStats;
}

export function BatchBoard({ batches, stats }: Props) {
  const router = useRouter();
  const [activeLane, setActiveLane] = useState("setup");
  const [searchQuery, setSearchQuery] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<BatchConfidenceLabel | "all">("all");
  const [batching, setBatching] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  async function handleBatchAll() {
    setBatching(true);
    setBatchResult(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch-all" }),
      });
      const data = await res.json();
      if (res.ok) {
        setBatchResult(
          `Processed ${data.jobsProcessed} jobs → ${data.batchesCreated} new batches, ${data.itemsBatched} items batched`
        );
        router.refresh();
      } else {
        setBatchResult(`Error: ${data.error ?? "Unknown error"}`);
      }
    } catch (err) {
      setBatchResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBatching(false);
    }
  }

  // Filter
  const lane = LANES.find((l) => l.key === activeLane) ?? LANES[0];
  const filtered = batches.filter((b) => {
    if (!lane.statuses.includes(b.status)) return false;
    if (confidenceFilter !== "all" && b.confidence !== confidenceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.displayTitle.toLowerCase().includes(q) ||
        b.accountName.toLowerCase().includes(q) ||
        (b.colour ?? "").toLowerCase().includes(q) ||
        (b.decorationMethod ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Count per lane
  const laneCounts = LANES.map((l) => ({
    ...l,
    count: batches.filter((b) => l.statuses.includes(b.status)).length,
  }));

  return (
    <div className="space-y-4">
      {/* Stats bar + batch all button */}
      <div className="flex flex-wrap items-center gap-3">
        <StatPill label="Total" value={stats.total} />
        {Object.entries(stats.byConfidence).map(([k, v]) => (
          <StatPill
            key={k}
            label={CONFIDENCE_STYLES[CONFIDENCE_MAP[k] ?? "Manual"]?.label ?? k}
            value={v as number}
            colour={CONFIDENCE_STYLES[CONFIDENCE_MAP[k] ?? "Manual"]?.bg}
          />
        ))}
        <button
          onClick={handleBatchAll}
          disabled={batching}
          className="ml-auto rounded-md px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: "var(--accent, #6366f1)" }}
        >
          {batching ? "Batching…" : "Batch All Jobs"}
        </button>
      </div>

      {batchResult && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            borderColor: batchResult.startsWith("Error") ? "#ef4444" : "#22c55e",
            background: batchResult.startsWith("Error") ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
            color: batchResult.startsWith("Error") ? "#fca5a5" : "#86efac",
          }}
        >
          {batchResult}
        </div>
      )}

      {/* Lane tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {laneCounts.map((l) => (
          <button
            key={l.key}
            onClick={() => setActiveLane(l.key)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              background: activeLane === l.key ? l.colour : "var(--bg-raised, #1e293b)",
              color: activeLane === l.key ? "#fff" : "var(--text-secondary, #94a3b8)",
              border: `1px solid ${activeLane === l.key ? l.colour : "var(--border, #334155)"}`,
            }}
          >
            {l.label}
            <span
              className="rounded-full px-1.5 py-0.5 text-xs font-bold"
              style={{
                background: activeLane === l.key ? "rgba(255,255,255,0.2)" : "var(--bg-base, #0f172a)",
              }}
            >
              {l.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search batches…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{
            background: "var(--bg-raised, #1e293b)",
            borderColor: "var(--border, #334155)",
            color: "var(--text-primary, #e2e8f0)",
          }}
        />
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value as BatchConfidenceLabel | "all")}
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{
            background: "var(--bg-raised, #1e293b)",
            borderColor: "var(--border, #334155)",
            color: "var(--text-primary, #e2e8f0)",
          }}
        >
          <option value="all">All confidence</option>
          <option value="Auto">Auto-configured</option>
          <option value="Review">Needs review</option>
          <option value="Manual">Manual setup</option>
        </select>
        <span className="ml-auto text-sm" style={{ color: "var(--text-tertiary, #64748b)" }}>
          {filtered.length} batch{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Batch cards */}
      {filtered.length === 0 ? (
        <div
          className="rounded-lg border p-8 text-center text-sm"
          style={{
            borderColor: "var(--border, #334155)",
            color: "var(--text-tertiary, #64748b)",
          }}
        >
          No batches in this lane
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((batch) => (
            <BatchCard key={batch.id} batch={batch} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function BatchCard({ batch }: { batch: ProductionBatch }) {
  const conf = CONFIDENCE_STYLES[batch.confidence];
  const method = batch.decorationMethod?.toLowerCase() ?? "";
  const methodStyle = METHOD_STYLES[method] ?? { bg: "var(--bg-base, #0f172a)", fg: "var(--text-secondary, #94a3b8)" };

  return (
    <div
      className="rounded-lg border p-4 transition-colors hover:border-blue-500"
      style={{
        background: "var(--bg-raised, #1e293b)",
        borderColor: "var(--border, #334155)",
      }}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold leading-tight"
          style={{ color: "var(--text-primary, #e2e8f0)" }}
        >
          {batch.displayTitle}
        </h3>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ background: conf.bg, color: conf.fg }}
        >
          {conf.label}
        </span>
      </div>

      {/* Meta pills */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {batch.colour && (
          <span
            className="rounded px-1.5 py-0.5 text-xs"
            style={{ background: "var(--bg-base, #0f172a)", color: "var(--text-secondary, #94a3b8)" }}
          >
            {batch.colour}
          </span>
        )}
        {batch.decorationMethod && (
          <span
            className="rounded px-1.5 py-0.5 text-xs font-medium"
            style={{ background: methodStyle.bg, color: methodStyle.fg }}
          >
            {batch.decorationMethod}
          </span>
        )}
        {batch.hasPersonalisation && (
          <span
            className="rounded px-1.5 py-0.5 text-xs"
            style={{ background: "#fef3c7", color: "#92400e" }}
          >
            Personalised ({batch.personalisationCount})
          </span>
        )}
      </div>

      {/* Size breakdown */}
      <div className="mb-2 flex flex-wrap gap-1">
        {batch.sizes.map((s) => (
          <span
            key={s.size}
            className="rounded border px-1.5 py-0.5 text-xs tabular-nums"
            style={{
              borderColor: "var(--border, #334155)",
              color: "var(--text-secondary, #94a3b8)",
            }}
          >
            {s.size}: {s.quantity}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs"
          style={{ color: "var(--text-tertiary, #64748b)" }}
        >
          {batch.totalQuantity} total
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background: "var(--bg-base, #0f172a)",
            color: "var(--text-secondary, #94a3b8)",
          }}
        >
          {batch.status}
        </span>
      </div>
    </div>
  );
}

function StatPill({ label, value, colour }: { label: string; value: number; colour?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
      style={{
        background: colour ?? "var(--bg-raised, #1e293b)",
        borderColor: "var(--border, #334155)",
        color: colour ? "#1e293b" : "var(--text-primary, #e2e8f0)",
      }}
    >
      <span className="font-medium">{label}:</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

// Map backend confidence enum to UI label
const CONFIDENCE_MAP: Record<string, BatchConfidenceLabel> = {
  AUTO_CONFIGURED: "Auto",
  NEEDS_REVIEW: "Review",
  MANUAL_SETUP: "Manual",
};
