"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ── Types ── */

interface JobActionsProps {
  jobId: string;
  lifecycle: string;
  classificationStatus: string;
  configurationStatus: string;
  stockStatus: string;
  productionStatus: string;
  approvalStatus: string;
  fulfillmentStatus: string;
  assignedDepartment: string | null;
  requiresReview: boolean;
  source: string;
  shopifyOrderId: string | null;
  totalItems: number;
}

/* ── Transition map (what buttons to show per lifecycle) ── */

type ActionDef = {
  label: string;
  action: string;
  payload: Record<string, unknown>;
  tone: "primary" | "success" | "warning" | "danger" | "ghost";
  confirm?: string;
};

function getAvailableActions(p: JobActionsProps): ActionDef[] {
  const actions: ActionDef[] = [];
  const lc = p.lifecycle;

  // Review accept/dismiss
  if (p.requiresReview) {
    actions.push({
      label: "Accept & classify",
      action: "review",
      payload: { accepted: true },
      tone: "success",
    });
  }

  // Lifecycle transitions based on current state
  switch (lc) {
    case "INGESTED":
      actions.push({
        label: "Classify",
        action: "transition",
        payload: { target: "classified", force: true },
        tone: "primary",
      });
      break;

    case "CLASSIFIED":
      actions.push({
        label: "Mark configured",
        action: "transition",
        payload: { target: "configured", force: true },
        tone: "primary",
      });
      break;

    case "CONFIGURED":
      actions.push({
        label: "Send to Deco",
        action: "transition",
        payload: { target: "pushed_to_deco", force: true },
        tone: "primary",
      });
      actions.push({
        label: "Awaiting stock",
        action: "transition",
        payload: { target: "awaiting_stock", force: true },
        tone: "warning",
      });
      break;

    case "PUSHED_TO_DECO":
      actions.push({
        label: "Awaiting stock",
        action: "transition",
        payload: { target: "awaiting_stock", force: true },
        tone: "primary",
      });
      break;

    case "AWAITING_STOCK":
      actions.push({
        label: "Stock received",
        action: "transition",
        payload: { target: "stock_received", force: true },
        tone: "success",
      });
      break;

    case "STOCK_RECEIVED":
      actions.push({
        label: "Queue for production",
        action: "transition",
        payload: { target: "production_queued", force: true },
        tone: "primary",
      });
      break;

    case "PRODUCTION_QUEUED":
      actions.push({
        label: "Start production",
        action: "transition",
        payload: { target: "in_production", force: true },
        tone: "primary",
      });
      break;

    case "IN_PRODUCTION":
      actions.push({
        label: "Mark complete",
        action: "transition",
        payload: { target: "completed" },
        tone: "success",
        confirm: "Mark this job as complete? This will trigger fulfillment.",
      });
      break;

    case "ON_HOLD":
      actions.push({
        label: "Resume → Classified",
        action: "transition",
        payload: { target: "classified" },
        tone: "primary",
      });
      actions.push({
        label: "Resume → Awaiting stock",
        action: "transition",
        payload: { target: "awaiting_stock" },
        tone: "primary",
      });
      break;
  }

  // Put on hold / cancel (always available except terminal states)
  if (lc !== "COMPLETED" && lc !== "CANCELLED") {
    if (lc !== "ON_HOLD") {
      actions.push({
        label: "Put on hold",
        action: "transition",
        payload: { target: "on_hold" },
        tone: "warning",
      });
    }
    actions.push({
      label: "Cancel",
      action: "transition",
      payload: { target: "cancelled" },
      tone: "danger",
      confirm: "Cancel this job? This cannot be undone.",
    });
  }

  return actions;
}

/* ── Production routing options ── */

