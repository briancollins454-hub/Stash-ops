"use client";

import { useState } from "react";

interface BulkImportResult {
  accountsProcessed: number;
  accountsWithArtwork: number;
  totalImported: number;
  totalSkipped: number;
  uniqueDecoCustomers: number;
  errors?: string[];
  error?: string;
  note?: string;
}

export function BulkDecoArtworkImporter() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const handleImport = async () => {
    if (!confirm("This will import Deco artwork for ALL accounts with a Deco customer ID. This may take a few minutes. Continue?")) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/accounts/bulk-import-deco-artwork", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Import failed", accountsProcessed: 0, accountsWithArtwork: 0, totalImported: 0, totalSkipped: 0, uniqueDecoCustomers: 0 });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Scans all accounts with a Deco customer ID, fetches their artwork from DecoNetwork, and saves
        it as permanent account assets. Accounts without artwork are skipped. Already-imported designs
        are deduplicated.
      </p>

      <button
        onClick={handleImport}
        disabled={running}
        className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:brightness-125 disabled:opacity-50"
        style={{
          background: running ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
          color: running ? "#fbbf24" : "#6ee7b7",
          border: `1px solid ${running ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`,
        }}
      >
        {running ? "⏳ Importing — this may take a few minutes..." : "⬇ Import All Deco Artwork"}
      </button>

      {result && !result.error && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {result.totalImported > 0 ? "✓ Import complete" : "Import complete — nothing new to import"}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Accounts scanned" value={result.accountsProcessed} />
            <Stat label="With artwork" value={result.accountsWithArtwork} />
            <Stat label="Designs imported" value={result.totalImported} highlight />
            <Stat label="Already existed" value={result.totalSkipped} />
          </div>

          {result.errors && result.errors.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#fca5a5" }}>
                Errors ({result.errors.length})
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>{e}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium"
          style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          ✗ {result.error}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p
        className="text-xl font-bold"
        style={{ color: highlight && value > 0 ? "#6ee7b7" : "var(--text-primary)" }}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{label}</p>
    </div>
  );
}
