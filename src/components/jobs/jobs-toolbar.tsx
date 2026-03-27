"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

const TABS = [
  { key: "all", label: "All" },
  { key: "deco", label: "Deco" },
  { key: "shopify", label: "Shopify" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "New", label: "New" },
  { value: "In Progress", label: "In Progress" },
  { value: "Complete", label: "Complete" },
  { value: "On hold", label: "On Hold" },
  { value: "Cancelled", label: "Cancelled" },
];

interface LaneCounts {
  new: number;
  inProgress: number;
  readyToShip: number;
  shipped: number;
  onHold: number;
  cancelled: number;
}

export function JobsToolbar({
  activeTab,
  counts,
  laneCounts,
  totalFiltered,
  searchQuery,
  statusFilter,
  sourceFilter,
}: {
  activeTab: string;
  counts: Record<string, number>;
  laneCounts: LaneCounts;
  totalFiltered: number;
  searchQuery: string;
  statusFilter: string;
  sourceFilter: string | undefined;
}) {
  const router = useRouter();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = {
        tab: activeTab !== "all" ? activeTab : "",
        q: searchQuery,
        status: statusFilter,
        source: sourceFilter ?? "",
        ...overrides,
      };
      for (const [k, v] of Object.entries(merged)) {
        if (v) params.set(k, v);
      }
      const qs = params.toString();
      return qs ? `/jobs?${qs}` : "/jobs";
    },
    [activeTab, searchQuery, statusFilter, sourceFilter],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ q: localSearch.trim() }));
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Source tabs + search + status filter */}
      <div className="surface p-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tabs */}
          <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: "var(--bg)" }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = counts[tab.key] ?? 0;
              return (
                <Link
                  key={tab.key}
                  href={buildUrl({ tab: tab.key === "all" ? "" : tab.key })}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? "var(--accent-soft)" : "transparent",
                    color: isActive ? "var(--accent-light)" : "var(--text-tertiary)",
                  }}
                >
                  {tab.label}
                  <span
                    className="rounded px-1 py-px text-[10px] tabular-nums font-bold"
                    style={{
                      background: isActive ? "var(--accent)" : "rgba(255,255,255,0.06)",
                      color: isActive ? "#fff" : "var(--text-tertiary)",
                    }}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--text-tertiary)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search jobs by ID, company, or customer..."
                className="w-full rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none transition-all focus:ring-1 focus:ring-[var(--accent)]"
                style={{
                  background: "var(--bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => { setLocalSearch(""); router.push(buildUrl({ q: "" })); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </form>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => router.push(buildUrl({ status: e.target.value }))}
            className="rounded-lg px-3 py-1.5 text-xs outline-none cursor-pointer"
            style={{
              background: "var(--bg)",
              color: statusFilter ? "var(--accent-light)" : "var(--text-secondary)",
              border: `1px solid ${statusFilter ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: "var(--bg-raised)" }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Pipeline summary strip */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "New", count: laneCounts.new, color: "#6366f1" },
          { label: "In Progress", count: laneCounts.inProgress, color: "#f59e0b" },
          { label: "Ready", count: laneCounts.readyToShip, color: "#10b981" },
          { label: "Shipped", count: laneCounts.shipped, color: "#06b6d4" },
          { label: "On Hold", count: laneCounts.onHold, color: "#8b5cf6" },
          { label: "Cancelled", count: laneCounts.cancelled, color: "#ef4444" },
        ].filter((l) => l.count > 0).map((lane) => (
          <Link
            key={lane.label}
            href={buildUrl({ status: lane.label === "Ready" ? "Complete" : lane.label === "In Progress" ? "In Progress" : lane.label })}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all hover:brightness-125"
            style={{
              background: `${lane.color}12`,
              border: `1px solid ${lane.color}30`,
              color: lane.color,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: lane.color }} />
            {lane.label}
            <span className="font-bold tabular-nums">{lane.count}</span>
          </Link>
        ))}
        <span className="flex items-center text-[11px] ml-auto" style={{ color: "var(--text-tertiary)" }}>
          {totalFiltered} total
        </span>
      </div>
    </div>
  );
}