function getProductionActions(p: JobActionsProps): ActionDef[] {
  const actions: ActionDef[] = [];
  const ps = p.productionStatus;

  if (ps === "NOT_READY" && (p.lifecycle === "STOCK_RECEIVED" || p.lifecycle === "PRODUCTION_QUEUED")) {
    // Queue to a department
    actions.push(
      { label: "Queue → Embroidery", action: "production_route", payload: { department: "embroidery", lane: "queued" }, tone: "primary" },
      { label: "Queue → DTF", action: "production_route", payload: { department: "dtf", lane: "queued" }, tone: "primary" },
    );
  }

  if (ps.startsWith("QUEUED_")) {
    const dept = ps === "QUEUED_EMBROIDERY" ? "embroidery" : ps === "QUEUED_DTF" ? "dtf" : "mixed";
    actions.push({
      label: "Start production",
      action: "production_route",
      payload: { department: dept, lane: "in_progress" },
      tone: "primary",
    });
  }

  if (ps.startsWith("IN_")) {
    const dept = ps === "IN_EMBROIDERY" ? "embroidery" : ps === "IN_DTF" ? "dtf" : "mixed";
    actions.push(
      { label: "Send to QC", action: "production_route", payload: { department: dept, lane: "qc" }, tone: "warning" },
      { label: "Mark complete", action: "production_route", payload: { department: dept, lane: "complete" }, tone: "success" },
    );
  }

  if (ps === "QC") {
    const dept = p.assignedDepartment?.toLowerCase() || "embroidery";
    actions.push(
      { label: "QC passed → Complete", action: "production_route", payload: { department: dept, lane: "complete" }, tone: "success" },
      { label: "QC failed → Redo", action: "production_route", payload: { department: dept, lane: "in_progress" }, tone: "danger" },
    );
  }

  return actions;
}

/* ── Button styling ── */

