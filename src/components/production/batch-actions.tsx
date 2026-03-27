"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BatchStatusLabel } from "@/lib/types";

// ── Backend enum ↔ UI label maps ──

const STATUS_TO_ENUM: Record<BatchStatusLabel, string> = {
  Draft: "DRAFT",
  "Pending Review": "PENDING_REVIEW",
  Configured: "CONFIGURED",
  Personalisation: "PERSONALISATION",
  "Ready to Order": "READY_TO_ORDER",
  Ordered: "ORDERED",
  "Awaiting Stock": "AWAITING_STOCK",
  "In Production": "IN_PRODUCTION",
  QC: "QC",
  Complete: "COMPLETE",
  "On Hold": "ON_HOLD",
  Cancelled: "CANCELLED",
};

const ENUM_TO_STATUS: Record<string, BatchStatusLabel> = Object.fromEntries(
  Object.entries(STATUS_TO_ENUM).map(([k, v]) => [v, k as BatchStatusLabel])
) as Record<string, BatchStatusLabel>;

// Valid transitions matching backend
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_REVIEW", "CONFIGURED", "CANCELLED"],
  PENDING_REVIEW: ["CONFIGURED", "ON_HOLD", "CANCELLED"],
  CONFIGURED: ["PERSONALISATION", "READY_TO_ORDER", "PENDING_REVIEW", "ON_HOLD", "CANCELLED"],
  PERSONALISATION: ["READY_TO_ORDER", "CONFIGURED", "ON_HOLD", "CANCELLED"],
  READY_TO_ORDER: ["ORDERED", "CONFIGURED", "ON_HOLD", "CANCELLED"],
  ORDERED: ["AWAITING_STOCK", "ON_HOLD", "CANCELLED"],
  AWAITING_STOCK: ["IN_PRODUCTION", "ON_HOLD", "CANCELLED"],
  IN_PRODUCTION: ["QC", "ON_HOLD", "CANCELLED"],
  QC: ["COMPLETE", "IN_PRODUCTION", "ON_HOLD"],
  COMPLETE: [],
  ON_HOLD: ["DRAFT", "CONFIGURED", "READY_TO_ORDER", "IN_PRODUCTION", "CANCELLED"],
  CANCELLED: [],
};

// Colours for transition buttons
const TRANSITION_STYLES: Record<string, { bg: string; fg: string }> = {
  CONFIGURED: { bg: "#3b82f6", fg: "#fff" },
  PERSONALISATION: { bg: "#8b5cf6", fg: "#fff" },
  READY_TO_ORDER: { bg: "#f59e0b", fg: "#fff" },
  ORDERED: { bg: "#6366f1", fg: "#fff" },
  AWAITING_STOCK: { bg: "#f59e0b", fg: "#fff" },
  IN_PRODUCTION: { bg: "#22c55e", fg: "#fff" },
  QC: { bg: "#06b6d4", fg: "#fff" },
  COMPLETE: { bg: "#10b981", fg: "#fff" },
  PENDING_REVIEW: { bg: "#eab308", fg: "#1e293b" },
  ON_HOLD: { bg: "#ef4444", fg: "#fff" },
  CANCELLED: { bg: "#991b1b", fg: "#fff" },
  DRAFT: { bg: "#64748b", fg: "#fff" },
};

// Primary = forward flow, secondary = backwards/hold/cancel
function isPrimaryTransition(from: string, to: string): boolean {
  const forwardFlow = [
    "DRAFT", "PENDING_REVIEW", "CONFIGURED", "PERSONALISATION",
    "READY_TO_ORDER", "ORDERED", "AWAITING_STOCK",
    "IN_PRODUCTION", "QC", "COMPLETE",
  ];
  const fromIdx = forwardFlow.indexOf(from);
  const toIdx = forwardFlow.indexOf(to);
  return toIdx > fromIdx && toIdx >= 0;
}

// ── Component ──

interface Props {
  batchId: string;
  currentStatus: BatchStatusLabel;
  notes: string | null;
  decorationMethod: string | null;
}

