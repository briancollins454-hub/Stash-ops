"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { useRouter } from "next/navigation";

type BulkCancelContextType = {
  enabled: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearAll: () => void;
};

const BulkCancelContext = createContext<BulkCancelContextType>({
  enabled: false,
  selected: new Set(),
  toggle: () => {},
  selectAll: () => {},
  clearAll: () => {},
});

export function useBulkCancel() {
  return useContext(BulkCancelContext);
}

export function BulkCancelProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ succeeded: number; failed: number } | null>(null);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }, []);

  const clearAll = useCallback(() => setSelected(new Set()), []);

  const executeBulkCancel = useCallback(async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Cancel ${selected.size} job(s)? This will cancel them everywhere — including Deco. This cannot be undone.`)) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/v1/jobs/bulk-cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobIds: Array.from(selected), actor: "stash-ui" }),
      });
      const data = await res.json();
      setResult({ succeeded: data.succeeded ?? 0, failed: data.failed ?? 0 });
      setSelected(new Set());
      setTimeout(() => router.refresh(), 800);
    } catch {
      setResult({ succeeded: 0, failed: selected.size });
    } finally {
      setLoading(false);
    }
  }, [selected, router]);

  return (
    <BulkCancelContext.Provider value={{ enabled, selected, toggle, selectAll, clearAll }}>
      {children}

      {/* Floating bar */}
      <div
        className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-5 py-3 shadow-2xl"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--border)",
          display: enabled || result ? "flex" : "none",
        }}
      >
        {result && (
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-medium"
              style={{ color: result.failed > 0 ? "#fca5a5" : "#6ee7b7" }}
            >
              {result.succeeded} cancelled{result.failed > 0 ? `, ${result.failed} failed` : ""}
            </span>
            <button
              onClick={() => {
                setResult(null);
                setEnabled(false);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
            >
              Dismiss
            </button>
          </div>
        )}

        {!result && !enabled && null}

        {!result && enabled && (
          <>
            <span className="text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
              {selected.size} selected
            </span>

            <button
              onClick={executeBulkCancel}
              disabled={selected.size === 0 || loading}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-40"
              style={{
                background: "rgba(239,68,68,0.15)",
                color: "#fca5a5",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              {loading ? "Cancelling…" : `Cancel ${selected.size} job(s)`}
            </button>

            <button
              onClick={() => {
                setEnabled(false);
                setSelected(new Set());
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
            >
              Exit
            </button>
          </>
        )}
      </div>

      {/* Toggle button — always visible in bottom-right */}
      {!enabled && !result && (
        <button
          onClick={() => setEnabled(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium shadow-lg transition-all hover:brightness-125"
          style={{
            background: "rgba(239,68,68,0.12)",
            color: "#fca5a5",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Bulk Cancel
        </button>
      )}
    </BulkCancelContext.Provider>
  );
}
