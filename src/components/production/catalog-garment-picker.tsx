"use client";

import { useState, useCallback } from "react";

interface CatalogResult {
  styleCode: string;
  brand: string;
  name: string;
  productType: string | null;
  colourCount: number;
}

interface Props {
  /** Pre-filled search term (e.g. garment keywords from the batch title). */
  initialQuery?: string;
  onSelect: (styleCode: string, product: CatalogResult) => void;
  onCancel: () => void;
}

/**
 * Search the supplier catalog and pick a blank garment.
 * Used when the batch decorator can't auto-match a product.
 */
export function CatalogGarmentPicker({ initialQuery = "", onSelect, onCancel }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/decorator/catalog-search?q=${encodeURIComponent(q.trim())}&limit=20`);
      const data = await res.json();
      setResults(data.items ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-6 shadow-2xl"
        style={{ background: "var(--bg-raised, #1e293b)", borderColor: "var(--border, #334155)" }}
      >
        <h3 className="mb-1 text-base font-semibold" style={{ color: "var(--text-primary, #e2e8f0)" }}>
          Select Blank Garment
        </h3>
        <p className="mb-4 text-xs" style={{ color: "var(--text-tertiary, #64748b)" }}>
          Search the supplier catalog by style code, brand, or garment name to find the plain garment for this batch.
        </p>

        {/* Search bar */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
            placeholder="e.g. JH001, AWDis Hoodie, Canterbury Polo..."
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{
              background: "var(--bg-base, #0f172a)",
              borderColor: "var(--border, #334155)",
              color: "var(--text-primary, #e2e8f0)",
            }}
            autoFocus
          />
          <button
            onClick={() => doSearch(query)}
            disabled={searching || !query.trim()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--accent, #6366f1)" }}
          >
            {searching ? "..." : "Search"}
          </button>
        </div>

        {/* Results */}
        <div
          className="max-h-72 overflow-y-auto rounded-md border"
          style={{ borderColor: "var(--border, #334155)" }}
        >
          {results.length > 0 ? (
            results.map((r) => (
              <button
                key={r.styleCode}
                onClick={() => onSelect(r.styleCode, r)}
                className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border, #334155)" }}
              >
                <span
                  className="shrink-0 rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-300"
                >
                  {r.styleCode}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" style={{ color: "var(--text-primary, #e2e8f0)" }}>
                    {r.name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary, #64748b)" }}>
                    {r.brand} &middot; {r.productType ?? "Garment"} &middot; {r.colourCount} colours
                  </div>
                </div>
              </button>
            ))
          ) : searched ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-tertiary, #64748b)" }}>
              No garments found. Try a different search term.
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-tertiary, #64748b)" }}>
              Search for a garment to see results.
            </div>
          )}
        </div>

        {/* Cancel */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium"
            style={{ color: "var(--text-secondary, #94a3b8)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
