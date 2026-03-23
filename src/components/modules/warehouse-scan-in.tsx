"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { WarehouseReceiptTask } from "@/lib/types";

function receiptTone(status: WarehouseReceiptTask["status"]) {
  switch (status) {
    case "Complete":
      return "border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]";
    case "Partial receipt":
      return "border-[#06b6d4]/25 bg-[#06b6d4]/10 text-[#67e8f9]";
    case "Pending receipt":
    default:
      return "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fcd34d]";
  }
}

export function WarehouseScanIn({ tasks }: { tasks: WarehouseReceiptTask[] }) {
  const router = useRouter();
  const [scanInput, setScanInput] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WarehouseReceiptTask | null>(null);
  const [receivedQty, setReceivedQty] = useState("");
  const [expectedQty, setExpectedQty] = useState("");
  const [branch, setBranch] = useState("HQ");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "partial" | "complete">("pending");

  // Scan/search to find a job
  const handleScan = useCallback(() => {
    const q = scanInput.trim().toUpperCase();
    if (!q) return;

    const match = tasks.find(
      (t) => t.jobId.toUpperCase() === q || t.id === q,
    );

    if (match) {
      setSelectedTask(match);
      setExpectedQty(String(match.expectedQty));
      setReceivedQty("");
      setShowForm(true);
      setError(null);
    } else {
      setError(`No receipt found for "${scanInput}". Try a Job ID like ST-12345.`);
      setSelectedTask(null);
      setShowForm(false);
    }
  }, [scanInput, tasks]);

  // Click a task to open the form
  const selectTask = useCallback((task: WarehouseReceiptTask) => {
    setSelectedTask(task);
    setExpectedQty(String(task.expectedQty));
    setReceivedQty("");
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }, []);

  // Submit receipt
  const submitReceipt = useCallback(async () => {
    if (!selectedTask) return;
    const qty = parseInt(receivedQty, 10);
    const exp = parseInt(expectedQty, 10);
    if (!qty || qty < 0 || !exp || exp < 1) {
      setError("Enter valid received and expected quantities");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/jobs/${encodeURIComponent(selectedTask.id)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "warehouse_receipt",
          receivedQuantity: qty,
          expectedQuantity: exp,
          branch,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setError(data.error || "Receipt failed");
      } else {
        setSuccess(`✓ ${selectedTask.jobId}: Received ${qty}/${exp} — ${data.receiptStatus || "recorded"}`);
        setShowForm(false);
        setSelectedTask(null);
        setScanInput("");
        setReceivedQty("");
        setNotes("");
        setTimeout(() => router.refresh(), 800);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [selectedTask, receivedQty, expectedQty, branch, notes, router]);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return t.status === "Pending receipt";
    if (filter === "partial") return t.status === "Partial receipt";
    if (filter === "complete") return t.status === "Complete";
    return true;
  });

  const pending = tasks.filter((t) => t.status !== "Complete");

  return (
    <div className="space-y-6">
      {/* ── Scan input ── */}
      <div className="card space-y-4 px-5 py-5" style={{ border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)" }}>
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-[#a5b4fc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Scan / Search</h3>
          <span className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>{pending.length} pending</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Scan barcode or enter Job ID (e.g. ST-12345)"
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            autoFocus
          />
          <button
            onClick={handleScan}
            className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all hover:brightness-125"
            style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            Search
          </button>
        </div>

        {/* Feedback */}
        {error && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(16,185,129,0.1)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
            {success}
          </div>
        )}

        {/* Receipt form */}
        {showForm && selectedTask && (
          <div className="space-y-3 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>{selectedTask.jobId}</span>
                <span className="ml-2 text-sm" style={{ color: "var(--text-primary)" }}>{selectedTask.account}</span>
              </div>
              <span className={`pill pill--dot shrink-0 ${receiptTone(selectedTask.status)}`}>{selectedTask.status}</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Already received: {selectedTask.receivedQty} / {selectedTask.expectedQty}
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--text-tertiary)" }}>Received qty</label>
                <input
                  type="number" min={0} value={receivedQty} onChange={(e) => setReceivedQty(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="0"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--text-tertiary)" }}>Expected qty</label>
                <input
                  type="number" min={1} value={expectedQty} onChange={(e) => setExpectedQty(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--text-tertiary)" }}>Branch</label>
                <select
                  value={branch} onChange={(e) => setBranch(e.target.value)}
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
                  type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Optional"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={submitReceipt}
                disabled={loading}
                className="rounded-lg px-5 py-2 text-xs font-medium transition-all hover:brightness-125 disabled:opacity-50"
                style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.3)" }}
              >
                {loading ? "Recording..." : "✓ Confirm receipt"}
              </button>
              <button
                onClick={() => { setShowForm(false); setSelectedTask(null); }}
                className="rounded-lg px-5 py-2 text-xs font-medium transition-all hover:brightness-125"
                style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1">
        {(["pending", "partial", "complete", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: filter === f ? "rgba(99,102,241,0.15)" : "transparent",
              color: filter === f ? "#a5b4fc" : "var(--text-tertiary)",
              border: `1px solid ${filter === f ? "rgba(99,102,241,0.3)" : "transparent"}`,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && ` (${tasks.filter((t) => t.status === "Pending receipt").length})`}
            {f === "partial" && ` (${tasks.filter((t) => t.status === "Partial receipt").length})`}
          </button>
        ))}
      </div>

      {/* ── Receipt list ── */}
      {filteredTasks.length === 0 ? (
        <div className="surface p-5 text-sm" style={{ color: "var(--text-tertiary)" }}>No receipts in this view.</div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <article
              key={task.id}
              className="card cursor-pointer px-4 py-3.5 transition-all hover:brightness-110"
              onClick={() => selectTask(task)}
            >
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>{task.jobId}</span>
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>•</span>
                    <span className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{task.account}</span>
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{task.receivedQty}/{task.expectedQty} scanned · {task.branch}</p>
                </div>
                <span className={`pill pill--dot shrink-0 ${receiptTone(task.status)}`}>{task.status}</span>
                <div className="hidden min-w-[80px] text-right sm:block">
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{task.lastScan}</p>
                </div>
                <svg className="h-4 w-4 shrink-0 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
