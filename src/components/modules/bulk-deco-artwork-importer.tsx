"use client";

import { useEffect, useState } from "react";

interface ArtworkStats {
  totalAssets: number;
  archived: number;
  external: number;
  noImage: number;
  accountsWithArtwork: number;
}

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

interface ArchiveResult {
  archived: number;
  failed: number;
  total: number;
  errors?: string[];
  error?: string;
  note?: string;
}

export function BulkDecoArtworkImporter() {
  const [stats, setStats] = useState<ArtworkStats | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<ArchiveResult | null>(null);

  const loadStats = async () => {
    try {
      const res = await fetch("/api/v1/accounts/artwork-stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { loadStats(); }, []);

  const handleImport = async () => {
    if (!confirm("This will import Deco artwork for ALL accounts with a Deco customer ID. This may take a few minutes. Continue?")) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/accounts/bulk-import-deco-artwork", { method: "POST" });
      const data = await res.json();
      setResult(data);
      loadStats();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Import failed", accountsProcessed: 0, accountsWithArtwork: 0, totalImported: 0, totalSkipped: 0, uniqueDecoCustomers: 0 });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Persistent stats from DB */}
      {stats && (
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#a5b4fc" }}>
            Current artwork inventory
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total designs" value={stats.totalAssets} />
            <Stat label="Archived (self-contained)" value={stats.archived} highlight />
            <Stat label="Still on Deco CDN" value={stats.external} warn={stats.external > 0} />
            <Stat label="Accounts with artwork" value={stats.accountsWithArtwork} />
          </div>
        </div>
      )}

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

      {/* Step 2: Archive images locally */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            Archive images permanently
          </p>
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Downloads every artwork image from Deco&apos;s CDN and stores it directly in the database.
            After archiving, artwork no longer depends on Deco — images are fully self-contained.
          </p>
        </div>

        <button
          onClick={async () => {
            if (!confirm("This will download all artwork images from Deco and store them in your database. This may take a few minutes. Continue?")) return;
            setArchiving(true);
            setArchiveResult(null);
            try {
              const res = await fetch("/api/v1/accounts/archive-artwork-images", { method: "POST" });
              const data = await res.json();
              setArchiveResult(data);
              loadStats();
            } catch (err) {
              setArchiveResult({ error: err instanceof Error ? err.message : "Archive failed", archived: 0, failed: 0, total: 0 });
            } finally {
              setArchiving(false);
            }
          }}
          disabled={archiving}
          className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:brightness-125 disabled:opacity-50"
          style={{
            background: archiving ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.15)",
            color: archiving ? "#fbbf24" : "#a5b4fc",
            border: `1px solid ${archiving ? "rgba(245,158,11,0.3)" : "rgba(99,102,241,0.3)"}`,
          }}
        >
          {archiving ? "⏳ Downloading images — this may take a few minutes..." : "💾 Archive All Images to Database"}
        </button>

        {archiveResult && !archiveResult.error && (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <Stat label="Archived" value={archiveResult.archived} highlight />
            <Stat label="Failed" value={archiveResult.failed} />
            <Stat label="Total" value={archiveResult.total} />
          </div>
        )}

        {archiveResult?.error && (
          <div
            className="rounded-lg px-4 py-3 text-sm font-medium"
            style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            ✗ {archiveResult.error}
          </div>
        )}

        {archiveResult?.errors && archiveResult.errors.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#fca5a5" }}>
              Failed downloads ({archiveResult.errors.length})
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {archiveResult.errors.map((e, i) => (
                <p key={i} className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>{e}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, warn }: { label: string; value: number; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="text-center">
      <p
        className="text-xl font-bold"
        style={{ color: warn ? "#fbbf24" : highlight && value > 0 ? "#6ee7b7" : "var(--text-primary)" }}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{label}</p>
    </div>
  );
}