export function BatchActions({ batchId, currentStatus, notes: initialNotes, decorationMethod: initialMethod }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(initialNotes ?? "");
  const [editingMethod, setEditingMethod] = useState(false);
  const [methodValue, setMethodValue] = useState(initialMethod ?? "");

  const currentEnum = STATUS_TO_ENUM[currentStatus] ?? "DRAFT";
  const available = VALID_TRANSITIONS[currentEnum] ?? [];

  const primary = available.filter((t) => isPrimaryTransition(currentEnum, t));
  const secondary = available.filter((t) => !isPrimaryTransition(currentEnum, t));

  async function handleTransition(targetEnum: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", status: targetEnum }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Transition failed");
      } else {
        setSuccess(`Moved to ${ENUM_TO_STATUS[targetEnum] ?? targetEnum}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNotes() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save notes");
      } else {
        setEditingNotes(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveMethod() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decorationMethod: methodValue || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save method");
      } else {
        setEditingMethod(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Transition buttons */}
      {available.length > 0 && (
        <div className="space-y-3">
          <h4
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--text-tertiary, #64748b)" }}
          >
            Move to
          </h4>

          {/* Primary (forward) transitions */}
          {primary.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {primary.map((t) => {
                const style = TRANSITION_STYLES[t] ?? { bg: "#475569", fg: "#fff" };
                return (
                  <button
                    key={t}
                    onClick={() => handleTransition(t)}
                    disabled={busy}
                    className="rounded-md px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
                    style={{ background: style.bg, color: style.fg }}
                  >
                    {ENUM_TO_STATUS[t] ?? t}
                  </button>
                );
              })}
            </div>
          )}

          {/* Secondary (backward/hold/cancel) transitions */}
          {secondary.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {secondary.map((t) => {
                const style = TRANSITION_STYLES[t] ?? { bg: "#475569", fg: "#fff" };
                return (
                  <button
                    key={t}
                    onClick={() => handleTransition(t)}
                    disabled={busy}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                    style={{
                      background: "transparent",
                      borderColor: style.bg,
                      color: style.bg,
                    }}
                  >
                    {ENUM_TO_STATUS[t] ?? t}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {currentEnum === "COMPLETE" && (
        <p className="text-sm font-medium" style={{ color: "#22c55e" }}>
          ✓ This batch is complete
        </p>
      )}

      {currentEnum === "CANCELLED" && (
        <p className="text-sm font-medium" style={{ color: "#ef4444" }}>
          ✗ This batch has been cancelled
        </p>
      )}

      {/* Decoration method editing */}
      <div>
        <h4
          className="mb-1 text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--text-tertiary, #64748b)" }}
        >
          Decoration Method
        </h4>
        {editingMethod ? (
          <div className="flex items-center gap-2">
            <select
              value={methodValue}
              onChange={(e) => setMethodValue(e.target.value)}
              className="rounded-md border px-3 py-1.5 text-sm"
              style={{
                background: "var(--bg-base, #0f172a)",
                borderColor: "var(--border, #334155)",
                color: "var(--text-primary, #e2e8f0)",
              }}
            >
              <option value="">Not set</option>
              <option value="embroidery">Embroidery</option>
              <option value="dtf">DTF</option>
              <option value="dtg">DTG</option>
              <option value="screen_print">Screen Print</option>
              <option value="vinyl">Vinyl</option>
              <option value="sublimation">Sublimation</option>
            </select>
            <button
              onClick={handleSaveMethod}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "#3b82f6" }}
            >
              Save
            </button>
            <button
              onClick={() => { setEditingMethod(false); setMethodValue(initialMethod ?? ""); }}
              className="rounded-md px-3 py-1.5 text-sm"
              style={{ color: "var(--text-secondary, #94a3b8)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "var(--text-primary, #e2e8f0)" }}>
              {initialMethod || "Not set"}
            </span>
            <button
              onClick={() => setEditingMethod(true)}
              className="text-xs underline"
              style={{ color: "var(--accent, #6366f1)" }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Notes editing */}
      <div>
        <h4
          className="mb-1 text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--text-tertiary, #64748b)" }}
        >
          Notes
        </h4>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{
                background: "var(--bg-base, #0f172a)",
                borderColor: "var(--border, #334155)",
                color: "var(--text-primary, #e2e8f0)",
                resize: "vertical",
              }}
              placeholder="Add notes about this batch..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveNotes}
                disabled={busy}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "#3b82f6" }}
              >
                Save
              </button>
              <button
                onClick={() => { setEditingNotes(false); setNotesValue(initialNotes ?? ""); }}
                className="rounded-md px-3 py-1.5 text-sm"
                style={{ color: "var(--text-secondary, #94a3b8)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "var(--text-secondary, #94a3b8)" }}>
              {initialNotes || "No notes"}
            </span>
            <button
              onClick={() => setEditingNotes(true)}
              className="text-xs underline"
              style={{ color: "var(--accent, #6366f1)" }}
            >
              {initialNotes ? "Edit" : "Add"}
            </button>
          </div>
        )}
      </div>

      {/* Feedback messages */}
      {error && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "#ef4444", background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "#22c55e", background: "rgba(34,197,94,0.1)", color: "#86efac" }}
        >
          {success}
        </div>
      )}
    </div>
  );
}