function btnStyle(tone: ActionDef["tone"]): React.CSSProperties {
  switch (tone) {
    case "primary":
      return { background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" };
    case "success":
      return { background: "rgba(16,185,129,0.15)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.3)" };
    case "warning":
      return { background: "rgba(245,158,11,0.15)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.3)" };
    case "danger":
      return { background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" };
    default:
      return { background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid var(--border)" };
  }
}

/* ── Component ── */

export function JobActions(props: JobActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Warehouse receipt state
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptQty, setReceiptQty] = useState("");
  const [expectedQty, setExpectedQty] = useState(String(props.totalItems));
  const [receiptBranch, setReceiptBranch] = useState("HQ");
  const [receiptNotes, setReceiptNotes] = useState("");

  const callAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const res = await fetch(`/api/v1/jobs/${encodeURIComponent(props.jobId)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || data.reasons?.join(", ") || "Action failed");
      }
      return data;
    },
    [props.jobId],
  );

  const execAction = useCallback(async (act: ActionDef) => {
    if (act.confirm && !window.confirm(act.confirm)) return;

    setLoading(act.label);
    setError(null);
    setSuccessMsg(null);

    try {
      // "Classify" needs a two-step flow: set sub-status first, then transition
      if (
        act.action === "transition" &&
        act.payload.target === "classified" &&
        props.classificationStatus !== "CLASSIFIED_READY" &&
        props.classificationStatus !== "ACCOUNT_MATCHED"
      ) {
        await callAction("substatus", { classificationStatus: "CLASSIFIED_READY" });
      }

      // "Mark configured" — set configuration sub-status if not already ready
      if (
        act.action === "transition" &&
        act.payload.target === "configured" &&
        props.configurationStatus !== "READY_FOR_CONFIRMATION" &&
        props.configurationStatus !== "CONFIRMED" &&
        props.configurationStatus !== "PUSHED_TO_DECO"
      ) {
        await callAction("substatus", { configurationStatus: "CONFIRMED" });
      }

      await callAction(act.action, act.payload);
      setSuccessMsg(`${act.label} — done`);
      setTimeout(() => router.refresh(), 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(null);
    }
  }, [props.jobId, props.classificationStatus, props.configurationStatus, router, callAction]);

  const submitReceipt = useCallback(async () => {
    const qty = parseInt(receiptQty, 10);
    const exp = parseInt(expectedQty, 10);
    if (!qty || qty < 0 || !exp || exp < 1) {
      setError("Enter valid received and expected quantities");
      return;
    }

    setLoading("receipt");
    setError(null);

    try {
      const res = await fetch(`/api/v1/jobs/${encodeURIComponent(props.jobId)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "warehouse_receipt",
          receivedQuantity: qty,
          expectedQuantity: exp,
          branch: receiptBranch,
          notes: receiptNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setError(data.error || "Receipt failed");
      } else {
        setSuccessMsg(`Received ${qty}/${exp} — ${data.receiptStatus || "recorded"}`);
        setShowReceiptForm(false);
        setReceiptQty("");
        setReceiptNotes("");
        setTimeout(() => router.refresh(), 500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(null);
    }
  }, [props.jobId, receiptQty, expectedQty, receiptBranch, receiptNotes, router]);

  const lifecycleActions = getAvailableActions(props);
  const productionActions = getProductionActions(props);
  const showWarehouse = ["AWAITING_STOCK", "STOCK_RECEIVED"].includes(props.lifecycle) ||
    ["ORDERED", "AWAITING_ARRIVAL", "PARTIALLY_RECEIVED"].includes(props.stockStatus);

  if (lifecycleActions.length === 0 && productionActions.length === 0 && !showWarehouse) return null;

  return (
    <div className="card space-y-4 px-5 py-5" style={{ border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)" }}>
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-[#a5b4fc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Actions</h3>
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(16,185,129,0.1)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
          {successMsg}
        </div>
      )}

      {/* Lifecycle actions */}
      {lifecycleActions.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>Workflow</p>
          <div className="flex flex-wrap gap-2">
            {lifecycleActions.map((act) => (
              <button
                key={act.label}
                onClick={() => execAction(act)}
                disabled={loading !== null}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:brightness-125 disabled:opacity-50"
                style={btnStyle(act.tone)}
              >
                {loading === act.label ? "..." : act.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Production routing */}
      {productionActions.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>Production</p>
          <div className="flex flex-wrap gap-2">
            {productionActions.map((act) => (
              <button
                key={act.label}
                onClick={() => execAction(act)}
                disabled={loading !== null}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:brightness-125 disabled:opacity-50"
                style={btnStyle(act.tone)}
              >
                {loading === act.label ? "..." : act.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Warehouse receipt */}
      {showWarehouse && (
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>Warehouse</p>
          {!showReceiptForm ? (
            <button
              onClick={() => setShowReceiptForm(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:brightness-125"
              style={btnStyle("primary")}
            >
              📦 Record goods received
            </button>
          ) : (
            <div className="space-y-3 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--text-tertiary)" }}>Received qty</label>
                  <input
                    type="number" min={0} value={receiptQty} onChange={(e) => setReceiptQty(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="0"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--text-tertiary)" }}>Expected qty</label>
                  <input
                    type="number" min={1} value={expectedQty} onChange={(e) => setExpectedQty(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="1"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--text-tertiary)" }}>Branch</label>
                  <select
                    value={receiptBranch} onChange={(e) => setReceiptBranch(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="HQ">HQ</option>
                    <option value="Warehouse A">Warehouse A</option>
                    <option value="Warehouse B">Warehouse B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--text-tertiary)" }}>Notes</label>
                  <input
                    type="text" value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Optional"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={submitReceipt}
                  disabled={loading !== null}
                  className="rounded-lg px-4 py-2 text-xs font-medium transition-all hover:brightness-125 disabled:opacity-50"
                  style={btnStyle("success")}
                >
                  {loading === "receipt" ? "Recording..." : "Confirm receipt"}
                </button>
                <button
                  onClick={() => setShowReceiptForm(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium transition-all hover:brightness-125"
                  style={btnStyle("ghost")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
